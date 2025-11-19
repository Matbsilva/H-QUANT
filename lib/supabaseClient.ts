import { createClient } from '@supabase/supabase-js';

// No Next.js, usamos process.env.
// Variáveis públicas (client-side) devem começar com NEXT_PUBLIC_
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('🚨 ERRO CRÍTICO: Variáveis do Supabase não encontradas.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);