import { type NextRequest, NextResponse } from 'next/server';

import { addAuditEntry } from '@/lib/admin-session';
import { resetMetrics } from '@/lib/metrics-store';
import { resetPadronVotes } from '@/lib/padron-store';
import { clearVotedUsers } from '@/lib/server-session';
import { resetVotingRecords } from '@/lib/voting-record-store';

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as { adminPin?: string };
    const adminPin = body.adminPin?.trim() || '';

    const expectedPin = process.env.ADMIN_PIN || 'admin1234';

    if (adminPin !== expectedPin) {
      return NextResponse.json(
        {
          success: false,
          message: 'Clave de Administrador incorrecta. Operación de reinicio cancelada.',
        },
        { status: 401 },
      );
    }

    // 1. Resetear el estado de votos en el Padrón Electoral
    resetPadronVotes();

    // 2. Limpiar el registro de usuarios que ya han votado en sesión
    clearVotedUsers();

    // 3. Vaciar urnas electrónicas y contadores de métricas
    resetMetrics();

    // 4. Vaciar el registro de sufragios con folio
    resetVotingRecords();

    // 4. Registrar en la bitácora de auditoría oficial
    addAuditEntry({
      ts: Date.now(),
      ip: request.headers.get('x-forwarded-for') || '127.0.0.1',
      event: 'access',
      detail:
        'REINICIO PROCESO ELECTORAL: Se restablecieron a cero todas las marcas del padrón y el conteo de votos de la urna.',
    });

    return NextResponse.json({
      success: true,
      message:
        'El proceso electoral ha sido reiniciado exitosamente. Todas las marcas del padrón electoral y conteos de la urna electrónica fueron restablecidos a cero.',
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Error inesperado al reiniciar la votación.',
      },
      { status: 500 },
    );
  }
}
