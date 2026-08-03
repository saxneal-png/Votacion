import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';

import {
  ADMIN_SESSION_COOKIE,
  addAuditEntry,
  validateAdminSession,
} from '@/lib/admin-session';
import {
  clearSchoolsMasterAsync,
  deleteSchoolMasterAsync,
  getSchoolsMasterAsync,
  parseSchoolsMasterExcelBuffer,
  updateSchoolMasterAsync,
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

export async function PUT(request: NextRequest) {
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
    const body = (await request.json()) as { rbd?: string; nombreOficial?: string; comuna?: string };
    const { rbd, nombreOficial, comuna } = body;

    if (!rbd || !nombreOficial) {
      return NextResponse.json(
        { message: 'Los campos RBD y Nombre Oficial son requeridos para actualizar.' },
        { status: 400 },
      );
    }

    const ok = await updateSchoolMasterAsync(rbd, {
      nombreOficial,
      comuna: comuna || '',
    });

    if (!ok) {
      return NextResponse.json(
        { message: 'No se pudo actualizar el establecimiento en la base de datos.' },
        { status: 500 },
      );
    }

    addAuditEntry({
      ts: Date.now(),
      ip,
      event: 'access',
      detail: `Edición de colegio maestro RBD ${rbd}: "${nombreOficial}" (${comuna || 'Sin comuna'}).`,
    });

    return NextResponse.json({ success: true, rbd });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Error actualizando colegio maestro.' },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {
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

  const { searchParams } = new URL(request.url);
  const clearAll = searchParams.get('all') === 'true';
  const rbd = searchParams.get('rbd');

  try {
    if (clearAll) {
      await clearSchoolsMasterAsync();
      addAuditEntry({
        ts: Date.now(),
        ip,
        event: 'access',
        detail: 'Eliminación completa del Catálogo Maestro de Establecimientos (Vaciar Catálogo).',
      });
      return NextResponse.json({ success: true, message: 'Catálogo maestro vaciado exitosamente.' });
    }

    if (!rbd) {
      return NextResponse.json(
        { message: 'Se requiere especificar el RBD o el parámetro all=true.' },
        { status: 400 },
      );
    }

    const ok = await deleteSchoolMasterAsync(rbd);
    if (!ok) {
      return NextResponse.json(
        { message: `No se pudo eliminar el colegio maestro con RBD ${rbd}.` },
        { status: 500 },
      );
    }

    addAuditEntry({
      ts: Date.now(),
      ip,
      event: 'access',
      detail: `Eliminación de colegio maestro RBD ${rbd}.`,
    });

    return NextResponse.json({ success: true, rbd });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Error al eliminar colegio maestro.' },
      { status: 500 },
    );
  }
}
