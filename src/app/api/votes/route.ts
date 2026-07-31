import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

import { getCandidateById, submitVote } from '@/lib/mock-api';
import { getEstamentoVariants } from '@/lib/candidates-store';
import { recordVote } from '@/lib/metrics-store';
import { recordOfficialVote } from '@/lib/voting-record-store';
import {
  destroySession,
  getSession,
  hasUserVoted,
  markUserAsVoted,
  SESSION_COOKIE_NAME,
} from '@/lib/server-session';
import type { Estamento } from '@/types';

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

  // Usar los datos almacenados en la sesión — no depender de getMockUserByRut.
  // Esto garantiza que el estamento, email y nombre correspondan al votante
  // que realmente se autenticó, independientemente del estado en memoria.
  const userEstamento = session.userEstamento as Estamento;
  const userEmail = session.userEmail;
  const userRut = session.userRut;
  const userOrganization = session.userOrganization;
  const userRbd = session.userRbd;
  const userFullName = session.userFullName;

  if (!userEstamento || !userEmail || !userRut) {
    return NextResponse.json(
      { message: 'Datos de sesión incompletos. Por favor inicia sesión nuevamente.' },
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

    const candidate = await getCandidateById(candidateId);
    if (!candidate) {
      return NextResponse.json(
        { message: 'La candidatura seleccionada no fue encontrada.' },
        { status: 404 },
      );
    }

    // Verificar que el candidato sea del mismo estamento del votante autenticado
    const candidateVariants = getEstamentoVariants(candidate.estamento).map((v) => v.toLowerCase());
    const userVariants = getEstamentoVariants(userEstamento).map((v) => v.toLowerCase());
    const isMatchingEstamento = candidateVariants.some((v) => userVariants.includes(v));

    if (!isMatchingEstamento) {
      return NextResponse.json(
        {
          message: `La candidatura seleccionada pertenece al estamento "${candidate.estamento}" y usted está acreditado para votar en "${userEstamento}".`,
        },
        { status: 403 },
      );
    }

    // Atomic check + mark: no await between these two calls.
    if (hasUserVoted(userRut)) {
      return NextResponse.json(
        { message: 'Ya has emitido tu voto en esta eleccion.' },
        { status: 409 },
      );
    }
    markUserAsVoted(userRut);
    recordVote(candidateId, userEstamento, userRbd);

    // Registrar en el acta oficial con el email y datos reales del votante
    recordOfficialVote({
      rutVotante: userRut,
      emailRegistrado: userEmail,
      estamento: userEstamento.toUpperCase(),
      rbdEstablecimiento: userRbd,
      nombreEstablecimiento: userOrganization,
    });

    const result = await submitVote(candidateId);

    // Destroy the session immediately after voting
    destroySession(sessionId);
    const response = NextResponse.json({
      ...result,
      voterName: userFullName,
    });
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