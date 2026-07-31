import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';

import { ADMIN_SESSION_COOKIE, validateAdminSession } from '@/lib/admin-session';
import {
  addSingleVoterAsync,
  deleteVoterRecordAsync,
  EstamentoDecreto102,
  getPadronRecordsAsync,
  toggleVoterHabilitadoAsync,
} from '@/lib/padron-store';

export async function GET(request: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;
  if (!validateAdminSession(token)) {
    return NextResponse.json({ message: 'Sesión no autorizada.' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const search = searchParams.get('search') ?? '';
  const estamento = searchParams.get('estamento') ?? '';
  const rbd = searchParams.get('rbd') ?? '';

  const data = await getPadronRecordsAsync({ search, estamento, rbd });
  return NextResponse.json(data, {
    headers: { 'Cache-Control': 'no-store' },
  });
}

export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;
  if (!validateAdminSession(token)) {
    return NextResponse.json({ message: 'Sesión no autorizada.' }, { status: 401 });
  }

  try {
    const body = (await request.json()) as {
      rutVotante?: string;
      rutEstudianteAsociado?: string;
      nombreCompleto?: string;
      estamento?: EstamentoDecreto102;
      rbdEstablecimiento?: string;
      nombreEstablecimiento?: string;
    };

    if (
      !body.rutVotante ||
      !body.nombreCompleto ||
      !body.estamento ||
      !body.rbdEstablecimiento ||
      !body.nombreEstablecimiento
    ) {
      return NextResponse.json(
        { message: 'Faltan campos obligatorios para registrar al votante.' },
        { status: 400 },
      );
    }

    const newRecord = await addSingleVoterAsync({
      rutVotante: body.rutVotante,
      rutEstudianteAsociado: body.rutEstudianteAsociado,
      nombreCompleto: body.nombreCompleto,
      estamento: body.estamento,
      rbdEstablecimiento: body.rbdEstablecimiento,
      nombreEstablecimiento: body.nombreEstablecimiento,
    });

    return NextResponse.json({ success: true, record: newRecord });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Error al agregar votante.' },
      { status: 400 },
    );
  }
}

export async function PATCH(request: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;
  if (!validateAdminSession(token)) {
    return NextResponse.json({ message: 'Sesión no autorizada.' }, { status: 401 });
  }

  try {
    const body = (await request.json()) as { id?: string };
    if (!body.id) {
      return NextResponse.json(
        { message: 'Se requiere la propiedad id del registro.' },
        { status: 400 },
      );
    }

    const updated = await toggleVoterHabilitadoAsync(body.id);
    return NextResponse.json({ success: true, record: updated });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Error al modificar registro.' },
      { status: 400 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;
  if (!validateAdminSession(token)) {
    return NextResponse.json({ message: 'Sesión no autorizada.' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { message: 'Se requiere el parámetro id para eliminar.' },
        { status: 400 },
      );
    }

    const deleted = await deleteVoterRecordAsync(id);
    if (!deleted) {
      return NextResponse.json(
        { message: 'No se encontró el registro para eliminar.' },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Error al eliminar registro.' },
      { status: 500 },
    );
  }
}
