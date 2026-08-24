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

class AuthService {
  /**
   * Realiza login exclusivamente através do Supabase Auth.
   * Suporta autenticação tanto por e-mail quanto por login/apelido abreviado.
   */
  public async login(identifier: string, password: string): Promise<{ success: boolean; session?: AuthSession; message?: string }> {
    const cleanIdentifier = identifier.trim().toLowerCase();
    let targetEmail = cleanIdentifier;

    // Se o identificador informado não possui '@', resolver o e-mail correspondente via Supabase
    if (!cleanIdentifier.includes('@')) {
      let resolvedEmail: string | null = null;

      // 1. Tentar resolver via RPC no Supabase (get_email_by_identifier)
      try {
        const { data: rpcEmail } = await supabase.rpc('get_email_by_identifier', {
          login_identifier: cleanIdentifier
        });
        if (rpcEmail && typeof rpcEmail === 'string' && rpcEmail.includes('@')) {
          resolvedEmail = rpcEmail.toLowerCase();
        }
      } catch (_) {
        // RPC não disponível, prosseguir para fallback via consulta
      }

      // 2. Tentar buscar pelo username na tabela profiles
      if (!resolvedEmail) {
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
          // ignore
        }
      }

      // 3. Se temos supabaseAdmin, buscar nos metadados de auth.users
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

      if (resolvedEmail) {
        targetEmail = resolvedEmail;
      } else {
        return { success: false, message: 'Usuário ou e-mail não encontrado.' };
      }
    }

    // 1. Autenticação estrita no Supabase Auth
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: targetEmail,
        password: password
      });

      if (error) {
        if (error.message.includes('Invalid login credentials') || error.message.includes('invalid_credentials')) {
          return { success: false, message: 'E-mail, login ou senha incorretos.' };
        }
        if (error.message.includes('Email not confirmed')) {
          return { success: false, message: 'E-mail ainda não confirmado no sistema.' };
        }
        return { success: false, message: error.message || 'Falha ao autenticar no Supabase.' };
      }

      if (!data?.user || !data?.session) {
        return { success: false, message: 'Falha ao obter sessão do Supabase.' };
      }

      // 2. Buscar perfil público do usuário
      let profileData: any = null;

      const { data: profile, error: profileErr } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', data.user.id)
        .single();

      if (profile) {
        profileData = profile;
      } else if (supabaseAdmin) {
        console.warn('Perfil não encontrado via anon key, buscando via admin...', profileErr?.message);
        const { data: adminProfile } = await supabaseAdmin
          .from('profiles')
          .select('*')
          .eq('id', data.user.id)
          .single();
        profileData = adminProfile;
      }

      if (!profileData) {
        await supabase.auth.signOut();
        console.error('Usuário existe no auth.users mas não tem perfil na tabela profiles. ID:', data.user.id);
        return {
          success: false,
          message: 'Cadastro incompleto. Peça ao administrador para verificar seu perfil.'
        };
      }

      if (profileData.status === 'INACTIVE') {
        await supabase.auth.signOut();
        return { success: false, message: 'Sua conta está inativa. Entre em contato com o administrador.' };
      }

      // 3. Atualizar data de último login
      try {
        const updateClient = supabaseAdmin || supabase;
        await updateClient
          .from('profiles')
          .update({ last_login_at: new Date().toISOString() })
          .eq('id', data.user.id);
      } catch (_) {
        // Não bloquear o login se falhar atualização de metadata
      }

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
        token: data.session.access_token
      };

      return { success: true, session };
    } catch (e: any) {
      console.error('Erro ao conectar ao Supabase Auth:', e);
      return { success: false, message: 'Erro de comunicação com o servidor de autenticação. Verifique sua conexão.' };
    }
  }

  /**
   * Efetuar Logout no Supabase Auth.
   */
  public async logout(): Promise<void> {
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.warn('Erro ao deslogar do Supabase:', e);
    }
  }

  /**
   * Recuperar sessão atual ativa validada pelo Supabase.
   */
  public async getCurrentSession(): Promise<AuthSession | null> {
    try {
      const { data } = await supabase.auth.getSession();
      if (data?.session?.user) {
        let profileData: any = null;

        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', data.session.user.id)
          .single();

        if (profile) {
          profileData = profile;
        } else if (supabaseAdmin) {
          const { data: adminProfile } = await supabaseAdmin
            .from('profiles')
            .select('*')
            .eq('id', data.session.user.id)
            .single();
          profileData = adminProfile;
        }

        if (profileData && profileData.status === 'ACTIVE') {
          const appUser: User = {
            id: profileData.id,
            name: profileData.name,
            email: profileData.email,
            username: profileData.username || (data.session.user.user_metadata?.username as string) || undefined,
            passwordHash: '',
            role: profileData.role as UserRole,
            status: profileData.status as UserStatus,
            createdAt: profileData.created_at,
            lastLoginAt: profileData.last_login_at
          };

          return {
            user: appUser,
            token: data.session.access_token
          };
        }
      }
    } catch (e) {
      console.warn('Erro ao obter sessão ativa:', e);
    }

    return null;
  }

  /**
   * Buscar todos os usuários cadastrados no Supabase (Exclusivo para o Painel Administrador).
   */
  public async getUsers(): Promise<User[]> {
    const client = supabaseAdmin || supabase;
    try {
      const { data: profiles, error } = await client
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

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

          if (profileError && profileError.message.includes('username')) {
            console.warn('Coluna username inexistente na tabela profiles, inserindo sem username:', profileError.message);
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
        return { success: false, message: e?.message || 'Erro ao criar usuário no Supabase.' };
      }

      return { success: false, message: 'Erro desconhecido ao criar usuário.' };
    }

    // ── Caminho 2: Fallback padrão com supabase.auth.signUp ─
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
   * Atualizar dados de um usuário (Nome, E-mail, Login/Username, Role, Status, Senha) exclusivamente no Supabase.
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

      if (error && error.message.includes('username')) {
        delete payload.username;
        const retry = await client.from('profiles').update(payload).eq('id', id);
        error = retry.error;
      }

      if (error) {
        return { success: false, message: error.message };
      }

      // Atualizar no Supabase Auth (senha, e-mail ou metadados de nome/role/username)
      if (supabaseAdmin) {
        const authUpdates: any = {};
        if (updates.password) authUpdates.password = updates.password;
        if (updates.email) {
          authUpdates.email = updates.email.trim().toLowerCase();
          authUpdates.email_confirm = true;
        }

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
      return { success: false, message: e?.message || 'Erro ao atualizar dados no Supabase.' };
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

      return { success: true, message: 'Usuário excluído com sucesso do Supabase.' };
    } catch (e: any) {
      return { success: false, message: e?.message || 'Erro ao excluir usuário.' };
    }
  }
}

export const authService = new AuthService();
