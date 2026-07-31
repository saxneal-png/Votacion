import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';

import { ADMIN_SESSION_COOKIE, validateAdminSession } from '@/lib/admin-session';
import { getVotingRecords } from '@/lib/voting-record-store';

export async function GET(request: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;
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
  const rbd = searchParams.get('rbd') || '';

  const data = getVotingRecords({ search, estamento, rbd });

  return NextResponse.json(data, {
    headers: {
      'Cache-Control': 'no-store',
    },
  });
}
