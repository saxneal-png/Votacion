import { createClient } from '@supabase/supabase-js';

const DEFAULT_SUPABASE_KEY = 'sb_publishable_7BVdLVWXR5m5gFcNXMw-vg_TKHjSsEN';

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://wpfbfvkfcpslxfgppsig.supabase.co';
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  DEFAULT_SUPABASE_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseKey);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false },
    })
  : null;
