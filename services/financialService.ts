import { supabase } from './supabaseClient';
import { Transaction, AIAnalysisResponse } from '../types';

export class FinancialService {
  /**
   * Carregar todas as transações do usuário logado no Supabase.
   * Se a chave do Supabase não estiver configurada ou falhar, fallback para o formato seguro.
   */
  public async getTransactions(userId: string): Promise<Transaction[]> {
    if (!supabase) return [];

    try {
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', userId)
        .order('date', { ascending: false });

      if (error) {
        console.error('Erro ao buscar transações no Supabase:', error);
        return [];
      }

      return (data || []).map(row => ({
        id: row.id,
        date: row.date,
        description: row.description,
        amount: Number(row.amount),
        category: row.category,
        type: row.type,
        module: row.module,
        isFixed: row.is_fixed || false,
        dueDay: row.due_day || undefined,
        paid: row.paid || false,
        paymentDate: row.payment_date || undefined,
        installments: row.installments || undefined
      }));
    } catch (e) {
      console.error('Falha de rede/Supabase ao carregar transações:', e);
      return [];
    }
  }

  /**
   * Salvar ou atualizar transações em lote
   */
  public async upsertTransaction(userId: string, tx: Transaction): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('transactions')
        .upsert({
          id: tx.id,
          user_id: userId,
          date: tx.date,
          description: tx.description,
          amount: tx.amount,
          category: tx.category,
          type: tx.type,
          module: tx.module,
          is_fixed: tx.isFixed || false,
          due_day: tx.dueDay || null,
          paid: tx.paid || false,
          payment_date: tx.paymentDate || null,
          installments: tx.installments || null
        });

      if (error) {
        console.error('Erro ao salvar transação no Supabase:', error);
        return false;
      }
      return true;
    } catch (e) {
      console.error('Falha de comunicação ao salvar transação:', e);
      return false;
    }
  }

  /**
   * Remover transação no Supabase
   */
  public async deleteTransaction(userId: string, transactionId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('transactions')
        .delete()
        .eq('id', transactionId)
        .eq('user_id', userId);

      if (error) {
        console.error('Erro ao remover transação no Supabase:', error);
        return false;
      }
      return true;
    } catch (e) {
      console.error('Falha ao remover transação:', e);
      return false;
    }
  }

  /**
   * Carregar categorias personalizadas do usuário por escopo
   */
  public async getCategories(userId: string, scope: 'PERSONAL' | 'BUSINESS'): Promise<string[]> {
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('name')
        .eq('user_id', userId)
        .eq('scope', scope);

      if (error || !data) return [];
      return data.map(c => c.name);
    } catch (e) {
      return [];
    }
  }

  /**
   * Salvar nova categoria no Supabase
   */
  public async addCategory(userId: string, scope: 'PERSONAL' | 'BUSINESS', categoryName: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('categories')
        .insert({
          user_id: userId,
          scope,
          name: categoryName
        });

      if (error) console.error('Erro ao inserir categoria:', error);
      return !error;
    } catch (e) {
      return false;
    }
  }

  /**
   * Carregar lista de empresas cadastradas pelo usuário
   */
  public async getCompanies(userId: string): Promise<string[]> {
    try {
      const { data, error } = await supabase
        .from('companies')
        .select('name')
        .eq('user_id', userId);

      if (error || !data) return [];
      return data.map(c => c.name);
    } catch (e) {
      return [];
    }
  }

  /**
   * Adicionar empresa no Supabase
   */
  public async addCompany(userId: string, companyName: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('companies')
        .insert({
          user_id: userId,
          name: companyName
        });
      return !error;
    } catch (e) {
      return false;
    }
  }

  /**
   * Atualizar empresa no Supabase
   */
  public async updateCompany(userId: string, oldName: string, newName: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('companies')
        .update({ name: newName })
        .eq('user_id', userId)
        .eq('name', oldName);
      return !error;
    } catch (e) {
      return false;
    }
  }

  /**
   * Remover empresa do Supabase
   */
  public async deleteCompany(userId: string, companyName: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('companies')
        .delete()
        .eq('user_id', userId)
        .eq('name', companyName);
      return !error;
    } catch (e) {
      return false;
    }
  }

  /**
   * Obter configurações do usuário (módulos e exclusões de séries fixas/parceladas)
   */
  public async getUserSettings(userId: string): Promise<any> {
    try {
      const { data, error } = await supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error || !data) return null;
      return data;
    } catch (e) {
      return null;
    }
  }

  /**
   * Salvar alterações nas configurações do usuário
   */
  public async updateUserSettings(userId: string, settings: any): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('user_settings')
        .upsert({
          user_id: userId,
          ...settings,
          updated_at: new Date().toISOString()
        });
      return !error;
    } catch (e) {
      return false;
    }
  }

  /**
   * Salvar histórico do diagnóstico MBR Intelligence
   */
  public async saveAIDiagnostics(userId: string, scope: string, periodType: string, response: AIAnalysisResponse): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('ai_diagnostics')
        .insert({
          user_id: userId,
          scope,
          period_type: periodType,
          response_json: response
        });
      return !error;
    } catch (e) {
      return false;
    }
  }
}

export const financialService = new FinancialService();
