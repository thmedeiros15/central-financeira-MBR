
import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { LayoutDashboard, Building2, Wallet, Settings, Trash2, Moon, Sun, Sparkles, LogOut, Shield, UserCheck, ChevronDown, User, Lock, Check, X } from 'lucide-react';
import { Transaction, ManagementModule, TransactionType, DateFilter, AIAnalysisResponse, ScorePeriod, DeleteScope, AnalysisParams, AuthSession } from './types';
import { INITIAL_TRANSACTIONS, PERSONAL_CATEGORIES, BUSINESS_EXPENSE_CATEGORIES } from './constants';
import { TransactionTable } from './components/TransactionTable';
import { AIConsultant } from './components/AIConsultant';
import { Dashboard } from './components/Dashboard';
import { FinancialSummary } from './components/FinancialSummary';
import { MbrLogo } from './components/MbrLogo';
import { LoginForm } from './components/LoginForm';
import { AdminPanel } from './components/AdminPanel';
import { authService } from './services/authService';
import { financialService } from './services/financialService';
import { analyzeFinancials } from './services/geminiService';
import { getLocalDateParts } from './utils/dateUtils';

const App: React.FC = () => {
  // Sessão do usuário logado
  const [authSession, setAuthSession] = useState<AuthSession | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  useEffect(() => {
    async function initSession() {
      const session = await authService.getCurrentSession();
      setAuthSession(session);
      setIsAuthLoading(false);
    }
    initSession();
  }, []);

  const currentUserId = authSession?.user?.id || null;
  const isUserAdmin = authSession?.user?.role === 'ADMIN';

  const [activeTab, setActiveTab] = useState<ManagementModule>('HOME');
  const [scorePeriod, setScorePeriod] = useState<ScorePeriod>('MONTH');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AIAnalysisResponse | null>(null);
  
  const ensureSalarioCategory = (cats: string[]) => {
    let result = [...cats];
    if (!result.includes('Salário')) {
      const filtered = result.filter(c => c !== 'Outros');
      result = ['Salário', ...filtered, 'Outros'];
    }
    if (!result.includes('Pró-labore')) {
      const filtered = result.filter(c => c !== 'Outros');
      result = [...filtered.filter(c => c !== 'Outros'), 'Pró-labore', 'Outros'];
    }
    return result;
  };

  const normalizeProLaboreTransactions = (txs: Transaction[]): Transaction[] => {
    return txs.map(t => {
      const descLower = (t.description || '').toLowerCase();
      if (t.module === 'PERSONAL' && (t.description.startsWith('Pró-labore') || descLower.includes('pro-labore') || descLower.includes('prolabore') || descLower.includes('pró-labore'))) {
        return { ...t, category: 'Pró-labore', type: 'INCOME' as TransactionType };
      }
      return t;
    });
  };

  const [isLoadingUserData, setIsLoadingUserData] = useState(false);

  const resetUserDataState = useCallback(() => {
    setTransactions([]);
    setPersonalCats(PERSONAL_CATEGORIES);
    setBusinessCats(BUSINESS_EXPENSE_CATEGORIES);
    setCompanies([]);
    setDeletedFixedSingle([]);
    setCanceledFixedSeries([]);
    setCanceledInstallmentSeries([]);
    setDeletedInstallmentSlots([]);
    setEnabledModules({ personal: true, business: true });
    setAnalysisResult(null);
  }, []);

  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    if (!currentUserId || isUserAdmin) return [];
    const saved = localStorage.getItem(`mbr_usr_${currentUserId}_transactions`);
    return saved ? normalizeProLaboreTransactions(JSON.parse(saved)) : [];
  });

  const [personalCats, setPersonalCats] = useState<string[]>(() => {
    if (!currentUserId || isUserAdmin) return PERSONAL_CATEGORIES;
    const saved = localStorage.getItem(`mbr_usr_${currentUserId}_personal_cats`);
    return saved ? ensureSalarioCategory(JSON.parse(saved)) : PERSONAL_CATEGORIES;
  });

  const [businessCats, setBusinessCats] = useState<string[]>(() => {
    if (!currentUserId || isUserAdmin) return BUSINESS_EXPENSE_CATEGORIES;
    const saved = localStorage.getItem(`mbr_usr_${currentUserId}_business_cats`);
    return saved ? JSON.parse(saved) : BUSINESS_EXPENSE_CATEGORIES;
  });

  const [deletedFixedSingle, setDeletedFixedSingle] = useState<string[]>(() => {
    if (!currentUserId || isUserAdmin) return [];
    const saved = localStorage.getItem(`mbr_usr_${currentUserId}_deleted_fixed_single`);
    return saved ? JSON.parse(saved) : [];
  });

  const [canceledFixedSeries, setCanceledFixedSeries] = useState<Array<{ key: string; startYear: number; startMonth: number }>>(() => {
    if (!currentUserId || isUserAdmin) return [];
    const saved = localStorage.getItem(`mbr_usr_${currentUserId}_canceled_fixed_series`);
    return saved ? JSON.parse(saved) : [];
  });

  const [canceledInstallmentSeries, setCanceledInstallmentSeries] = useState<Array<{ parentId: string; maxAllowedInstallment: number }>>(() => {
    if (!currentUserId || isUserAdmin) return [];
    const saved = localStorage.getItem(`mbr_usr_${currentUserId}_canceled_installment_series`);
    return saved ? JSON.parse(saved) : [];
  });

  const [deletedInstallmentSlots, setDeletedInstallmentSlots] = useState<string[]>(() => {
    if (!currentUserId || isUserAdmin) return [];
    const saved = localStorage.getItem(`mbr_usr_${currentUserId}_deleted_installment_slots`);
    return saved ? JSON.parse(saved) : [];
  });

  const [companies, setCompanies] = useState<string[]>(() => {
    if (!currentUserId || isUserAdmin) return [];
    const saved = localStorage.getItem(`mbr_usr_${currentUserId}_companies`);
    return saved ? JSON.parse(saved) : [];
  });

  const [enabledModules, setEnabledModules] = useState<{ personal: boolean, business: boolean }>(() => {
    if (!currentUserId || isUserAdmin) return { personal: true, business: true };
    const saved = localStorage.getItem(`mbr_usr_${currentUserId}_enabled_modules`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed && (parsed.personal || parsed.business)) return parsed;
      } catch (e) {
        // ignore
      }
    }
    return { personal: true, business: true };
  });

  // Re-hidratar dados do usuário quando mudar a sessão ou logar
  useEffect(() => {
    if (!currentUserId || isUserAdmin) {
      resetUserDataState();
      setIsLoadingUserData(false);
      return;
    }

    let isMounted = true;
    setIsLoadingUserData(true);
    // Limpar imediatamente os dados de sessões passadas para evitar colisão visual ou de cache
    resetUserDataState();

    async function loadUserData() {
      try {
        // 1. Carregar Transações do Supabase
        const remoteTx = await financialService.getTransactions(currentUserId!);
        if (!isMounted) return;

        if (remoteTx && remoteTx.length > 0) {
          setTransactions(normalizeProLaboreTransactions(remoteTx));
        } else {
          // Checar se há dados locais do próprio usuário para resiliência/migração
          const savedTx = localStorage.getItem(`mbr_usr_${currentUserId}_transactions`);
          if (savedTx) {
            try {
              const parsed = normalizeProLaboreTransactions(JSON.parse(savedTx));
              setTransactions(parsed);
              parsed.forEach(tx => financialService.upsertTransaction(currentUserId!, tx));
            } catch (e) {
              setTransactions([]);
            }
          } else {
            // REGRA ABSOLUTA: Se o usuário tem zero registros, o estado DEVE ser uma lista vazia []
            setTransactions([]);
          }
        }

        // 2. Carregar Categorias Pessoais do Supabase
        const remotePersonalCats = await financialService.getCategories(currentUserId!, 'PERSONAL');
        if (!isMounted) return;
        if (remotePersonalCats && remotePersonalCats.length > 0) {
          setPersonalCats(ensureSalarioCategory(remotePersonalCats));
        } else {
          setPersonalCats(PERSONAL_CATEGORIES);
        }

        // 3. Carregar Categorias Empresariais do Supabase
        const remoteBusinessCats = await financialService.getCategories(currentUserId!, 'BUSINESS');
        if (!isMounted) return;
        if (remoteBusinessCats && remoteBusinessCats.length > 0) {
          setBusinessCats(remoteBusinessCats);
        } else {
          setBusinessCats(BUSINESS_EXPENSE_CATEGORIES);
        }

        // 4. Carregar Empresas do Supabase
        const remoteCompanies = await financialService.getCompanies(currentUserId!);
        if (!isMounted) return;
        setCompanies(remoteCompanies || []);

        // 5. Carregar Configurações (Módulos e Séries Excluídas)
        const remoteSettings = await financialService.getUserSettings(currentUserId!);
        if (!isMounted) return;
        if (remoteSettings) {
          if (remoteSettings.enabled_modules) setEnabledModules(remoteSettings.enabled_modules);
          if (remoteSettings.deleted_fixed_single) setDeletedFixedSingle(remoteSettings.deleted_fixed_single);
          if (remoteSettings.canceled_fixed_series) setCanceledFixedSeries(remoteSettings.canceled_fixed_series);
          if (remoteSettings.canceled_installment_series) setCanceledInstallmentSeries(remoteSettings.canceled_installment_series);
          if (remoteSettings.deleted_installment_slots) setDeletedInstallmentSlots(remoteSettings.deleted_installment_slots);
        } else {
          setEnabledModules({ personal: true, business: true });
          setDeletedFixedSingle([]);
          setCanceledFixedSeries([]);
          setCanceledInstallmentSeries([]);
          setDeletedInstallmentSlots([]);
        }
      } catch (e) {
        console.error("Erro ao carregar dados do usuário no Supabase:", e);
      } finally {
        if (isMounted) {
          setIsLoadingUserData(false);
        }
      }
    }

    loadUserData();

    return () => { isMounted = false; };
  }, [currentUserId, isUserAdmin, resetUserDataState]);

  // Efeitos para persistir dados isolados por usuário (SOMENTE após término do carregamento)
  useEffect(() => {
    if (currentUserId && !isUserAdmin && !isLoadingUserData) {
      localStorage.setItem(`mbr_usr_${currentUserId}_transactions`, JSON.stringify(transactions));
    }
  }, [transactions, currentUserId, isUserAdmin, isLoadingUserData]);

  useEffect(() => {
    if (currentUserId && !isUserAdmin && !isLoadingUserData) {
      localStorage.setItem(`mbr_usr_${currentUserId}_enabled_modules`, JSON.stringify(enabledModules));
    }
  }, [enabledModules, currentUserId, isUserAdmin, isLoadingUserData]);

  useEffect(() => {
    if (currentUserId && !isUserAdmin && !isLoadingUserData) {
      localStorage.setItem(`mbr_usr_${currentUserId}_personal_cats`, JSON.stringify(personalCats));
    }
  }, [personalCats, currentUserId, isUserAdmin, isLoadingUserData]);

  useEffect(() => {
    if (currentUserId && !isUserAdmin && !isLoadingUserData) {
      localStorage.setItem(`mbr_usr_${currentUserId}_business_cats`, JSON.stringify(businessCats));
    }
  }, [businessCats, currentUserId, isUserAdmin, isLoadingUserData]);

  useEffect(() => {
    if (currentUserId && !isUserAdmin && !isLoadingUserData) {
      localStorage.setItem(`mbr_usr_${currentUserId}_companies`, JSON.stringify(companies));
    }
  }, [companies, currentUserId, isUserAdmin, isLoadingUserData]);

  useEffect(() => {
    if (currentUserId && !isUserAdmin && !isLoadingUserData) {
      localStorage.setItem(`mbr_usr_${currentUserId}_deleted_fixed_single`, JSON.stringify(deletedFixedSingle));
    }
  }, [deletedFixedSingle, currentUserId, isUserAdmin, isLoadingUserData]);

  useEffect(() => {
    if (currentUserId && !isUserAdmin && !isLoadingUserData) {
      localStorage.setItem(`mbr_usr_${currentUserId}_canceled_fixed_series`, JSON.stringify(canceledFixedSeries));
    }
  }, [canceledFixedSeries, currentUserId, isUserAdmin, isLoadingUserData]);

  useEffect(() => {
    if (currentUserId && !isUserAdmin && !isLoadingUserData) {
      localStorage.setItem(`mbr_usr_${currentUserId}_canceled_installment_series`, JSON.stringify(canceledInstallmentSeries));
    }
  }, [canceledInstallmentSeries, currentUserId, isUserAdmin, isLoadingUserData]);

  useEffect(() => {
    if (currentUserId && !isUserAdmin && !isLoadingUserData) {
      localStorage.setItem(`mbr_usr_${currentUserId}_deleted_installment_slots`, JSON.stringify(deletedInstallmentSlots));
    }
  }, [deletedInstallmentSlots, currentUserId, isUserAdmin, isLoadingUserData]);

  const handleLogout = async () => {
    await authService.logout();
    resetUserDataState();
    setAuthSession(null);
  };

  const [filter, setFilter] = useState<DateFilter>({
    day: new Date().getDate(),
    month: new Date().getMonth(),
    year: new Date().getFullYear(),
    viewType: 'MONTH'
  });
  
  const [showForm, setShowForm] = useState(false);
  const [showProLaboreForm, setShowProLaboreForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const [newDesc, setNewDesc] = useState('');
  const [newAmount, setNewAmount] = useState('');
  const [newType, setNewType] = useState<TransactionType>('EXPENSE');
  const [newCat, setNewCat] = useState('');
  const [customCat, setCustomCat] = useState('');
  const [isFixedCategory, setIsFixedCategory] = useState(false);
  const [isFixedTransaction, setIsFixedTransaction] = useState(false);
  const [dueDay, setDueDay] = useState<string>('');
  const [isInstallment, setIsInstallment] = useState(false);
  const [totalInstallments, setTotalInstallments] = useState<string>('12');
  const [currentInstallment, setCurrentInstallment] = useState<string>('1');

  const [proLaboreCompany, setProLaboreCompany] = useState('');
  const [proLaboreValue, setProLaboreValue] = useState('');
  const [proLaboreFixed, setProLaboreFixed] = useState(true);
  const [proLaboreDay, setProLaboreDay] = useState('05');

  const [newCompanyName, setNewCompanyName] = useState('');
  const [showCompanyManager, setShowCompanyManager] = useState(false);
  const [editingCompanyName, setEditingCompanyName] = useState<string | null>(null);
  const [confirmDeleteCompany, setConfirmDeleteCompany] = useState<string | null>(null);

  const [moduleErrorMsg, setModuleErrorMsg] = useState<string | null>(null);

  const handleTogglePersonalModule = () => {
    if (enabledModules.personal && !enabledModules.business) {
      setModuleErrorMsg('Pelo menos um módulo (Pessoal ou Empresarial) deve permanecer ativo no sistema.');
      setTimeout(() => setModuleErrorMsg(null), 4000);
      return;
    }
    setModuleErrorMsg(null);
    setEnabledModules(prev => ({ ...prev, personal: !prev.personal }));
  };

  const handleToggleBusinessModule = () => {
    if (enabledModules.business && !enabledModules.personal) {
      setModuleErrorMsg('Pelo menos um módulo (Pessoal ou Empresarial) deve permanecer ativo no sistema.');
      setTimeout(() => setModuleErrorMsg(null), 4000);
      return;
    }
    setModuleErrorMsg(null);
    setEnabledModules(prev => ({ ...prev, business: !prev.business }));
  };
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    return localStorage.getItem('mbr_dark_mode') === 'true';
  });
  const [showSettings, setShowSettings] = useState(false);
  const [showCleanup, setShowCleanup] = useState(false);
  const [cleanupTarget, setCleanupTarget] = useState<'PERSONAL' | 'BUSINESS' | 'BOTH' | null>(null);
  const [showCleanupConfirm, setShowCleanupConfirm] = useState(false);

  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [editPasswordConfirm, setEditPasswordConfirm] = useState('');
  const [profileMsg, setProfileMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const profileDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileDropdownRef.current && !profileDropdownRef.current.contains(event.target as Node)) {
        setIsProfileDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleOpenProfileModal = () => {
    if (authSession?.user) {
      setEditName(authSession.user.name);
      setEditPassword('');
      setEditPasswordConfirm('');
      setProfileMsg(null);
      setShowProfileModal(true);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authSession) return;
    setProfileMsg(null);

    if (!editName.trim()) {
      setProfileMsg({ type: 'error', text: 'O nome é obrigatório.' });
      return;
    }

    // Validação de senha caso o usuário tenha preenchido
    if (editPassword) {
      if (editPassword.length < 6) {
        setProfileMsg({ type: 'error', text: 'A nova senha deve possuir no mínimo 6 caracteres.' });
        return;
      }
      if (editPassword !== editPasswordConfirm) {
        setProfileMsg({ type: 'error', text: 'A confirmação de senha não confere com a nova senha.' });
        return;
      }
    }

    // Atualizar nome e/ou senha via updateUser (usa Admin API isolada para senha)
    const updateResult = await authService.updateUser(authSession.user.id, { 
      name: editName.trim(),
      ...(editPassword.trim() ? { password: editPassword.trim() } : {})
    });

    if (!updateResult.success) {
      setProfileMsg({ type: 'error', text: updateResult.message || 'Erro ao atualizar dados do perfil.' });
      return;
    }

    const freshSession = await authService.getCurrentSession();
    if (freshSession) {
      setAuthSession(freshSession);
    }

    setProfileMsg({ 
      type: 'success', 
      text: editPassword.trim() ? 'Perfil e nova senha atualizados com sucesso!' : 'Perfil atualizado com sucesso!' 
    });
    setEditPassword('');
    setEditPasswordConfirm('');

    setTimeout(() => {
      setShowProfileModal(false);
      setProfileMsg(null);
    }, 1500);
  };

  useEffect(() => {
    localStorage.setItem('mbr_dark_mode', String(isDarkMode));
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  useEffect(() => {
    // Redirecionar se o módulo atual for desativado
    if (activeTab === 'PERSONAL' && !enabledModules.personal) setActiveTab('HOME');
    if (activeTab === 'BUSINESS' && !enabledModules.business) setActiveTab('HOME');
  }, [enabledModules, activeTab]);

  const runAnalysis = useCallback(async (params?: AnalysisParams) => {
    if (isAnalyzing) return; 
    setIsAnalyzing(true);
    try {
      const p: AnalysisParams = params || {
        scope: activeTab === 'PERSONAL' ? 'PERSONAL' : activeTab === 'BUSINESS' ? 'BUSINESS' : 'CONSOLIDATED',
        periodType: 'SINGLE_MONTH',
        month: filter.month,
        selectedMonths: [filter.month],
        startMonth: 0,
        endMonth: filter.month,
        year: filter.year,
        selectedYears: [filter.year - 1, filter.year]
      };
      const result = await analyzeFinancials(transactions, p);
      setAnalysisResult(result);
    } catch (error) {
      console.error("Erro na análise estratégica:", error);
    } finally {
      setIsAnalyzing(false);
    }
  }, [transactions, isAnalyzing, activeTab, filter]); 

  useEffect(() => {
    if (filter.viewType !== 'MONTH' && filter.viewType !== 'DAY') return;
    const targetMonth = filter.month;
    const targetYear = filter.year;

    setTransactions(prev => {
      let updated = [...prev];
      let hasChanges = false;
      
      // 1. Mapear base de parcelamentos (o de menor parcela ou mais antigo de cada série)
      const installmentBaseMap = new Map<string, Transaction>();
      // 2. Mapear base de fixos (o mais antigo de cada série)
      const fixedBaseMap = new Map<string, Transaction>();

      prev.forEach(t => {
        if (t.installments) {
          const pId = t.installments.parentId || t.id;
          const existing = installmentBaseMap.get(pId);
          if (!existing) {
            installmentBaseMap.set(pId, t);
          } else {
            if (t.installments.current < existing.installments.current || t.date < existing.date) {
              installmentBaseMap.set(pId, t);
            }
          }
        } else if (t.isFixed) {
          const fixedKey = `${t.module}-${t.description.trim().toLowerCase()}-${t.category}`;
          const existing = fixedBaseMap.get(fixedKey);
          if (!existing || t.date < existing.date) {
            fixedBaseMap.set(fixedKey, t);
          }
        }
      });

      // Projetar Parcelamentos
      installmentBaseMap.forEach((baseTx, pId) => {
        if (!baseTx.installments) return;
        const baseParts = getLocalDateParts(baseTx.date);
        const startMonth = baseParts.month;
        const startYear = baseParts.year;

        const maxDiff = (targetYear - startYear) * 12 + (targetMonth - startMonth);
        if (maxDiff <= 0) return;

        for (let step = 1; step <= maxDiff; step++) {
          const totalMonths = startMonth + step;
          const mYear = startYear + Math.floor(totalMonths / 12);
          const mMonth = ((totalMonths % 12) + 12) % 12;

          const currentInstallmentNumber = baseTx.installments.current + step;
          if (currentInstallmentNumber > baseTx.installments.total) break;

          if (deletedInstallmentSlots.includes(`${pId}-${currentInstallmentNumber}`)) continue;
          const canceledSeries = canceledInstallmentSeries.find(c => c.parentId === pId);
          if (canceledSeries && currentInstallmentNumber > canceledSeries.maxAllowedInstallment) continue;

          const alreadyExists = updated.some(t => {
            const tp = getLocalDateParts(t.date);
            if (tp.year !== mYear || tp.month !== mMonth) return false;
            if (!t.installments) return false;
            const tpId = t.installments.parentId || t.id;
            return tpId === pId || (t.description.trim().toLowerCase() === baseTx.description.trim().toLowerCase() && t.category === baseTx.category && t.module === baseTx.module);
          });

          if (!alreadyExists) {
            const day = baseTx.dueDay || baseParts.day;
            const daysInTargetMonth = new Date(mYear, mMonth + 1, 0).getDate();
            const safeDay = Math.min(day, daysInTargetMonth);

            const newTransaction: Transaction = {
              ...baseTx,
              id: crypto.randomUUID(),
              date: new Date(Date.UTC(mYear, mMonth, safeDay)).toISOString(),
              paid: false,
              paymentDate: undefined,
              installments: {
                ...baseTx.installments,
                current: currentInstallmentNumber,
                parentId: pId
              }
            };
            updated.push(newTransaction);
            hasChanges = true;
          }
        }
      });

      // Projetar Fixos
      fixedBaseMap.forEach((baseTx) => {
        const baseParts = getLocalDateParts(baseTx.date);
        const startMonth = baseParts.month;
        const startYear = baseParts.year;
        const fixedKey = `${baseTx.module}-${baseTx.description}-${baseTx.category}`;

        const maxDiff = (targetYear - startYear) * 12 + (targetMonth - startMonth);
        if (maxDiff <= 0) return;

        for (let step = 1; step <= maxDiff; step++) {
          const totalMonths = startMonth + step;
          const mYear = startYear + Math.floor(totalMonths / 12);
          const mMonth = ((totalMonths % 12) + 12) % 12;

          if (deletedFixedSingle.includes(`${fixedKey}-${mYear}-${mMonth}`)) continue;

          const isCanceled = canceledFixedSeries.some(c => {
            if (c.key !== fixedKey) return false;
            const diff = (mYear - c.startYear) * 12 + (mMonth - c.startMonth);
            return diff >= 0;
          });
          if (isCanceled) continue;

          const alreadyExists = updated.some(t => {
            const tp = getLocalDateParts(t.date);
            if (tp.year !== mYear || tp.month !== mMonth) return false;
            if (!t.isFixed) return false;
            const k = `${t.module}-${t.description}-${t.category}`;
            return k === fixedKey;
          });

          if (!alreadyExists) {
            const day = baseTx.dueDay || baseParts.day;
            const daysInTargetMonth = new Date(mYear, mMonth + 1, 0).getDate();
            const safeDay = Math.min(day, daysInTargetMonth);

            const newTransaction: Transaction = {
              ...baseTx,
              id: crypto.randomUUID(),
              date: new Date(Date.UTC(mYear, mMonth, safeDay)).toISOString(),
              paid: false,
              paymentDate: undefined
            };
            updated.push(newTransaction);
            hasChanges = true;
          }
        }
      });

      return hasChanges ? updated : prev;
    });
  }, [filter.month, filter.year, deletedFixedSingle, canceledFixedSeries, canceledInstallmentSeries, deletedInstallmentSlots]);

  const moduleTransactions = useMemo(() => {
    return activeTab === 'HOME' ? transactions : transactions.filter(t => t.module === activeTab);
  }, [transactions, activeTab]);

  const filteredTransactions = useMemo(() => {
    return moduleTransactions.filter(t => {
      const parts = getLocalDateParts(t.date);
      if (filter.viewType === 'YEAR') return parts.year === filter.year;
      if (filter.viewType === 'DAY') {
        return parts.day === filter.day && parts.month === filter.month && parts.year === filter.year;
      }
      return parts.month === filter.month && parts.year === filter.year;
    });
  }, [moduleTransactions, filter]);

  const stats = useMemo(() => {
    const isProLabore = (t: Transaction) => t.module === 'PERSONAL' && (t.description.startsWith('Pró-labore') || t.description.toLowerCase().includes('pro-labore') || t.description.toLowerCase().includes('prolabore') || t.description.toLowerCase().includes('pró-labore'));

    const personalIncome = filteredTransactions
      .filter(t => t.type === 'INCOME' && t.module === 'PERSONAL')
      .reduce((acc, t) => acc + t.amount, 0);

    const personalIncomeNoProLabore = filteredTransactions
      .filter(t => t.type === 'INCOME' && t.module === 'PERSONAL' && !isProLabore(t))
      .reduce((acc, t) => acc + t.amount, 0);

    const businessIncome = filteredTransactions
      .filter(t => t.type === 'INCOME' && t.module === 'BUSINESS')
      .reduce((acc, t) => acc + t.amount, 0);

    const income = activeTab === 'HOME' 
      ? (businessIncome + personalIncomeNoProLabore) 
      : (activeTab === 'PERSONAL' ? personalIncome : businessIncome);

    const personalExpenses = filteredTransactions
      .filter(t => t.type === 'EXPENSE' && t.module === 'PERSONAL')
      .reduce((acc, t) => acc + t.amount, 0);

    const businessExpenses = filteredTransactions
      .filter(t => t.type === 'EXPENSE' && t.module === 'BUSINESS')
      .reduce((acc, t) => acc + t.amount, 0);

    const expenses = personalExpenses + businessExpenses;

    const proLaboreMonth = transactions.reduce((acc, t) => {
      if (isProLabore(t)) {
        const parts = getLocalDateParts(t.date);
        if (parts.month === filter.month && parts.year === filter.year) {
          return acc + t.amount;
        }
      }
      return acc;
    }, 0);

    const proLaboreYear = transactions.reduce((acc, t) => {
      if (isProLabore(t)) {
        const parts = getLocalDateParts(t.date);
        if (parts.year === filter.year) {
          return acc + t.amount;
        }
      }
      return acc;
    }, 0);

    return { 
      income, 
      expenses, 
      personalIncome,
      businessIncome,
      personalExpenses,
      businessExpenses,
      proLaboreMonth, 
      proLaboreYear 
    };
  }, [filteredTransactions, transactions, activeTab, filter.month, filter.year]);

  const resetForm = () => {
    setNewDesc(''); setNewAmount(''); setNewCat(''); setCustomCat(''); setEditingId(null); setIsFixedCategory(false);
    setIsFixedTransaction(false); setDueDay(''); setIsInstallment(false); setTotalInstallments('12'); setCurrentInstallment('1'); setShowForm(false);
    setShowProLaboreForm(false); setProLaboreValue(''); setProLaboreCompany(''); setProLaboreFixed(true); setProLaboreDay('05');
  };

  const handleEdit = (transaction: Transaction) => {
    setEditingId(transaction.id); setNewDesc(transaction.description); setNewAmount(transaction.amount.toString()); setNewType(transaction.type);
    setIsFixedTransaction(!!transaction.isFixed); setDueDay(transaction.dueDay?.toString() || ''); setIsInstallment(!!transaction.installments);
    setTotalInstallments(transaction.installments?.total.toString() || '12'); setCurrentInstallment(transaction.installments?.current.toString() || '1');
    const currentCats = activeTab === 'PERSONAL' ? personalCats : businessCats;
    if (currentCats.includes(transaction.category)) setNewCat(transaction.category); else { setNewCat('Outros'); setCustomCat(transaction.category); }
    setShowForm(true); setShowProLaboreForm(false); window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = (id: string, scope: DeleteScope = 'SINGLE') => {
    const targetTx = transactions.find(t => t.id === id);
    if (!targetTx) return;

    const parts = getLocalDateParts(targetTx.date);

    if (targetTx.installments) {
      const pId = targetTx.installments.parentId || targetTx.id;
      const currentNum = targetTx.installments.current;

      if (scope === 'ALL_INSTALLMENTS') {
        const toDeleteIds: string[] = [];
        setTransactions(prev => prev.filter(t => {
          if (!t.installments) return true;
          const tpId = t.installments.parentId || t.id;
          const sameSeries = tpId === pId || (t.description === targetTx.description && t.category === targetTx.category && t.module === targetTx.module);
          if (sameSeries) {
            toDeleteIds.push(t.id);
            return false;
          }
          return true;
        }));
        if (currentUserId) {
          toDeleteIds.forEach(delId => financialService.deleteTransaction(currentUserId, delId));
          const updatedCanceled = [
            ...canceledInstallmentSeries.filter(c => c.parentId !== pId),
            { parentId: pId, maxAllowedInstallment: 0 }
          ];
          setCanceledInstallmentSeries(updatedCanceled);
          financialService.updateUserSettings(currentUserId, { canceled_installment_series: updatedCanceled });
        }
      } else if (scope === 'THIS_AND_FUTURE_INSTALLMENTS') {
        const toDeleteIds: string[] = [];
        setTransactions(prev => prev.filter(t => {
          if (!t.installments) return true;
          const tpId = t.installments.parentId || t.id;
          const sameSeries = tpId === pId || (t.description === targetTx.description && t.category === targetTx.category && t.module === targetTx.module);
          if (sameSeries && t.installments.current >= currentNum) {
            toDeleteIds.push(t.id);
            return false;
          }
          return true;
        }));
        if (currentUserId) {
          toDeleteIds.forEach(delId => financialService.deleteTransaction(currentUserId, delId));
          const updatedCanceled = [
            ...canceledInstallmentSeries.filter(c => c.parentId !== pId),
            { parentId: pId, maxAllowedInstallment: currentNum - 1 }
          ];
          setCanceledInstallmentSeries(updatedCanceled);
          financialService.updateUserSettings(currentUserId, { canceled_installment_series: updatedCanceled });
        }
      } else {
        setTransactions(prev => prev.filter(t => t.id !== id));
        if (currentUserId) {
          financialService.deleteTransaction(currentUserId, id);
          const updatedSlots = [...deletedInstallmentSlots, `${pId}-${currentNum}`];
          setDeletedInstallmentSlots(updatedSlots);
          financialService.updateUserSettings(currentUserId, { deleted_installment_slots: updatedSlots });
        }
      }
    } else if (targetTx.isFixed) {
      const fixedKey = `${targetTx.module}-${targetTx.description}-${targetTx.category}`;

      if (scope === 'FUTURE_FIXED') {
        const toDeleteIds: string[] = [];
        setTransactions(prev => prev.filter(t => {
          if (!t.isFixed) return true;
          const sameSeries = t.module === targetTx.module && t.description === targetTx.description && t.category === targetTx.category && t.type === targetTx.type;
          if (sameSeries && new Date(t.date) >= new Date(targetTx.date)) {
            toDeleteIds.push(t.id);
            return false;
          }
          return true;
        }));
        if (currentUserId) {
          toDeleteIds.forEach(delId => financialService.deleteTransaction(currentUserId, delId));
          const updatedCanceled = [
            ...canceledFixedSeries.filter(c => c.key !== fixedKey),
            { key: fixedKey, startYear: parts.year, startMonth: parts.month }
          ];
          setCanceledFixedSeries(updatedCanceled);
          financialService.updateUserSettings(currentUserId, { canceled_fixed_series: updatedCanceled });
        }
      } else {
        setTransactions(prev => prev.filter(t => t.id !== id));
        if (currentUserId) {
          financialService.deleteTransaction(currentUserId, id);
          const updatedFixed = [...deletedFixedSingle, `${fixedKey}-${parts.year}-${parts.month}`];
          setDeletedFixedSingle(updatedFixed);
          financialService.updateUserSettings(currentUserId, { deleted_fixed_single: updatedFixed });
        }
      }
    } else {
      setTransactions(prev => prev.filter(t => t.id !== id));
      if (currentUserId) {
        financialService.deleteTransaction(currentUserId, id);
      }
    }
  };

  const handleTogglePaid = (id: string) => {
    let updatedTx: Transaction | null = null;
    setTransactions(prev => prev.map(t => {
      if (t.id === id) {
        const isPaid = !t.paid;
        const now = new Date();
        const utcPaymentDate = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())).toISOString();
        updatedTx = { 
          ...t, 
          paid: isPaid, 
          paymentDate: isPaid ? utcPaymentDate : undefined 
        };
        return updatedTx;
      }
      return t;
    }));

    if (currentUserId && updatedTx) {
      financialService.upsertTransaction(currentUserId, updatedTx);
    }
  };

  const handleAddTransaction = (e: React.FormEvent) => {
    e.preventDefault(); 
    if (!newDesc || !newAmount || !newCat || activeTab === 'HOME') {
      alert('Por favor, preencha todos os campos obrigatórios (Descrição, Valor e Categoria).');
      return;
    }
    
    let finalCategory = newCat;
    if (newCat === 'Outros' && customCat.trim()) {
      finalCategory = customCat.trim();
      if (isFixedCategory) {
        if (activeTab === 'PERSONAL') {
          setPersonalCats(prev => [...prev.filter(c => c !== 'Outros'), finalCategory, 'Outros']);
          if (currentUserId) financialService.addCategory(currentUserId, 'PERSONAL', finalCategory);
        } else {
          setBusinessCats(prev => [...prev.filter(c => c !== 'Outros'), finalCategory, 'Outros']);
          if (currentUserId) financialService.addCategory(currentUserId, 'BUSINESS', finalCategory);
        }
      }
    }
    const parsedDueDay = dueDay ? parseInt(dueDay) : undefined;
    const defaultDay = filter.viewType === 'DAY' ? filter.day : (filter.month === new Date().getMonth() && filter.year === new Date().getFullYear() ? new Date().getDate() : 1);
    const day = parsedDueDay || defaultDay;
    const daysInMonth = new Date(filter.year, filter.month + 1, 0).getDate();
    const safeDay = Math.min(day, daysInMonth);

    const isBoleto = isFixedTransaction || isInstallment || parsedDueDay !== undefined;
    const now = new Date();
    const utcPaymentDate = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())).toISOString();

    if (editingId) {
      let updatedTx: Transaction | null = null;
      setTransactions(prev => prev.map(t => {
        if (t.id === editingId) {
          const parts = getLocalDateParts(t.date);
          const editDay = parsedDueDay || parts.day;
          const editDaysInMonth = new Date(parts.year, parts.month + 1, 0).getDate();
          const editSafeDay = Math.min(editDay, editDaysInMonth);
          const editDate = new Date(Date.UTC(parts.year, parts.month, editSafeDay)).toISOString();
          const wasBoleto = Boolean(t.isFixed || t.installments || t.dueDay !== undefined);
          const isPaidNow = !isBoleto ? true : (wasBoleto ? Boolean(t.paid) : false);

          updatedTx = {
            ...t,
            date: editDate,
            description: newDesc,
            amount: parseFloat(newAmount),
            type: newType,
            category: finalCategory,
            isFixed: isFixedTransaction,
            dueDay: parsedDueDay,
            paid: isPaidNow,
            paymentDate: isPaidNow ? (t.paymentDate || utcPaymentDate) : undefined,
            installments: isInstallment ? {
              current: parseInt(currentInstallment),
              total: parseInt(totalInstallments),
              parentId: t.installments?.parentId || t.id
            } : undefined
          };
          return updatedTx;
        }
        return t;
      }));

      if (currentUserId && updatedTx) {
        financialService.upsertTransaction(currentUserId, updatedTx);
      }
    } else {
      const id = crypto.randomUUID();
      const txDate = new Date(Date.UTC(filter.year, filter.month, safeDay)).toISOString();
      const tx: Transaction = {
        id,
        date: txDate,
        description: newDesc,
        amount: parseFloat(newAmount),
        type: newType,
        category: finalCategory,
        module: activeTab as any,
        isFixed: isFixedTransaction,
        dueDay: parsedDueDay,
        paid: !isBoleto,
        paymentDate: !isBoleto ? utcPaymentDate : undefined,
        installments: isInstallment ? {
          current: parseInt(currentInstallment),
          total: parseInt(totalInstallments),
          parentId: id
        } : undefined
      };
      setTransactions(prev => [tx, ...prev]);
      if (currentUserId) {
        financialService.upsertTransaction(currentUserId, tx);
      }
    }
    resetForm();
  };

  const handleProLaboreSubmit = (e: React.FormEvent) => {
    e.preventDefault(); if (!proLaboreCompany || !proLaboreValue) return;
    const day = parseInt(proLaboreDay) || 1;
    const now = new Date();
    const utcPaymentDate = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())).toISOString();
    const tx: Transaction = { 
      id: crypto.randomUUID(), 
      date: new Date(Date.UTC(filter.year, filter.month, day)).toISOString(), 
      description: `Pró-labore: ${proLaboreCompany}`, 
      amount: parseFloat(proLaboreValue), 
      type: 'INCOME', 
      category: 'Pró-labore', 
      module: 'PERSONAL', 
      isFixed: proLaboreFixed,
      dueDay: proLaboreFixed ? day : undefined,
      paid: true,
      paymentDate: utcPaymentDate
    };
    setTransactions(prev => [tx, ...prev]);
    if (currentUserId) {
      financialService.upsertTransaction(currentUserId, tx);
    }
    resetForm();
  };

  const handleAddCompany = (e: React.FormEvent) => {
    e.preventDefault(); if (!newCompanyName.trim()) return;
    const company = newCompanyName.trim();
    if (editingCompanyName) {
      const old = editingCompanyName;
      setCompanies(prev => prev.map(c => c === old ? company : c));
      setEditingCompanyName(null);
      if (currentUserId) financialService.updateCompany(currentUserId, old, company);
    } else if (!companies.includes(company)) {
      setCompanies(prev => [...prev, company]);
      if (currentUserId) financialService.addCompany(currentUserId, company);
    }
    setNewCompanyName('');
  };

  const handleRemoveCompany = (company: string) => {
    setCompanies(prev => prev.filter(c => c !== company));
    setConfirmDeleteCompany(null);
    if (currentUserId) financialService.deleteCompany(currentUserId, company);
  };

  const handleCleanup = () => {
    if (!cleanupTarget) return;
    
    const toDelete = transactions.filter(t => cleanupTarget === 'BOTH' || t.module === cleanupTarget);
    setTransactions(prev => {
      if (cleanupTarget === 'BOTH') return [];
      return prev.filter(t => t.module !== cleanupTarget);
    });

    if (currentUserId) {
      toDelete.forEach(t => financialService.deleteTransaction(currentUserId, t.id));
    }

    if (cleanupTarget === 'PERSONAL') {
      setPersonalCats(PERSONAL_CATEGORIES);
      const newCanceled = canceledFixedSeries.filter(c => !c.key.startsWith('PERSONAL-'));
      const newDeleted = deletedFixedSingle.filter(k => !k.startsWith('PERSONAL-'));
      setCanceledFixedSeries(newCanceled);
      setDeletedFixedSingle(newDeleted);
      if (currentUserId) {
        financialService.updateUserSettings(currentUserId, { canceled_fixed_series: newCanceled, deleted_fixed_single: newDeleted });
      }
    } else if (cleanupTarget === 'BUSINESS') {
      setBusinessCats(BUSINESS_EXPENSE_CATEGORIES);
      setCompanies([]);
      const newCanceled = canceledFixedSeries.filter(c => !c.key.startsWith('BUSINESS-'));
      const newDeleted = deletedFixedSingle.filter(k => !k.startsWith('BUSINESS-'));
      setCanceledFixedSeries(newCanceled);
      setDeletedFixedSingle(newDeleted);
      if (currentUserId) {
        companies.forEach(c => financialService.deleteCompany(currentUserId, c));
        financialService.updateUserSettings(currentUserId, { canceled_fixed_series: newCanceled, deleted_fixed_single: newDeleted });
      }
    } else if (cleanupTarget === 'BOTH') {
      setPersonalCats(PERSONAL_CATEGORIES);
      setBusinessCats(BUSINESS_EXPENSE_CATEGORIES);
      setCompanies([]);
      setCanceledFixedSeries([]);
      setDeletedFixedSingle([]);
      setCanceledInstallmentSeries([]);
      setDeletedInstallmentSlots([]);
      if (currentUserId) {
        companies.forEach(c => financialService.deleteCompany(currentUserId, c));
        financialService.updateUserSettings(currentUserId, {
          canceled_fixed_series: [],
          deleted_fixed_single: [],
          canceled_installment_series: [],
          deleted_installment_slots: []
        });
      }
    }

    setShowCleanup(false);
    setCleanupTarget(null);
    setShowCleanupConfirm(false);
    alert('Dados limpos com sucesso!');
  };

  const renderContent = () => {
    switch(activeTab) {
      case 'HOME':
        return (
          <div className="space-y-4 sm:space-y-8 animate-in fade-in duration-700">
            <Dashboard 
              transactions={transactions} 
              filter={filter} 
              activeModule={activeTab}
              score={analysisResult?.financialScore} 
              scorePeriod={scorePeriod}
              onScorePeriodChange={setScorePeriod}
              isScoreLoading={isAnalyzing}
              onTogglePaid={handleTogglePaid}
              enabledModules={enabledModules}
            />
            <AIConsultant 
              transactions={transactions} 
              module={activeTab} 
              globalFilter={filter}
              analysis={analysisResult}
              isLoading={isAnalyzing}
              onAnalyze={(params) => runAnalysis(params)}
              enabledModules={enabledModules}
            />
          </div>
        );
      case 'PERSONAL':
      case 'BUSINESS':
        return (
          <div className="space-y-4 sm:space-y-8 animate-in fade-in duration-700">
            <div className="bg-white dark:bg-slate-900 p-3 sm:p-4 rounded-2xl border border-slate-100 dark:border-slate-800 flex flex-wrap items-center gap-3 sm:gap-6 shadow-sm">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black text-slate-400 dark:text-slate-400 uppercase tracking-widest">Visualizar:</span>
                <select className="text-xs font-bold text-slate-700 dark:text-slate-200 bg-slate-50 dark:bg-slate-800 border-none rounded-lg px-3 py-1.5 outline-none cursor-pointer" value={filter.viewType} onChange={e => setFilter(prev => ({ ...prev, viewType: e.target.value as any }))}>
                  <option value="DAY">Diário</option>
                  <option value="MONTH">Mensal</option>
                  <option value="YEAR">Anual</option>
                </select>
              </div>
              {filter.viewType !== 'YEAR' && (
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black text-slate-400 dark:text-slate-400 uppercase tracking-widest">{filter.viewType === 'DAY' ? 'Dia / Mês:' : 'Mês:'}</span>
                  <div className="flex gap-1.5">
                    {filter.viewType === 'DAY' && (
                      <select className="text-xs font-bold text-slate-700 dark:text-slate-200 bg-slate-50 dark:bg-slate-800 border-none rounded-lg px-3 py-1.5 outline-none cursor-pointer" value={filter.day} onChange={e => setFilter(prev => ({ ...prev, day: parseInt(e.target.value) }))}>
                        {Array.from({ length: new Date(filter.year, filter.month + 1, 0).getDate() }, (_, i) => i + 1).map(d => ( <option key={d} value={d}>{String(d).padStart(2, '0')}</option> ))}
                      </select>
                    )}
                    <select className="text-xs font-bold text-slate-700 dark:text-slate-200 bg-slate-50 dark:bg-slate-800 border-none rounded-lg px-3 py-1.5 outline-none cursor-pointer" value={filter.month} onChange={e => setFilter(prev => ({ ...prev, month: parseInt(e.target.value) }))}>
                      {['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'].map((m, i) => ( <option key={m} value={i}>{m}</option> ))}
                    </select>
                  </div>
                </div>
              )}
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black text-slate-400 dark:text-slate-400 uppercase tracking-widest">Ano:</span>
                <select className="text-xs font-bold text-slate-700 dark:text-slate-200 bg-slate-50 dark:bg-slate-800 border-none rounded-lg px-3 py-1.5 outline-none cursor-pointer" value={filter.year} onChange={e => setFilter(prev => ({ ...prev, year: parseInt(e.target.value) }))}>
                  {[2023, 2024, 2025, 2026].map(y => ( <option key={y} value={y}>{y}</option> ))}
                </select>
              </div>
            </div>

            <FinancialSummary 
              income={stats.income} 
              expenses={stats.expenses} 
              personalIncome={stats.personalIncome}
              businessIncome={stats.businessIncome}
              personalExpenses={stats.personalExpenses}
              businessExpenses={stats.businessExpenses}
              proLaboreMonth={stats.proLaboreMonth}
              proLaboreYear={stats.proLaboreYear}
              showBalance={true}
              showProLabore={activeTab === 'PERSONAL' && enabledModules.business}
              isHomeTab={activeTab === 'HOME'}
              enabledModules={enabledModules}
            />

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
               <div className="flex items-center gap-3">
                <div className="w-1.5 h-6 rounded-full bg-[#F26522] shadow-[0_0_10px_rgba(242,101,34,0.6)]"></div>
                <div>
                  <h3 className="text-base sm:text-lg font-black text-slate-800 dark:text-slate-100 tracking-tight">{activeTab === 'PERSONAL' ? 'Gestão Pessoal' : 'Gestão Empresarial'}</h3>
                  <p className="text-[8px] sm:text-[9px] text-[#F26522] dark:text-[#F26522] font-black uppercase tracking-[0.2em]">Fluxo de Caixa MBR</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {activeTab === 'BUSINESS' && ( <button onClick={() => { setShowCompanyManager(!showCompanyManager); setShowForm(false); }} className="bg-[#F26522]/10 dark:bg-[#F26522]/20 text-[#F26522] hover:bg-[#F26522]/20 px-4 py-2 sm:px-6 sm:py-2.5 rounded-xl font-black border border-[#F26522]/30 text-xs transition-colors cursor-pointer">🏢 Gerenciar Empresas</button> )}
                {activeTab === 'PERSONAL' && enabledModules.business && ( <button onClick={() => { setShowProLaboreForm(!showProLaboreForm); setShowForm(false); }} className="bg-[#F26522]/10 dark:bg-[#F26522]/20 text-[#F26522] hover:bg-[#F26522]/20 px-4 py-2 sm:px-6 sm:py-2.5 rounded-xl font-black border border-[#F26522]/30 text-xs transition-colors cursor-pointer">💰 PRÓ-LABORE</button> )}
                <button onClick={() => { setShowForm(!showForm); setShowProLaboreForm(false); setShowCompanyManager(false); }} className="bg-[#F26522] hover:bg-[#D94100] text-white px-4 py-2 sm:px-6 sm:py-2.5 rounded-xl font-black text-xs shadow-md shadow-orange-950/20 transition-all cursor-pointer">{showForm ? '✕ Cancelar' : '⚡ Novo Registro'}</button>
              </div>
            </div>

            {showProLaboreForm && activeTab === 'PERSONAL' && enabledModules.business && (
              <div className="bg-white dark:bg-slate-900 p-5 sm:p-8 rounded-[1.5rem] border border-[#F26522]/30 dark:border-[#F26522]/30 shadow-xl animate-in slide-in-from-top-6 duration-500">
                <div className="mb-6"><h3 className="text-sm font-black text-slate-800 dark:text-slate-100 uppercase flex items-center gap-2"><span className="text-[#F26522]">💰</span> Receber Pró-labore</h3></div>
                <form onSubmit={handleProLaboreSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <select className="px-4 py-2.5 bg-gray-50 dark:bg-slate-800 border dark:border-slate-700 text-slate-800 dark:text-slate-100 rounded-lg text-xs font-bold focus:ring-2 focus:ring-[#F26522]" value={proLaboreCompany} onChange={e => setProLaboreCompany(e.target.value)} required>
                    <option value="">Empresa...</option>
                    {companies.map(c => <option key={c} value={c}>{c}</option>)}
                    <option value="Outros">Outras Fontes</option>
                  </select>
                  <input type="number" step="0.01" inputMode="decimal" placeholder="Valor" className="px-4 py-2.5 bg-gray-50 dark:bg-slate-800 border dark:border-slate-700 text-slate-800 dark:text-slate-100 rounded-lg text-xs focus:ring-2 focus:ring-[#F26522]" value={proLaboreValue} onChange={e => setProLaboreValue(e.target.value)} required />
                  <div className="flex items-center gap-4 px-4 bg-slate-50 dark:bg-slate-800 border dark:border-slate-700 rounded-lg">
                    <div className="flex items-center gap-2">
                      <input type="checkbox" id="pl-fixed" checked={proLaboreFixed} onChange={e => setProLaboreFixed(e.target.checked)} className="accent-[#F26522]" />
                      <label htmlFor="pl-fixed" className="text-[10px] font-black uppercase text-slate-700 dark:text-slate-300">Fixo</label>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-black uppercase text-slate-400">Dia:</span>
                      <input 
                        type="text" 
                        inputMode="numeric"
                        pattern="[0-9]*"
                        placeholder="Ex: 05"
                        className="w-12 h-7 text-center text-xs font-bold border dark:border-slate-600 rounded bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-[#F26522]" 
                        value={proLaboreDay} 
                        onChange={e => setProLaboreDay(e.target.value.replace(/\D/g, '').slice(0, 2))} 
                      />
                    </div>
                  </div>
                  <button type="submit" className="bg-[#F26522] hover:bg-[#D94100] text-white py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-all">Confirmar</button>
                </form>
              </div>
            )}

            {showCompanyManager && activeTab === 'BUSINESS' && (
              <div className="bg-white dark:bg-slate-900 p-5 sm:p-8 rounded-[1.5rem] border border-[#F26522]/30 dark:border-[#F26522]/30 shadow-xl animate-in slide-in-from-top-6 duration-500">
                <div className="mb-6 flex items-center justify-between"><h3 className="text-sm font-black text-slate-800 dark:text-slate-100 uppercase flex items-center gap-2"><span className="text-[#F26522]">🏢</span> Minhas Empresas</h3></div>
                <form onSubmit={handleAddCompany} className="flex gap-4 mb-6">
                  <input type="text" placeholder="Nome da Empresa..." className="flex-1 px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 rounded-lg text-xs font-bold focus:ring-2 focus:ring-[#F26522]" value={newCompanyName} onChange={e => setNewCompanyName(e.target.value)} required />
                  <button type="submit" className="bg-[#F26522] hover:bg-[#D94100] text-white px-6 py-3 rounded-xl font-black text-xs uppercase transition-all">{editingCompanyName ? 'Atualizar' : 'Adicionar'}</button>
                </form>
                <div className="flex flex-wrap gap-3">
                  {companies.map(company => (
                    <div key={company} className="bg-slate-50 dark:bg-slate-800 p-3 rounded-xl border border-slate-100 dark:border-slate-700 flex items-center gap-3">
                      <span className="text-[10px] font-black uppercase text-slate-800 dark:text-slate-200 flex-1">{company}</span>
                      <div className="flex items-center gap-2">
                        <button onClick={() => { setEditingCompanyName(company); setNewCompanyName(company); }} className="text-[#F26522] text-xs hover:bg-[#F26522]/10 p-1 rounded">
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        </button>
                        <button onClick={() => setConfirmDeleteCompany(company)} className="text-rose-500 text-xs hover:bg-rose-50 dark:hover:bg-rose-950 p-1 rounded">✕</button>
                      </div>
                      {confirmDeleteCompany === company && (
                        <div className="flex gap-1 ml-2">
                          <button onClick={() => handleRemoveCompany(company)} className="bg-rose-500 text-white text-[8px] px-2 py-1 rounded">Sim</button>
                          <button onClick={() => setConfirmDeleteCompany(null)} className="bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-[8px] px-2 py-1 rounded">Não</button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {showForm && (
              <div className="bg-white dark:bg-slate-900 p-5 sm:p-8 rounded-[1.5rem] border border-[#F26522]/30 dark:border-[#F26522]/30 shadow-xl animate-in slide-in-from-top-6 duration-500">
                <div className="mb-6"><h3 className="text-sm font-black text-slate-800 dark:text-slate-100 uppercase flex items-center gap-2"><span className="text-[#F26522]">⚡</span> {editingId ? 'Editar' : 'Novo'} Registro</h3></div>
                <form onSubmit={handleAddTransaction} className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <input type="text" placeholder="Descrição" className="px-4 py-2.5 bg-gray-50 dark:bg-slate-800 border dark:border-slate-700 text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 rounded-lg text-xs focus:ring-2 focus:ring-[#F26522]" value={newDesc} onChange={e => setNewDesc(e.target.value)} required />
                  <input type="number" step="0.01" inputMode="decimal" placeholder="Valor (R$)" className="px-4 py-2.5 bg-gray-50 dark:bg-slate-800 border dark:border-slate-700 text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 rounded-lg text-xs focus:ring-2 focus:ring-[#F26522]" value={newAmount} onChange={e => setNewAmount(e.target.value)} required />
                  <select className="px-4 py-2.5 bg-gray-50 dark:bg-slate-800 border dark:border-slate-700 text-slate-800 dark:text-slate-100 rounded-lg text-xs font-bold focus:ring-2 focus:ring-[#F26522]" value={newType} onChange={e => setNewType(e.target.value as TransactionType)}>
                    <option value="EXPENSE">🔻 Despesa</option>
                    <option value="INCOME">🔺 Receita</option>
                  </select>
                  <select className="px-4 py-2.5 bg-gray-50 dark:bg-slate-800 border dark:border-slate-700 text-slate-800 dark:text-slate-100 rounded-lg text-xs font-bold focus:ring-2 focus:ring-[#F26522]" value={newCat} onChange={e => setNewCat(e.target.value)} required>
                    <option value="">Categoria...</option>
                    {(activeTab === 'PERSONAL' ? personalCats : businessCats).map(c => <option key={c} value={c}>{c}</option>)}
                    <option value="Outros">Outros</option>
                  </select>

                  <div className="md:col-span-4 flex flex-wrap items-center gap-6 p-4 bg-slate-50 dark:bg-slate-800/80 rounded-xl border dark:border-slate-700">
                    <div className="flex items-center gap-2">
                      <input type="checkbox" id="fixed" checked={isFixedTransaction} onChange={e => setIsFixedTransaction(e.target.checked)} className="accent-[#F26522]" />
                      <label htmlFor="fixed" className="text-[10px] font-black uppercase text-slate-700 dark:text-slate-300">Fixo</label>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-black uppercase text-slate-400">Dia Venc.:</span>
                      <input 
                        type="text" 
                        inputMode="numeric"
                        pattern="[0-9]*"
                        className="w-20 h-8 px-2 text-center text-xs font-bold border dark:border-slate-600 rounded bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-[#F26522] outline-none" 
                        placeholder="1-31"
                        value={dueDay} 
                        onChange={e => {
                          const val = e.target.value.replace(/\D/g, '');
                          if (val === '' || (parseInt(val) >= 1 && parseInt(val) <= 31)) {
                            setDueDay(val);
                          }
                        }} 
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <input type="checkbox" id="inst" checked={isInstallment} onChange={e => setIsInstallment(e.target.checked)} className="accent-[#F26522]" />
                      <label htmlFor="inst" className="text-[10px] font-black uppercase text-slate-700 dark:text-slate-300">Parcelar</label>
                      {isInstallment && (
                        <div className="flex items-center gap-1">
                          <input 
                            type="number" 
                            min="1" 
                            inputMode="numeric" 
                            pattern="[0-9]*" 
                            className="w-10 h-8 text-center text-xs border dark:border-slate-600 rounded bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-[#F26522]" 
                            value={currentInstallment} 
                            onChange={e => setCurrentInstallment(e.target.value.replace(/\D/g, ''))} 
                          />
                          <span className="text-xs text-slate-400">/</span>
                          <input 
                            type="number" 
                            min="1" 
                            inputMode="numeric" 
                            pattern="[0-9]*" 
                            className="w-10 h-8 text-center text-xs border dark:border-slate-600 rounded bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-[#F26522]" 
                            value={totalInstallments} 
                            onChange={e => setTotalInstallments(e.target.value.replace(/\D/g, ''))} 
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  {newCat === 'Outros' && (
                    <div className="md:col-span-4 flex gap-2">
                      <input type="text" placeholder="Nova Categoria..." className="flex-1 px-4 h-10 bg-white dark:bg-slate-800 border dark:border-slate-700 text-slate-800 dark:text-slate-100 rounded-lg text-xs font-bold focus:ring-2 focus:ring-[#F26522]" value={customCat} onChange={e => setCustomCat(e.target.value)} required />
                      <button type="button" onClick={() => setIsFixedCategory(!isFixedCategory)} className={`px-4 text-[10px] font-black border rounded-lg ${isFixedCategory ? 'bg-[#F26522] text-white' : 'bg-white dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-700'}`}>Fixar Cat.</button>
                    </div>
                  )}

                  <button type="submit" className="md:col-span-4 bg-[#F26522] hover:bg-[#D94100] text-white py-3 rounded-xl font-black text-xs uppercase tracking-widest shadow-md shadow-orange-950/20 transition-all">{editingId ? 'Atualizar' : 'Lançar'}</button>
                </form>
              </div>
            )}

            <TransactionTable transactions={filteredTransactions} onDelete={handleDelete} onEdit={handleEdit} onTogglePaid={handleTogglePaid} />
          </div>
        );
    }
  };

  if (isAuthLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center p-4">
        <div className="w-12 h-12 border-4 border-[#F26522] border-t-transparent rounded-full animate-spin"></div>
        <p className="text-white text-xs font-bold uppercase tracking-widest mt-4">Carregando MBR Tracker...</p>
      </div>
    );
  }

  if (!authSession) {
    return <LoginForm onLoginSuccess={(session) => setAuthSession(session)} />;
  }

  if (isUserAdmin) {
    return (
      <div className="min-h-screen bg-[#FAFBFF] dark:bg-[#030712] text-slate-900 dark:text-slate-100 flex flex-col transition-colors">
        <header className="h-16 bg-white dark:bg-[#080D1A] border-b border-slate-100 dark:border-slate-800/80 px-4 sm:px-8 flex items-center justify-between sticky top-0 z-50 transition-colors">
          <div className="flex items-center gap-3">
            <MbrLogo variant="full" size="lg" isDarkBackground={isDarkMode} />
          </div>
          <div className="flex items-center gap-3">
            <div className="relative" ref={profileDropdownRef}>
              <button
                onClick={() => setIsProfileDropdownOpen(prev => !prev)}
                className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-500 text-xs font-black uppercase hover:bg-amber-500/20 transition-all cursor-pointer shadow-sm active:scale-95"
              >
                <Shield className="w-4 h-4 text-amber-500" />
                <span className="max-w-[140px] sm:max-w-[200px] truncate">{authSession.user.name}</span>
                <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isProfileDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {isProfileDropdownOpen && (
                <div className="absolute right-0 mt-2 w-52 bg-white dark:bg-[#0E1526] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl py-2 z-[100] animate-in fade-in slide-in-from-top-2 duration-150">
                  <div className="px-4 py-2 border-b border-slate-100 dark:border-slate-800/80 mb-1">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Administrador</p>
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">{authSession.user.email}</p>
                  </div>

                  <button
                    onClick={() => {
                      setIsProfileDropdownOpen(false);
                      handleOpenProfileModal();
                    }}
                    className="w-full text-left px-4 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/60 flex items-center gap-2.5 transition-colors cursor-pointer"
                  >
                    <User className="w-4 h-4 text-[#F26522]" />
                    <span>Perfil</span>
                  </button>

                  <button
                    onClick={() => {
                      setIsDarkMode(prev => !prev);
                    }}
                    className="w-full text-left px-4 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/60 flex items-center gap-2.5 transition-colors cursor-pointer"
                  >
                    {isDarkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-indigo-500" />}
                    <span>{isDarkMode ? 'Modo Claro' : 'Modo Escuro'}</span>
                  </button>

                  <div className="my-1 border-t border-slate-100 dark:border-slate-800/80"></div>

                  <button
                    onClick={() => {
                      setIsProfileDropdownOpen(false);
                      handleLogout();
                    }}
                    className="w-full text-left px-4 py-2.5 text-xs font-black text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 flex items-center gap-2.5 transition-colors cursor-pointer"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Sair</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 px-4 sm:px-8 py-6 sm:py-8">
          <div className="max-w-[1200px] mx-auto">
            <AdminPanel currentAdmin={authSession.user} />
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FDFDFE] dark:bg-[#030712] text-slate-900 dark:text-slate-100 flex flex-col sm:flex-row overflow-x-hidden transition-colors">
      <nav className="hidden sm:flex fixed top-0 left-0 bottom-0 w-[88px] bg-[#0A0E1A] dark:bg-[#030712] border-r border-slate-800/80 flex-col items-center py-6 gap-6 z-[60] shadow-2xl">
        <div 
          onClick={() => { setActiveTab('HOME'); resetForm(); }}
          className="relative group flex flex-col items-center gap-1 cursor-pointer transition-transform duration-300 hover:scale-105"
          title="MBR TRACKER"
        >
          <MbrLogo variant="icon" size="lg" isDarkBackground={true} />
        </div>

        <div className="w-8 h-[1px] bg-slate-800/80 my-1"></div>

        <div className="flex flex-col gap-4 w-full px-3">
          <NavItem 
            active={activeTab === 'HOME'} 
            onClick={() => { setActiveTab('HOME'); resetForm(); }} 
            label="Início" 
            icon={<LayoutDashboard className="w-5 h-5" />} 
            color="orange"
          />
          {enabledModules.business && (
            <NavItem 
              active={activeTab === 'BUSINESS'} 
              onClick={() => { setActiveTab('BUSINESS'); resetForm(); }} 
              label="Empresa" 
              color="orange" 
              icon={<Building2 className="w-5 h-5" />} 
            />
          )}
          {enabledModules.personal && (
            <NavItem 
              active={activeTab === 'PERSONAL'} 
              onClick={() => { setActiveTab('PERSONAL'); resetForm(); }} 
              label="Pessoal" 
              color="orange" 
              icon={<Wallet className="w-5 h-5" />} 
            />
          )}
        </div>

        <div className="mt-auto pt-4 flex flex-col items-center gap-3 w-full px-3 border-t border-slate-800/80">
          <button 
            onClick={() => setIsDarkMode(prev => !prev)} 
            className="group relative w-11 h-11 rounded-2xl bg-slate-900/80 border border-slate-800 flex items-center justify-center text-slate-400 hover:text-[#F26522] hover:bg-slate-800 hover:border-[#F26522]/40 transition-all duration-200" 
            title="Alternar Tema"
          >
            {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            <div className="absolute left-full ml-3 px-3 py-1.5 bg-slate-950 border border-slate-800 text-white text-[10px] font-black uppercase tracking-wider rounded-xl shadow-2xl pointer-events-none opacity-0 group-hover:opacity-100 translate-x-1 group-hover:translate-x-0 transition-all duration-200 z-[100] whitespace-nowrap">
              {isDarkMode ? 'Modo Claro' : 'Modo Escuro'}
            </div>
          </button>

          <button 
            onClick={() => setShowSettings(true)} 
            className="group relative w-11 h-11 rounded-2xl bg-slate-900/80 border border-slate-800 flex items-center justify-center text-slate-400 hover:text-[#F26522] hover:bg-slate-800 hover:border-[#F26522]/40 transition-all duration-200" 
            title="Configurações"
          >
            <Settings className="w-5 h-5" />
            <div className="absolute left-full ml-3 px-3 py-1.5 bg-slate-950 border border-slate-800 text-white text-[10px] font-black uppercase tracking-wider rounded-xl shadow-2xl pointer-events-none opacity-0 group-hover:opacity-100 translate-x-1 group-hover:translate-x-0 transition-all duration-200 z-[100] whitespace-nowrap">
              Configurações
            </div>
          </button>

          <button 
            onClick={() => setShowCleanup(true)} 
            className="group relative w-11 h-11 rounded-2xl bg-slate-900/80 border border-slate-800 flex items-center justify-center text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 hover:border-rose-900/50 transition-all duration-200" 
            title="Limpar Dados"
          >
            <Trash2 className="w-5 h-5" />
            <div className="absolute left-full ml-3 px-3 py-1.5 bg-slate-950 border border-slate-800 text-white text-[10px] font-black uppercase tracking-wider rounded-xl shadow-2xl pointer-events-none opacity-0 group-hover:opacity-100 translate-x-1 group-hover:translate-x-0 transition-all duration-200 z-[100] whitespace-nowrap">
              Limpar Dados
            </div>
          </button>
        </div>
      </nav>

      <div className="flex-1 flex flex-col sm:ml-[88px] pb-20 sm:pb-0">
        <header className="h-16 bg-white dark:bg-[#080D1A] border-b border-slate-100 dark:border-slate-800/80 px-4 sm:px-8 flex items-center justify-between sticky top-0 z-50 transition-colors">
          <div className="flex items-center gap-3">
            <MbrLogo variant="full" size="lg" isDarkBackground={isDarkMode} />
          </div>
          <div className="flex items-center gap-3">
            <div className="relative" ref={profileDropdownRef}>
              <button
                onClick={() => setIsProfileDropdownOpen(prev => !prev)}
                className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs font-black uppercase hover:bg-emerald-500/20 transition-all cursor-pointer shadow-sm active:scale-95"
              >
                <UserCheck className="w-4 h-4 text-emerald-500" />
                <span className="max-w-[140px] sm:max-w-[200px] truncate">{authSession.user.name}</span>
                <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isProfileDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {isProfileDropdownOpen && (
                <div className="absolute right-0 mt-2 w-52 bg-white dark:bg-[#0E1526] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl py-2 z-[100] animate-in fade-in slide-in-from-top-2 duration-150">
                  <div className="px-4 py-2 border-b border-slate-100 dark:border-slate-800/80 mb-1">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Usuário Conectado</p>
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">{authSession.user.email}</p>
                  </div>

                  <button
                    onClick={() => {
                      setIsProfileDropdownOpen(false);
                      handleOpenProfileModal();
                    }}
                    className="w-full text-left px-4 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/60 flex items-center gap-2.5 transition-colors cursor-pointer"
                  >
                    <User className="w-4 h-4 text-[#F26522]" />
                    <span>Perfil</span>
                  </button>

                  <button
                    onClick={() => {
                      setIsDarkMode(prev => !prev);
                    }}
                    className="w-full text-left px-4 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/60 flex items-center gap-2.5 transition-colors cursor-pointer"
                  >
                    {isDarkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-indigo-500" />}
                    <span>{isDarkMode ? 'Modo Claro' : 'Modo Escuro'}</span>
                  </button>

                  <div className="my-1 border-t border-slate-100 dark:border-slate-800/80"></div>

                  <button
                    onClick={() => {
                      setIsProfileDropdownOpen(false);
                      handleLogout();
                    }}
                    className="w-full text-left px-4 py-2.5 text-xs font-black text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 flex items-center gap-2.5 transition-colors cursor-pointer"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Sair</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>
        <main className="flex-1 px-3 sm:px-8 pt-3 pb-6 sm:py-8 bg-[#FAFBFF] dark:bg-[#0B0F19] transition-colors">
          <div className="max-w-[1200px] mx-auto">
            <div className="mb-2.5 sm:mb-8">
              <h2 className="text-xl sm:text-3xl font-black text-slate-900 dark:text-slate-100 tracking-tighter">{activeTab === 'HOME' ? 'Central inteligente' : activeTab === 'PERSONAL' ? 'Fluxo Pessoal' : 'Corp Finance'}</h2>
            </div>
            {renderContent()}
          </div>
        </main>

        {/* Mobile Bottom Navigation */}
        <nav className="sm:hidden fixed bottom-0 left-0 right-0 bg-[#0B0F19]/90 dark:bg-[#030712]/90 backdrop-blur-md flex items-center justify-around py-3 px-4 z-[60] border-t border-slate-800/80 shadow-[0_-10px_20px_rgba(0,0,0,0.4)]">
          <MobileNavItem 
            active={activeTab === 'HOME' && !showSettings} 
            onClick={() => { setActiveTab('HOME'); setShowSettings(false); resetForm(); }} 
            label="Início" 
            color="orange"
            icon={<LayoutDashboard className="w-5 h-5" />} 
          />
          {enabledModules.business && (
            <MobileNavItem 
              active={activeTab === 'BUSINESS' && !showSettings} 
              onClick={() => { setActiveTab('BUSINESS'); setShowSettings(false); resetForm(); }} 
              label="Empresa" 
              color="orange"
              icon={<Building2 className="w-5 h-5" />} 
            />
          )}
          {enabledModules.personal && (
            <MobileNavItem 
              active={activeTab === 'PERSONAL' && !showSettings} 
              onClick={() => { setActiveTab('PERSONAL'); setShowSettings(false); resetForm(); }} 
              label="Pessoal" 
              color="orange"
              icon={<Wallet className="w-5 h-5" />} 
            />
          )}
          <MobileNavItem 
            active={showSettings} 
            onClick={() => setShowSettings(true)} 
            label="Config" 
            color="orange"
            icon={<Settings className="w-5 h-5" />} 
          />
        </nav>

        {/* Cleanup Modal */}
        {showCleanup && (
          <div className="fixed inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-sm z-[110] flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 w-full max-w-md max-h-[85vh] flex flex-col rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
              <div className="bg-rose-600 px-5 py-4 text-white flex justify-between items-center shrink-0">
                <div>
                  <h3 className="text-base sm:text-lg font-black tracking-tight uppercase">Limpeza de Dados</h3>
                  <p className="text-[10px] font-bold text-rose-100 uppercase tracking-widest mt-0.5">Selecione o que deseja apagar</p>
                </div>
                <button onClick={() => { setShowCleanup(false); setCleanupTarget(null); setShowCleanupConfirm(false); }} className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors shrink-0">
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                </button>
              </div>
              <div className="p-4 sm:p-5 space-y-3 overflow-y-auto flex-1">
                {!showCleanupConfirm ? (
                  <>
                    <button onClick={() => setCleanupTarget('PERSONAL')} className={`w-full p-3.5 rounded-xl border-2 text-left transition-all ${cleanupTarget === 'PERSONAL' ? 'border-rose-500 bg-rose-50 dark:bg-rose-950/40' : 'border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40'}`}>
                      <p className="text-xs font-black uppercase text-slate-800 dark:text-slate-100">Dados Pessoais</p>
                      <p className="text-[9px] text-slate-400 dark:text-slate-400 uppercase font-bold">Transações e categorias da aba Pessoal</p>
                    </button>
                    <button onClick={() => setCleanupTarget('BUSINESS')} className={`w-full p-3.5 rounded-xl border-2 text-left transition-all ${cleanupTarget === 'BUSINESS' ? 'border-rose-500 bg-rose-50 dark:bg-rose-950/40' : 'border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40'}`}>
                      <p className="text-xs font-black uppercase text-slate-800 dark:text-slate-100">Dados Empresariais</p>
                      <p className="text-[9px] text-slate-400 dark:text-slate-400 uppercase font-bold">Transações, categorias e empresas</p>
                    </button>
                    <button onClick={() => setCleanupTarget('BOTH')} className={`w-full p-3.5 rounded-xl border-2 text-left transition-all ${cleanupTarget === 'BOTH' ? 'border-rose-500 bg-rose-50 dark:bg-rose-950/40' : 'border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40'}`}>
                      <p className="text-xs font-black uppercase text-slate-800 dark:text-slate-100">Limpar Tudo</p>
                      <p className="text-[9px] text-slate-400 dark:text-slate-400 uppercase font-bold">Resetar completamente o sistema</p>
                    </button>
                    
                    <button 
                      disabled={!cleanupTarget}
                      onClick={() => setShowCleanupConfirm(true)}
                      className="w-full bg-rose-600 text-white py-3.5 rounded-xl font-black text-xs uppercase tracking-widest mt-3 disabled:opacity-50"
                    >
                      Continuar
                    </button>
                  </>
                ) : (
                  <div className="text-center space-y-4 py-2">
                    <div className="w-14 h-14 bg-rose-100 dark:bg-rose-950/80 text-rose-600 dark:text-rose-400 rounded-full flex items-center justify-center mx-auto">
                      <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                    </div>
                    <div>
                      <h4 className="text-base font-black text-slate-900 dark:text-slate-100 uppercase">Tem certeza?</h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1">Esta ação não poderá ser desfeita. Todos os dados selecionados serão removidos permanentemente.</p>
                    </div>
                    <div className="flex gap-3 pt-2">
                      <button onClick={() => setShowCleanupConfirm(false)} className="flex-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 py-3 rounded-xl font-black text-xs uppercase tracking-widest">Cancelar</button>
                      <button onClick={handleCleanup} className="flex-1 bg-rose-600 text-white py-3 rounded-xl font-black text-xs uppercase tracking-widest shadow-lg shadow-rose-100 dark:shadow-none">Sim, Limpar</button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Settings Modal */}
        {showSettings && (
          <div className="fixed inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-2.5 sm:p-4 animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 w-full max-w-md max-h-[92vh] flex flex-col rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
              <div className="bg-[#020617] dark:bg-slate-950 px-4 py-3 sm:px-5 sm:py-4 text-white flex justify-between items-center shrink-0 border-b border-slate-800/40">
                <div>
                  <h3 className="text-sm sm:text-lg font-black tracking-tight uppercase flex items-center gap-2">
                    <span className="text-[#F26522]">⚙️</span> Configurações
                  </h3>
                  <p className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Personalize sua experiência</p>
                </div>
                <button 
                  onClick={() => setShowSettings(false)} 
                  className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors shrink-0 text-white cursor-pointer"
                  title="Fechar"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                </button>
              </div>
              
              <div className="p-3 sm:p-5 space-y-2.5 sm:space-y-4 overflow-y-auto flex-1">
                {/* Modules Section */}
                <div className="space-y-2 sm:space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest">Módulos Ativos</p>
                    <span className="text-[9px] sm:text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Mínimo 1 ativo</span>
                  </div>

                  {moduleErrorMsg && (
                    <div className="p-2 bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 rounded-xl text-[11px] font-bold text-amber-800 dark:text-amber-200 flex items-center gap-2 animate-in fade-in slide-in-from-top-1 duration-200">
                      <span className="text-xs">⚠️</span>
                      <span>{moduleErrorMsg}</span>
                    </div>
                  )}
                  
                  <button 
                    type="button"
                    onClick={handleTogglePersonalModule}
                    className={`w-full flex items-center justify-between p-2.5 sm:p-3.5 rounded-xl border-2 transition-all cursor-pointer ${enabledModules.personal ? 'border-blue-500/50 dark:border-blue-700/60 bg-blue-50/50 dark:bg-blue-950/40' : 'border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 opacity-60'}`}
                  >
                    <div className="flex items-center gap-2.5 sm:gap-3">
                      <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl flex items-center justify-center shrink-0 ${enabledModules.personal ? 'bg-blue-600 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-400'}`}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" className="sm:w-5 sm:h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                      </div>
                      <div className="text-left">
                        <p className={`text-xs sm:text-sm font-black uppercase ${enabledModules.personal ? 'text-blue-900 dark:text-blue-200' : 'text-slate-500'}`}>Gestão Pessoal</p>
                        <p className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase">
                          Finanças individuais {enabledModules.personal && !enabledModules.business ? '(Ativo)' : ''}
                        </p>
                      </div>
                    </div>
                    <div className={`w-4 h-4 sm:w-5 sm:h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${enabledModules.personal ? 'border-blue-600 bg-blue-600' : 'border-slate-300 dark:border-slate-600'}`}>
                      {enabledModules.personal && <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" className="sm:w-3 sm:h-3" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
                    </div>
                  </button>

                  <button 
                    type="button"
                    onClick={handleToggleBusinessModule}
                    className={`w-full flex items-center justify-between p-2.5 sm:p-3.5 rounded-xl border-2 transition-all cursor-pointer ${enabledModules.business ? 'border-emerald-500/50 dark:border-emerald-700/60 bg-emerald-50/50 dark:bg-emerald-950/40' : 'border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 opacity-60'}`}
                  >
                    <div className="flex items-center gap-2.5 sm:gap-3">
                      <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl flex items-center justify-center shrink-0 ${enabledModules.business ? 'bg-emerald-600 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-400'}`}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" className="sm:w-5 sm:h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="14" x="2" y="7" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
                      </div>
                      <div className="text-left">
                        <p className={`text-xs sm:text-sm font-black uppercase ${enabledModules.business ? 'text-emerald-900 dark:text-emerald-200' : 'text-slate-500'}`}>Gestão Empresarial</p>
                        <p className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase">
                          Finanças do negócio {enabledModules.business && !enabledModules.personal ? '(Ativo)' : ''}
                        </p>
                      </div>
                    </div>
                    <div className={`w-4 h-4 sm:w-5 sm:h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${enabledModules.business ? 'border-emerald-600 bg-emerald-600' : 'border-slate-300 dark:border-slate-600'}`}>
                      {enabledModules.business && <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" className="sm:w-3 sm:h-3" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
                    </div>
                  </button>
                </div>

                {/* Visual Theme Section */}
                <div className="space-y-2 sm:space-y-3">
                  <p className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest">Aparência do App</p>
                  
                  <div 
                    onClick={() => setIsDarkMode(prev => !prev)}
                    className={`w-full flex items-center justify-between p-2.5 sm:p-3.5 rounded-xl border-2 transition-all cursor-pointer ${isDarkMode ? 'border-[#F26522]/50 bg-[#F26522]/10 dark:bg-[#F26522]/15' : 'border-slate-200 bg-slate-50'}`}
                  >
                    <div className="flex items-center gap-2.5 sm:gap-3">
                      <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl flex items-center justify-center shrink-0 ${isDarkMode ? 'bg-[#F26522] text-white' : 'bg-slate-800 text-amber-400'}`}>
                        {isDarkMode ? (
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" className="sm:w-5 sm:h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>
                        ) : (
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" className="sm:w-5 sm:h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>
                        )}
                      </div>
                      <div className="text-left">
                        <p className="text-xs sm:text-sm font-black uppercase text-slate-900 dark:text-slate-100">Modo Escuro (Dark)</p>
                        <p className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase">{isDarkMode ? 'Ativado (Fundo Escuro)' : 'Desativado (Fundo Claro)'}</p>
                      </div>
                    </div>

                    <div className={`w-10 h-5 sm:w-11 sm:h-6 rounded-full p-0.5 transition-colors flex items-center shrink-0 ${isDarkMode ? 'bg-[#F26522] justify-end' : 'bg-slate-300 justify-start'}`}>
                      <div className="w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-white shadow-md transform transition-transform"></div>
                    </div>
                  </div>
                </div>

                {/* Data Management Section */}
                <div className="space-y-2 sm:space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <p className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest">Gestão de Dados</p>
                  
                  <button 
                    type="button"
                    onClick={() => {
                      setShowSettings(false);
                      setShowCleanup(true);
                    }}
                    className="w-full flex items-center justify-between p-2.5 sm:p-3.5 rounded-xl border-2 border-rose-100 dark:border-rose-950/60 bg-rose-50/50 dark:bg-rose-950/30 hover:bg-rose-100/60 dark:hover:bg-rose-950/50 transition-all cursor-pointer text-left"
                  >
                    <div className="flex items-center gap-2.5 sm:gap-3">
                      <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl flex items-center justify-center bg-rose-600 text-white shrink-0 shadow-sm">
                        <Trash2 className="w-4 h-4 sm:w-5 sm:h-5" />
                      </div>
                      <div>
                        <p className="text-xs sm:text-sm font-black uppercase text-rose-900 dark:text-rose-200">Limpeza de Dados</p>
                        <p className="text-[9px] sm:text-[10px] font-bold text-rose-600/80 dark:text-rose-400 uppercase">
                          Resetar registros pessoais ou empresariais
                        </p>
                      </div>
                    </div>
                    <div className="text-rose-600 dark:text-rose-400 font-bold text-xs sm:text-sm">
                      &rarr;
                    </div>
                  </button>
                </div>
              </div>

              {/* Footer */}
              <div className="p-3 sm:p-4 bg-slate-50 dark:bg-slate-950/80 border-t border-slate-100 dark:border-slate-800 shrink-0">
                <button 
                  onClick={() => setShowSettings(false)}
                  className="w-full bg-[#F26522] hover:bg-[#D94100] text-white py-2.5 sm:py-3 rounded-xl font-black text-xs uppercase tracking-widest shadow-md active:scale-[0.98] transition-all cursor-pointer"
                >
                  Salvar e Fechar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal de Editar Perfil */}
        {showProfileModal && authSession && (
          <div className="fixed inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-sm z-[120] flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
              <div className="bg-[#F26522] px-6 py-5 text-white flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center text-white">
                    <User className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base sm:text-lg font-black tracking-tight uppercase">Meu Perfil</h3>
                    <p className="text-[10px] font-bold text-orange-100 uppercase tracking-widest mt-0.5">Configurações da sua conta</p>
                  </div>
                </div>
                <button 
                  onClick={() => { setShowProfileModal(false); setProfileMsg(null); }} 
                  className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors shrink-0 cursor-pointer text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSaveProfile} className="p-6 space-y-4">
                {profileMsg && (
                  <div className={`p-3.5 rounded-xl text-xs font-bold flex items-center gap-2 ${profileMsg.type === 'success' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'}`}>
                    {profileMsg.type === 'success' ? <Check className="w-4 h-4 shrink-0 text-emerald-500" /> : <X className="w-4 h-4 shrink-0 text-rose-500" />}
                    <span>{profileMsg.text}</span>
                  </div>
                )}

                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">E-mail (Identificador)</label>
                  <input 
                    type="email" 
                    disabled 
                    value={authSession.user.email} 
                    className="w-full px-4 h-11 bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 rounded-xl text-xs font-bold cursor-not-allowed"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">Nome Completo</label>
                  <input 
                    type="text" 
                    required
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    placeholder="Seu nome completo"
                    className="w-full px-4 h-11 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-xl text-xs font-bold focus:ring-2 focus:ring-[#F26522] focus:outline-none transition-all"
                  />
                </div>

                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-3">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Alterar Senha (Opcional)</p>
                  
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1">Nova Senha</label>
                    <input 
                      type="password" 
                      value={editPassword}
                      onChange={e => setEditPassword(e.target.value)}
                      placeholder="Digite a nova senha (opcional)"
                      className="w-full px-4 h-11 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-xl text-xs font-bold focus:ring-2 focus:ring-[#F26522] focus:outline-none transition-all"
                    />
                  </div>

                  {editPassword && (
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1">Confirmar Nova Senha</label>
                      <input 
                        type="password" 
                        value={editPasswordConfirm}
                        onChange={e => setEditPasswordConfirm(e.target.value)}
                        placeholder="Repita a nova senha"
                        className="w-full px-4 h-11 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-xl text-xs font-bold focus:ring-2 focus:ring-[#F26522] focus:outline-none transition-all"
                      />
                    </div>
                  )}
                </div>

                <div className="pt-3 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => { setShowProfileModal(false); setProfileMsg(null); }}
                    className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold text-xs hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2.5 rounded-xl bg-[#F26522] hover:bg-[#D94100] text-white font-black text-xs uppercase tracking-wider shadow-md active:scale-95 transition-all cursor-pointer"
                  >
                    Salvar Alterações
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const MobileNavItem: React.FC<{ active: boolean, onClick: () => void, label: string, icon: React.ReactNode, color?: 'orange' | 'indigo' | 'emerald' | 'blue' }> = ({ active, onClick, label, icon, color = 'orange' }) => {
  const activeColors = { 
    orange: 'text-[#F26522] bg-[#F26522]/15 border-[#F26522]/40 shadow-md shadow-orange-950/40',
    indigo: 'text-indigo-400 bg-indigo-500/15 border-indigo-500/30 shadow-md shadow-indigo-950/40', 
    emerald: 'text-emerald-400 bg-emerald-500/15 border-emerald-500/30 shadow-md shadow-emerald-950/40', 
    blue: 'text-blue-400 bg-blue-500/15 border-blue-500/30 shadow-md shadow-blue-950/40' 
  };
  return (
    <button onClick={onClick} className={`flex flex-col items-center gap-1 py-1.5 px-3 rounded-2xl border transition-all active:scale-95 ${active ? activeColors[color] : 'text-slate-400 border-transparent hover:text-slate-200'}`}>
      <div className={`${active ? 'scale-110' : 'scale-100'} transition-transform`}>
        {icon}
      </div>
      <span className="text-[8px] font-black uppercase tracking-wider">{label}</span>
    </button>
  );
};

const NavItem: React.FC<{ active: boolean, onClick: () => void, label: string, icon: React.ReactNode, color?: 'orange' | 'indigo' | 'emerald' | 'blue' }> = ({ active, onClick, label, icon, color = 'orange' }) => {
  const colorMap = { 
    orange: {
      bar: 'bg-[#F26522] shadow-[0_0_12px_rgba(242,101,34,0.8)]',
      box: 'bg-[#F26522]/20 text-[#F26522] border-[#F26522]/50 shadow-lg shadow-orange-950/60 ring-1 ring-[#F26522]/30',
      text: 'text-[#F26522] font-black'
    },
    indigo: {
      bar: 'bg-indigo-500 shadow-[0_0_12px_rgba(99,102,241,0.8)]',
      box: 'bg-indigo-600/20 text-indigo-400 border-indigo-500/40 shadow-lg shadow-indigo-950/60 ring-1 ring-indigo-500/30',
      text: 'text-indigo-400 font-black'
    },
    emerald: {
      bar: 'bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.8)]',
      box: 'bg-emerald-600/20 text-emerald-400 border-emerald-500/40 shadow-lg shadow-emerald-950/60 ring-1 ring-emerald-500/30',
      text: 'text-emerald-400 font-black'
    },
    blue: {
      bar: 'bg-blue-500 shadow-[0_0_12px_rgba(59,130,246,0.8)]',
      box: 'bg-blue-600/20 text-blue-400 border-blue-500/40 shadow-lg shadow-blue-950/60 ring-1 ring-blue-500/30',
      text: 'text-blue-400 font-black'
    }
  };

  const theme = colorMap[color] || colorMap.orange;

  return (
    <button onClick={onClick} className="group relative w-full flex flex-col items-center justify-center gap-1 py-1 transition-all outline-none">
      {active && (
        <span className={`absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 rounded-r-full ${theme.bar}`} />
      )}
      <div className={`w-12 h-12 flex items-center justify-center rounded-2xl transition-all duration-300 border ${active ? theme.box : 'bg-slate-900/60 text-slate-400 border-slate-800/80 hover:bg-slate-800/80 hover:text-slate-200 hover:border-slate-700/80 group-hover:scale-105'}`}>
        <div className={`transition-transform duration-300 ${active ? 'scale-110' : 'group-hover:scale-110'}`}>
          {icon}
        </div>
      </div>
      <span className={`text-[9px] uppercase tracking-wider transition-colors ${active ? theme.text : 'text-slate-500 font-bold group-hover:text-slate-300'}`}>
        {label}
      </span>
      <div className="absolute left-full ml-3 px-3 py-1.5 bg-slate-950 border border-slate-800 text-white text-[10px] font-black uppercase tracking-wider rounded-xl shadow-2xl pointer-events-none opacity-0 group-hover:opacity-100 translate-x-1 group-hover:translate-x-0 transition-all duration-200 z-[100] whitespace-nowrap">
        {label}
      </div>
    </button>
  );
};

export default App;
