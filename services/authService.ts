import { User, UserRole, UserStatus, AuthSession } from '../types';

const USERS_STORAGE_KEY = 'mbr_users_db_v1';
const SESSION_STORAGE_KEY = 'mbr_auth_session_v1';

// Helper de hash simples para armazenamento seguro de senha em localStorage
export function hashPassword(plainText: string): string {
  let hash = 0;
  for (let i = 0; i < plainText.length; i++) {
    const char = plainText.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0; // Converter para inteiro 32-bit
  }
  return `mbr_hash_${Math.abs(hash)}_${plainText.length}`;
}

// Usuários iniciais do sistema
const DEFAULT_USERS: User[] = [
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

class AuthService {
  private users: User[] = [];

  constructor() {
    this.initUsersStorage();
  }

  private initUsersStorage(): void {
    try {
      const stored = localStorage.getItem(USERS_STORAGE_KEY);
      if (stored) {
        this.users = JSON.parse(stored);
        // Garantir que os usuários padronizados possuam a senha visível em texto plano se estivesse faltando
        let updated = false;
        this.users = this.users.map(u => {
          if (!u.plainPassword) {
            updated = true;
            if (u.id === 'user_admin_001') return { ...u, plainPassword: 'admin123' };
            if (u.id === 'user_demo_002') return { ...u, plainPassword: 'user123' };
          }
          return u;
        });
        if (updated) {
          this.saveUsersToStorage();
        }
      } else {
        this.users = DEFAULT_USERS;
        this.saveUsersToStorage();
      }
    } catch (e) {
      console.error('Erro ao inicializar usuários no localStorage:', e);
      this.users = DEFAULT_USERS;
    }
  }

  private saveUsersToStorage(): void {
    try {
      localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(this.users));
    } catch (e) {
      console.error('Erro ao salvar usuários no localStorage:', e);
    }
  }

  public getUsers(): User[] {
    this.initUsersStorage();
    return [...this.users];
  }

  public getUserById(id: string): User | undefined {
    this.initUsersStorage();
    return this.users.find(u => u.id === id);
  }

  public getUserByEmail(email: string): User | undefined {
    this.initUsersStorage();
    const cleanEmail = email.trim().toLowerCase();
    return this.users.find(u => u.email.toLowerCase() === cleanEmail);
  }

  public createUser(data: {
    name: string;
    email: string;
    password: string;
    role: UserRole;
    status: UserStatus;
  }): { success: boolean; user?: User; message?: string } {
    this.initUsersStorage();

    const cleanEmail = data.email.trim().toLowerCase();
    if (!cleanEmail || !data.name.trim() || !data.password) {
      return { success: false, message: 'Preencha todos os campos obrigatórios.' };
    }

    if (this.getUserByEmail(cleanEmail)) {
      return { success: false, message: 'Já existe um usuário cadastrado com este e-mail.' };
    }

    const newUser: User = {
      id: `usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      name: data.name.trim(),
      email: cleanEmail,
      passwordHash: hashPassword(data.password),
      plainPassword: data.password,
      role: data.role,
      status: data.status,
      createdAt: new Date().toISOString(),
      lastLoginAt: null
    };

    this.users.push(newUser);
    this.saveUsersToStorage();

    return { success: true, user: newUser };
  }

  public updateUser(
    id: string,
    updates: {
      name?: string;
      email?: string;
      role?: UserRole;
      status?: UserStatus;
      password?: string;
    }
  ): { success: boolean; message?: string; user?: User } {
    this.initUsersStorage();

    const userIndex = this.users.findIndex(u => u.id === id);
    if (userIndex === -1) {
      return { success: false, message: 'Usuário não encontrado.' };
    }

    const currentUser = this.users[userIndex];

    if (updates.email && updates.email.trim().toLowerCase() !== currentUser.email.toLowerCase()) {
      const cleanEmail = updates.email.trim().toLowerCase();
      const existing = this.getUserByEmail(cleanEmail);
      if (existing && existing.id !== id) {
        return { success: false, message: 'Este e-mail já está em uso por outro usuário.' };
      }
      currentUser.email = cleanEmail;
    }

    if (updates.name !== undefined) {
      currentUser.name = updates.name.trim();
    }

    if (updates.role !== undefined) {
      currentUser.role = updates.role;
    }

    if (updates.status !== undefined) {
      currentUser.status = updates.status;
    }

    if (updates.password && updates.password.trim() !== '') {
      if (updates.password.length < 4) {
        return { success: false, message: 'A senha deve ter pelo menos 4 caracteres.' };
      }
      currentUser.passwordHash = hashPassword(updates.password);
      currentUser.plainPassword = updates.password;
    }

    this.users[userIndex] = currentUser;
    this.saveUsersToStorage();

    // Atualizar sessão se for o próprio usuário logado
    const session = this.getCurrentSession();
    if (session && session.user.id === id) {
      this.saveSession({
        ...session,
        user: { ...currentUser }
      });
    }

    return { success: true, user: currentUser };
  }

  public resetUserPassword(id: string, newPassword: string): { success: boolean; message?: string } {
    this.initUsersStorage();

    if (!newPassword || newPassword.length < 4) {
      return { success: false, message: 'A nova senha deve ter pelo menos 4 caracteres.' };
    }

    const userIndex = this.users.findIndex(u => u.id === id);
    if (userIndex === -1) {
      return { success: false, message: 'Usuário não encontrado.' };
    }

    this.users[userIndex].passwordHash = hashPassword(newPassword);
    this.users[userIndex].plainPassword = newPassword;
    this.saveUsersToStorage();

    return { success: true, message: 'Senha redefinida com sucesso!' };
  }

  public deleteUser(id: string, currentAdminId: string): { success: boolean; message?: string } {
    this.initUsersStorage();

    if (id === currentAdminId) {
      return { success: false, message: 'Você não pode excluir sua própria conta de Administrador.' };
    }

    const user = this.getUserById(id);
    if (!user) {
      return { success: false, message: 'Usuário não encontrado.' };
    }

    this.users = this.users.filter(u => u.id !== id);
    this.saveUsersToStorage();

    // Opcional: remover dados financeiros associados ao usuário excluído
    const userStorageKey = `mbr_user_data_${id}`;
    localStorage.removeItem(userStorageKey);

    return { success: true, message: 'Usuário excluído com sucesso.' };
  }

  public login(email: string, password: string): { success: boolean; session?: AuthSession; message?: string } {
    this.initUsersStorage();

    const cleanEmail = email.trim().toLowerCase();
    const user = this.getUserByEmail(cleanEmail);

    if (!user) {
      return { success: false, message: 'E-mail ou senha incorretos.' };
    }

    if (user.status === 'INACTIVE') {
      return { success: false, message: 'Sua conta está inativa. Entre em contato com o administrador do sistema.' };
    }

    const inputHash = hashPassword(password);
    if (user.passwordHash !== inputHash) {
      return { success: false, message: 'E-mail ou senha incorretos.' };
    }

    // Atualizar último acesso
    user.lastLoginAt = new Date().toISOString();
    const userIndex = this.users.findIndex(u => u.id === user.id);
    if (userIndex !== -1) {
      this.users[userIndex] = user;
      this.saveUsersToStorage();
    }

    const session: AuthSession = {
      user: { ...user },
      token: `token_${user.id}_${Date.now()}`
    };

    this.saveSession(session);
    return { success: true, session };
  }

  public logout(): void {
    try {
      localStorage.removeItem(SESSION_STORAGE_KEY);
    } catch (e) {
      console.error('Erro ao efetuar logout:', e);
    }
  }

  public getCurrentSession(): AuthSession | null {
    try {
      const stored = localStorage.getItem(SESSION_STORAGE_KEY);
      if (!stored) return null;
      const session: AuthSession = JSON.parse(stored);
      
      // Validar se o usuário ainda existe e está ativo no BD
      const freshUser = this.getUserById(session.user.id);
      if (!freshUser || freshUser.status === 'INACTIVE') {
        this.logout();
        return null;
      }

      return {
        ...session,
        user: freshUser
      };
    } catch (e) {
      return null;
    }
  }

  private saveSession(session: AuthSession): void {
    try {
      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
    } catch (e) {
      console.error('Erro ao salvar sessão no localStorage:', e);
    }
  }
}

export const authService = new AuthService();
