import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { formatRut } from '@/lib/rut-validator';


const REAL_SUPABASE_URL = 'https://wpfbfvkfcpslxfgppsig.supabase.co';
const REAL_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndwZmJmdmtmY3BzbHhmZ3Bwc2lnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU1MDAxMjEsImV4cCI6MjEwMTA3NjEyMX0.L5nA5cOCc941L5HgARdWl3Mg0ne3k6e7QtRJN3ykcek';
const REAL_SERVICE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndwZmJmdmtmY3BzbHhmZ3Bwc2lnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NTUwMDEyMSwiZXhwIjoyMTAxMDc2MTIxfQ.p6m6RRcqi2iYUeP5IrZIcYoHGdiYRJ2Hy-ax_BqgqWc';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || REAL_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || REAL_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || REAL_SERVICE_KEY;

// Singleton global para evitar "Multiple GoTrueClient instances detected"
const globalForSupabase = globalThis as unknown as {
  __supabaseClient?: SupabaseClient;
  __supabaseAdmin?: SupabaseClient;
};

export const supabaseClient: SupabaseClient =
  globalForSupabase.__supabaseClient ??
  (globalForSupabase.__supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      storageKey: 'sb-anon-auth-token',
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  }));

export const supabaseAdmin: SupabaseClient =
  globalForSupabase.__supabaseAdmin ??
  (globalForSupabase.__supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      storageKey: 'sb-admin-auth-token',
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  }));


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
}): Promise<{ success: boolean; comprobanteId: string; folio?: string; receiptCode?: string }> {
  try {
    const { data, error } = await supabaseAdmin.rpc('emitir_voto_atomico', {
      p_rut: rut.toLowerCase().trim(),
      p_candidate_id: candidateId,
      p_estamento: estamento,
      p_rbd: rbd,
      p_nombre_establecimiento: nombreEstablecimiento,
      p_email: email,
    });

    if (error) {
      const msg = error.message || '';
      if (msg.includes('ALREADY_VOTED') || msg.includes('ya ha emitido su voto')) {
        const err = Object.assign(new Error('Ya has emitido tu voto en esta eleccion.'), { code: 'ALREADY_VOTED' });
        throw err;
      }
      if (msg.includes('VOTANTE_INHABILITADO') || msg.includes('inhabilitado')) {
        const err = Object.assign(new Error('El votante se encuentra inhabilitado para participar.'), { code: 'VOTANTE_INHABILITADO' });
        throw err;
      }
      if (msg.includes('VOTANTE_NO_ENCONTRADO') || msg.includes('no fue encontrado')) {
        const err = Object.assign(new Error('Votante no encontrado en el padrón electoral.'), { code: 'VOTANTE_NO_ENCONTRADO' });
        throw err;
      }
      console.error('[SUPABASE RPC] Error en RPC emitir_voto_atomico:', msg);
    }

    if (data?.success) {
      return {
        success: true,
        comprobanteId: data.receiptCode || data.folio,
        receiptCode: data.receiptCode,
        folio: data.folio,
      };
    }
  } catch (rpcErr) {
    if ((rpcErr as Record<string, unknown>)?.code) {
      throw rpcErr;
    }
    console.warn('[SUPABASE RPC] Fallback a inserción individual:', rpcErr);
  }

  const comprobanteId = `COMP-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
  const cleanRutStr = rut.replace(/[^0-9kK]/g, '').toUpperCase();
  const formattedRutStr = formatRut(cleanRutStr);


  // 1. Insertar el voto en la urna anónima (sin RUT)
  const { error: voteError } = await supabaseAdmin.from('votos_anonimos').insert([
    {
      estamento,
      candidate_id: candidateId,
      created_at: new Date().toISOString(),
    },
  ]);

  if (voteError) {
    throw new Error(`Error al registrar el voto en la urna anónima: ${voteError.message}`);
  }

  // 2. Registrar la participación en el acta de sufragio
  const { error: participationError } = await supabaseAdmin
    .from('acta_sufragio')
    .insert([
      {
        folio: comprobanteId,
        rut_votante: cleanRutStr,
        formatted_rut_votante: formattedRutStr,
        email_registrado: email,
        estamento,
        rbd_establecimiento: rbd,
        nombre_establecimiento: nombreEstablecimiento,
        fecha_hora: new Date().toISOString(),
      },
    ]);

  if (participationError) {
    console.error('[SUPABASE] Error al registrar acta de sufragio:', participationError.message);
    throw new Error(`Error al registrar el acta de sufragio: ${participationError.message}`);
  }

  // 3. Marcar el padrón bd_padron como ha_votado = true
  const estVariants = [
    estamento.toUpperCase(),
    estamento.toLowerCase(),
    estamento.charAt(0).toUpperCase() + estamento.slice(1).toLowerCase(),
    estamento.slice(0, -1), // singular (ej. Docente)
  ];

  const { error: padronError } = await supabaseAdmin
    .from('bd_padron')
    .update({
      ha_votado: true,
      fecha_voto: new Date().toISOString(),
    })
    .or(`rut_votante.ilike.%${cleanRutStr}%,formatted_rut_votante.ilike.%${cleanRutStr}%`)
    .in('estamento', estVariants);

  if (padronError) {
    console.error('[SUPABASE] Error al actualizar estado ha_votado en bd_padron:', padronError.message);
  }

  return { success: true, comprobanteId, receiptCode: comprobanteId, folio: comprobanteId };
}


