import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

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

    // Comparar contra el OTP guardado en la sesión server-side.
    // Esto elimina la dependencia de getMockUserByRut y garantiza
    // que el OTP corresponda exactamente al enviado por correo.
    const expectedOtp = session.userOtp;
    if (!expectedOtp) {
      return NextResponse.json(
        { message: 'No se encontró el código OTP en la sesión. Por favor solicita un nuevo acceso.' },
        { status: 400 },
      );
    }

    if (otp !== expectedOtp) {
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