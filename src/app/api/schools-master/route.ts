import { NextResponse } from 'next/server';
import { getSchoolsMasterAsync } from '@/lib/schools-master-store';

export async function GET() {
  try {
    const records = await getSchoolsMasterAsync();
    return NextResponse.json(
      { records, schools: records, total: records.length },
      { headers: { 'Cache-Control': 'public, max-age=60, s-maxage=300, stale-while-revalidate=600' } },
    );
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Error al obtener catálogo maestro.' },
      { status: 500 },
    );
  }
}
