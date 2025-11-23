import { supabase } from '../lib/supabaseClient';
import { Composicao } from '../types';

export const compositionService = {

  // Busca todas as composições do banco (Carregar)
  async fetchAll(): Promise<Composicao[]> {
    const { data, error } = await supabase
      .from('composicoes')
      .select('*')
      .order('titulo', { ascending: true });

    if (error) {
      console.error('Erro ao buscar composições:', error);
      return [];
    }

    return data as Composicao[];
  },

  // Busca composições com paginação
  async fetchPage(page: number, limit: number): Promise<{ data: Composicao[], count: number }> {
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const { data, error, count } = await supabase
      .from('composicoes')
      .select('*', { count: 'exact' })
      .order('titulo', { ascending: true })
      .range(from, to);

    if (error) {
      console.error('Erro ao buscar página de composições:', error);
      return { data: [], count: 0 };
    }

    return { data: data as Composicao[], count: count || 0 };
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