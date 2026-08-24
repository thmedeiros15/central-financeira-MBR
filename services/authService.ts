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
   * Realiza login através do Supabase Auth aceitando tanto E-mail quanto Login/Usuário abreviado.
   * Fallback seguro para credenciais locais se desconectado.
   */
  public async login(identifier: string, password: string): Promise<{ success: boolean; session?: AuthSession; message?: string }> {
    const cleanIdentifier = identifier.trim().toLowerCase();
    let targetEmail = cleanIdentifier;

    // Se o identificador não possui '@', buscar o e-mail correspondente ao username
    if (!cleanIdentifier.includes('@')) {
      let resolvedEmail: string | null = null;

      // 1. Tentar buscar pelo username na tabela profiles
      try {
        const client = supabaseAdmin || supabase;
        const { data: profile } = await client
          .from('profiles')
          .select('email, username')
          .ilike('username', cleanIdentifier)
          .maybeSingle();

        if (profile?.email) {
          resolvedEmail = profile.email.toLowerCase();
        }
      } catch (_) {
        // Ignorar erro se coluna username ainda não existir
      }

      // 2. Se não encontrou em profiles e temos supabaseAdmin, buscar nos metadados de auth.users
      if (!resolvedEmail && supabaseAdmin) {
        try {
          const { data: usersData } = await supabaseAdmin.auth.admin.listUsers();
          const match = usersData?.users?.find((u: any) => {
            const userMeta = u.user_metadata?.username;
            return userMeta && String(userMeta).trim().toLowerCase() === cleanIdentifier;
          });
          if (match?.email) {
            resolvedEmail = match.email.toLowerCase();
          }
        } catch (_) {
          // ignore
        }
      }

      // 3. Fallback no banco local
      if (!resolvedEmail) {
        try {
          const stored = localStorage.getItem(LOCAL_USERS_KEY);
          if (stored) {
            const localUsers: User[] = JSON.parse(stored);
            const match = localUsers.find(u => u.username?.toLowerCase() === cleanIdentifier);
            if (match) resolvedEmail = match.email.toLowerCase();
          }
        } catch (_) {
          // ignore
        }
      }

      if (resolvedEmail) {
        targetEmail = resolvedEmail;
      } else {
        // Se foi informado um username mas não encontramos o e-mail, tentar fallback local direto
        const localResult = this.loginLocalFallback(cleanIdentifier, password);
        if (localResult.success) return localResult;
        return { success: false, message: 'Usuário ou senha incorretos.' };
      }
    }

    // 1. Tentar Login pelo Supabase Auth com o targetEmail
    try {
      let { data, error } = await supabase.auth.signInWithPassword({
        email: targetEmail,
        password: password
      });

      // Se falhou no Supabase Auth e temos a chave de admin, tenta sincronizar/criar o perfil no Supabase Auth
      if (error && supabaseAdmin) {
        // Verificar se existe um perfil cadastrado na tabela profiles
        const { data: profile } = await supabaseAdmin
          .from('profiles')
          .select('*')
          .eq('email', targetEmail)
          .maybeSingle();

        if (profile) {
          // Atualiza a senha no auth.users para a senha informada e confirma o e-mail
          await supabaseAdmin.auth.admin.updateUserById(profile.id, {
            password: password,
            email_confirm: true
          });
          // Tentar login novamente com as credenciais sincronizadas
          const retry = await supabase.auth.signInWithPassword({
            email: targetEmail,
            password: password
          });
          if (!retry.error && retry.data) {
            data = retry.data;
            error = null;
          }
        }
      }

      if (error) {
        // Supabase retornou erro de credenciais
        if (error.message.includes('Invalid login credentials') || error.message.includes('invalid_credentials')) {
          const localResult = this.loginLocalFallback(cleanIdentifier, password);
          if (localResult.success) return localResult;
          return { success: false, message: 'E-mail, login ou senha incorretos.' };
        }
        console.warn('Erro Supabase Auth:', error.message);
        return this.loginLocalFallback(cleanIdentifier, password);
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

          const username = profileData.username || (data.user.user_metadata?.username as string) || undefined;

          const appUser: User = {
            id: profileData.id,
            name: profileData.name,
            email: profileData.email,
            username: username,
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
      return this.loginLocalFallback(cleanIdentifier, password);
    }

    // 2. Fallback de Desenvolvimento / Credenciais Padrão
    return this.loginLocalFallback(cleanIdentifier, password);
  }

  private loginLocalFallback(identifier: string, password: string): { success: boolean; session?: AuthSession; message?: string } {
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
          username: 'admin',
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
          username: 'usuario',
          passwordHash: hashPassword('user123'),
          plainPassword: 'user123',
          role: 'USER',
          status: 'ACTIVE',
          createdAt: new Date('2026-01-05T14:30:00.000Z').toISOString(),
          lastLoginAt: null
        }
      ];
    }

    const clean = identifier.toLowerCase();
    const user = localUsers.find(u => 
      u.email.toLowerCase() === clean || 
      (u.username && u.username.toLowerCase() === clean)
    );

    if (!user) {
      return { success: false, message: 'E-mail, login ou senha incorretos.' };
    }

    if (user.status === 'INACTIVE') {
      return { success: false, message: 'Sua conta está inativa. Entre em contato com o administrador do sistema.' };
    }

    if (user.passwordHash !== hashPassword(password)) {
      return { success: false, message: 'E-mail, login ou senha incorretos.' };
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
            username: profile.username || (data.session.user.user_metadata?.username as string) || undefined,
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
   * Usa supabaseAdmin para bypassar o RLS e mesclar metadados de autenticação se necessário.
   */
  public async getUsers(): Promise<User[]> {
    const client = supabaseAdmin || supabase;
    try {
      // 1. Buscar perfis na tabela profiles
      const { data: profiles, error } = await client
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      // 2. Se temos supabaseAdmin, buscar auth.users para garantir sincronização do username
      let authUsersMap: Record<string, any> = {};
      if (supabaseAdmin) {
        try {
          const { data: authUsersData } = await supabaseAdmin.auth.admin.listUsers();
          if (authUsersData?.users) {
            authUsersData.users.forEach((u: any) => {
              authUsersMap[u.id] = u.user_metadata;
            });
          }
        } catch (_) {
          // ignore
        }
      }

      if (!error && profiles) {
        return profiles.map(p => {
          const metadata = authUsersMap[p.id] || {};
          return {
            id: p.id,
            name: p.name,
            email: p.email,
            username: p.username || metadata.username || undefined,
            passwordHash: '',
            role: p.role as UserRole,
            status: p.status as UserStatus,
            createdAt: p.created_at,
            lastLoginAt: p.last_login_at
          };
        });
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
   */
  public async createUser(data: {
    name: string;
    email: string;
    username?: string;
    password: string;
    role: UserRole;
    status: UserStatus;
  }): Promise<{ success: boolean; user?: User; message?: string }> {
    const cleanEmail = data.email.trim().toLowerCase();
    const cleanUsername = data.username ? data.username.trim().toLowerCase().replace(/\s+/g, '') : undefined;

    // ── Caminho 1: Admin API (service_role key disponível) ──────────────────
    if (supabaseAdmin) {
      try {
        // Verificar se o username já está em uso se fornecido
        if (cleanUsername) {
          const { data: existingUser } = await supabaseAdmin
            .from('profiles')
            .select('id')
            .ilike('username', cleanUsername)
            .maybeSingle();

          if (existingUser) {
            return { success: false, message: `O login "${cleanUsername}" já está em uso por outro usuário.` };
          }
        }

        const { data: authData, error } = await supabaseAdmin.auth.admin.createUser({
          email: cleanEmail,
          password: data.password,
          email_confirm: true,
          user_metadata: {
            name: data.name,
            role: data.role,
            username: cleanUsername || null
          }
        });

        if (error) {
          return { success: false, message: error.message };
        }

        if (authData.user) {
          // Upsert no profile com username
          const profilePayload: any = {
            id: authData.user.id,
            name: data.name,
            email: cleanEmail,
            role: data.role,
            status: data.status,
            created_at: new Date().toISOString()
          };

          if (cleanUsername) {
            profilePayload.username = cleanUsername;
          }

          let { error: profileError } = await supabaseAdmin
            .from('profiles')
            .upsert(profilePayload);

          // Se der erro por coluna username inexistente, tentar sem username
          if (profileError && profileError.message.includes('username')) {
            console.warn('Coluna username ainda não criada em profiles, criando sem username na tabela:', profileError.message);
            delete profilePayload.username;
            await supabaseAdmin.from('profiles').upsert(profilePayload);
          }

          const newUser: User = {
            id: authData.user.id,
            name: data.name,
            email: cleanEmail,
            username: cleanUsername,
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

    // ── Caminho 2: Fallback — sem service_role key ─
    console.warn('AVISO: VITE_SUPABASE_SERVICE_ROLE_KEY não configurada. Usando signUp() como fallback.');
    try {
      const { data: authData, error } = await supabase.auth.signUp({
        email: cleanEmail,
        password: data.password,
        options: {
          data: {
            name: data.name,
            role: data.role,
            username: cleanUsername || null
          }
        }
      });

      if (error) {
        return { success: false, message: error.message };
      }

      if (authData.user) {
        const profilePayload: any = {
          id: authData.user.id,
          name: data.name,
          email: cleanEmail,
          role: data.role,
          status: data.status,
          created_at: new Date().toISOString()
        };
        if (cleanUsername) profilePayload.username = cleanUsername;

        try {
          await supabase.from('profiles').upsert(profilePayload);
        } catch (_) {
          delete profilePayload.username;
          await supabase.from('profiles').upsert(profilePayload);
        }

        const newUser: User = {
          id: authData.user.id,
          name: data.name,
          email: cleanEmail,
          username: cleanUsername,
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
   * Atualizar dados de um usuário (Nome, E-mail, Login/Username, Role, Status, Senha)
   */
  public async updateUser(
    id: string,
    updates: {
      name?: string;
      email?: string;
      username?: string;
      role?: UserRole;
      status?: UserStatus;
      password?: string;
    }
  ): Promise<{ success: boolean; message?: string }> {
    const client = supabaseAdmin || supabase;
    try {
      const cleanUsername = updates.username !== undefined 
        ? (updates.username.trim().toLowerCase().replace(/\s+/g, '') || null) 
        : undefined;

      // Verificar unicidade de username se alterado
      if (cleanUsername && supabaseAdmin) {
        const { data: existingUser } = await supabaseAdmin
          .from('profiles')
          .select('id')
          .ilike('username', cleanUsername)
          .neq('id', id)
          .maybeSingle();

        if (existingUser) {
          return { success: false, message: `O login "${cleanUsername}" já está sendo usado por outro usuário.` };
        }
      }

      const payload: any = {};
      if (updates.name !== undefined) payload.name = updates.name.trim();
      if (updates.email !== undefined) payload.email = updates.email.trim().toLowerCase();
      if (cleanUsername !== undefined) payload.username = cleanUsername;
      if (updates.role !== undefined) payload.role = updates.role;
      if (updates.status !== undefined) payload.status = updates.status;

      let { error } = await client
        .from('profiles')
        .update(payload)
        .eq('id', id);

      // Se der erro por coluna username inexistente, tentar sem username no update de profiles
      if (error && error.message.includes('username')) {
        delete payload.username;
        const retry = await client.from('profiles').update(payload).eq('id', id);
        error = retry.error;
      }

      if (error) {
        return { success: false, message: error.message };
      }

      // Atualizar no Supabase Auth caso senha, e-mail ou username sejam alterados
      if (supabaseAdmin) {
        const authUpdates: any = {};
        if (updates.password) authUpdates.password = updates.password;
        if (updates.email) {
          authUpdates.email = updates.email.trim().toLowerCase();
          authUpdates.email_confirm = true;
        }

        // Buscar metadados atuais do usuário
        const { data: authUserData } = await supabaseAdmin.auth.admin.getUserById(id);
        const currentMeta = authUserData?.user?.user_metadata || {};

        authUpdates.user_metadata = {
          ...currentMeta,
          ...(updates.name ? { name: updates.name.trim() } : {}),
          ...(updates.role ? { role: updates.role } : {}),
          ...(cleanUsername !== undefined ? { username: cleanUsername } : {})
        };

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
   */
  public async deleteUser(id: string, currentAdminId: string): Promise<{ success: boolean; message?: string }> {
    if (id === currentAdminId) {
      return { success: false, message: 'Você não pode excluir sua própria conta de Administrador.' };
    }

    const client = supabaseAdmin || supabase;
    try {
      if (supabaseAdmin) {
        const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(id);
        if (authError) {
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
