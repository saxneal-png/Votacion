import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

import { getCandidates, getMockUserByRut } from '@/lib/mock-api';
import { getSession, SESSION_COOKIE_NAME } from '@/lib/server-session';

export async function GET() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const session = getSession(sessionId);

  if (!session?.otpVerified) {
    return NextResponse.json(
      { message: 'No existe una sesion habilitada para consultar la papeleta.' },
      { status: 401 },
    );
  }

  const user = getMockUserByRut(session.userRut);
  if (!user) {
    return NextResponse.json(
      { message: 'No fue posible recuperar el padron del votante.' },
      { status: 401 },
    );
  }

  const candidates = await getCandidates(user.estamento);
  return NextResponse.json(candidates);
}