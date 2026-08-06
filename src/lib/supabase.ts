import { supabaseClient, supabaseAdmin } from '@/lib/supabase-client';

export const isSupabaseConfigured = Boolean(supabaseClient);

/**
 * Re-exportación Singleton para evitar instancias duplicadas de GoTrueClient en el navegador.
 */
export const supabase = supabaseClient;
export { supabaseAdmin };
