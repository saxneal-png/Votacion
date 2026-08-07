import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

import { destroySession, getSession, setActiveEstamento, SESSION_COOKIE_NAME } from '@/lib/server-session';
import { getAllVoterEstamentosAsync } from '@/services/authRulesService';

export async function GET() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const session = getSession(sessionId);

  if (session?.otpVerified && session.userRut) {
    let availableEstamentos = session.availableEstamentos;
    if (!availableEstamentos || availableEstamentos.length === 0) {
      availableEstamentos = await getAllVoterEstamentosAsync(session.userRut);
    }

    return NextResponse.json({
      authenticated: true,
      user: {
        rut: session.userRut,
        fullName: session.userFullName || 'Votante Acreditado Decreto 102',
        email: session.userEmail || 'votante@slep.cl',
        estamento: session.userEstamento || 'apoderados',
        organization: session.userOrganization || 'SLEP VALLE DIGUILLÍN',
        availableEstamentos,
      },
    });
  }

  return NextResponse.json({ authenticated: false }, { status: 200 });
}

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const session = getSession(sessionId);

  if (!sessionId || !session?.otpVerified || !session.userRut) {
    return NextResponse.json({ message: 'Sesión no válida' }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as { estamento?: string };
  if (!body.estamento) {
    return NextResponse.json({ message: 'Estamento requerido' }, { status: 400 });
  }

  setActiveEstamento(sessionId, body.estamento);

  let availableEstamentos = session.availableEstamentos;
  if (!availableEstamentos || availableEstamentos.length === 0) {
    availableEstamentos = await getAllVoterEstamentosAsync(session.userRut);
  }

  return NextResponse.json({
    success: true,
    user: {
      rut: session.userRut,
      fullName: session.userFullName,
      email: session.userEmail,
      estamento: session.userEstamento,
      organization: session.userOrganization,
      availableEstamentos,
    },
  });
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