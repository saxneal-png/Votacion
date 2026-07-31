import { type NextRequest, NextResponse } from 'next/server';

import { verifyMagicToken } from '@/lib/azure-m365-service';
import { getMockUserByRut } from '@/lib/mock-api';
import { createSession, markOtpVerified, SESSION_COOKIE_NAME } from '@/lib/server-session';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const token = searchParams.get('token') || searchParams.get('magic');

  if (!token) {
    return NextResponse.redirect(`${origin}/?error=${encodeURIComponent('No se proporcionó un token de Enlace Mágico válido.')}`);
  }

  const verification = verifyMagicToken(token);
  if (!verification.valid || !verification.userRut) {
    const errorMsg = verification.reason || 'El Enlace Mágico no es válido o ha expirado (más de 10 minutos).';
    return NextResponse.redirect(`${origin}/?error=${encodeURIComponent(errorMsg)}`);
  }

  const user = getMockUserByRut(verification.userRut) || {
    rut: verification.userRut,
    fullName: 'Votante Acreditado Decreto 102',
    email: 'votante@slep.cl',
    estamento: verification.estamento || 'docentes',
  };

  // Crear sesión de votación habilitada e ingresar directo a la Cabina Secreta
  const sessionId = createSession(user.rut);
  markOtpVerified(sessionId);

  const response = NextResponse.redirect(`${origin}/?cabina=true`);
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: sessionId,
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 10 * 60, // 10 minutos
  });

  return response;
}
