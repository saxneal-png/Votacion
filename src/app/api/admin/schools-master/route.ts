import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';

import {
  ADMIN_SESSION_COOKIE,
  addAuditEntry,
  validateAdminSession,
} from '@/lib/admin-session';
import {
  getSchoolsMasterAsync,
  parseSchoolsMasterExcelBuffer,
  upsertSchoolsMasterAsync,
} from '@/lib/schools-master-store';

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    'unknown'
  );
}

export async function GET(request: NextRequest) {
  const ip = getClientIp(request);
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;
  const session = validateAdminSession(token);

  if (!session) {
    return NextResponse.json(
      { message: 'Sesión administrativa no válida o expirada.' },
      { status: 401 },
    );
  }

  try {
    const records = await getSchoolsMasterAsync();
    return NextResponse.json(
      { records, total: records.length },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Error al obtener catálogo maestro.' },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;
  const session = validateAdminSession(token);

  if (!session) {
    return NextResponse.json(
      { message: 'Sesión administrativa no válida o expirada.' },
      { status: 401 },
    );
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json(
        { message: 'Debes seleccionar un archivo Excel (.xlsx / .xls) o CSV con el catálogo maestro de establecimientos.' },
        { status: 400 },
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const records = parseSchoolsMasterExcelBuffer(buffer);

    if (records.length === 0) {
      return NextResponse.json(
        { message: 'No se encontraron registros válidos de establecimientos en el archivo. Verifica los encabezados (RBD, establecimientos, Comuna).' },
        { status: 400 },
      );
    }

    const count = await upsertSchoolsMasterAsync(records);

    addAuditEntry({
      ts: Date.now(),
      ip,
      event: 'access',
      detail: `Carga de Catálogo Maestro de Colegios: ${count} establecimientos cargados/actualizados.`,
    });

    return NextResponse.json({
      success: true,
      totalLoaded: records.length,
      countUpserted: count,
      records,
    });
  } catch (error) {
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : 'Error procesando archivo maestro de establecimientos.',
      },
      { status: 400 },
    );
  }
}
