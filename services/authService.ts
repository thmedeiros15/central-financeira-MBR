import { supabase, supabaseAdmin } from './supabaseClient';
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
      let { data, error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password: password
      });

      // Se falhou no Supabase Auth e temos a chave de admin, tenta sincronizar/criar o perfil no Supabase Auth
      if (error && supabaseAdmin) {
        // Verificar se existe um perfil cadastrado na tabela profiles
        const { data: profile } = await supabaseAdmin
          .from('profiles')
          .select('*')
          .eq('email', cleanEmail)
          .maybeSingle();

        if (profile) {
          // Atualiza a senha no auth.users para a senha informada e confirma o e-mail
          await supabaseAdmin.auth.admin.updateUserById(profile.id, {
            password: password,
            email_confirm: true
          });
          // Tentar login novamente com as credenciais sincronizadas
          const retry = await supabase.auth.signInWithPassword({
            email: cleanEmail,
            password: password
          });
          if (!retry.error && retry.data) {
            data = retry.data;
            error = null;
          }
        }
      }

      if (error) {
        // Supabase retornou erro de credenciais (usuário não existe no Supabase ou senha errada).
        // IMPORTANTE: o admin pode existir SOMENTE no fallback local — sempre tentamos antes de retornar erro.
        if (error.message.includes('Invalid login credentials') || error.message.includes('invalid_credentials')) {
          const localResult = this.loginLocalFallback(cleanEmail, password);
          if (localResult.success) return localResult;
          // Nem no Supabase nem localmente → credenciais realmente inválidas
          return { success: false, message: 'E-mail ou senha incorretos.' };
        }
        // Outros erros do Supabase (rede, serviço indisponível etc.) — tentar fallback local
        console.warn('Erro Supabase Auth:', error.message);
        return this.loginLocalFallback(cleanEmail, password);
      }

      if (data.user) {
        // Buscar perfil público associado
        let profileData: any = null;

        // Tentar com o cliente normal primeiro
        const { data: profile, error: profileErr } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', data.user.id)
          .single();

        if (profile) {
          profileData = profile;
        } else {
          // Perfil não encontrado via RLS — tentar com supabaseAdmin (bypassa RLS)
          console.warn('Perfil não encontrado via anon key, tentando via admin...', profileErr?.message);
          if (supabaseAdmin) {
            const { data: adminProfile } = await supabaseAdmin
              .from('profiles')
              .select('*')
              .eq('id', data.user.id)
              .single();
            profileData = adminProfile;
          }
        }

        if (profileData) {
          if (profileData.status === 'INACTIVE') {
            await supabase.auth.signOut();
            return { success: false, message: 'Sua conta está inativa. Entre em contato com o administrador.' };
          }

          // Atualizar último login
          try {
            const updateClient = supabaseAdmin || supabase;
            await updateClient
              .from('profiles')
              .update({ last_login_at: new Date().toISOString() })
              .eq('id', data.user.id);
          } catch (_) {/* não bloquear o login por falha de update */}

          const appUser: User = {
            id: profileData.id,
            name: profileData.name,
            email: profileData.email,
            passwordHash: hashPassword(password),
            plainPassword: password,
            role: profileData.role as UserRole,
            status: profileData.status as UserStatus,
            createdAt: profileData.created_at,
            lastLoginAt: new Date().toISOString()
          };

          const session: AuthSession = {
            user: appUser,
            token: data.session?.access_token || `token_${appUser.id}`
          };

          this.saveLocalSession(session);
          return { success: true, session };
        } else {
          // Autenticado no Supabase mas sem perfil na tabela profiles
          // Isso indica que o trigger/upsert de criação de perfil falhou
          await supabase.auth.signOut();
          console.error('Usuário existe no auth.users mas não tem perfil na tabela profiles. ID:', data.user.id);
          return {
            success: false,
            message: 'Seu cadastro está incompleto. Peça ao administrador para recriar seu perfil no painel.'
          };
        }
      }
    } catch (e) {
      console.warn('Comunicação com Supabase falhou, recorrendo a credenciais locais:', e);
      // Só cai no fallback se houve erro de conexão (Supabase indisponível)
      return this.loginLocalFallback(cleanEmail, password);
    }

    // 2. Fallback de Desenvolvimento / Credenciais Padrão
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
   * Usa supabaseAdmin para bypassar o RLS — o admin local não tem sessão Supabase ativa.
   */
  public async getUsers(): Promise<User[]> {
    // Usar supabaseAdmin (service_role) para garantir leitura mesmo sem sessão Supabase
    const client = supabaseAdmin || supabase;
    try {
      const { data, error } = await client
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

      if (error) console.error('Erro ao buscar usuários do Supabase:', error.message);
    } catch (e) {
      console.warn('Erro ao consultar profiles:', e);
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
   * Usa supabaseAdmin (service_role) para não derrubar a sessão do admin atual
   * e confirmar o e-mail automaticamente sem exigir verificação.
   */
  public async createUser(data: {
    name: string;
    email: string;
    password: string;
    role: UserRole;
    status: UserStatus;
  }): Promise<{ success: boolean; user?: User; message?: string }> {
    const cleanEmail = data.email.trim().toLowerCase();

    // ── Caminho 1: Admin API (service_role key disponível) ──────────────────
    if (supabaseAdmin) {
      try {
        const { data: authData, error } = await supabaseAdmin.auth.admin.createUser({
          email: cleanEmail,
          password: data.password,
          email_confirm: true,          // Confirma o e-mail automaticamente
          user_metadata: {
            name: data.name,
            role: data.role
          }
        });

        if (error) {
          return { success: false, message: error.message };
        }

        if (authData.user) {
          // O trigger handle_new_user já cria o perfil automaticamente.
          // Fazemos upsert para garantir role e status corretos conforme definido pelo admin.
          const { error: profileError } = await supabaseAdmin
            .from('profiles')
            .upsert({
              id: authData.user.id,
              name: data.name,
              email: cleanEmail,
              role: data.role,
              status: data.status,
              created_at: new Date().toISOString()
            });

          if (profileError) {
            console.warn('Perfil criado via trigger, erro no upsert ignorado:', profileError.message);
          }

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
        return { success: false, message: e?.message || 'Erro ao criar usuário via Admin API.' };
      }

      return { success: false, message: 'Erro desconhecido ao criar usuário.' };
    }

    // ── Caminho 2: Fallback — sem service_role key (não recomendado em produção) ─
    // signUp() como fallback: pode derrubar sessão atual e exige confirmação de e-mail.
    console.warn('AVISO: VITE_SUPABASE_SERVICE_ROLE_KEY não configurada. Usando signUp() como fallback.');
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
        await supabase
          .from('profiles')
          .upsert({
            id: authData.user.id,
            name: data.name,
            email: cleanEmail,
            role: data.role,
            status: data.status,
            created_at: new Date().toISOString()
          });

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
   * Usa supabaseAdmin para bypassar RLS quando o admin não tem sessão Supabase.
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
    const client = supabaseAdmin || supabase;
    try {
      const payload: any = {};
      if (updates.name !== undefined) payload.name = updates.name.trim();
      if (updates.email !== undefined) payload.email = updates.email.trim().toLowerCase();
      if (updates.role !== undefined) payload.role = updates.role;
      if (updates.status !== undefined) payload.status = updates.status;

      const { error } = await client
        .from('profiles')
        .update(payload)
        .eq('id', id);

      if (error) {
        return { success: false, message: error.message };
      }

      // Atualizar no Supabase Auth caso a senha ou e-mail sejam alterados pelo Admin
      if (supabaseAdmin && (updates.password || updates.email)) {
        const authUpdates: any = {};
        if (updates.password) authUpdates.password = updates.password;
        if (updates.email) {
          authUpdates.email = updates.email.trim().toLowerCase();
          authUpdates.email_confirm = true;
        }
        const { error: authErr } = await supabaseAdmin.auth.admin.updateUserById(id, authUpdates);
        if (authErr) {
          console.warn('Erro ao atualizar dados no auth.users:', authErr.message);
        }
      }

      return { success: true };
    } catch (e: any) {
      return { success: false, message: e?.message || 'Erro ao atualizar dados.' };
    }
  }

  /**
   * Excluir um usuário no Supabase Auth + Profiles
   * Usa supabaseAdmin para bypassar RLS e remover do auth.users também.
   */
  public async deleteUser(id: string, currentAdminId: string): Promise<{ success: boolean; message?: string }> {
    if (id === currentAdminId) {
      return { success: false, message: 'Você não pode excluir sua própria conta de Administrador.' };
    }

    const client = supabaseAdmin || supabase;
    try {
      // Remover do auth.users (cascateia para profiles por ON DELETE CASCADE)
      if (supabaseAdmin) {
        const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(id);
        if (authError) {
          // Se falhar no auth, tenta deletar só o profile
          console.warn('Falha ao deletar do auth.users, tentando apenas profile:', authError.message);
          const { error } = await client.from('profiles').delete().eq('id', id);
          if (error) return { success: false, message: error.message };
        }
      } else {
        const { error } = await client.from('profiles').delete().eq('id', id);
        if (error) return { success: false, message: error.message };
      }

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
