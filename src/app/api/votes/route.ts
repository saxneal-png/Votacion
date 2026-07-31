import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

import { getCandidateById, getMockUserByRut, submitVote } from '@/lib/mock-api';
import { recordVote } from '@/lib/metrics-store';
import { recordOfficialVote } from '@/lib/voting-record-store';
import {
  destroySession,
  getSession,
  hasUserVoted,
  markUserAsVoted,
  SESSION_COOKIE_NAME,
} from '@/lib/server-session';

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const session = getSession(sessionId);

  if (!session?.otpVerified) {
    return NextResponse.json(
      { message: 'No existe una sesion habilitada para emitir el voto.' },
      { status: 401 },
    );
  }

  const user = getMockUserByRut(session.userRut);
  if (!user) {
    return NextResponse.json(
      { message: 'No fue posible recuperar al votante autenticado.' },
      { status: 401 },
    );
  }

  try {
    const body = await request.json() as { candidateId?: string };
    const candidateId = body.candidateId?.trim() ?? '';

    if (!candidateId) {
      return NextResponse.json(
        { message: 'Debes seleccionar una candidatura antes de votar.' },
        { status: 400 },
      );
    }

    const candidate = getCandidateById(candidateId);
    if (!candidate || candidate.estamento !== user.estamento) {
      return NextResponse.json(
        { message: 'La candidatura seleccionada no pertenece al padron habilitado.' },
        { status: 403 },
      );
    }

    // Atomic check + mark: no await between these two calls.
    // Node.js is single-threaded; without an intervening await, no concurrent
    // request can pass hasUserVoted after we mark — eliminates the race condition.
    if (hasUserVoted(user.rut)) {
      return NextResponse.json(
        { message: 'Ya has emitido tu voto en esta eleccion.' },
        { status: 409 },
      );
    }
    markUserAsVoted(user.rut);
    recordVote(candidateId, user.estamento, user.schoolId);

    recordOfficialVote({
      rutVotante: user.rut,
      emailRegistrado: user.email,
      estamento: user.estamento,
      rbdEstablecimiento: user.schoolId,
      nombreEstablecimiento: user.organization,
    });

    const result = await submitVote(candidateId);

    // Destroy the session immediately after voting — the cookie is no longer needed.
    destroySession(sessionId);
    const response = NextResponse.json(result);
    response.cookies.set({
      name: SESSION_COOKIE_NAME,
      value: '',
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 0,
    });
    return response;
  } catch (error) {
    return NextResponse.json(
      {
        message: error instanceof Error
          ? error.message
          : 'No fue posible registrar el voto.',
      },
      { status: 400 },
    );
  }
}