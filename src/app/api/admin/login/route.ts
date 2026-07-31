import { timingSafeEqual } from 'crypto';

import { type NextRequest, NextResponse } from 'next/server';

import {
  ADMIN_SESSION_COOKIE,
  addAuditEntry,
  checkLockout,
  clearLockout,
  createAdminSession,
  recordFailedAttempt,
} from '@/lib/admin-session';

const CONFIGURED_PIN = process.env.ADMIN_PIN;

/**
 * Constant-time PIN verification.
 * Returns false immediately when lengths differ (after a dummy comparison to
 * prevent early-exit timing leakage).
 */
function verifyPin(provided: string): boolean {
  // Fail closed in production when ADMIN_PIN is not configured.
  if (!CONFIGURED_PIN) {
    if (process.env.NODE_ENV === 'production') return false;
    // Development convenience: any non-empty value is accepted.
    return provided.trim().length > 0;
  }

  const buf1 = Buffer.from(provided);
  const buf2 = Buffer.from(CONFIGURED_PIN);

  if (buf1.length !== buf2.length) {
    // Perform a dummy comparison to avoid leaking length via timing.
    timingSafeEqual(Buffer.alloc(buf1.length), Buffer.alloc(buf1.length));
    return false;
  }

  return timingSafeEqual(buf1, buf2);
}

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    'unknown'
  );
}

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);

  // Check brute-force lockout before doing any work.
  const lockoutStatus = checkLockout(ip);
  if (lockoutStatus.locked) {
    const retryAfterSec = Math.ceil(lockoutStatus.retryAfterMs / 1000);
    addAuditEntry({ ts: Date.now(), ip, event: 'lockout_blocked' });
    return NextResponse.json(
      {
        message: `Acceso bloqueado por exceso de intentos. Intenta en ${Math.ceil(retryAfterSec / 60)} min.`,
      },
      { status: 429, headers: { 'Retry-After': String(retryAfterSec) } },
    );
  }

  let pin: string;
  try {
    const body = (await request.json()) as { pin?: unknown };
    pin = typeof body.pin === 'string' ? body.pin.trim() : '';
  } catch {
    return NextResponse.json({ message: 'Solicitud inválida.' }, { status: 400 });
  }

  if (!pin) {
    return NextResponse.json({ message: 'PIN ausente.' }, { status: 400 });
  }

  if (!verifyPin(pin)) {
    const { attemptsRemaining, justLocked } = recordFailedAttempt(ip);
    addAuditEntry({
      ts: Date.now(),
      ip,
      event: 'login_failure',
      detail: justLocked ? 'cuenta bloqueada' : undefined,
    });

    const message = justLocked
      ? 'Cuenta bloqueada por exceso de intentos fallidos. Intenta en 15 minutos.'
      : `PIN incorrecto. ${attemptsRemaining} intento${attemptsRemaining === 1 ? '' : 's'} restante${attemptsRemaining === 1 ? '' : 's'}.`;

    return NextResponse.json({ message }, { status: 401 });
  }

  clearLockout(ip);
  const token = createAdminSession(ip);
  addAuditEntry({ ts: Date.now(), ip, event: 'login_success' });

  const response = NextResponse.json({ ok: true });
  response.cookies.set({
    name: ADMIN_SESSION_COOKIE,
    value: token,
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 2 * 60 * 60, // 2 hours
  });
  return response;
}
