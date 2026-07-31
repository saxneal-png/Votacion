import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// ---------------------------------------------------------------------------
// IP-based rate limiter (#25)
// In-memory per-edge-instance store. Best-effort: resets on cold start.
// Adjust limit in development/production to avoid blocking dashboard polling.
// ---------------------------------------------------------------------------
const isDev = process.env.NODE_ENV === 'development';
const RATE_LIMIT_MAX = isDev ? 1000 : 200; // 200 req/min in prod, 1000 req/min in dev
const RATE_LIMIT_WINDOW_MS = 60_000;

interface RateLimitEntry {
  count: number;
  resetAt: number;
}
const ipRateLimitMap = new Map<string, RateLimitEntry>();

function isRateLimited(ip: string): boolean {
  // En desarrollo no aplicar bloqueo agresivo por IP
  if (isDev) return false;

  const now = Date.now();
  const entry = ipRateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    ipRateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }
  if (entry.count >= RATE_LIMIT_MAX) return true;
  entry.count += 1;
  return false;
}

export function middleware(request: NextRequest) {
  // --- Rate limit by IP (#25) ---
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    'unknown';

  if (isRateLimited(ip)) {
    return new NextResponse('Too Many Requests', {
      status: 429,
      headers: { 'Retry-After': '60' },
    });
  }

  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');

  // In development, keep unsafe directives so Next.js Fast Refresh works.
  // In production, use a per-request nonce — no unsafe-inline or unsafe-eval.
  const scriptSrc = isDev
    ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
    : `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`;

  // report-uri (#21): collects CSP violations without blocking.
  const reportUri = isDev ? '' : '; report-uri /api/csp-report';

  const csp = [
    "default-src 'self'",
    scriptSrc,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self'",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
  ].join('; ') + reportUri;

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', csp);

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });

  response.headers.set('Content-Security-Policy', csp);
  return response;
}

export const config = {
  matcher: [
    {
      source: '/((?!_next/static|_next/image|favicon.ico).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
};
