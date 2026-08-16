import React, { useState, useMemo, useEffect } from 'react';
import { 
  Users, UserPlus, Search, Shield, ShieldAlert, CheckCircle2, XCircle, 
  Edit3, Trash2, Calendar, Clock, RefreshCw, UserCheck, Lock, Eye, EyeOff
} from 'lucide-react';
import { User, UserRole, UserStatus } from '../types';
import { authService } from '../services/authService';

interface AdminPanelProps {
  currentAdmin: User;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({ currentAdmin }) => {
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'ALL' | UserRole>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | UserStatus>('ALL');

  // Modais State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [deletingUser, setDeletingUser] = useState<User | null>(null);

  // Formulário de Criação
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('USER');
  const [newStatus, setNewStatus] = useState<UserStatus>('ACTIVE');

  // Formulário de Edição
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editRole, setEditRole] = useState<UserRole>('USER');
  const [editStatus, setEditStatus] = useState<UserStatus>('ACTIVE');
  const [editPassword, setEditPassword] = useState('');
  const [showEditPassword, setShowEditPassword] = useState(false);

  // Mensagens de Feedback
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const refreshUserList = async () => {
    setIsLoading(true);
    const fetched = await authService.getUsers();
    setUsers(fetched);
    setIsLoading(false);
  };

  useEffect(() => {
    refreshUserList();
  }, []);

  const showNotification = (type: 'success' | 'error', message: string) => {
    setFeedback({ type, message });
    setTimeout(() => {
      setFeedback(null);
    }, 4000);
  };

  // Métricas
  const stats = useMemo(() => {
    const total = users.length;
    const active = users.filter(u => u.status === 'ACTIVE').length;
    const inactive = users.filter(u => u.status === 'INACTIVE').length;
    const admins = users.filter(u => u.role === 'ADMIN').length;
    return { total, active, inactive, admins };
  }, [users]);

  // Filtro da lista
  const filteredUsers = useMemo(() => {
    return users.filter(u => {
      const matchesSearch = 
        u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.email.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesRole = roleFilter === 'ALL' || u.role === roleFilter;
      const matchesStatus = statusFilter === 'ALL' || u.status === statusFilter;

      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [users, searchQuery, roleFilter, statusFilter]);

  // Handlers
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = await authService.createUser({
      name: newName,
      email: newEmail,
      password: newPassword,
      role: newRole,
      status: newStatus
    });

    if (result.success) {
      showNotification('success', `Usuário "${newName}" criado com sucesso!`);
      setShowCreateModal(false);
      setNewName('');
      setNewEmail('');
      setNewPassword('');
      setNewRole('USER');
      setNewStatus('ACTIVE');
      refreshUserList();
    } else {
      showNotification('error', result.message || 'Erro ao criar usuário.');
    }
  };

  const handleOpenEdit = (user: User) => {
    setEditingUser(user);
    setEditName(user.name);
    setEditEmail(user.email);
    setEditRole(user.role);
    setEditStatus(user.status);
    setEditPassword('');
    setShowEditPassword(false);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    if (editPassword.trim() && editPassword.trim().length < 6) {
      showNotification('error', 'A nova senha deve possuir pelo menos 6 caracteres.');
      return;
    }

    const result = await authService.updateUser(editingUser.id, {
      name: editName,
      email: editEmail,
      role: editRole,
      status: editStatus,
      password: editPassword.trim() || undefined
    });

    if (result.success) {
      showNotification('success', editPassword.trim()
        ? `Dados e nova senha de "${editName}" atualizados!`
        : `Dados do usuário "${editName}" atualizados!`
      );
      setEditingUser(null);
      setEditPassword('');
      refreshUserList();
    } else {
      showNotification('error', result.message || 'Erro ao atualizar usuário.');
    }
  };

  const handleToggleStatus = async (user: User) => {
    const nextStatus: UserStatus = user.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    const result = await authService.updateUser(user.id, { status: nextStatus });

    if (result.success) {
      showNotification('success', `Status de ${user.name} alterado para ${nextStatus === 'ACTIVE' ? 'Ativo' : 'Inativo'}.`);
      refreshUserList();
    } else {
      showNotification('error', result.message || 'Erro ao alterar status.');
    }
  };

  const handleDeleteUser = async () => {
    if (!deletingUser) return;

    const result = await authService.deleteUser(deletingUser.id, currentAdmin.id);
    if (result.success) {
      showNotification('success', result.message || 'Usuário removido do sistema.');
      setDeletingUser(null);
      refreshUserList();
    } else {
      showNotification('error', result.message || 'Erro ao excluir usuário.');
    }
  };

  const formatDate = (isoStr: string | null) => {
    if (!isoStr) return 'Nunca acessou';
    try {
      const d = new Date(isoStr);
      return d.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return 'Data inválida';
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200 pb-12">
      
      {/* Banner de Aviso de Nível Administrativo */}
      <div className="bg-slate-900 dark:bg-slate-900 border border-slate-800 p-5 rounded-3xl shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-[#F26522]/10 border border-[#F26522]/30 flex items-center justify-center text-[#F26522] shrink-0">
            <Shield className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-black text-white uppercase tracking-tight">Painel do Administrador</h2>
              <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-400 text-[10px] font-black uppercase">
                Acesso Restrito
              </span>
            </div>
            <p className="text-xs font-semibold text-slate-400 mt-0.5">
              Gestão centralizada de credenciais, permissões e status dos usuários do sistema MBR Tracker.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowCreateModal(true)}
          className="w-full md:w-auto bg-[#F26522] hover:bg-[#D94100] active:scale-95 text-white px-5 py-3 rounded-xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md shadow-orange-950/20"
        >
          <UserPlus className="w-4 h-4" />
          <span>Criar Novo Usuário</span>
        </button>
      </div>

      {/* Feedback Toast Banner */}
      {feedback && (
        <div className={`p-4 rounded-2xl border text-xs font-bold flex items-center justify-between gap-3 animate-in slide-in-from-top-2 duration-200 ${
          feedback.type === 'success' 
            ? 'bg-emerald-950/80 border-emerald-800 text-emerald-200' 
            : 'bg-rose-950/80 border-rose-800 text-rose-200'
        }`}>
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" /> : <XCircle className="w-4 h-4 text-rose-400 shrink-0" />}
            <span>{feedback.message}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="opacity-70 hover:opacity-100">✕</button>
        </div>
      )}

      {/* Cards com Métricas dos Usuários */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-4 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[10px] font-black uppercase tracking-wider">Total Registrados</span>
            <Users className="w-4 h-4 text-blue-500" />
          </div>
          <p className="text-2xl font-black text-slate-900 dark:text-white">{stats.total}</p>
          <span className="text-[10px] font-bold text-slate-400 uppercase">Contas no sistema</span>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-4 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[10px] font-black uppercase tracking-wider">Usuários Ativos</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{stats.active}</p>
          <span className="text-[10px] font-bold text-slate-400 uppercase">Acesso liberado</span>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-4 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[10px] font-black uppercase tracking-wider">Contas Inativas</span>
            <XCircle className="w-4 h-4 text-rose-500" />
          </div>
          <p className="text-2xl font-black text-rose-600 dark:text-rose-400">{stats.inactive}</p>
          <span className="text-[10px] font-bold text-slate-400 uppercase">Acesso bloqueado</span>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-4 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[10px] font-black uppercase tracking-wider">Administradores</span>
            <ShieldAlert className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-2xl font-black text-amber-600 dark:text-amber-400">{stats.admins}</p>
          <span className="text-[10px] font-bold text-slate-400 uppercase">Gestores de usuários</span>
        </div>
      </div>

      {/* Barra de Filtro e Pesquisa */}
      <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-4 rounded-2xl shadow-xs space-y-3 md:space-y-0 md:flex md:items-center md:justify-between md:gap-4">
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por nome ou e-mail..."
            className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-xl pl-9 pr-4 py-2 text-xs font-bold text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#F26522]"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 bg-slate-50 dark:bg-slate-800/80 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
            <span className="text-[10px] font-black text-slate-400 uppercase px-2">Nível:</span>
            <button
              onClick={() => setRoleFilter('ALL')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${roleFilter === 'ALL' ? 'bg-[#F26522] text-white' : 'text-slate-500'}`}
            >
              Todos
            </button>
            <button
              onClick={() => setRoleFilter('ADMIN')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${roleFilter === 'ADMIN' ? 'bg-[#F26522] text-white' : 'text-slate-500'}`}
            >
              Admins
            </button>
            <button
              onClick={() => setRoleFilter('USER')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${roleFilter === 'USER' ? 'bg-[#F26522] text-white' : 'text-slate-500'}`}
            >
              Usuários
            </button>
          </div>

          <div className="flex items-center gap-1 bg-slate-50 dark:bg-slate-800/80 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
            <span className="text-[10px] font-black text-slate-400 uppercase px-2">Status:</span>
            <button
              onClick={() => setStatusFilter('ALL')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${statusFilter === 'ALL' ? 'bg-[#F26522] text-white' : 'text-slate-500'}`}
            >
              Todos
            </button>
            <button
              onClick={() => setStatusFilter('ACTIVE')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${statusFilter === 'ACTIVE' ? 'bg-[#F26522] text-white' : 'text-slate-500'}`}
            >
              Ativos
            </button>
            <button
              onClick={() => setStatusFilter('INACTIVE')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${statusFilter === 'INACTIVE' ? 'bg-[#F26522] text-white' : 'text-slate-500'}`}
            >
              Inativos
            </button>
          </div>
        </div>
      </div>

      {/* Tabela de Usuários */}
      <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-950/60 border-b border-slate-100 dark:border-slate-800 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                <th className="p-4">Usuário</th>
                <th className="p-4">Nível de Acesso</th>
                <th className="p-4">Status</th>
                <th className="p-4">Criação</th>
                <th className="p-4">Último Acesso</th>
                <th className="p-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-xs font-bold">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-400 font-semibold">
                    Carregando usuários do Supabase...
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-400 font-semibold">
                    Nenhum usuário encontrado com os filtros aplicados.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => {
                  const isCurrentAdmin = u.id === currentAdmin.id;
                  return (
                    <tr key={u.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-black text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 shrink-0">
                            {u.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="font-extrabold text-slate-900 dark:text-white truncate flex items-center gap-1.5">
                              <span>{u.name}</span>
                              {isCurrentAdmin && (
                                <span className="text-[9px] bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 px-1.5 py-0.2 rounded font-black">
                                  Você
                                </span>
                              )}
                            </p>
                            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 truncate">{u.email}</p>
                          </div>
                        </div>
                      </td>

                      <td className="p-4">
                        {u.role === 'ADMIN' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-400 font-extrabold text-[11px]">
                            <ShieldAlert className="w-3 h-3" /> Administrador
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-500/10 border border-blue-500/30 text-blue-700 dark:text-blue-400 font-extrabold text-[11px]">
                            <UserCheck className="w-3 h-3" /> Usuário Padrão
                          </span>
                        )}
                      </td>

                      <td className="p-4">
                        {u.status === 'ACTIVE' ? (
                          <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-black">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span> Ativo
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-rose-600 dark:text-rose-400 font-black">
                            <span className="w-2 h-2 rounded-full bg-rose-500"></span> Inativo
                          </span>
                        )}
                      </td>

                      <td className="p-4 text-slate-500 dark:text-slate-400 font-medium">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          <span>{formatDate(u.createdAt)}</span>
                        </div>
                      </td>

                      <td className="p-4 text-slate-500 dark:text-slate-400 font-medium">
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          <span>{formatDate(u.lastLoginAt)}</span>
                        </div>
                      </td>

                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          
                          {/* Editar */}
                          <button
                            onClick={() => handleOpenEdit(u)}
                            title="Editar dados"
                            className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>

                          {/* Alterar Status */}
                          <button
                            onClick={() => handleToggleStatus(u)}
                            title={u.status === 'ACTIVE' ? 'Inativar Usuário' : 'Ativar Usuário'}
                            className={`p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer ${
                              u.status === 'ACTIVE' ? 'text-emerald-600' : 'text-rose-600'
                            }`}
                          >
                            <RefreshCw className="w-4 h-4" />
                          </button>

                          {/* Excluir (bloqueado para o próprio admin) */}
                          <button
                            disabled={isCurrentAdmin}
                            onClick={() => setDeletingUser(u)}
                            title={isCurrentAdmin ? 'Sua própria conta não pode ser excluída' : 'Excluir usuário'}
                            className="p-1.5 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-lg text-rose-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>

                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL: Criar Novo Usuário */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[110] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 w-full max-w-md rounded-3xl shadow-2xl overflow-hidden">
            <div className="bg-slate-950 px-5 py-4 text-white flex justify-between items-center border-b border-slate-800">
              <h3 className="font-black text-base uppercase flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-[#F26522]" /> Cadastrar Novo Usuário
              </h3>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleCreateUser} className="p-5 space-y-4">
              <div>
                <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">Nome Completo</label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  placeholder="Ex: Carlos Silva"
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#F26522]"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">E-mail de Acesso</label>
                <input
                  type="email"
                  required
                  value={newEmail}
                  onChange={e => setNewEmail(e.target.value)}
                  placeholder="carlos@empresa.com"
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#F26522]"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">Senha Inicial</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#F26522]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">Nível de Acesso</label>
                  <select
                    value={newRole}
                    onChange={e => setNewRole(e.target.value as UserRole)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#F26522]"
                  >
                    <option value="USER">Usuário Padrão</option>
                    <option value="ADMIN">Administrador</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">Status da Conta</label>
                  <select
                    value={newStatus}
                    onChange={e => setNewStatus(e.target.value as UserStatus)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#F26522]"
                  >
                    <option value="ACTIVE">Ativo</option>
                    <option value="INACTIVE">Inativo</option>
                  </select>
                </div>
              </div>

              <div className="pt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="w-1/2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 py-3 rounded-xl font-extrabold text-xs uppercase"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="w-1/2 bg-[#F26522] hover:bg-[#D94100] text-white py-3 rounded-xl font-extrabold text-xs uppercase shadow-md"
                >
                  Salvar Usuário
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Editar Usuário */}
      {editingUser && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[110] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 w-full max-w-md rounded-3xl shadow-2xl overflow-hidden">
            <div className="bg-slate-950 px-5 py-4 text-white flex justify-between items-center border-b border-slate-800">
              <h3 className="font-black text-base uppercase flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-[#F26522]" /> Editar Usuário
              </h3>
              <button onClick={() => setEditingUser(null)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleSaveEdit} className="p-5 space-y-4">
              <div>
                <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">Nome Completo</label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#F26522]"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">E-mail</label>
                <input
                  type="email"
                  required
                  value={editEmail}
                  onChange={e => setEditEmail(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#F26522]"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-slate-400 mb-1 flex items-center justify-between">
                  <span>Nova Senha (Opcional)</span>
                  <span className="text-[9px] text-slate-400 font-normal normal-case">Mínimo 6 caracteres</span>
                </label>
                <div className="relative">
                  <input
                    type={showEditPassword ? "text" : "password"}
                    value={editPassword}
                    onChange={e => setEditPassword(e.target.value)}
                    placeholder="Deixe em branco para manter a senha atual"
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-3 pr-10 py-2.5 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#F26522]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowEditPassword(!showEditPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 p-1"
                    title={showEditPassword ? "Ocultar senha" : "Exibir senha"}
                  >
                    {showEditPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">Nível</label>
                  <select
                    value={editRole}
                    onChange={e => setEditRole(e.target.value as UserRole)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#F26522]"
                  >
                    <option value="USER">Usuário Padrão</option>
                    <option value="ADMIN">Administrador</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">Status</label>
                  <select
                    value={editStatus}
                    onChange={e => setEditStatus(e.target.value as UserStatus)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#F26522]"
                  >
                    <option value="ACTIVE">Ativo</option>
                    <option value="INACTIVE">Inativo</option>
                  </select>
                </div>
              </div>

              <div className="pt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="w-1/2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 py-3 rounded-xl font-extrabold text-xs uppercase"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="w-1/2 bg-[#F26522] hover:bg-[#D94100] text-white py-3 rounded-xl font-extrabold text-xs uppercase shadow-md"
                >
                  Atualizar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Excluir Usuário */}
      {deletingUser && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[110] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 w-full max-w-sm rounded-3xl shadow-2xl p-6 text-center">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto mb-4 border border-rose-500/20">
              <Trash2 className="w-6 h-6" />
            </div>

            <h3 className="text-base font-black text-slate-900 dark:text-white uppercase">Confirmar Exclusão</h3>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
              Tem certeza que deseja excluir o usuário <strong className="text-slate-900 dark:text-white">{deletingUser.name}</strong>?
            </p>
            <p className="text-[10px] font-bold text-rose-500 uppercase tracking-wider mt-1">
              Esta ação removerá a conta permanentemente.
            </p>

            <div className="mt-6 flex gap-2">
              <button
                type="button"
                onClick={() => setDeletingUser(null)}
                className="w-1/2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 py-3 rounded-xl font-extrabold text-xs uppercase"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDeleteUser}
                className="w-1/2 bg-rose-600 hover:bg-rose-700 text-white py-3 rounded-xl font-extrabold text-xs uppercase shadow-md"
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
