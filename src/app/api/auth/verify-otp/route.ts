import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

import { getMockUserByRut, verifyOtpCode } from '@/lib/mock-api';
import {
  destroySession,
  getSession,
  incrementOtpAttempts,
  markOtpVerified,
  MAX_OTP_ATTEMPTS,
  SESSION_COOKIE_NAME,
} from '@/lib/server-session';

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const sessionId = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    const session = getSession(sessionId);

    if (!session || !sessionId) {
      return NextResponse.json(
        { message: 'La sesion de autenticacion no existe o expiro.' },
        { status: 401 },
      );
    }

    const body = await request.json() as { otp?: string };
    const otp = body.otp?.trim() ?? '';

    if (!otp) {
      return NextResponse.json(
        { message: 'Debes ingresar el codigo OTP.' },
        { status: 400 },
      );
    }

    // Validate OTP format server-side: must be exactly 6 ASCII digits.
    if (!/^\d{6}$/.test(otp)) {
      return NextResponse.json(
        { message: 'El codigo OTP debe ser de 6 digitos numericos.' },
        { status: 400 },
      );
    }

    const user = getMockUserByRut(session.userRut);
    if (!user) {
      return NextResponse.json(
        { message: 'No fue posible recuperar la sesion del votante.' },
        { status: 401 },
      );
    }

    // Validate first — only count a failure if the OTP is actually wrong.
    // This prevents destroying the session on the 3rd attempt when the user
    // enters the correct code.
    try {
      await verifyOtpCode(otp, user.otp);
    } catch {
      // Wrong OTP: increment server-side counter and check limit.
      const attempts = incrementOtpAttempts(sessionId);
      if (attempts >= MAX_OTP_ATTEMPTS) {
        destroySession(sessionId);
        return NextResponse.json(
          { message: 'Demasiados intentos fallidos. La sesion ha sido cancelada.' },
          { status: 401 },
        );
      }
      return NextResponse.json(
        { message: 'El codigo OTP no es valido o ha expirado.' },
        { status: 401 },
      );
    }

    // OTP correct — mark verified and return success.
    markOtpVerified(sessionId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        message: error instanceof Error
          ? error.message
          : 'No fue posible validar el OTP.',
      },
      { status: 401 },
    );
  }
}