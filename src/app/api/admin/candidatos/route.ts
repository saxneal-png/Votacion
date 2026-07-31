import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';

import { ADMIN_SESSION_COOKIE, validateAdminSession } from '@/lib/admin-session';
import {
  addCandidato,
  CandidateFormData,
  deleteCandidato,
  getCandidatos,
  updateCandidato,
} from '@/lib/candidates-store';

export async function GET(request: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;
  if (!validateAdminSession(token)) {
    return NextResponse.json({ message: 'Sesión no autorizada.' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const search = searchParams.get('search') ?? '';
  const estamento = searchParams.get('estamento') ?? '';

  const candidatesList = getCandidatos({ search, estamento });
  return NextResponse.json({ candidates: candidatesList, total: candidatesList.length });
}

export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;
  if (!validateAdminSession(token)) {
    return NextResponse.json({ message: 'Sesión no autorizada.' }, { status: 401 });
  }

  try {
    const body = (await request.json()) as CandidateFormData;

    if (!body.nombreCompleto || !body.estamento || !body.propuestaPrincipal || !body.escuelaEstablecimiento) {
      return NextResponse.json(
        { message: 'Faltan campos obligatorios (Nombre, Estamento, Propuesta o Escuela).' },
        { status: 400 },
      );
    }

    const newCandidate = addCandidato({
      nombreCompleto: body.nombreCompleto,
      estamento: body.estamento,
      biografia: body.biografia || '',
      propuestaPrincipal: body.propuestaPrincipal,
      escuelaEstablecimiento: body.escuelaEstablecimiento,
      fotoPerfil: body.fotoPerfil,
    });

    return NextResponse.json({ success: true, candidate: newCandidate });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Error al registrar candidato.' },
      { status: 400 },
    );
  }
}

export async function PUT(request: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;
  if (!validateAdminSession(token)) {
    return NextResponse.json({ message: 'Sesión no autorizada.' }, { status: 401 });
  }

  try {
    const body = (await request.json()) as { id?: string } & Partial<CandidateFormData>;
    if (!body.id) {
      return NextResponse.json({ message: 'Se requiere el id del candidato a actualizar.' }, { status: 400 });
    }

    const updatedCandidate = updateCandidato(body.id, {
      nombreCompleto: body.nombreCompleto,
      estamento: body.estamento,
      biografia: body.biografia,
      propuestaPrincipal: body.propuestaPrincipal,
      escuelaEstablecimiento: body.escuelaEstablecimiento,
      fotoPerfil: body.fotoPerfil,
    });

    return NextResponse.json({ success: true, candidate: updatedCandidate });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Error al actualizar candidato.' },
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
    let id = searchParams.get('id');

    if (!id) {
      const body = (await request.json().catch(() => ({}))) as { id?: string };
      id = body.id || null;
    }

    if (!id) {
      return NextResponse.json({ message: 'Se requiere el id del candidato a eliminar.' }, { status: 400 });
    }

    const deleted = deleteCandidato(id);
    if (!deleted) {
      return NextResponse.json({ message: 'No se encontró el candidato especificado.' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Error al eliminar candidato.' },
      { status: 500 },
    );
  }
}
