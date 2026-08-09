import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    'Supabase URL ou Anon Key não configuradas no arquivo .env. Configure VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY para habilitar a conexão com o banco de dados Supabase.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
