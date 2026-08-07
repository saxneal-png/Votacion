import { type NextRequest, NextResponse } from 'next/server';

import { verifyMagicToken } from '@/lib/azure-m365-service';
import { createSession, markOtpVerified, SESSION_COOKIE_NAME } from '@/lib/server-session';
import { consumeTempToken, getAllVoterEstamentosAsync } from '@/services/authRulesService';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const token = searchParams.get('token') || searchParams.get('magic') || searchParams.get('access_token');

  if (!token) {
    return NextResponse.redirect(`${origin}/?error=${encodeURIComponent('No se proporcionó un token de Enlace Mágico válido.')}`);
  }

  // Intentar consumir el TempToken (flujo verify-credentials con datos completos)
  const tempResult = consumeTempToken(token);
  if (tempResult.valid && tempResult.payload) {
    const payload = tempResult.payload;
    const availableEstamentos = await getAllVoterEstamentosAsync(payload.rutVotante);

    const sessionId = createSession({
      userRut: payload.rutVotante,
      userEmail: payload.emailDestino,
      userEstamento: payload.estamentoDestino,
      userFullName: payload.nombreVotante || payload.nombreEstablecimiento,
      userRbd: payload.rbdEstablecimiento,
      userOrganization: payload.nombreEstablecimiento,
      userOtp: '', // Ya verificado via magic link, no se requiere OTP
      availableEstamentos,
    });
    markOtpVerified(sessionId);

    const response = NextResponse.redirect(`${origin}/?cabina=true`);
    response.cookies.set({
      name: SESSION_COOKIE_NAME,
      value: sessionId,
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 10 * 60,
    });
    return response;
  }

  // Fallback: verificar con el sistema de magic tokens de Azure M365
  const verification = verifyMagicToken(token);
  if (!verification.valid || !verification.userRut) {
    const errorMsg = verification.reason || 'El Enlace Mágico no es válido o ha expirado (más de 10 minutos).';
    return NextResponse.redirect(`${origin}/?error=${encodeURIComponent(errorMsg)}`);
  }

  const availableEstamentos = await getAllVoterEstamentosAsync(verification.userRut);

  // Crear sesión usando los datos del token verificado
  const sessionId = createSession({
    userRut: verification.userRut,
    userEmail: 'votante@slep.cl',
    userEstamento: verification.estamento || 'docentes',
    userFullName: 'Votante Acreditado',
    userRbd: '10202',
    userOrganization: 'SLEP VALLE DIGUILLÍN',
    userOtp: '', // Ya verificado via magic link
    availableEstamentos,
  });
  markOtpVerified(sessionId);

  const response = NextResponse.redirect(`${origin}/?cabina=true`);
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: sessionId,
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 10 * 60,
  });
  return response;
}
