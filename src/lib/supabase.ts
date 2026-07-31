import { createClient } from '@supabase/supabase-js';

// Las claves JWT reales de Supabase (anon key y service_role key)
const FALLBACK_SUPABASE_URL = 'https://wpfbfvkfcpslxfgppsig.supabase.co';
const FALLBACK_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndwZmJmdmtmY3BzbHhmZ3Bwc2lnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU1MDAxMjEsImV4cCI6MjEwMTA3NjEyMX0.L5nA5cOCc941L5HgARdWl3Mg0ne3k6e7QtRJN3ykcek';
const FALLBACK_SERVICE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndwZmJmdmtmY3BzbHhmZ3Bwc2lnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NTUwMDEyMSwiZXhwIjoyMTAxMDc2MTIxfQ.p6m6RRcqi2iYUeP5IrZIcYoHGdiYRJ2Hy-ax_BqgqWc';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || FALLBACK_SUPABASE_URL;

// En el servidor (rutas API de Next.js) se prefiere la clave service_role para saltarse RLS.
// En el cliente browser se usa la clave anon pública.
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  FALLBACK_SERVICE_KEY;

// Validar que la clave es un JWT real (empieza con "eyJ")
const isValidJwt = (key: string) => key.startsWith('eyJ');

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseKey && isValidJwt(supabaseKey));

if (!isSupabaseConfigured) {
  console.warn(
    '[SUPABASE] Clave de Supabase inválida o no configurada. Operando en modo memoria temporal.',
  );
} else {
  console.log('[SUPABASE] Cliente inicializado correctamente con proyecto:', supabaseUrl);
}

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false },
    })
  : null;
