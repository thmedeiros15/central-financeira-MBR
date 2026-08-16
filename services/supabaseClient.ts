import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'placeholder-key';
const supabaseServiceKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY || '';

if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) {
  console.warn(
    'Supabase URL ou Anon Key vazias no arquivo .env.'
  );
}

// Cliente padrão com anon key (para usuários autenticados, RLS ativo)
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Cliente admin com service_role key (bypassar RLS, criar usuários sem e-mail de confirmação)
// ATENÇÃO: Nunca exponha esta chave publicamente. Em produção, use um backend server.
export const supabaseAdmin = supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })
  : null;
