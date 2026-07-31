import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

import { destroySession, getSession, SESSION_COOKIE_NAME } from '@/lib/server-session';

export async function GET() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const session = getSession(sessionId);

  if (session?.otpVerified && session.userRut) {
    return NextResponse.json({
      authenticated: true,
      user: {
        rut: session.userRut,
        fullName: session.userFullName || 'Votante Acreditado Decreto 102',
        email: session.userEmail || 'votante@slep.cl',
        estamento: session.userEstamento || 'apoderados',
        organization: session.userOrganization || 'SLEP VALLE DIGUILLÍN',
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