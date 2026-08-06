import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

import { getCandidatosAsync } from '@/lib/candidates-store';
import { getSession, SESSION_COOKIE_NAME } from '@/lib/server-session';
import type { Estamento } from '@/types';

export const dynamic = 'force-dynamic';

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

  // Usar el estamento directamente de la sesión — no depender de getMockUserByRut.
  // Esto garantiza que el votante vea SOLO los candidatos de SU estamento real.
  const userEstamento = session.userEstamento as Estamento;

  if (!userEstamento) {
    return NextResponse.json(
      { message: 'No se pudo determinar el estamento del votante. Inicia sesión nuevamente.' },
      { status: 401 },
    );
  }

  // Leer candidatos desde Supabase (con fallback a datos en memoria)
  const candidates = await getCandidatosAsync({ estamento: userEstamento });
  return NextResponse.json(candidates);
}