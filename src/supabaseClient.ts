import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://slgeigpsyvfxpwyudmxe.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_vWIvqBfO9hrH9nyazZWqnw_rY-d84UT';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    'Supabase environment variables (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY) are missing! Auth and Realtime calls will fail until set.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
