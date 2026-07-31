import { type NextRequest, NextResponse } from 'next/server';

import { sendOtpEmailViaGraph } from '@/lib/azure-m365-service';
import { createTempToken, validateFuncionarioAuth } from '@/services/authRulesService';

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      rutFuncionario?: string;
      emailDestino?: string;
    };

    const rutFuncionario = body.rutFuncionario?.trim() || '';
    const emailDestino = body.emailDestino?.trim() || '';

    // 1. Validar reglas del Estamento Funcionarios y Docentes (Dominio @eduvallediguillin.gob.cl)
    const matchedRecord = validateFuncionarioAuth(rutFuncionario, emailDestino);

    // 2. Generar Token Temporal de Acceso (10 min)
    const tempToken = createTempToken({
      rutVotante: matchedRecord.rutVotante,
      nombreVotante: matchedRecord.nombreCompleto,
      estamentoDestino: matchedRecord.estamento,
      rbdEstablecimiento: matchedRecord.rbdEstablecimiento,
      nombreEstablecimiento: matchedRecord.nombreEstablecimiento,
      emailDestino,
    });

    // 3. Despachar Enlace Mágico por correo M365
    await sendOtpEmailViaGraph({
      toEmail: emailDestino,
      voterName: matchedRecord.nombreCompleto,
      estamentoLabel: matchedRecord.estamento,
      otp: Math.floor(100000 + Math.random() * 900000).toString(),
      magicToken: tempToken.token,
    });

    return NextResponse.json({
      success: true,
      message: `Enlace de acreditación enviado a tu casilla ${emailDestino}. Revisa tu correo institucional para ingresar a la papeleta de Funcionarios.`,
      token: tempToken.token,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Error al procesar la acreditación de funcionario.',
      },
      { status: 400 },
    );
  }
}
