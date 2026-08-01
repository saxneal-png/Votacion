import { NextResponse } from 'next/server';
import { sendOtpEmail } from '@/lib/ms-graph-mailer';

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      toEmail?: string;
      userName?: string;
      otpCode?: string;
    };

    if (!body.toEmail || !body.otpCode) {
      return NextResponse.json(
        { message: 'Faltan parámetros requeridos toEmail u otpCode' },
        { status: 400 },
      );
    }

    const result = await sendOtpEmail({
      toEmail: body.toEmail,
      userName: body.userName || 'Estimado(a) Votante',
      otpCode: body.otpCode,
    });

    return NextResponse.json({
      success: true,
      message: 'Correo OTP procesado exitosamente desde la cola',
      result,
    });
  } catch (error) {
    console.error('[API JOB SEND-EMAIL] Error al procesar correo:', error);
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : 'Error interno al procesar correo en cola',
      },
      { status: 500 },
    );
  }
}
