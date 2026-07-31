import { type NextRequest, NextResponse } from 'next/server';

import {
  generateOtpToken,
  sendOtpEmailViaGraph,
  updateAzureM365Config,
} from '@/lib/azure-m365-service';
import { getMockUserByRut } from '@/lib/mock-api';

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      rutVotante?: string;
      emailDestino?: string;
      esSimulacion?: boolean;
    };

    const rutVotante = body.rutVotante?.trim() || '16940271-k';
    const emailDestino = body.emailDestino?.trim();
    const esSimulacion = body.esSimulacion ?? false;

    if (!emailDestino) {
      return NextResponse.json(
        { message: 'Debes proporcionar la dirección de correo de destino (emailDestino).' },
        { status: 400 },
      );
    }

    // Configurar modo de simulación o producción según la petición
    updateAzureM365Config({ useSimulation: esSimulacion });

    const user = getMockUserByRut(rutVotante);
    const voterName = user?.fullName || 'Votante Oficial Decreto 102';
    const estamento = user?.estamento || 'docentes';

    // Generar token OTP y Magic Link de 10 minutos
    const otpData = generateOtpToken(rutVotante, estamento);

    // Despachar correo vía M365 Graph API (o Simulación)
    const sendResult = await sendOtpEmailViaGraph({
      toEmail: emailDestino,
      voterName,
      estamentoLabel: estamento.toUpperCase(),
      otp: otpData.otp,
      magicToken: otpData.magicToken,
    });

    if (!sendResult.success) {
      return NextResponse.json(
        {
          success: false,
          message: sendResult.message,
        },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      message: `Correo de acreditación electoral despachado exitosamente a ${emailDestino}`,
      mode: sendResult.mode,
      otp: otpData.otp,
      magicToken: otpData.magicToken,
      expiresAtFormatted: otpData.expiresAtFormatted,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Error inesperado al despachar correo de acreditación.',
      },
      { status: 500 },
    );
  }
}
