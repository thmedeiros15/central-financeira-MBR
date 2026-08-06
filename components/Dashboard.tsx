
import React, { useState, useEffect, useMemo } from 'react';
import { Transaction, DateFilter, ScorePeriod, ManagementModule } from '../types';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, 
  LineChart, Line, ReferenceLine 
} from 'recharts';
import { FinancialSummary } from './FinancialSummary';

interface Props {
  transactions: Transaction[];
  filter?: DateFilter;
  activeModule?: ManagementModule;
  hideSummary?: boolean;
  score?: number;
  scorePeriod?: ScorePeriod;
  onScorePeriodChange?: (period: ScorePeriod) => void;
  isScoreLoading?: boolean;
  onTogglePaid?: (id: string) => void;
  enabledModules?: { business: boolean; personal: boolean };
}

const COLORS = ['#4F46E5', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#6366F1', '#14B8A6'];

// Helper to parse date without timezone shifts
const getLocalDateParts = (isoString: string) => {
  const date = new Date(isoString);
  return {
    day: date.getUTCDate(),
    month: date.getUTCMonth(),
    year: date.getUTCFullYear()
  };
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white dark:bg-slate-800 p-3 border border-slate-100 dark:border-slate-700 rounded-xl shadow-lg text-[10px] space-y-1 z-50">
        {label && <p className="font-black text-slate-800 dark:text-slate-200 mb-1">{label}</p>}
        {payload.map((p: any, index: number) => {
          const isPercentage = p.unit === '%' || p.dataKey === 'Margem' || (p.name && p.name.includes('%'));
          const formattedValue = isPercentage
            ? `${Number(p.value).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`
            : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(p.value);
          return (
            <p key={index} className="font-bold flex items-center justify-between gap-4" style={{ color: p.fill || p.color || '#4F46E5' }}>
              <span className="text-slate-600 dark:text-slate-300">{p.name || p.dataKey}:</span>
              <span className="tabular-nums">{formattedValue}</span>
            </p>
          );
        })}
      </div>
    );
  }
  return null;
};

export const Dashboard: React.FC<Props> = ({ 
  transactions, 
  filter, 
  activeModule,
  hideSummary, 
  score, 
  scorePeriod = 'MONTH', 
  onScorePeriodChange,
  isScoreLoading = false,
  onTogglePaid,
  enabledModules
}) => {
  const showBusinessSection = enabledModules ? enabledModules.business : true;
  const showPersonalSection = enabledModules ? enabledModules.personal : true;
  const showConsolidatedSection = showBusinessSection || showPersonalSection;
  const currentYear = useMemo(() => new Date().getFullYear(), []);
  const [activeBoletoModal, setActiveBoletoModal] = useState<'DUE_SOON' | 'OVERDUE' | null>(null);

  const boletosStats = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);

    const targetMonth = filter?.month !== undefined ? filter.month : now.getMonth();
    const targetYear = filter?.year !== undefined ? filter.year : now.getFullYear();

    const dueSoon: Transaction[] = [];
    let dueSoonSum = 0;

    const overdue: Transaction[] = [];
    let overdueSum = 0;

    let dueTodaySum = 0;
    let dueTodayCount = 0;

    transactions.forEach(t => {
      // Apenas despesas que possuem data marcada de vencimento (dueDay), que são fixas (isFixed) ou parceladas (installments)
      // devem ser tratadas como boletos/cobranças pendentes. Despesas do dia a dia (sem data/fixo/parcela) são consideradas pagas na hora.
      const isScheduledOrFixedBill = Boolean(t.isFixed || t.installments || t.dueDay !== undefined);

      if (t.type === 'EXPENSE' && !t.paid && isScheduledOrFixedBill) {
        const parts = getLocalDateParts(t.date);
        const day = t.dueDay || parts.day;
        const dueDate = new Date(parts.year, parts.month, day, 0, 0, 0, 0);

        if (dueDate.getTime() === today.getTime()) {
          dueTodayCount++;
          dueTodaySum += t.amount;
        }

        if (dueDate < today) {
          // Boletos vencidos: vencimento anterior a hoje (do mês ou de meses que já passaram)
          overdue.push(t);
          overdueSum += t.amount;
        } else if (parts.month === targetMonth && parts.year === targetYear) {
          // Boletos a vencer: apenas do mês atual/selecionado
          dueSoon.push(t);
          dueSoonSum += t.amount;
        }
      }
    });

    const sortByDueDate = (a: Transaction, b: Transaction) => {
      const partsA = getLocalDateParts(a.date);
      const partsB = getLocalDateParts(b.date);
      const dayA = a.dueDay || partsA.day;
      const dayB = b.dueDay || partsB.day;
      const timeA = new Date(partsA.year, partsA.month, dayA).getTime();
      const timeB = new Date(partsB.year, partsB.month, dayB).getTime();
      return timeA - timeB;
    };

    dueSoon.sort(sortByDueDate);
    overdue.sort(sortByDueDate);

    return {
      dueSoonList: dueSoon,
      dueSoonTotal: dueSoonSum,
      dueSoonCount: dueSoon.length,
      dueTodayCount,
      dueTodayTotal: dueTodaySum,
      overdueList: overdue,
      overdueTotal: overdueSum,
      overdueCount: overdue.length
    };
  }, [transactions, filter]);

  const [selectedBusinessYear, setSelectedBusinessYear] = useState<number>(() => {
    return filter?.year || currentYear;
  });

  const [isComparingBusiness, setIsComparingBusiness] = useState<boolean>(false);
  const [businessCompareYears, setBusinessCompareYears] = useState<number[]>(() => {
    const c = filter?.year || currentYear;
    return [c, c - 1];
  });
  const [businessMetricView, setBusinessMetricView] = useState<'BOTH' | 'INCOME' | 'EXPENSE'>('BOTH');

  const [selectedPersonalYear, setSelectedPersonalYear] = useState<number>(() => {
    return filter?.year || currentYear;
  });

  const [isComparingPersonal, setIsComparingPersonal] = useState<boolean>(false);
  const [personalCompareYears, setPersonalCompareYears] = useState<number[]>(() => {
    const c = filter?.year || currentYear;
    return [c, c - 1];
  });
  const [personalMetricView, setPersonalMetricView] = useState<'BOTH' | 'INCOME' | 'EXPENSE'>('BOTH');

  const [selectedMarginYear, setSelectedMarginYear] = useState<number>(() => {
    return filter?.year || currentYear;
  });

  const [isComparingMargin, setIsComparingMargin] = useState<boolean>(false);
  const [marginCompareYears, setMarginCompareYears] = useState<number[]>(() => {
    const c = filter?.year || currentYear;
    return [c, c - 1];
  });

  const [selectedConsolidatedYear, setSelectedConsolidatedYear] = useState<number>(() => {
    return filter?.year || currentYear;
  });
  const [consolidatedFilter, setConsolidatedFilter] = useState<'ALL' | 'INCOME' | 'EXPENSE' | 'PROLABORE'>('ALL');
  const [consolidatedChartType, setConsolidatedChartType] = useState<'BAR' | 'LINE'>('BAR');

  useEffect(() => {
    if (!showBusinessSection && consolidatedFilter === 'PROLABORE') {
      setConsolidatedFilter('ALL');
    }
  }, [showBusinessSection, consolidatedFilter]);

  useEffect(() => {
    if (filter?.year) {
      setSelectedBusinessYear(filter.year);
      setSelectedPersonalYear(filter.year);
      setSelectedMarginYear(filter.year);
      setSelectedConsolidatedYear(filter.year);
    }
  }, [filter?.year]);

  const availableYears = useMemo(() => {
    const yearsSet = new Set<number>([currentYear]);
    transactions.forEach(t => {
      const y = getLocalDateParts(t.date).year;
      if (y && y <= currentYear) yearsSet.add(y);
    });
    for (let y = currentYear - 5; y <= currentYear; y++) {
      yearsSet.add(y);
    }
    return Array.from(yearsSet).sort((a, b) => b - a);
  }, [transactions, currentYear]);

  const YEAR_COLORS: Record<number, string> = useMemo(() => ({
    2026: '#6366F1', // Indigo
    2025: '#10B981', // Emerald
    2024: '#F59E0B', // Amber
    2023: '#EC4899', // Pink
    2022: '#8B5CF6', // Purple
    2021: '#06B6D4', // Cyan
    2020: '#F97316', // Orange
  }), []);

  const getYearColor = (year: number, index: number) => {
    if (YEAR_COLORS[year]) return YEAR_COLORS[year];
    const fallbackColors = ['#6366F1', '#10B981', '#F59E0B', '#EC4899', '#8B5CF6', '#06B6D4', '#F97316'];
    return fallbackColors[index % fallbackColors.length];
  };

  const stats = useMemo(() => {
    // Filtrar dados baseado no período selecionado
    const filtered = filter ? transactions.filter(t => {
      const parts = getLocalDateParts(t.date);
      if (filter.viewType === 'YEAR') return parts.year === filter.year;
      if (filter.viewType === 'DAY') {
        return parts.day === filter.day && parts.month === filter.month && parts.year === filter.year;
      }
      return parts.month === filter.month && parts.year === filter.year;
    }) : transactions;

    // Regra: Na HOME, ignorar o Pro-labore (receita pessoal) para não contar o mesmo dinheiro duas vezes
    const isProLabore = (t: Transaction) => t.module === 'PERSONAL' && (t.description.startsWith('Pró-labore') || t.description.toLowerCase().includes('pro-labore') || t.description.toLowerCase().includes('prolabore') || t.description.toLowerCase().includes('pró-labore'));

    const currentFilterMonth = filter?.month ?? new Date().getMonth();
    const currentFilterYear = filter?.year ?? currentYear;

    const proLaboreMonth = transactions.reduce((acc, t) => {
      if (isProLabore(t)) {
        const parts = getLocalDateParts(t.date);
        if (parts.month === currentFilterMonth && parts.year === currentFilterYear) {
          return acc + t.amount;
        }
      }
      return acc;
    }, 0);

    const proLaboreYear = transactions.reduce((acc, t) => {
      if (isProLabore(t)) {
        const parts = getLocalDateParts(t.date);
        if (parts.year === currentFilterYear) {
          return acc + t.amount;
        }
      }
      return acc;
    }, 0);

    const personalIncome = filtered
      .filter(t => t.type === 'INCOME' && t.module === 'PERSONAL')
      .reduce((acc, t) => acc + t.amount, 0);

    const personalIncomeNoProLabore = filtered
      .filter(t => t.type === 'INCOME' && t.module === 'PERSONAL' && !isProLabore(t))
      .reduce((acc, t) => acc + t.amount, 0);

    const businessIncome = filtered
      .filter(t => t.type === 'INCOME' && t.module === 'BUSINESS')
      .reduce((acc, t) => acc + t.amount, 0);

    const income = activeModule === 'HOME' 
      ? (businessIncome + personalIncomeNoProLabore) 
      : (activeModule === 'PERSONAL' ? personalIncome : businessIncome);

    const personalExpenses = filtered
      .filter(t => t.type === 'EXPENSE' && t.module === 'PERSONAL')
      .reduce((acc, t) => acc + t.amount, 0);

    const businessExpenses = filtered
      .filter(t => t.type === 'EXPENSE' && t.module === 'BUSINESS')
      .reduce((acc, t) => acc + t.amount, 0);

    const expenses = personalExpenses + businessExpenses;
    
    const catMap: Record<string, number> = {};
    filtered.filter(t => t.type === 'EXPENSE').forEach(t => { catMap[t.category] = (catMap[t.category] || 0) + t.amount; });
    const pieData = Object.entries(catMap).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);

    const monthLabels = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    
    // Anos ativos para comparação de Evolução Financeira da Empresa
    const activeBusinessCompareYears = isComparingBusiness
      ? (businessCompareYears.length > 0 ? businessCompareYears : [selectedBusinessYear]).slice().sort((a, b) => b - a)
      : [selectedBusinessYear];

    // Evolução Mensal da Empresa (suporta comparação multi-ano)
    const companyMonthlyEvolution = monthLabels.map((monthName, monthIndex) => {
      const row: Record<string, any> = { month: monthName };

      if (isComparingBusiness) {
        activeBusinessCompareYears.forEach(year => {
          let receita = 0;
          let despesa = 0;
          transactions.forEach(t => {
            if (t.module !== 'BUSINESS') return;
            const parts = getLocalDateParts(t.date);
            if (parts.year === year && parts.month === monthIndex) {
              if (t.type === 'INCOME') receita += t.amount;
              else if (t.type === 'EXPENSE') despesa += t.amount;
            }
          });
          const lucroLiquido = receita - despesa;
          row[`Receitas ${year}`] = receita;
          row[`Despesas ${year}`] = despesa;
          row[`Lucro ${year}`] = lucroLiquido;
        });
      } else {
        let receita = 0;
        let despesa = 0;

        transactions.forEach(t => {
          if (t.module !== 'BUSINESS') return;
          const parts = getLocalDateParts(t.date);
          if (parts.year === selectedBusinessYear && parts.month === monthIndex) {
            if (t.type === 'INCOME') receita += t.amount;
            else if (t.type === 'EXPENSE') despesa += t.amount;
          }
        });

        const lucroLiquido = receita - despesa;
        const margem = receita > 0 ? (lucroLiquido / receita) * 100 : 0;

        row['Receitas'] = receita;
        row['Despesas'] = despesa;
        row['LucroLiquido'] = lucroLiquido;
        row['Margem'] = Number(margem.toFixed(1));
      }

      return row;
    });

    // Totais Anuais da Empresa (Faturamento, Despesas e Resultado)
    const yearBusinessTotals = activeBusinessCompareYears.map(year => {
      let totalReceita = 0;
      let totalDespesa = 0;
      transactions.forEach(t => {
        if (t.module !== 'BUSINESS') return;
        const parts = getLocalDateParts(t.date);
        if (parts.year === year) {
          if (t.type === 'INCOME') totalReceita += t.amount;
          else if (t.type === 'EXPENSE') totalDespesa += t.amount;
        }
      });
      const totalLucro = totalReceita - totalDespesa;
      const margem = totalReceita > 0 ? (totalLucro / totalReceita) * 100 : 0;
      return {
        year,
        totalReceita,
        totalDespesa,
        totalLucro,
        margem: Number(margem.toFixed(1))
      };
    });

    // Anos ativos para comparação de Evolução Financeira Pessoal
    const activePersonalCompareYears = isComparingPersonal
      ? (personalCompareYears.length > 0 ? personalCompareYears : [selectedPersonalYear]).slice().sort((a, b) => b - a)
      : [selectedPersonalYear];

    // Evolução Mensal Pessoal (suporta comparação multi-ano)
    const personalMonthlyEvolution = monthLabels.map((monthName, monthIndex) => {
      const row: Record<string, any> = { month: monthName };

      if (isComparingPersonal) {
        activePersonalCompareYears.forEach(year => {
          let receita = 0;
          let despesa = 0;
          transactions.forEach(t => {
            if (t.module !== 'PERSONAL') return;
            const parts = getLocalDateParts(t.date);
            if (parts.year === year && parts.month === monthIndex) {
              if (t.type === 'INCOME') receita += t.amount;
              else if (t.type === 'EXPENSE') despesa += t.amount;
            }
          });
          const saldo = receita - despesa;
          row[`Receitas ${year}`] = receita;
          row[`Despesas ${year}`] = despesa;
          row[`Saldo ${year}`] = saldo;
        });
      } else {
        let receita = 0;
        let despesa = 0;

        transactions.forEach(t => {
          if (t.module !== 'PERSONAL') return;
          const parts = getLocalDateParts(t.date);
          if (parts.year === selectedPersonalYear && parts.month === monthIndex) {
            if (t.type === 'INCOME') receita += t.amount;
            else if (t.type === 'EXPENSE') despesa += t.amount;
          }
        });

        const saldo = receita - despesa;

        row['Receitas'] = receita;
        row['Despesas'] = despesa;
        row['Saldo'] = saldo;
      }

      return row;
    });

    // Totais Anuais Pessoais (Receitas, Despesas e Saldo)
    const yearPersonalTotals = activePersonalCompareYears.map(year => {
      let totalReceita = 0;
      let totalDespesa = 0;
      transactions.forEach(t => {
        if (t.module !== 'PERSONAL') return;
        const parts = getLocalDateParts(t.date);
        if (parts.year === year) {
          if (t.type === 'INCOME') totalReceita += t.amount;
          else if (t.type === 'EXPENSE') totalDespesa += t.amount;
        }
      });
      const totalSaldo = totalReceita - totalDespesa;
      return {
        year,
        totalReceita,
        totalDespesa,
        totalSaldo
      };
    });

    // Evolução Mensal da Margem de Lucro da Empresa (suporta comparação multi-ano)
    const activeCompareYears = isComparingMargin
      ? (marginCompareYears.length > 0 ? marginCompareYears : [selectedMarginYear]).slice().sort((a, b) => b - a)
      : [selectedMarginYear];

    const marginMonthlyEvolution = monthLabels.map((monthName, monthIndex) => {
      const row: Record<string, any> = { month: monthName };

      if (isComparingMargin) {
        activeCompareYears.forEach(year => {
          let receita = 0;
          let despesa = 0;
          transactions.forEach(t => {
            if (t.module !== 'BUSINESS') return;
            const parts = getLocalDateParts(t.date);
            if (parts.year === year && parts.month === monthIndex) {
              if (t.type === 'INCOME') receita += t.amount;
              else if (t.type === 'EXPENSE') despesa += t.amount;
            }
          });
          const lucroLiquido = receita - despesa;
          const margem = receita > 0 ? (lucroLiquido / receita) * 100 : 0;
          row[`${year}`] = Number(margem.toFixed(1));
        });
      } else {
        let receita = 0;
        let despesa = 0;
        transactions.forEach(t => {
          if (t.module !== 'BUSINESS') return;
          const parts = getLocalDateParts(t.date);
          if (parts.year === selectedMarginYear && parts.month === monthIndex) {
            if (t.type === 'INCOME') receita += t.amount;
            else if (t.type === 'EXPENSE') despesa += t.amount;
          }
        });
        const lucroLiquido = receita - despesa;
        const margem = receita > 0 ? (lucroLiquido / receita) * 100 : 0;

        row['Receitas'] = receita;
        row['Despesas'] = despesa;
        row['LucroLiquido'] = lucroLiquido;
        row['Margem'] = Number(margem.toFixed(1));
      }

      return row;
    });

    const yearMarginAverages = activeCompareYears.map(year => {
      let totalReceita = 0;
      let totalDespesa = 0;
      transactions.forEach(t => {
        if (t.module !== 'BUSINESS') return;
        const parts = getLocalDateParts(t.date);
        if (parts.year === year) {
          if (t.type === 'INCOME') totalReceita += t.amount;
          else if (t.type === 'EXPENSE') totalDespesa += t.amount;
        }
      });
      const totalLucro = totalReceita - totalDespesa;
      const avgMargin = totalReceita > 0 ? (totalLucro / totalReceita) * 100 : 0;
      return {
        year,
        avgMargin: Number(avgMargin.toFixed(1)),
        totalReceita,
        totalLucro
      };
    });
    
    const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const timeMap: Record<string, { income: number, expense: number }> = {};
    filtered.forEach(t => {
      const parts = getLocalDateParts(t.date);
      const label = filter?.viewType === 'YEAR' ? months[parts.month] : `${String(parts.day).padStart(2, '0')}/${String(parts.month + 1).padStart(2, '0')}`;
      if (!timeMap[label]) timeMap[label] = { income: 0, expense: 0 };
      if (t.type === 'INCOME') {
        timeMap[label].income += t.amount; 
      } else {
        timeMap[label].expense += t.amount;
      }
    });
    const areaData = Object.entries(timeMap).map(([date, vals]) => ({ date, ...vals }));
    
    // Evolução Mensal dos Indicadores (para o gráfico consolidado)
    const consolidatedMonthlyEvolution = monthLabels.map((monthName, monthIndex) => {
      let receitaConsolidada = 0;
      let entradaPessoal = 0;
      let entradaEmpresarial = 0;

      let saidaConsolidada = 0;
      let despesasPessoais = 0;
      let despesasEmpresariais = 0;

      let proLabore = 0;

      transactions.forEach(t => {
        const parts = getLocalDateParts(t.date);
        if (parts.year === selectedConsolidatedYear && parts.month === monthIndex) {
          if (t.type === 'INCOME') {
            if (isProLabore(t)) {
              proLabore += t.amount;
              entradaPessoal += t.amount;
            } else if (t.module === 'PERSONAL') {
              entradaPessoal += t.amount;
              receitaConsolidada += t.amount;
            } else if (t.module === 'BUSINESS') {
              entradaEmpresarial += t.amount;
              receitaConsolidada += t.amount;
            }
          } else if (t.type === 'EXPENSE') {
            saidaConsolidada += t.amount;
            if (t.module === 'PERSONAL') {
              despesasPessoais += t.amount;
            } else if (t.module === 'BUSINESS') {
              despesasEmpresariais += t.amount;
            }
          }
        }
      });

      return {
        month: monthName,
        'Receita Consolidada': receitaConsolidada,
        'Entrada Gestão Pessoal': entradaPessoal,
        'Entrada Gestão Empresarial': entradaEmpresarial,
        'Saída Consolidada': saidaConsolidada,
        'Despesas Pessoais': despesasPessoais,
        'Despesas Empresariais': despesasEmpresariais,
        'Pró-labore': proLabore
      };
    });
    
    return { 
      income, 
      expenses, 
      personalIncome,
      businessIncome,
      personalExpenses,
      businessExpenses,
      proLaboreMonth,
      proLaboreYear,
      pieData, 
      companyMonthlyEvolution, 
      activeBusinessCompareYears,
      yearBusinessTotals,
      marginMonthlyEvolution,
      activeCompareYears,
      yearMarginAverages,
      consolidatedMonthlyEvolution,
      personalMonthlyEvolution,
      activePersonalCompareYears,
      yearPersonalTotals,
      areaData, 
      businessYear: selectedBusinessYear,
      personalYear: selectedPersonalYear,
      marginYear: selectedMarginYear,
      consolidatedYear: selectedConsolidatedYear
    };
  }, [transactions, filter, activeModule, selectedBusinessYear, selectedPersonalYear, selectedMarginYear, selectedConsolidatedYear, isComparingMargin, marginCompareYears, isComparingBusiness, businessCompareYears, isComparingPersonal, personalCompareYears]);

  const getScoreColor = (s: number) => {
    if (s <= 30) return '#EF4444';
    if (s <= 50) return '#F59E0B';
    if (s <= 70) return '#EAB308';
    if (s <= 85) return '#10B981';
    return '#059669';
  };

  const getScoreStatus = (s: number) => {
    if (s <= 30) return 'Crítico';
    if (s <= 50) return 'Atenção';
    if (s <= 70) return 'Regular';
    if (s <= 85) return 'Saudável';
    return 'Excelente';
  };

  return (
    <div className="space-y-4 sm:space-y-8 animate-in fade-in duration-500 pb-10">
      {!hideSummary && (
        <FinancialSummary 
          income={stats.income} 
          expenses={stats.expenses} 
          personalIncome={stats.personalIncome}
          businessIncome={stats.businessIncome}
          personalExpenses={stats.personalExpenses}
          businessExpenses={stats.businessExpenses}
          proLaboreMonth={stats.proLaboreMonth}
          proLaboreYear={stats.proLaboreYear}
          dueSoonTotal={boletosStats.dueSoonTotal}
          dueSoonCount={boletosStats.dueSoonCount}
          dueTodayCount={boletosStats.dueTodayCount}
          dueTodayTotal={boletosStats.dueTodayTotal}
          overdueTotal={boletosStats.overdueTotal}
          overdueCount={boletosStats.overdueCount}
          onOpenDueSoonModal={() => setActiveBoletoModal('DUE_SOON')}
          onOpenOverdueModal={() => setActiveBoletoModal('OVERDUE')}
          isHomeTab={true}
          enabledModules={enabledModules}
        />
      )}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        
        {/* Alteração 1: Evolução Financeira Empresarial (Bar/Line Chart Jan - Dez com Comparação) */}
        {showBusinessSection && (
          <div className={`${!showPersonalSection ? 'lg:col-span-2' : ''} bg-white dark:bg-slate-900 p-3 sm:p-6 rounded-2xl sm:rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 flex flex-col justify-between`}>
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <div>
                <h3 className="text-xs sm:text-lg font-black text-slate-800 dark:text-slate-100">Evolução Financeira da Empresa</h3>
              </div>
              
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const nextMode = !isComparingBusiness;
                    setIsComparingBusiness(nextMode);
                    if (nextMode && businessCompareYears.length === 0) {
                      setBusinessCompareYears([selectedBusinessYear, selectedBusinessYear - 1]);
                    }
                  }}
                  className={`px-3 py-1 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 border shadow-2xs cursor-pointer ${
                    isComparingBusiness 
                      ? 'bg-indigo-600 text-white border-indigo-600' 
                      : 'bg-slate-50 dark:bg-slate-800/90 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                  }`}
                >
                  <span className="text-[11px] font-bold">⇄</span>
                  <span>{isComparingBusiness ? 'Comparando Anos' : 'Comparar Anos'}</span>
                </button>

                {!isComparingBusiness && (
                  <div className="flex items-center bg-slate-50 dark:bg-slate-800/90 px-3 py-1 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xs">
                    <select 
                      value={selectedBusinessYear} 
                      onChange={(e) => setSelectedBusinessYear(Number(e.target.value))}
                      className="bg-transparent text-xs font-black text-slate-800 dark:text-slate-100 outline-none cursor-pointer py-0.5"
                    >
                      {availableYears.map(y => (
                        <option key={y} value={y} className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-bold">
                          {y}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            </div>

            {/* Chips de seleção de anos no modo comparação para Evolução Financeira */}
            {isComparingBusiness && (
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3 pt-2 border-t border-slate-100 dark:border-slate-800/80">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 mr-1">Anos:</span>
                  {availableYears.map((year, idx) => {
                    const isSelected = businessCompareYears.includes(year);
                    const color = getYearColor(year, idx);
                    return (
                      <button
                        key={year}
                        type="button"
                        onClick={() => {
                          if (isSelected) {
                            if (businessCompareYears.length > 1) {
                              setBusinessCompareYears(prev => prev.filter(y => y !== year));
                            }
                          } else {
                            setBusinessCompareYears(prev => [...prev, year].sort((a, b) => b - a));
                          }
                        }}
                        className={`px-2.5 py-1 rounded-lg text-xs font-black transition-all flex items-center gap-1.5 border cursor-pointer ${
                          isSelected
                            ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border-slate-300 dark:border-slate-600 shadow-2xs'
                            : 'bg-slate-50 dark:bg-slate-800/40 text-slate-400 border-slate-200 dark:border-slate-800 opacity-60 hover:opacity-100'
                        }`}
                      >
                        <span 
                          className="w-2.5 h-2.5 rounded-full inline-block" 
                          style={{ backgroundColor: isSelected ? color : '#cbd5e1' }} 
                        />
                        <span>{year}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Filtro da métrica visível: Ambos, Faturamento ou Despesas */}
                <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700/80">
                  <button
                    type="button"
                    onClick={() => setBusinessMetricView('BOTH')}
                    className={`px-2 py-0.5 rounded-md text-[10px] font-black transition-all cursor-pointer ${
                      businessMetricView === 'BOTH'
                        ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-2xs'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                  >
                    Ambos
                  </button>
                  <button
                    type="button"
                    onClick={() => setBusinessMetricView('INCOME')}
                    className={`px-2 py-0.5 rounded-md text-[10px] font-black transition-all cursor-pointer ${
                      businessMetricView === 'INCOME'
                        ? 'bg-emerald-600 text-white shadow-2xs'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                  >
                    Faturamento
                  </button>
                  <button
                    type="button"
                    onClick={() => setBusinessMetricView('EXPENSE')}
                    className={`px-2 py-0.5 rounded-md text-[10px] font-black transition-all cursor-pointer ${
                      businessMetricView === 'EXPENSE'
                        ? 'bg-rose-600 text-white shadow-2xs'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                  >
                    Despesas
                  </button>
                </div>
              </div>
            )}

            {/* Resumo com Totais Anuais do Faturamento e Despesas */}
            <div className="mb-4 space-y-2">
              {!isComparingBusiness ? (
                <div className="grid grid-cols-3 gap-2 p-2.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800/80 text-[11px]">
                  <div>
                    <span className="block text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                      Faturamento Total ({selectedBusinessYear})
                    </span>
                    <span className="font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(stats.yearBusinessTotals[0]?.totalReceita || 0)}
                    </span>
                  </div>
                  <div>
                    <span className="block text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                      Total Despesas ({selectedBusinessYear})
                    </span>
                    <span className="font-black text-rose-600 dark:text-rose-400 tabular-nums">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(stats.yearBusinessTotals[0]?.totalDespesa || 0)}
                    </span>
                  </div>
                  <div>
                    <span className="block text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                      Resultado Líquido ({selectedBusinessYear})
                    </span>
                    <span className={`font-black tabular-nums ${
                      (stats.yearBusinessTotals[0]?.totalLucro || 0) >= 0 ? 'text-indigo-600 dark:text-indigo-400' : 'text-rose-600 dark:text-rose-400'
                    }`}>
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(stats.yearBusinessTotals[0]?.totalLucro || 0)}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {stats.yearBusinessTotals.map((item, idx) => {
                      const color = getYearColor(item.year, idx);
                      return (
                        <div key={item.year} className="p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-100 dark:border-slate-800 flex flex-col justify-between space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="flex items-center gap-1.5 font-black text-xs text-slate-800 dark:text-slate-100">
                              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
                              Ano {item.year}
                            </span>
                            <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${
                              item.margem >= 0 ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300' : 'bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300'
                            }`}>
                              Margem: {item.margem}%
                            </span>
                          </div>

                          <div className="grid grid-cols-2 gap-2 text-[10px] pt-1 border-t border-slate-200/60 dark:border-slate-700/60">
                            <div>
                              <span className="block text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase">Faturamento</span>
                              <span className="font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
                                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.totalReceita)}
                              </span>
                            </div>
                            <div>
                              <span className="block text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase">Despesas</span>
                              <span className="font-black text-rose-600 dark:text-rose-400 tabular-nums">
                                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.totalDespesa)}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {stats.yearBusinessTotals.length >= 2 && (
                    <div className="p-2 bg-indigo-50/70 dark:bg-indigo-950/40 rounded-xl border border-indigo-100 dark:border-indigo-900/50 flex flex-wrap items-center justify-between text-[10px] font-bold text-indigo-900 dark:text-indigo-200 gap-2">
                      <span className="font-black">Comparativo ({stats.yearBusinessTotals[0].year} vs {stats.yearBusinessTotals[1].year}):</span>
                      <div className="flex flex-wrap items-center gap-3">
                        <span>
                          Faturamento:{' '}
                          <span className={`font-black ${
                            (stats.yearBusinessTotals[0].totalReceita - stats.yearBusinessTotals[1].totalReceita) >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                          }`}>
                            {(stats.yearBusinessTotals[0].totalReceita - stats.yearBusinessTotals[1].totalReceita) >= 0 ? '+' : ''}
                            {stats.yearBusinessTotals[1].totalReceita > 0 
                              ? (((stats.yearBusinessTotals[0].totalReceita - stats.yearBusinessTotals[1].totalReceita) / stats.yearBusinessTotals[1].totalReceita) * 100).toFixed(1) + '%'
                              : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(stats.yearBusinessTotals[0].totalReceita - stats.yearBusinessTotals[1].totalReceita)
                            }
                          </span>
                        </span>
                        <span>
                          Despesas:{' '}
                          <span className={`font-black ${
                            (stats.yearBusinessTotals[0].totalDespesa - stats.yearBusinessTotals[1].totalDespesa) <= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                          }`}>
                            {(stats.yearBusinessTotals[0].totalDespesa - stats.yearBusinessTotals[1].totalDespesa) >= 0 ? '+' : ''}
                            {stats.yearBusinessTotals[1].totalDespesa > 0
                              ? (((stats.yearBusinessTotals[0].totalDespesa - stats.yearBusinessTotals[1].totalDespesa) / stats.yearBusinessTotals[1].totalDespesa) * 100).toFixed(1) + '%'
                              : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(stats.yearBusinessTotals[0].totalDespesa - stats.yearBusinessTotals[1].totalDespesa)
                            }
                          </span>
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="h-52 sm:h-72">
            <ResponsiveContainer width="100%" height="100%">
              {isComparingBusiness ? (
                <BarChart data={stats.companyMonthlyEvolution} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className="text-slate-100 dark:text-slate-800" />
                  <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{fontSize: 9, fontWeight: 700, fill: '#94a3b8'}} />
                  <YAxis axisLine={false} tickLine={false} tick={{fontSize: 9, fontWeight: 700, fill: '#94a3b8'}} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: '9px', fontWeight: 'bold', paddingTop: '5px' }} />
                  {stats.activeBusinessCompareYears.map((year, idx) => {
                    const color = getYearColor(year, idx);
                    return (
                      <React.Fragment key={year}>
                        {(businessMetricView === 'BOTH' || businessMetricView === 'INCOME') && (
                          <Bar 
                            dataKey={`Receitas ${year}`} 
                            name={`Faturamento ${year}`} 
                            fill={color} 
                            radius={[4, 4, 0, 0]} 
                          />
                        )}
                        {(businessMetricView === 'BOTH' || businessMetricView === 'EXPENSE') && (
                          <Bar 
                            dataKey={`Despesas ${year}`} 
                            name={`Despesas ${year}`} 
                            fill={businessMetricView === 'EXPENSE' ? color : '#EF4444'} 
                            radius={[4, 4, 0, 0]} 
                          />
                        )}
                      </React.Fragment>
                    );
                  })}
                </BarChart>
              ) : (
                <BarChart data={stats.companyMonthlyEvolution} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className="text-slate-100 dark:text-slate-800" />
                  <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{fontSize: 9, fontWeight: 700, fill: '#94a3b8'}} />
                  <YAxis axisLine={false} tickLine={false} tick={{fontSize: 9, fontWeight: 700, fill: '#94a3b8'}} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: '9px', fontWeight: 'bold', paddingTop: '5px' }} />
                  <Bar dataKey="Receitas" name="Receitas (Faturamento)" fill="#10B981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Despesas" name="Despesas" fill="#EF4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              )}
            </ResponsiveContainer>
          </div>
        </div>
        )}

        {/* Alteração 2: Evolução da Margem de Lucro (Line Chart Jan - Dez) */}
        {showBusinessSection && (
          <div className={`${!showPersonalSection ? 'lg:col-span-2' : ''} bg-white dark:bg-slate-900 p-3 sm:p-6 rounded-2xl sm:rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 flex flex-col justify-between`}>
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <div>
                <h3 className="text-xs sm:text-lg font-black text-slate-800 dark:text-slate-100">Margem de Lucro da Empresa</h3>
              </div>
              
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const nextMode = !isComparingMargin;
                    setIsComparingMargin(nextMode);
                    if (nextMode && marginCompareYears.length === 0) {
                      setMarginCompareYears([selectedMarginYear, selectedMarginYear - 1]);
                    }
                  }}
                  className={`px-3 py-1 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 border shadow-2xs ${
                    isComparingMargin 
                      ? 'bg-indigo-600 text-white border-indigo-600' 
                      : 'bg-slate-50 dark:bg-slate-800/90 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                  }`}
                >
                  <span className="text-[11px] font-bold">⇄</span>
                  <span>{isComparingMargin ? 'Comparando Anos' : 'Comparar Anos'}</span>
                </button>

                {!isComparingMargin && (
                  <div className="flex items-center bg-slate-50 dark:bg-slate-800/90 px-3 py-1 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xs">
                    <select 
                      value={selectedMarginYear} 
                      onChange={(e) => setSelectedMarginYear(Number(e.target.value))}
                      className="bg-transparent text-xs font-black text-slate-800 dark:text-slate-100 outline-none cursor-pointer py-0.5"
                    >
                      {availableYears.map(y => (
                        <option key={y} value={y} className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-bold">
                          {y}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            </div>

            {/* Chips de seleção de anos no modo comparação */}
            {isComparingMargin && (
              <div className="flex flex-wrap items-center gap-1.5 mb-3 pt-2 border-t border-slate-100 dark:border-slate-800/80">
                <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 mr-1">Anos:</span>
                {availableYears.map((year, idx) => {
                  const isSelected = marginCompareYears.includes(year);
                  const color = getYearColor(year, idx);
                  return (
                    <button
                      key={year}
                      type="button"
                      onClick={() => {
                        if (isSelected) {
                          if (marginCompareYears.length > 1) {
                            setMarginCompareYears(prev => prev.filter(y => y !== year));
                          }
                        } else {
                          setMarginCompareYears(prev => [...prev, year].sort((a, b) => b - a));
                        }
                      }}
                      className={`px-2.5 py-1 rounded-lg text-xs font-black transition-all flex items-center gap-1.5 border cursor-pointer ${
                        isSelected
                          ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border-slate-300 dark:border-slate-600 shadow-2xs'
                          : 'bg-slate-50 dark:bg-slate-800/40 text-slate-400 border-slate-200 dark:border-slate-800 opacity-60 hover:opacity-100'
                      }`}
                    >
                      <span 
                        className="w-2.5 h-2.5 rounded-full inline-block" 
                        style={{ backgroundColor: isSelected ? color : '#cbd5e1' }} 
                      />
                      <span>{year}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Resumo com a Média da Margem de cada ano e Evolução */}
            {isComparingMargin && stats.yearMarginAverages && stats.yearMarginAverages.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 mb-4 p-2.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800/80 text-[11px] font-bold">
                <span className="text-slate-400 dark:text-slate-500 font-black uppercase text-[9px] tracking-wider">Média de Margem:</span>
                {stats.yearMarginAverages.map((item, idx) => {
                  const color = getYearColor(item.year, idx);
                  return (
                    <div key={item.year} className="flex items-center gap-1.5 bg-white dark:bg-slate-800 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 shadow-2xs">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                      <span className="text-slate-700 dark:text-slate-200">{item.year}:</span>
                      <span className="font-black text-slate-900 dark:text-slate-100">{item.avgMargin}%</span>
                    </div>
                  );
                })}
                {stats.yearMarginAverages.length >= 2 && (
                  <div className="sm:ml-auto text-slate-600 dark:text-slate-300 font-black flex items-center gap-1 text-[10px]">
                    <span>Crescimento:</span>
                    <span className={`px-2 py-0.5 rounded-md ${
                      (stats.yearMarginAverages[0].avgMargin - stats.yearMarginAverages[1].avgMargin) >= 0 
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300' 
                        : 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
                    }`}>
                      {(stats.yearMarginAverages[0].avgMargin - stats.yearMarginAverages[1].avgMargin) >= 0 ? '+' : ''}
                      {(stats.yearMarginAverages[0].avgMargin - stats.yearMarginAverages[1].avgMargin).toFixed(1)} p.p.
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="h-52 sm:h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={stats.marginMonthlyEvolution} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className="text-slate-100 dark:text-slate-800" />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{fontSize: 9, fontWeight: 700, fill: '#94a3b8'}} />
                <YAxis axisLine={false} tickLine={false} tick={{fontSize: 9, fontWeight: 700, fill: '#94a3b8'}} unit="%" />
                <Tooltip content={<CustomTooltip />} />
                <ReferenceLine y={0} stroke="#94a3b8" strokeDasharray="3 3" />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '9px', fontWeight: 'bold', paddingTop: '5px' }} />
                {isComparingMargin ? (
                  stats.activeCompareYears.map((year, idx) => {
                    const color = getYearColor(year, idx);
                    return (
                      <Line 
                        key={year}
                        type="monotone" 
                        dataKey={`${year}`} 
                        name={`Ano ${year} (%)`} 
                        unit="%"
                        stroke={color} 
                        strokeWidth={3} 
                        dot={{ r: 4, fill: color, strokeWidth: 2 }} 
                        activeDot={{ r: 6 }} 
                      />
                    );
                  })
                ) : (
                  <Line 
                    type="monotone" 
                    dataKey="Margem" 
                    name="Margem de Lucro (%)" 
                    stroke="#6366F1" 
                    strokeWidth={3} 
                    dot={{ r: 4, fill: '#6366F1', strokeWidth: 2 }} 
                    activeDot={{ r: 6 }} 
                  />
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
        )}

        {/* Evolução Financeira Pessoal */}
        {showPersonalSection && (
          <div className="lg:col-span-2 bg-white dark:bg-slate-900 p-3 sm:p-6 rounded-2xl sm:rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 flex flex-col justify-between">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <div>
                <h3 className="text-xs sm:text-lg font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
                  <span>👛</span>
                  <span>Evolução Financeira Pessoal</span>
                </h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">
                  Acompanhamento de Receitas e Despesas Pessoais por Mês
                </p>
              </div>
              
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const nextMode = !isComparingPersonal;
                    setIsComparingPersonal(nextMode);
                    if (nextMode && personalCompareYears.length === 0) {
                      setPersonalCompareYears([selectedPersonalYear, selectedPersonalYear - 1]);
                    }
                  }}
                  className={`px-3 py-1 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 border shadow-2xs cursor-pointer ${
                    isComparingPersonal 
                      ? 'bg-indigo-600 text-white border-indigo-600' 
                      : 'bg-slate-50 dark:bg-slate-800/90 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                  }`}
                >
                  <span className="text-[11px] font-bold">⇄</span>
                  <span>{isComparingPersonal ? 'Comparando Anos' : 'Comparar Anos'}</span>
                </button>

                {!isComparingPersonal && (
                  <div className="flex items-center bg-slate-50 dark:bg-slate-800/90 px-3 py-1 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xs">
                    <select 
                      value={selectedPersonalYear} 
                      onChange={(e) => setSelectedPersonalYear(Number(e.target.value))}
                      className="bg-transparent text-xs font-black text-slate-800 dark:text-slate-100 outline-none cursor-pointer py-0.5"
                    >
                      {availableYears.map(y => (
                        <option key={y} value={y} className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-bold">
                          {y}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            </div>

            {/* Chips de seleção de anos no modo comparação para Evolução Financeira Pessoal */}
            {isComparingPersonal && (
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3 pt-2 border-t border-slate-100 dark:border-slate-800/80">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 mr-1">Anos:</span>
                  {availableYears.map((year, idx) => {
                    const isSelected = personalCompareYears.includes(year);
                    const color = getYearColor(year, idx);
                    return (
                      <button
                        key={year}
                        type="button"
                        onClick={() => {
                          if (isSelected) {
                            if (personalCompareYears.length > 1) {
                              setPersonalCompareYears(prev => prev.filter(y => y !== year));
                            }
                          } else {
                            setPersonalCompareYears(prev => [...prev, year].sort((a, b) => b - a));
                          }
                        }}
                        className={`px-2.5 py-1 rounded-lg text-xs font-black transition-all flex items-center gap-1.5 border cursor-pointer ${
                          isSelected
                            ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border-slate-300 dark:border-slate-600 shadow-2xs'
                            : 'bg-slate-50 dark:bg-slate-800/40 text-slate-400 border-slate-200 dark:border-slate-800 opacity-60 hover:opacity-100'
                        }`}
                      >
                        <span 
                          className="w-2.5 h-2.5 rounded-full inline-block" 
                          style={{ backgroundColor: isSelected ? color : '#cbd5e1' }} 
                        />
                        <span>{year}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Filtro da métrica visível: Ambos, Receitas ou Despesas */}
                <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700/80">
                  <button
                    type="button"
                    onClick={() => setPersonalMetricView('BOTH')}
                    className={`px-2 py-0.5 rounded-md text-[10px] font-black transition-all cursor-pointer ${
                      personalMetricView === 'BOTH'
                        ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-2xs'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                  >
                    Ambos
                  </button>
                  <button
                    type="button"
                    onClick={() => setPersonalMetricView('INCOME')}
                    className={`px-2 py-0.5 rounded-md text-[10px] font-black transition-all cursor-pointer ${
                      personalMetricView === 'INCOME'
                        ? 'bg-emerald-600 text-white shadow-2xs'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                  >
                    Receitas
                  </button>
                  <button
                    type="button"
                    onClick={() => setPersonalMetricView('EXPENSE')}
                    className={`px-2 py-0.5 rounded-md text-[10px] font-black transition-all cursor-pointer ${
                      personalMetricView === 'EXPENSE'
                        ? 'bg-rose-600 text-white shadow-2xs'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                  >
                    Despesas
                  </button>
                </div>
              </div>
            )}

            {/* Resumo com Totais Anuais das Receitas e Despesas Pessoais */}
            <div className="mb-4 space-y-2">
              {!isComparingPersonal ? (
                <div className="grid grid-cols-3 gap-2 p-2.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800/80 text-[11px]">
                  <div>
                    <span className="block text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                      Receitas Pessoais ({selectedPersonalYear})
                    </span>
                    <span className="font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(stats.yearPersonalTotals[0]?.totalReceita || 0)}
                    </span>
                  </div>
                  <div>
                    <span className="block text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                      Total Despesas ({selectedPersonalYear})
                    </span>
                    <span className="font-black text-rose-600 dark:text-rose-400 tabular-nums">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(stats.yearPersonalTotals[0]?.totalDespesa || 0)}
                    </span>
                  </div>
                  <div>
                    <span className="block text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                      Saldo Pessoal ({selectedPersonalYear})
                    </span>
                    <span className={`font-black tabular-nums ${
                      (stats.yearPersonalTotals[0]?.totalSaldo || 0) >= 0 ? 'text-indigo-600 dark:text-indigo-400' : 'text-rose-600 dark:text-rose-400'
                    }`}>
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(stats.yearPersonalTotals[0]?.totalSaldo || 0)}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {stats.yearPersonalTotals.map((item, idx) => {
                      const color = getYearColor(item.year, idx);
                      return (
                        <div key={item.year} className="p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-100 dark:border-slate-800 flex flex-col justify-between space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="flex items-center gap-1.5 font-black text-xs text-slate-800 dark:text-slate-100">
                              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
                              Ano {item.year}
                            </span>
                            <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${
                              item.totalSaldo >= 0 ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/80 dark:text-indigo-300' : 'bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300'
                            }`}>
                              Saldo: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.totalSaldo)}
                            </span>
                          </div>

                          <div className="grid grid-cols-2 gap-2 text-[10px] pt-1 border-t border-slate-200/60 dark:border-slate-700/60">
                            <div>
                              <span className="block text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase">Receitas</span>
                              <span className="font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
                                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.totalReceita)}
                              </span>
                            </div>
                            <div>
                              <span className="block text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase">Despesas</span>
                              <span className="font-black text-rose-600 dark:text-rose-400 tabular-nums">
                                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.totalDespesa)}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {stats.yearPersonalTotals.length >= 2 && (
                    <div className="p-2 bg-indigo-50/70 dark:bg-indigo-950/40 rounded-xl border border-indigo-100 dark:border-indigo-900/50 flex flex-wrap items-center justify-between text-[10px] font-bold text-indigo-900 dark:text-indigo-200 gap-2">
                      <span className="font-black">Comparativo Pessoal ({stats.yearPersonalTotals[0].year} vs {stats.yearPersonalTotals[1].year}):</span>
                      <div className="flex flex-wrap items-center gap-3">
                        <span>
                          Receitas:{' '}
                          <span className={`font-black ${
                            (stats.yearPersonalTotals[0].totalReceita - stats.yearPersonalTotals[1].totalReceita) >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                          }`}>
                            {(stats.yearPersonalTotals[0].totalReceita - stats.yearPersonalTotals[1].totalReceita) >= 0 ? '+' : ''}
                            {stats.yearPersonalTotals[1].totalReceita > 0 
                              ? (((stats.yearPersonalTotals[0].totalReceita - stats.yearPersonalTotals[1].totalReceita) / stats.yearPersonalTotals[1].totalReceita) * 100).toFixed(1) + '%'
                              : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(stats.yearPersonalTotals[0].totalReceita - stats.yearPersonalTotals[1].totalReceita)
                            }
                          </span>
                        </span>
                        <span>
                          Despesas:{' '}
                          <span className={`font-black ${
                            (stats.yearPersonalTotals[0].totalDespesa - stats.yearPersonalTotals[1].totalDespesa) <= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                          }`}>
                            {(stats.yearPersonalTotals[0].totalDespesa - stats.yearPersonalTotals[1].totalDespesa) >= 0 ? '+' : ''}
                            {stats.yearPersonalTotals[1].totalDespesa > 0
                              ? (((stats.yearPersonalTotals[0].totalDespesa - stats.yearPersonalTotals[1].totalDespesa) / stats.yearPersonalTotals[1].totalDespesa) * 100).toFixed(1) + '%'
                              : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(stats.yearPersonalTotals[0].totalDespesa - stats.yearPersonalTotals[1].totalDespesa)
                            }
                          </span>
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="h-52 sm:h-72">
            <ResponsiveContainer width="100%" height="100%">
              {isComparingPersonal ? (
                <BarChart data={stats.personalMonthlyEvolution} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className="text-slate-100 dark:text-slate-800" />
                  <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{fontSize: 9, fontWeight: 700, fill: '#94a3b8'}} />
                  <YAxis axisLine={false} tickLine={false} tick={{fontSize: 9, fontWeight: 700, fill: '#94a3b8'}} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: '9px', fontWeight: 'bold', paddingTop: '5px' }} />
                  {stats.activePersonalCompareYears.map((year, idx) => {
                    const color = getYearColor(year, idx);
                    return (
                      <React.Fragment key={year}>
                        {(personalMetricView === 'BOTH' || personalMetricView === 'INCOME') && (
                          <Bar 
                            dataKey={`Receitas ${year}`} 
                            name={`Receitas ${year}`} 
                            fill={color} 
                            radius={[4, 4, 0, 0]} 
                          />
                        )}
                        {(personalMetricView === 'BOTH' || personalMetricView === 'EXPENSE') && (
                          <Bar 
                            dataKey={`Despesas ${year}`} 
                            name={`Despesas ${year}`} 
                            fill={personalMetricView === 'EXPENSE' ? color : '#EF4444'} 
                            radius={[4, 4, 0, 0]} 
                          />
                        )}
                      </React.Fragment>
                    );
                  })}
                </BarChart>
              ) : (
                <BarChart data={stats.personalMonthlyEvolution} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className="text-slate-100 dark:text-slate-800" />
                  <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{fontSize: 9, fontWeight: 700, fill: '#94a3b8'}} />
                  <YAxis axisLine={false} tickLine={false} tick={{fontSize: 9, fontWeight: 700, fill: '#94a3b8'}} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: '9px', fontWeight: 'bold', paddingTop: '5px' }} />
                  <Bar dataKey="Receitas" name="Receitas" fill="#10B981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Despesas" name="Despesas" fill="#EF4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              )}
            </ResponsiveContainer>
          </div>
        </div>
        )}

        {/* Gráfico Consolidado dos Indicadores Financeiros */}
        {showConsolidatedSection && (
          <div className="lg:col-span-2 bg-white dark:bg-slate-900 p-3 sm:p-6 rounded-2xl sm:rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 flex flex-col justify-between">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div>
                <h3 className="text-xs sm:text-lg font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
                  <span>📈</span>
                  <span>Evolução Consolidada dos Indicadores</span>
                </h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">
                  {showBusinessSection 
                    ? "Visão comparativa de Receitas, Saídas e Pró-labore por mês" 
                    : "Visão comparativa de Receitas e Saídas por mês"}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* Seletor de Tipo de Gráfico (Barras / Linhas) */}
                <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-xl border border-slate-200 dark:border-slate-700">
                  <button
                    type="button"
                    onClick={() => setConsolidatedChartType('BAR')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-black transition-all cursor-pointer ${
                      consolidatedChartType === 'BAR'
                        ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-2xs'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                  >
                    Barras
                  </button>
                  <button
                    type="button"
                    onClick={() => setConsolidatedChartType('LINE')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-black transition-all cursor-pointer ${
                      consolidatedChartType === 'LINE'
                        ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-2xs'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                  >
                    Linhas
                  </button>
                </div>

                {/* Seletor de Ano */}
                <div className="flex items-center bg-slate-50 dark:bg-slate-800/90 px-3 py-1 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xs">
                  <select 
                    value={selectedConsolidatedYear} 
                    onChange={(e) => setSelectedConsolidatedYear(Number(e.target.value))}
                    className="bg-transparent text-xs font-black text-slate-800 dark:text-slate-100 outline-none cursor-pointer py-0.5"
                  >
                    {availableYears.map(y => (
                      <option key={y} value={y} className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-bold">
                        {y}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Filtros das Categorias de Indicadores */}
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4 pt-2 border-t border-slate-100 dark:border-slate-800/80">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 mr-1">Exibir:</span>
                {[
                  { id: 'ALL', label: 'Todos os Indicadores' },
                  { id: 'INCOME', label: 'Apenas Entradas' },
                  { id: 'EXPENSE', label: 'Apenas Saídas' },
                  ...(showBusinessSection ? [{ id: 'PROLABORE', label: 'Apenas Pró-labore' }] : []),
                ].map(item => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setConsolidatedFilter(item.id as any)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-black transition-all cursor-pointer border ${
                      consolidatedFilter === item.id
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                        : 'bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Gráfico Recharts */}
          <div className="h-64 sm:h-80">
            <ResponsiveContainer width="100%" height="100%">
              {consolidatedChartType === 'BAR' ? (
                <BarChart data={stats.consolidatedMonthlyEvolution} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className="text-slate-100 dark:text-slate-800" />
                  <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 700, fill: '#94a3b8'}} />
                  <YAxis axisLine={false} tickLine={false} tick={{fontSize: 9, fontWeight: 700, fill: '#94a3b8'}} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: '10px', fontWeight: 'bold', paddingTop: '10px' }} />
                  
                  {(consolidatedFilter === 'ALL' || consolidatedFilter === 'INCOME') && (
                    <>
                      <Bar dataKey="Receita Consolidada" fill="#10B981" radius={[4, 4, 0, 0]} />
                      {showPersonalSection && <Bar dataKey="Entrada Gestão Pessoal" fill="#3B82F6" radius={[4, 4, 0, 0]} />}
                      {showBusinessSection && <Bar dataKey="Entrada Gestão Empresarial" fill="#14B8A6" radius={[4, 4, 0, 0]} />}
                    </>
                  )}

                  {(consolidatedFilter === 'ALL' || consolidatedFilter === 'EXPENSE') && (
                    <>
                      <Bar dataKey="Saída Consolidada" fill="#EF4444" radius={[4, 4, 0, 0]} />
                      {showPersonalSection && <Bar dataKey="Despesas Pessoais" fill="#F59E0B" radius={[4, 4, 0, 0]} />}
                      {showBusinessSection && <Bar dataKey="Despesas Empresariais" fill="#DC2626" radius={[4, 4, 0, 0]} />}
                    </>
                  )}

                  {showBusinessSection && (consolidatedFilter === 'ALL' || consolidatedFilter === 'PROLABORE') && (
                    <Bar dataKey="Pró-labore" fill="#8B5CF6" radius={[4, 4, 0, 0]} />
                  )}
                </BarChart>
              ) : (
                <LineChart data={stats.consolidatedMonthlyEvolution} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className="text-slate-100 dark:text-slate-800" />
                  <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 700, fill: '#94a3b8'}} />
                  <YAxis axisLine={false} tickLine={false} tick={{fontSize: 9, fontWeight: 700, fill: '#94a3b8'}} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: '10px', fontWeight: 'bold', paddingTop: '10px' }} />

                  {(consolidatedFilter === 'ALL' || consolidatedFilter === 'INCOME') && (
                    <>
                      <Line type="monotone" dataKey="Receita Consolidada" stroke="#10B981" strokeWidth={3} dot={{ r: 3 }} />
                      {showPersonalSection && <Line type="monotone" dataKey="Entrada Gestão Pessoal" stroke="#3B82F6" strokeWidth={2.5} dot={{ r: 3 }} />}
                      {showBusinessSection && <Line type="monotone" dataKey="Entrada Gestão Empresarial" stroke="#14B8A6" strokeWidth={2.5} dot={{ r: 3 }} />}
                    </>
                  )}

                  {(consolidatedFilter === 'ALL' || consolidatedFilter === 'EXPENSE') && (
                    <>
                      <Line type="monotone" dataKey="Saída Consolidada" stroke="#EF4444" strokeWidth={3} dot={{ r: 3 }} />
                      {showPersonalSection && <Line type="monotone" dataKey="Despesas Pessoais" stroke="#F59E0B" strokeWidth={2.5} dot={{ r: 3 }} />}
                      {showBusinessSection && <Line type="monotone" dataKey="Despesas Empresariais" stroke="#DC2626" strokeWidth={2.5} dot={{ r: 3 }} />}
                    </>
                  )}

                  {showBusinessSection && (consolidatedFilter === 'ALL' || consolidatedFilter === 'PROLABORE') && (
                    <Line type="monotone" dataKey="Pró-labore" stroke="#8B5CF6" strokeWidth={3} dot={{ r: 3 }} />
                  )}
                </LineChart>
              )}
            </ResponsiveContainer>
          </div>
        </div>
        )}

      </div>

      {/* Modal de Detalhamento de Boletos (A Vencer e Vencidos) */}
      {activeBoletoModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl max-w-2xl w-full p-5 sm:p-7 shadow-2xl space-y-5 max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center text-lg font-bold ${
                  activeBoletoModal === 'DUE_SOON' 
                    ? 'bg-amber-100 dark:bg-amber-950/80 text-amber-600 dark:text-amber-400' 
                    : 'bg-rose-100 dark:bg-rose-950/80 text-rose-600 dark:text-rose-400'
                }`}>
                  {activeBoletoModal === 'DUE_SOON' ? '⚠️' : '🚨'}
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black text-slate-800 dark:text-slate-100">
                    {activeBoletoModal === 'DUE_SOON' ? 'Boletos a Vencer (do Mês)' : 'Boletos Vencidos (Mês e Anteriores)'}
                  </h3>
                  <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                    {activeBoletoModal === 'DUE_SOON' 
                      ? `${boletosStats.dueSoonCount} boleto(s) pendente(s) neste mês` 
                      : `${boletosStats.overdueCount} boleto(s) vencido(s) do mês e de meses anteriores`}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveBoletoModal(null)}
                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all cursor-pointer font-black text-sm"
              >
                ✕
              </button>
            </div>

            {/* Summary Banner */}
            <div className={`p-4 rounded-2xl flex items-center justify-between border ${
              activeBoletoModal === 'DUE_SOON'
                ? 'bg-amber-50/60 dark:bg-amber-950/40 border-amber-200/70 dark:border-amber-900/60 text-amber-900 dark:text-amber-200'
                : 'bg-rose-50/60 dark:bg-rose-950/40 border-rose-200/70 dark:border-rose-900/60 text-rose-900 dark:text-rose-200'
            }`}>
              <span className="text-xs font-black uppercase tracking-wider">Valor Total Acumulado:</span>
              <span className="text-lg font-black tabular-nums">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                  activeBoletoModal === 'DUE_SOON' ? boletosStats.dueSoonTotal : boletosStats.overdueTotal
                )}
              </span>
            </div>

            {/* List of Boletos */}
            <div className="overflow-y-auto space-y-3 flex-1 pr-1">
              {(activeBoletoModal === 'DUE_SOON' ? boletosStats.dueSoonList : boletosStats.overdueList).length === 0 ? (
                <div className="p-8 text-center flex flex-col items-center gap-2">
                  <span className="text-4xl">🎉</span>
                  <p className="text-xs font-black text-slate-400 uppercase tracking-widest">
                    Nenhum boleto encontrado nesta categoria!
                  </p>
                </div>
              ) : (
                (activeBoletoModal === 'DUE_SOON' ? boletosStats.dueSoonList : boletosStats.overdueList).map(t => {
                  const parts = getLocalDateParts(t.date);
                  const dayNum = t.dueDay || parts.day;
                  const day = String(dayNum).padStart(2, '0');
                  const month = String(parts.month + 1).padStart(2, '0');
                  const year = parts.year;
                  const formattedDueDate = `${day}/${month}/${year}`;

                  const now = new Date();
                  const todayTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0).getTime();
                  const itemDueTime = new Date(parts.year, parts.month, dayNum, 0, 0, 0, 0).getTime();
                  const isDueToday = itemDueTime === todayTime;

                  return (
                    <div 
                      key={t.id}
                      className={`p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all ${
                        isDueToday
                          ? 'bg-amber-500/10 border-2 border-amber-500/80 dark:border-amber-400 ring-2 ring-amber-500/30'
                          : 'bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 hover:border-slate-200 dark:hover:border-slate-700'
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          {isDueToday && (
                            <span className="bg-amber-600 text-white font-black text-[8px] px-2 py-0.5 rounded-md uppercase tracking-wider animate-pulse flex items-center gap-1">
                              <span>🚨</span>
                              <span>VENCE HOJE</span>
                            </span>
                          )}
                          <span className={`px-2 py-0.5 text-[8px] font-black rounded-md uppercase tracking-wider ${
                            t.module === 'PERSONAL' 
                              ? 'bg-blue-100 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300' 
                              : 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300'
                          }`}>
                            {t.module === 'PERSONAL' ? 'Gestão Pessoal' : 'Gestão Empresarial'}
                          </span>
                          <span className="bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-[8px] font-black px-2 py-0.5 rounded-md uppercase">
                            {t.category}
                          </span>
                          {t.installments && (
                            <span className="bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 text-[8px] font-black px-2 py-0.5 rounded-md uppercase">
                              Parcela {t.installments.current}/{t.installments.total}
                            </span>
                          )}
                        </div>
                        <p className="text-sm font-black text-slate-800 dark:text-slate-100 uppercase tracking-tight">
                          {t.description}
                        </p>
                        <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 flex items-center gap-1">
                          <span>📅 Data de Vencimento:</span>
                          <span className={isDueToday ? "text-amber-600 dark:text-amber-400 font-black" : "text-slate-700 dark:text-slate-300 font-black"}>
                            {formattedDueDate} {isDueToday && '(HOJE)'}
                          </span>
                        </p>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-4 border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-200 dark:border-slate-700">
                        <span className="text-sm sm:text-base font-black text-rose-600 dark:text-rose-400 tabular-nums">
                          {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(t.amount)}
                        </span>
                        {onTogglePaid && (
                          <button
                            type="button"
                            onClick={() => onTogglePaid(t.id)}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                            title="Marcar como pago"
                          >
                            <span>✓</span>
                            <span>Pagar</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Modal Footer */}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => setActiveBoletoModal(null)}
                className="bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 text-white px-5 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

