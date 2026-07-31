import { type NextRequest, NextResponse } from 'next/server';

import { sendOtpEmailViaGraph } from '@/lib/azure-m365-service';
import { createTempToken, validateApoderadoAuth } from '@/services/authRulesService';

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      rutApoderado?: string;
      rutEstudiante?: string;
      emailDestino?: string;
    };

    const rutApoderado = body.rutApoderado?.trim() || '';
    const rutEstudiante = body.rutEstudiante?.trim() || '';
    const emailDestino = body.emailDestino?.trim() || '';

    // 1. Validar reglas del Estamento Padres y Apoderados
    const matchedRecord = validateApoderadoAuth(rutApoderado, rutEstudiante, emailDestino);

    // 2. Generar Token Temporal de Acceso (10 min)
    const tempToken = createTempToken({
      rutVotante: matchedRecord.rutVotante,
      rutEstudiante: matchedRecord.rutEstudianteAsociado ?? undefined,
      estamentoDestino: 'PADRES_APODERADOS',
      rbdEstablecimiento: matchedRecord.rbdEstablecimiento,
      nombreEstablecimiento: matchedRecord.nombreEstablecimiento,
      emailDestino,
    });

    // 3. Despachar Enlace Mágico por correo M365
    await sendOtpEmailViaGraph({
      toEmail: emailDestino,
      voterName: matchedRecord.nombreCompleto,
      estamentoLabel: 'PADRES Y APODERADOS',
      otp: Math.floor(100000 + Math.random() * 900000).toString(),
      magicToken: tempToken.token,
    });

    return NextResponse.json({
      success: true,
      message: `Enlace de acreditación enviado a ${emailDestino}. Revisa tu correo para ingresar a la papeleta de Apoderados.`,
      token: tempToken.token,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Error al procesar la acreditación de apoderado.',
      },
      { status: 400 },
    );
  }
}
