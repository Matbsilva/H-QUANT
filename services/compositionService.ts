import { supabase } from '../lib/supabaseClient';
import { Composicao } from '../types';

export const compositionService = {
  
  // Busca todas as composições do banco (Carregar)
  async fetchAll(): Promise<Composicao[]> {
    // 'composicoes' é o nome da tabela que você vai criar no SQL Editor do Supabase
    const { data, error } = await supabase
      .from('composicoes')
      .select('*')
      .order('titulo', { ascending: true });

    if (error) {
      console.error('Erro ao buscar composições:', error);
      // Se der erro (ex: tabela não existe), retorna array vazio para não quebrar o app
      return [];
    }

    return data as Composicao[];
  },

  // Salva uma nova composição (Criar)
  async create(composition: Omit<Composicao, 'id'>): Promise<Composicao> {
    // Removemos o ID temporário (ex: "temp-1") para o banco gerar um UUID real
    const { id, ...dataToSave } = composition as any;

    const { data, error } = await supabase
      .from('composicoes')
      .insert([dataToSave])
      .select()
      .single();

    if (error) {
      console.error('Erro ao salvar composição:', error);
      throw error;
    }

    return data as Composicao;
  },

  // Remove uma composição (Deletar)
  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('composicoes')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Erro ao deletar composição:', error);
      throw error;
    }
  }
};