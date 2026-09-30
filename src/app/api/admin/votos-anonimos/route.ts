import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';

import { ADMIN_SESSION_COOKIE, validateAdminSession } from '@/lib/admin-session';
import { getAnonymousVotesAsync } from '@/lib/anonymous-votes-store';

export async function GET(request: NextRequest) {
  const cookieHeader = request.headers.get('cookie') || '';
  const match = cookieHeader.match(new RegExp(`${ADMIN_SESSION_COOKIE}=([^;]+)`));
  let token = request.cookies?.get(ADMIN_SESSION_COOKIE)?.value || match?.[1];

  if (!token) {
    try {
      const cookieStore = await cookies();
      token = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;
    } catch {
      // Fallback
    }
  }

  const session = validateAdminSession(token);

  if (!session) {
    return NextResponse.json(
      { message: 'Sesión administrativa no válida o expirada.' },
      { status: 401 },
    );
  }

  const { searchParams } = new URL(request.url);
  const search = searchParams.get('search') || '';
  const estamento = searchParams.get('estamento') || '';

  const { records, total } = await getAnonymousVotesAsync({ search, estamento });

  return NextResponse.json({
    success: true,
    total,
    records,
  });
}
