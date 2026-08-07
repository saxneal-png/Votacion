import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

import { getCandidatoByIdAsync, getEstamentoVariants } from '@/lib/candidates-store';
import { recordVote } from '@/lib/metrics-store';
import { recordOfficialVote } from '@/lib/voting-record-store';
import { recordVoteInSupabase } from '@/lib/supabase-client';
import {
  destroySession,
  getSession,
  hasUserVoted,
  markEstamentoVotedInSession,
  markUserAsVoted,
  SESSION_COOKIE_NAME,
} from '@/lib/server-session';
import { getAllVoterEstamentosAsync } from '@/services/authRulesService';
import { checkVotingWindowStatusAsync } from '@/lib/election-config-store';
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

  // Validar si la ventana de votación está abierta y si el estamento está habilitado
  const windowCheck = await checkVotingWindowStatusAsync(userEstamento);
  if (!windowCheck.canVote) {
    return NextResponse.json(
      { message: windowCheck.reason || 'El período de votación no se encuentra disponible.' },
      { status: 403 },
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

    // Buscar el candidato en Supabase (sin fallback a mock)
    const candidate = await getCandidatoByIdAsync(candidateId);
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

    // Atomic check + mark local session (clave compuesta rut:estamento para multirrol):
    if (hasUserVoted(userRut, userEstamento)) {
      return NextResponse.json(
        { message: 'Ya has emitido tu voto en esta eleccion.' },
        { status: 409 },
      );
    }

    // Ejecutar Transacción Atómica RPC en Supabase
    let voteResult;
    try {
      voteResult = await recordVoteInSupabase({
        estamento: userEstamento,
        candidateId,
        rut: userRut,
        rbd: userRbd,
        nombreEstablecimiento: userOrganization,
        email: userEmail,
      });
    } catch (supabaseError) {
      const code = (supabaseError as Record<string, unknown>)?.code;
      if (code === 'ALREADY_VOTED') {
        markUserAsVoted(userRut, userEstamento);
        return NextResponse.json(
          { message: 'Ya has emitido tu voto en esta eleccion.' },
          { status: 409 },
        );
      }
      if (code === 'VOTANTE_INHABILITADO') {
        return NextResponse.json(
          { message: 'El votante se encuentra inhabilitado para participar.' },
          { status: 403 },
        );
      }
      throw supabaseError;
    }

    markUserAsVoted(userRut, userEstamento);
    recordVote(candidateId, userEstamento, userRbd);

    // Registrar en el acta oficial local con el email y datos reales del votante
    recordOfficialVote({
      rutVotante: userRut,
      emailRegistrado: userEmail,
      estamento: userEstamento.toUpperCase(),
      rbdEstablecimiento: userRbd,
      nombreEstablecimiento: userOrganization,
      skipSupabaseInsert: true,
    });

    const candidateName = candidate.nombreCompleto || candidate.name || candidateId;

    // Actualizar estado de estamentos en la sesión
    if (sessionId) {
      markEstamentoVotedInSession(sessionId, userEstamento);
    }
    const updatedEstamentos = await getAllVoterEstamentosAsync(userRut);
    if (session) {
      session.availableEstamentos = updatedEstamentos;
    }

    const pendingEstamentos = updatedEstamentos.filter((e) => e.habilitado && !e.haVotado);
    const hasPendingBallots = pendingEstamentos.length > 0;

    // Si NO quedan papeletas pendientes, destruir la sesión inmediatamente
    if (!hasPendingBallots) {
      destroySession(sessionId);
    }

    const response = NextResponse.json({
      success: true,
      message: `Voto emitido correctamente para ${candidateName}.`,
      receiptCode: voteResult.receiptCode || voteResult.comprobanteId,
      folio: voteResult.folio || voteResult.comprobanteId,
      voterName: userFullName,
      hasPendingBallots,
      pendingEstamentos,
      availableEstamentos: updatedEstamentos,
      candidate: {
        ...candidate,
        name: candidateName,
        nombreCompleto: candidateName,
      },
    });

    if (!hasPendingBallots) {
      response.cookies.set({
        name: SESSION_COOKIE_NAME,
        value: '',
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        maxAge: 0,
      });
    }

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