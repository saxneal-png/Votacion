import { NextResponse } from 'next/server';

import { sendOtpEmailViaGraph } from '@/lib/azure-m365-service';
import { createSession, SESSION_COOKIE_NAME } from '@/lib/server-session';
import {
  createTempToken,
  validateApoderadoAuth,
  validateFuncionarioAuth,
} from '@/services/authRulesService';

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      rut?: string;
      email?: string;
      studentRut?: string;
      voterType?: 'apoderado' | 'funcionario';
    };

    const rut = body.rut?.trim() ?? '';
    const email = body.email?.trim() ?? '';
    const studentRut = body.studentRut?.trim() ?? '';
    const voterType = body.voterType ?? (studentRut ? 'apoderado' : 'funcionario');

    if (!rut || !email) {
      return NextResponse.json(
        { message: 'Debes ingresar RUT y correo para continuar.' },
        { status: 400 },
      );
    }

    let matchedRecord;
    let estamentoLabel = 'DOCENTES';

    if (voterType === 'apoderado' || studentRut) {
      if (!studentRut) {
        return NextResponse.json(
          { message: 'Debes ingresar el RUN del estudiante (alumno / carga).' },
          { status: 400 },
        );
      }
      matchedRecord = validateApoderadoAuth(rut, studentRut, email);
      estamentoLabel = 'PADRES Y APODERADOS';
    } else {
      matchedRecord = validateFuncionarioAuth(rut, email);
      estamentoLabel = matchedRecord.estamento;
    }

    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();

    const sessionId = createSession({
      userRut: matchedRecord.rutVotante,
      userEmail: email,
      userEstamento: matchedRecord.estamento,
      userFullName: matchedRecord.nombreCompleto,
      userRbd: matchedRecord.rbdEstablecimiento,
      userOrganization: matchedRecord.nombreEstablecimiento,
      userOtp: otpCode,
    });

    // Generar Token Temporal de Acceso (10 min)
    const tempToken = createTempToken({
      rutVotante: matchedRecord.rutVotante,
      nombreVotante: matchedRecord.nombreCompleto,
      rutEstudiante: matchedRecord.rutEstudianteAsociado ?? undefined,
      estamentoDestino: matchedRecord.estamento,
      rbdEstablecimiento: matchedRecord.rbdEstablecimiento,
      nombreEstablecimiento: matchedRecord.nombreEstablecimiento,
      emailDestino: email,
    });


    // Despachar correo vía M365 / Azure AD Graph API (o Simulación)
    await sendOtpEmailViaGraph({
      toEmail: email,
      voterName: matchedRecord.nombreCompleto,
      estamentoLabel,
      otp: otpCode,
      magicToken: tempToken.token,
    });

    const publicUser = {
      rut: matchedRecord.rutVotante,
      fullName: matchedRecord.nombreCompleto,
      email,
      organization: matchedRecord.nombreEstablecimiento,
      estamento: matchedRecord.estamento.toLowerCase(),
      otp: otpCode,
    };

    const response = NextResponse.json({ user: publicUser });
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
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error ? error.message : 'No fue posible validar la identidad.',
      },
      { status: 400 },
    );
  }
}