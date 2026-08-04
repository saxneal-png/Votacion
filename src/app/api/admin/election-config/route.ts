import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';

import {
  ADMIN_SESSION_COOKIE,
  addAuditEntry,
  validateAdminSession,
} from '@/lib/admin-session';
import {
  getElectionConfigAsync,
  saveElectionConfigAsync,
  checkVotingWindowStatusAsync,
  type ElectionConfig,
} from '@/lib/election-config-store';

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    'unknown'
  );
}

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

  try {
    const config = await getElectionConfigAsync();
    const windowStatus = await checkVotingWindowStatusAsync();
    return NextResponse.json(
      { config, windowStatus },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Error al obtener configuración electoral.' },
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
    const body = (await request.json()) as Partial<ElectionConfig>;

    if (!body.tituloProceso || !Array.isArray(body.estamentosHabilitados) || !body.fechaInicio || !body.fechaFin) {
      return NextResponse.json(
        { message: 'Parámetros inválidos. Se requiere título del proceso, estamentos habilitados, fecha de inicio y fecha de fin.' },
        { status: 400 },
      );
    }

    if (body.estamentosHabilitados.length === 0) {
      return NextResponse.json(
        { message: 'Debes seleccionar al menos un (1) estamento participante para realizar el sufragio.' },
        { status: 400 },
      );
    }

    const start = new Date(body.fechaInicio);
    const end = new Date(body.fechaFin);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return NextResponse.json(
        { message: 'Las fechas de inicio o término ingresadas no tienen un formato válido.' },
        { status: 400 },
      );
    }

    if (start >= end) {
      return NextResponse.json(
        { message: 'La fecha y hora de inicio debe ser anterior a la fecha y hora de término.' },
        { status: 400 },
      );
    }

    const saved = await saveElectionConfigAsync(body);
    const windowStatus = await checkVotingWindowStatusAsync();

    addAuditEntry({
      ts: Date.now(),
      ip,
      event: 'access',
      detail: `Configuración electoral actualizada: Estamentos (${saved.estamentosHabilitados.join(', ')}), Período (${saved.fechaInicio} a ${saved.fechaFin}), Estado (${saved.estadoEleccion}).`,
    });

    return NextResponse.json({
      success: true,
      config: saved,
      windowStatus,
    });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Error al guardar configuración electoral.' },
      { status: 500 },
    );
  }
}
