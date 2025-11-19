import { createClient } from '@supabase/supabase-js';

// O "as string" força o tipo, e o "|| ''" garante um valor padrão.
const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string) || '';
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string) || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('🚨 ERRO CRÍTICO: Variáveis do Supabase não encontradas.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);