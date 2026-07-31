import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';

import { ADMIN_SESSION_COOKIE, validateAdminSession } from '@/lib/admin-session';
import { generateVotingRecordsCsvAsync } from '@/lib/voting-record-store';

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

  const csvContent = await generateVotingRecordsCsvAsync({ search, estamento, rbd });
  const filename = `registro_votacion_slep_${new Date().toISOString().slice(0, 10)}.csv`;

  return new NextResponse(csvContent, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}
