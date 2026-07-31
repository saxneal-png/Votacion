import { createClient } from '@supabase/supabase-js';

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://wpfbfvkfcpslxfgppsig.supabase.co';
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const isPlaceholderKey =
  !supabaseKey ||
  supabaseKey.includes('tu-anon-key') ||
  supabaseKey.includes('tu-service-role');

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseKey && !isPlaceholderKey);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false },
    })
  : null;
