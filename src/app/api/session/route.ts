import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

import { getMockUserByRut } from '@/lib/mock-api';
import { destroySession, getSession, SESSION_COOKIE_NAME } from '@/lib/server-session';

export async function GET() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const session = getSession(sessionId);

  if (session?.otpVerified && session.userRut) {
    const user = getMockUserByRut(session.userRut) || {
      rut: session.userRut,
      fullName: 'Votante Acreditado Decreto 102',
      email: 'votante@slep.cl',
      estamento: 'docentes',
    };

    return NextResponse.json({
      authenticated: true,
      user: {
        rut: user.rut,
        fullName: user.fullName,
        email: user.email,
        estamento: user.estamento,
      },
    });
  }

  return NextResponse.json({ authenticated: false }, { status: 200 });
}

export async function DELETE() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  destroySession(sessionId);

  const response = new NextResponse(null, { status: 204 });
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
}