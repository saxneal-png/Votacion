import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';

import { ADMIN_SESSION_COOKIE, addAuditEntry, validateAdminSession } from '@/lib/admin-session';
import {
  generateTerritorialParticipationCsvAsync,
  getTerritorialParticipationReportAsync,
} from '@/lib/territorial-participation-store';

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    '127.0.0.1'
  );
}

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
  const format = searchParams.get('format') || 'csv';

  if (format === 'json') {
    const data = await getTerritorialParticipationReportAsync();
    return NextResponse.json({
      success: true,
      report: data,
    });
  }

  // Generación oficial CSV (UTF-8 + BOM)
  const csvContent = await generateTerritorialParticipationCsvAsync();
  const dateStr = new Date().toISOString().slice(0, 10);
  const filename = `participacion_territorial_comunas_establecimientos_${dateStr}.csv`;

  // Registrar descarga en la bitácora de auditoría
  addAuditEntry({
    ts: Date.now(),
    ip: getClientIp(request),
    event: 'access',
    detail: `EXPORTACIÓN PARTICIPACIÓN TERRITORIAL: Descarga de reporte de porcentaje de participación por establecimiento, estamento y comuna (${filename}).`,
  });

  return new NextResponse(csvContent, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    },
  });
}
