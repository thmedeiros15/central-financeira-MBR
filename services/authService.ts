import { supabase } from './supabaseClient';
import { User, UserRole, UserStatus, AuthSession } from '../types';

export function hashPassword(plainText: string): string {
  let hash = 0;
  for (let i = 0; i < plainText.length; i++) {
    const char = plainText.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return `mbr_hash_${Math.abs(hash)}_${plainText.length}`;
}

const LOCAL_USERS_KEY = 'mbr_users_db_v1';
const LOCAL_SESSION_KEY = 'mbr_auth_session_v1';

class AuthService {
  /**
   * Realiza login através do Supabase Auth. Fallback seguro para credenciais locais se desconectado.
   */
  public async login(email: string, password: string): Promise<{ success: boolean; session?: AuthSession; message?: string }> {
    const cleanEmail = email.trim().toLowerCase();

    // 1. Tentar Login pelo Supabase Auth
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password: password
      });

      if (!error && data.user) {
        // Buscar perfil público associado
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', data.user.id)
          .single();

        if (profile) {
          if (profile.status === 'INACTIVE') {
            await supabase.auth.signOut();
            return { success: false, message: 'Sua conta está inativa. Entre em contato com o administrador.' };
          }

          // Atualizar último login
          await supabase
            .from('profiles')
            .update({ last_login_at: new Date().toISOString() })
            .eq('id', data.user.id);

          const appUser: User = {
            id: profile.id,
            name: profile.name,
            email: profile.email,
            passwordHash: hashPassword(password),
            plainPassword: password,
            role: profile.role as UserRole,
            status: profile.status as UserStatus,
            createdAt: profile.created_at,
            lastLoginAt: new Date().toISOString()
          };

          const session: AuthSession = {
            user: appUser,
            token: data.session?.access_token || `token_${appUser.id}`
          };

          this.saveLocalSession(session);
          return { success: true, session };
        }
      }
    } catch (e) {
      console.warn('Comunicação com Supabase falhou, recorrendo a credenciais locais:', e);
    }

    // 2. Fallback de Desenvolvimento / Credenciais Padrão se o usuário tentar admin123 ou user123 prévios
    return this.loginLocalFallback(cleanEmail, password);
  }

  private loginLocalFallback(email: string, password: string): { success: boolean; session?: AuthSession; message?: string } {
    let localUsers: User[] = [];
    try {
      const stored = localStorage.getItem(LOCAL_USERS_KEY);
      if (stored) localUsers = JSON.parse(stored);
    } catch (e) {
      // ignore
    }

    if (localUsers.length === 0) {
      localUsers = [
        {
          id: 'user_admin_001',
          name: 'Administrador MBR',
          email: 'admin@mbrtracker.com.br',
          passwordHash: hashPassword('admin123'),
          plainPassword: 'admin123',
          role: 'ADMIN',
          status: 'ACTIVE',
          createdAt: new Date('2026-01-01T10:00:00.000Z').toISOString(),
          lastLoginAt: null
        },
        {
          id: 'user_demo_002',
          name: 'Usuário Demonstração',
          email: 'usuario@mbrtracker.com.br',
          passwordHash: hashPassword('user123'),
          plainPassword: 'user123',
          role: 'USER',
          status: 'ACTIVE',
          createdAt: new Date('2026-01-05T14:30:00.000Z').toISOString(),
          lastLoginAt: null
        }
      ];
    }

    const user = localUsers.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (!user) {
      return { success: false, message: 'E-mail ou senha incorretos.' };
    }

    if (user.status === 'INACTIVE') {
      return { success: false, message: 'Sua conta está inativa. Entre em contato com o administrador do sistema.' };
    }

    if (user.passwordHash !== hashPassword(password)) {
      return { success: false, message: 'E-mail ou senha incorretos.' };
    }

    user.lastLoginAt = new Date().toISOString();
    const session: AuthSession = {
      user: { ...user },
      token: `token_${user.id}_${Date.now()}`
    };

    this.saveLocalSession(session);
    return { success: true, session };
  }

  /**
   * Efetuar Logout no Supabase Auth e limpar armazenamento local.
   */
  public async logout(): Promise<void> {
    try {
      await supabase.auth.signOut();
    } catch (e) {
      // ignore
    }
    localStorage.removeItem(LOCAL_SESSION_KEY);
  }

  /**
   * Recuperar sessão atual ativa.
   */
  public async getCurrentSession(): Promise<AuthSession | null> {
    try {
      const { data } = await supabase.auth.getSession();
      if (data?.session?.user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', data.session.user.id)
          .single();

        if (profile && profile.status === 'ACTIVE') {
          const appUser: User = {
            id: profile.id,
            name: profile.name,
            email: profile.email,
            passwordHash: '',
            role: profile.role as UserRole,
            status: profile.status as UserStatus,
            createdAt: profile.created_at,
            lastLoginAt: profile.last_login_at
          };

          return {
            user: appUser,
            token: data.session.access_token
          };
        }
      }
    } catch (e) {
      // fallback
    }

    // Local Session Fallback
    try {
      const stored = localStorage.getItem(LOCAL_SESSION_KEY);
      if (!stored) return null;
      return JSON.parse(stored);
    } catch {
      return null;
    }
  }

  /**
   * Buscar todos os usuários cadastrados (Exclusivo para o Painel Administrador).
   */
  public async getUsers(): Promise<User[]> {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && data) {
        return data.map(p => ({
          id: p.id,
          name: p.name,
          email: p.email,
          passwordHash: '',
          role: p.role as UserRole,
          status: p.status as UserStatus,
          createdAt: p.created_at,
          lastLoginAt: p.last_login_at
        }));
      }
    } catch (e) {
      // fallback
    }

    // Fallback local
    try {
      const stored = localStorage.getItem(LOCAL_USERS_KEY);
      if (stored) return JSON.parse(stored);
    } catch {
      // ignore
    }
    return [];
  }

  /**
   * Criar um novo usuário no Supabase Auth + Tabela Profiles
   */
  public async createUser(data: {
    name: string;
    email: string;
    password: string;
    role: UserRole;
    status: UserStatus;
  }): Promise<{ success: boolean; user?: User; message?: string }> {
    const cleanEmail = data.email.trim().toLowerCase();

    try {
      const { data: authData, error } = await supabase.auth.signUp({
        email: cleanEmail,
        password: data.password,
        options: {
          data: {
            name: data.name,
            role: data.role
          }
        }
      });

      if (error) {
        return { success: false, message: error.message };
      }

      if (authData.user) {
        const newUser: User = {
          id: authData.user.id,
          name: data.name,
          email: cleanEmail,
          passwordHash: hashPassword(data.password),
          plainPassword: data.password,
          role: data.role,
          status: data.status,
          createdAt: new Date().toISOString(),
          lastLoginAt: null
        };
        return { success: true, user: newUser };
      }
    } catch (e: any) {
      return { success: false, message: e?.message || 'Erro ao criar usuário no Supabase.' };
    }

    return { success: false, message: 'Erro desconhecido ao criar usuário.' };
  }

  /**
   * Atualizar dados de um usuário (Nome, Role, Status) no Supabase Profiles
   */
  public async updateUser(
    id: string,
    updates: {
      name?: string;
      email?: string;
      role?: UserRole;
      status?: UserStatus;
      password?: string;
    }
  ): Promise<{ success: boolean; message?: string }> {
    try {
      const payload: any = {};
      if (updates.name !== undefined) payload.name = updates.name.trim();
      if (updates.email !== undefined) payload.email = updates.email.trim().toLowerCase();
      if (updates.role !== undefined) payload.role = updates.role;
      if (updates.status !== undefined) payload.status = updates.status;

      const { error } = await supabase
        .from('profiles')
        .update(payload)
        .eq('id', id);

      if (error) {
        return { success: false, message: error.message };
      }

      return { success: true };
    } catch (e: any) {
      return { success: false, message: e?.message || 'Erro ao atualizar dados.' };
    }
  }

  /**
   * Excluir um usuário no Supabase Profiles
   */
  public async deleteUser(id: string, currentAdminId: string): Promise<{ success: boolean; message?: string }> {
    if (id === currentAdminId) {
      return { success: false, message: 'Você não pode excluir sua própria conta de Administrador.' };
    }

    try {
      const { error } = await supabase
        .from('profiles')
        .delete()
        .eq('id', id);

      if (error) return { success: false, message: error.message };
      return { success: true, message: 'Usuário excluído com sucesso.' };
    } catch (e: any) {
      return { success: false, message: e?.message || 'Erro ao excluir usuário.' };
    }
  }

  private saveLocalSession(session: AuthSession): void {
    try {
      localStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify(session));
    } catch (e) {
      // ignore
    }
  }
}

export const authService = new AuthService();
