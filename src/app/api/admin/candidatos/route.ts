import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';

import { ADMIN_SESSION_COOKIE, validateAdminSession } from '@/lib/admin-session';
import {
  addCandidatoAsync,
  CandidateFormData,
  clearAllCandidatosAsync,
  deleteCandidatoAsync,
  getCandidatosAsync,
  updateCandidatoAsync,
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

  const candidatesList = await getCandidatosAsync({ search, estamento });
  return NextResponse.json({ candidates: candidatesList, total: candidatesList.length }, {
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
    const body = (await request.json()) as CandidateFormData;

    if (!body.nombreCompleto || !body.estamento || !body.propuestaPrincipal || !body.escuelaEstablecimiento) {
      return NextResponse.json(
        { message: 'Faltan campos obligatorios (Nombre, Estamento, Propuesta o Escuela).' },
        { status: 400 },
      );
    }

    const newCandidate = await addCandidatoAsync({
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

    const updatedCandidate = await updateCandidatoAsync(body.id, {
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
    const clearAll = searchParams.get('clearAll') === 'true';
    let id = searchParams.get('id');

    if (clearAll) {
      await clearAllCandidatosAsync();
      return NextResponse.json({ success: true, message: 'Todas las candidaturas fueron eliminadas correctamente.' });
    }

    if (!id) {
      const body = (await request.json().catch(() => ({}))) as { id?: string; clearAll?: boolean };
      id = body.id || null;
      if (body.clearAll) {
        await clearAllCandidatosAsync();
        return NextResponse.json({ success: true, message: 'Todas las candidaturas fueron eliminadas correctamente.' });
      }
    }

    if (!id) {
      return NextResponse.json({ message: 'Se requiere el id del candidato a eliminar.' }, { status: 400 });
    }

    await deleteCandidatoAsync(id);
    return NextResponse.json({ success: true, message: 'Candidato eliminado exitosamente.' });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Error al eliminar candidato.' },
      { status: 400 },
    );
  }
}
