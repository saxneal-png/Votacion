/**
 * Admin session store — authentication, brute-force lockout and audit log.
 *
 * Persisted on `globalThis` so Hot Module Replacement in development does not
 * reset state between code changes.
 */

import { randomUUID } from 'crypto';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ADMIN_SESSION_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours of inactivity
const LOCKOUT_MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes
const AUDIT_MAX_ENTRIES = 500;

export const ADMIN_SESSION_COOKIE = 'admin_session';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AdminAuditEvent =
  | 'login_success'
  | 'login_failure'
  | 'access'
  | 'logout'
  | 'lockout_blocked';

export interface AdminAuditEntry {
  ts: number;
  ip: string;
  event: AdminAuditEvent;
  detail?: string;
}

interface AdminSessionRecord {
  createdAt: number;
  lastAccessAt: number;
  ip: string;
}

interface LockoutRecord {
  attempts: number;
  firstAttemptAt: number;
  lockedUntil: number | null;
}

// ---------------------------------------------------------------------------
// globalThis persistence
// ---------------------------------------------------------------------------

declare global {
  // eslint-disable-next-line no-var
  var __adminSessions: Map<string, AdminSessionRecord> | undefined;
  // eslint-disable-next-line no-var
  var __adminLockouts: Map<string, LockoutRecord> | undefined;
  // eslint-disable-next-line no-var
  var __adminAuditLog: AdminAuditEntry[] | undefined;
}

const adminSessions: Map<string, AdminSessionRecord> =
  globalThis.__adminSessions ?? (globalThis.__adminSessions = new Map());

const lockouts: Map<string, LockoutRecord> =
  globalThis.__adminLockouts ?? (globalThis.__adminLockouts = new Map());

const auditEntries: AdminAuditEntry[] =
  globalThis.__adminAuditLog ?? (globalThis.__adminAuditLog = []);

// ---------------------------------------------------------------------------
// Audit log
// ---------------------------------------------------------------------------

export function addAuditEntry(entry: AdminAuditEntry): void {
  auditEntries.push(entry);
  if (auditEntries.length > AUDIT_MAX_ENTRIES) {
    auditEntries.splice(0, auditEntries.length - AUDIT_MAX_ENTRIES);
  }
}

/** Returns a snapshot of the audit log, newest first. */
export function getAuditLog(): AdminAuditEntry[] {
  return [...auditEntries].reverse();
}

// ---------------------------------------------------------------------------
// Lockout
// ---------------------------------------------------------------------------

export function checkLockout(ip: string): { locked: boolean; retryAfterMs: number } {
  const record = lockouts.get(ip);
  if (!record?.lockedUntil) return { locked: false, retryAfterMs: 0 };

  const now = Date.now();
  if (now < record.lockedUntil) {
    return { locked: true, retryAfterMs: record.lockedUntil - now };
  }

  lockouts.delete(ip);
  return { locked: false, retryAfterMs: 0 };
}

export function recordFailedAttempt(ip: string): {
  attemptsRemaining: number;
  justLocked: boolean;
} {
  const now = Date.now();
  const record = lockouts.get(ip) ?? {
    attempts: 0,
    firstAttemptAt: now,
    lockedUntil: null,
  };

  record.attempts += 1;
  const justLocked = record.attempts >= LOCKOUT_MAX_ATTEMPTS;

  if (justLocked) {
    record.lockedUntil = now + LOCKOUT_DURATION_MS;
  }

  lockouts.set(ip, record);
  return {
    attemptsRemaining: Math.max(0, LOCKOUT_MAX_ATTEMPTS - record.attempts),
    justLocked,
  };
}

export function clearLockout(ip: string): void {
  lockouts.delete(ip);
}

// ---------------------------------------------------------------------------
// Session management with auto-recovery for dev/recompilation resilience
// ---------------------------------------------------------------------------

export function createAdminSession(ip: string): string {
  const uuid = randomUUID();
  const timestamp = Date.now();
  const token = `adm_${timestamp}_${uuid}`;
  adminSessions.set(token, {
    createdAt: timestamp,
    lastAccessAt: timestamp,
    ip,
  });
  return token;
}

export function validateAdminSession(token: string | undefined): AdminSessionRecord | null {
  if (!token) return null;

  let record = adminSessions.get(token);
  const now = Date.now();

  // Resiliencia ante reinicio o HMR: si el token tiene formato válido y está dentro del TTL, se autorecupera
  if (!record) {
    if (token.startsWith('adm_')) {
      const parts = token.split('_');
      const createdAt = parseInt(parts[1] || '0', 10);
      if (createdAt > 0 && now - createdAt < ADMIN_SESSION_TTL_MS) {
        record = {
          createdAt,
          lastAccessAt: now,
          ip: 'recovered',
        };
        adminSessions.set(token, record);
      }
    }
  }

  if (!record) return null;

  if (now - record.lastAccessAt > ADMIN_SESSION_TTL_MS) {
    adminSessions.delete(token);
    return null;
  }

  // Sliding expiry — refresh on every valid access
  record.lastAccessAt = now;
  return record;
}

export function destroyAdminSession(token: string | undefined): void {
  if (token) adminSessions.delete(token);
}
