import { randomUUID } from 'crypto';

export const SESSION_COOKIE_NAME = 'voting_session';

interface SessionRecord {
  userRut: string;
  otpVerified: boolean;
  otpAttempts: number;
  createdAt: number;
}

const MAX_OTP_ATTEMPTS = 3;

const SESSION_TTL_MS = 10 * 60 * 1000;

// In development, Next.js Hot Module Replacement re-evaluates this module on
// every rebuild, which would reset the in-memory Maps and lose all active sessions.
// Storing them on `globalThis` keeps them alive across hot reloads.
declare global {
  // eslint-disable-next-line no-var
  var __votingSessionStore: Map<string, SessionRecord> | undefined;
  // eslint-disable-next-line no-var
  var __votingVotedUsers: Set<string> | undefined;
}

const sessionStore: Map<string, SessionRecord> =
  globalThis.__votingSessionStore ??
  (globalThis.__votingSessionStore = new Map());

const votedUsers: Set<string> =
  globalThis.__votingVotedUsers ??
  (globalThis.__votingVotedUsers = new Set());

function isSessionExpired(record: SessionRecord) {
  return Date.now() - record.createdAt > SESSION_TTL_MS;
}

export function createSession(userRut: string) {
  const sessionId = randomUUID();
  sessionStore.set(sessionId, {
    userRut,
    otpVerified: false,
    otpAttempts: 0,
    createdAt: Date.now(),
  });
  return sessionId;
}

export function getSession(sessionId: string | undefined) {
  if (!sessionId) return null;

  const session = sessionStore.get(sessionId);
  if (!session) return null;

  if (isSessionExpired(session)) {
    sessionStore.delete(sessionId);
    return null;
  }

  return session;
}

export function markOtpVerified(sessionId: string) {
  const session = sessionStore.get(sessionId);
  if (!session) return;

  session.otpVerified = true;
}

/**
 * Increments the OTP failure counter for a session.
 * Returns the new count. The caller is responsible for destroying the session
 * when the count reaches MAX_OTP_ATTEMPTS.
 * Returns MAX_OTP_ATTEMPTS + 1 if the session no longer exists.
 */
export function incrementOtpAttempts(sessionId: string): number {
  const session = sessionStore.get(sessionId);
  if (!session) return MAX_OTP_ATTEMPTS + 1;

  session.otpAttempts += 1;
  return session.otpAttempts;
}

export { MAX_OTP_ATTEMPTS };

export function destroySession(sessionId: string | undefined) {
  if (!sessionId) return;
  sessionStore.delete(sessionId);
}

export function hasUserVoted(userRut: string) {
  return votedUsers.has(userRut);
}

export function markUserAsVoted(userRut: string) {
  votedUsers.add(userRut);
}

export function clearVotedUsers() {
  votedUsers.clear();
}