import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';

import { ADMIN_SESSION_COOKIE, addAuditEntry, validateAdminSession } from '@/lib/admin-session';
import { getCandidatosAsync } from '@/lib/candidates-store';
import {
  exportCandidatesToBuffer,
  exportCandidatesToCsv,
  generateCandidateTemplateWorkbook,
} from '@/lib/candidates-excel';

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    'unknown'
  );
}

export async function GET(request: NextRequest) {
  const ip = getClientIp(request);
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

  if (!validateAdminSession(token)) {
    return NextResponse.json({ message: 'Sesión administrativa no autorizada o expirada.' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const isTemplate = searchParams.get('template') === 'true';
  const format = searchParams.get('format') || 'xlsx';
  const estamento = searchParams.get('estamento') || '';
  const search = searchParams.get('search') || '';

  try {
    if (isTemplate) {
      const buffer = generateCandidateTemplateWorkbook();
      return new NextResponse(new Uint8Array(buffer), {
        status: 200,
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': 'attachment; filename="plantilla_candidatos_slep.xlsx"',
          'Cache-Control': 'no-store',
        },
      });
    }

    const candidates = await getCandidatosAsync({ estamento, search });
    const dateStr = new Date().toISOString().slice(0, 10);

    addAuditEntry({
      ts: Date.now(),
      ip,
      event: 'access',
      detail: `Exportación de ${candidates.length} candidaturas a archivo ${format.toUpperCase()}.`,
    });

    if (format.toLowerCase() === 'csv') {
      const csvData = exportCandidatesToCsv(candidates);
      return new NextResponse(csvData, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="candidatos_eleccion_slep_${dateStr}.csv"`,
          'Cache-Control': 'no-store',
        },
      });
    }

    const excelBuffer = exportCandidatesToBuffer(candidates);
    return new NextResponse(new Uint8Array(excelBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="candidatos_eleccion_slep_${dateStr}.xlsx"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('Error al exportar candidatos:', error);
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Error al exportar candidaturas.' },
      { status: 500 },
    );
  }
}
