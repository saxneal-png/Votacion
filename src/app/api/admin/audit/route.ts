import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';

import {
  ADMIN_SESSION_COOKIE,
  getAuditLog,
  validateAdminSession,
} from '@/lib/admin-session';

export async function GET(_request: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;
  const session = validateAdminSession(token);

  if (!session) {
    return NextResponse.json(
      { message: 'Sesión administrativa no válida o expirada.' },
      { status: 401 },
    );
  }

  return NextResponse.json(
    { log: getAuditLog() },
    {
      headers: {
        'Cache-Control': 'no-store',
      },
    },
  );
}
