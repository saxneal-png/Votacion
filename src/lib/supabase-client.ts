import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://tu-proyecto.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'tu-anon-key';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseAnonKey;

/**
 * Cliente Supabase Anónimo para uso público/cliente
 */
export const supabaseClient = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Cliente Supabase de Administración (Servidor / Service Role Key)
 * Usado exclusivamente en las API Routes server-side.
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
 * Verifica si las credenciales de Supabase están configuradas
 */
export function isSupabaseConfigured(): boolean {
  return (
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL) &&
    process.env.NEXT_PUBLIC_SUPABASE_URL !== 'https://tu-proyecto.supabase.co' &&
    Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY) &&
    process.env.SUPABASE_SERVICE_ROLE_KEY !== 'tu-service-role-key-aqui'
  );
}

/**
 * Consulta el padrón electoral en Supabase por RUT y correo
 */
export async function getVoterFromSupabase(
  rut: string,
  email: string,
): Promise<PadronVotante | null> {
  if (!isSupabaseConfigured()) {
    console.warn('Supabase no está configurado. Usando mock local.');
    return null;
  }

  const { data, error } = await supabaseAdmin
    .from('padron_electoral')
    .select('*')
    .eq('rut', rut.toLowerCase().trim())
    .eq('correo', email.toLowerCase().trim())
    .single();

  if (error || !data) {
    return null;
  }

  return data as PadronVotante;
}

/**
 * Registra el voto anónimo y marca al votante como "ha_votado"
 */
export async function recordVoteInSupabase({
  estamento,
  candidateId,
  rut,
}: {
  estamento: string;
  candidateId: string;
  rut: string;
}): Promise<{ success: boolean; comprobanteId: string }> {
  const comprobanteId = `COMP-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

  if (!isSupabaseConfigured()) {
    return { success: true, comprobanteId };
  }

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

  // 3. Actualizar estado en padrón
  await supabaseAdmin
    .from('padron_electoral')
    .update({ ha_votado: true })
    .eq('rut', rut.toLowerCase().trim());

  return { success: true, comprobanteId };
}
