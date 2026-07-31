import { NextResponse } from 'next/server';

import { sendOtpEmail } from '@/lib/ms-graph-mailer';

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { toEmail?: string };
    const toEmail = body.toEmail?.trim();

    if (!toEmail) {
      return NextResponse.json(
        { message: 'Debes proporcionar la propiedad toEmail en el cuerpo de la petición.' },
        { status: 400 },
      );
    }

    // Generar un código OTP de prueba aleatorio de 6 dígitos
    const testOtp = Math.floor(100000 + Math.random() * 900000).toString();

    const result = await sendOtpEmail({
      toEmail,
      userName: 'Usuario Pruebas SLEP',
      otpCode: testOtp,
    });

    return NextResponse.json({
      success: true,
      message: `Correo OTP de prueba enviado exitosamente a ${toEmail}`,
      testOtpGenerated: testOtp,
      result,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
    console.error('Error en /api/test-email:', error);

    return NextResponse.json(
      {
        success: false,
        message: `Fallo al enviar correo de prueba: ${errorMessage}`,
        details: 'Asegúrate de haber configurado MS_GRAPH_TENANT_ID y MS_GRAPH_CLIENT_SECRET en .env.local',
      },
      { status: 500 },
    );
  }
}
