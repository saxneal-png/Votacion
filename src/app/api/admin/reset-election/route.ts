import { type NextRequest, NextResponse } from 'next/server';

import { addAuditEntry } from '@/lib/admin-session';
import { resetMetrics } from '@/lib/metrics-store';
import { resetPadronVotesAsync } from '@/lib/padron-store';
import { clearVotedUsers } from '@/lib/server-session';
import { resetVotingRecords } from '@/lib/voting-record-store';
import { supabaseAdmin } from '@/lib/supabase';

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

    // 1. Resetear marcas de voto en el Padrón Electoral (Memoria y Supabase bd_padron)
    await resetPadronVotesAsync();

    // 2. Limpiar el registro de usuarios que ya han votado en sesión
    clearVotedUsers();

    // 3. Vaciar urnas electrónicas y contadores de métricas
    resetMetrics();

    // 4. Vaciar el registro oficial de sufragios con folio (Memoria y Supabase acta_sufragio)
    resetVotingRecords();

    // 5. Eliminar votos acumulados y tablas en Supabase PostgreSQL si están activas
    if (supabaseAdmin) {
      try {
        await supabaseAdmin.from('acta_sufragio').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        await supabaseAdmin.from('votos_anonimos').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        await supabaseAdmin.from('registro_participacion').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        await supabaseAdmin.from('candidatos').update({ votos_acumulados: 0 }).neq('id', 'RESET_ALL');
      } catch (err) {
        console.error('[SUPABASE] Error limpiando tablas en reset-election:', err);
      }
    }

    // 6. Registrar en la bitácora de auditoría oficial
    addAuditEntry({
      ts: Date.now(),
      ip: request.headers.get('x-forwarded-for') || '127.0.0.1',
      event: 'access',
      detail:
        'REINICIO PROCESO ELECTORAL: Se restablecieron a cero todas las marcas del padrón, actas de sufragio y conteos de la urna en la base de datos.',
    });

    return NextResponse.json({
      success: true,
      message:
        'El proceso electoral ha sido reiniciado exitosamente. Todas las marcas del padrón electoral, actas de sufragio y métricas de participación fueron restablecidas a cero.',
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
