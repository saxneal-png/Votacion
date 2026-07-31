import { type NextRequest, NextResponse } from 'next/server';

import { consumeTempToken, generateBlindJwtToken } from '@/services/authRulesService';
import { createSession, markOtpVerified, SESSION_COOKIE_NAME } from '@/lib/server-session';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const accessToken = searchParams.get('access_token') || searchParams.get('token');

  if (!accessToken) {
    return NextResponse.redirect(
      `${origin}/?error=${encodeURIComponent('No se proporcionó un token de acceso a la papeleta (access_token).')}`,
    );
  }

  // Consumir el Token Temporal de un solo uso y marcar el voto como emitido en el Padrón
  const result = consumeTempToken(accessToken);

  if (!result.valid || !result.payload) {
    const errorMsg = result.reason || 'El enlace de acceso a la papeleta no es válido o ya fue utilizado.';
    return NextResponse.redirect(`${origin}/?error=${encodeURIComponent(errorMsg)}`);
  }

  const { payload } = result;

  // Generar Token Ciego Anónimo JWT que oculta RUTs y datos personales
  const { blindToken } = generateBlindJwtToken({
    estamento: payload.estamentoDestino,
    rbdEstablecimiento: payload.rbdEstablecimiento,
  });

  // Habilitar sesión de sufragio cifrada
  const sessionId = createSession(payload.rutVotante);
  markOtpVerified(sessionId);

  const response = NextResponse.redirect(`${origin}/?cabina=true&blind_token=${encodeURIComponent(blindToken)}`);
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: sessionId,
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 10 * 60, // 10 Minutos
  });

  return response;
}
