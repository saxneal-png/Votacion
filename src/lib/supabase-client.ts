import { createClient } from '@supabase/supabase-js';

const REAL_SUPABASE_URL = 'https://wpfbfvkfcpslxfgppsig.supabase.co';
const REAL_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndwZmJmdmtmY3BzbHhmZ3Bwc2lnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU1MDAxMjEsImV4cCI6MjEwMTA3NjEyMX0.L5nA5cOCc941L5HgARdWl3Mg0ne3k6e7QtRJN3ykcek';
const REAL_SERVICE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndwZmJmdmtmY3BzbHhmZ3Bwc2lnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NTUwMDEyMSwiZXhwIjoyMTAxMDc2MTIxfQ.p6m6RRcqi2iYUeP5IrZIcYoHGdiYRJ2Hy-ax_BqgqWc';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || REAL_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || REAL_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || REAL_SERVICE_KEY;

/**
 * Cliente Supabase Anónimo para uso público/cliente
 */
export const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: false },
});

/**
 * Cliente Supabase de Administración (Servidor / Service Role Key)
 * Usado exclusivamente en las API Routes server-side para saltarse RLS.
 */
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

/**
 * Interface para el registro de votante en el Padrón Electoral
 */
export interface PadronVotante {
  rut: string;
  nombre_completo: string;
  correo: string;
  estamento: 'directivos' | 'docentes' | 'asistentes';
  establecimiento_id: string;
  ha_votado: boolean;
}

/**
 * Verifica si las credenciales de Supabase son válidas (JWT)
 */
export function isSupabaseConfigured(): boolean {
  return supabaseServiceKey.startsWith('eyJ') && supabaseUrl.includes('supabase.co');
}

/**
 * Registra el voto de forma atómica en Supabase utilizando la función RPC PostgreSQL `emitir_voto_atomico`.
 * Si la función RPC no está disponible en la BD, cae a las inserciones separadas.
 */
export async function recordVoteInSupabase({
  estamento,
  candidateId,
  rut,
  rbd = '10101',
  nombreEstablecimiento = 'Establecimiento SLEP',
  email = '',
}: {
  estamento: string;
  candidateId: string;
  rut: string;
  rbd?: string;
  nombreEstablecimiento?: string;
  email?: string;
}): Promise<{ success: boolean; comprobanteId: string }> {
  try {
    const { data, error } = await supabaseAdmin.rpc('emitir_voto_atomico', {
      p_rut: rut.toLowerCase().trim(),
      p_candidate_id: candidateId,
      p_estamento: estamento,
      p_rbd: rbd,
      p_nombre_establecimiento: nombreEstablecimiento,
      p_email: email,
    });

    if (!error && data?.success) {
      return {
        success: true,
        comprobanteId: data.receiptCode || data.folio,
      };
    }

    if (error && !error.message.includes('function') && !error.message.includes('schema')) {
      console.error('[SUPABASE RPC] Error en RPC emitir_voto_atomico:', error.message);
    }
  } catch (rpcErr) {
    console.warn('[SUPABASE RPC] Fallback a inserción cliente:', rpcErr);
  }

  const comprobanteId = `COMP-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

  // 1. Insertar el voto en la urna anónima (sin RUT)
  const { error: voteError } = await supabaseAdmin.from('votos_anonimos').insert([
    {
      estamento,
      candidate_id: candidateId,
      created_at: new Date().toISOString(),
    },
  ]);

  if (voteError) {
    throw new Error(`Error al registrar el voto: ${voteError.message}`);
  }

  // 2. Registrar la participación (asociada al RUT pero separada del sentido del voto)
  const { error: participationError } = await supabaseAdmin
    .from('registro_participacion')
    .insert([
      {
        rut: rut.toLowerCase().trim(),
        comprobante_id: comprobanteId,
        voted_at: new Date().toISOString(),
      },
    ]);

  if (participationError) {
    console.error('Error en marca de participación:', participationError);
  }

  return { success: true, comprobanteId };
}
