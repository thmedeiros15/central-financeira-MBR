import React, { useState, useMemo, useEffect } from 'react';
import { 
  Sparkles, 
  RefreshCw, 
  User, 
  Building2, 
  Wallet, 
  TrendingUp, 
  BarChart3, 
  Lightbulb, 
  AlertTriangle, 
  Search, 
  Check
} from 'lucide-react';
import { Transaction, AIAnalysisResponse, ManagementModule, DateFilter, AnalysisScope, AnalysisPeriodType, AnalysisParams } from '../types';
import { getLocalDateParts } from '../utils/dateUtils';

interface Props {
  transactions: Transaction[];
  module?: ManagementModule;
  globalFilter?: DateFilter;
  analysis: AIAnalysisResponse | null;
  isLoading: boolean;
  onAnalyze: (params: AnalysisParams) => void;
  enabledModules?: { business: boolean; personal: boolean };
}

const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

const SHORT_MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

export const AIConsultant: React.FC<Props> = ({ 
  transactions,
  module = 'HOME', 
  globalFilter,
  analysis,
  isLoading,
  onAnalyze,
  enabledModules
}) => {
  const now = new Date();

  const showBusiness = enabledModules ? enabledModules.business : true;
  const showPersonal = enabledModules ? enabledModules.personal : true;
  const showBoth = showBusiness && showPersonal;

  // 1. Âmbito de Análise: PERSONAL, BUSINESS, ou CONSOLIDATED (Ambas)
  const [scope, setScope] = useState<AnalysisScope>(() => {
    if (enabledModules) {
      if (enabledModules.personal && !enabledModules.business) return 'PERSONAL';
      if (enabledModules.business && !enabledModules.personal) return 'BUSINESS';
    }
    if (module === 'PERSONAL') return 'PERSONAL';
    if (module === 'BUSINESS') return 'BUSINESS';
    return 'CONSOLIDATED';
  });

  useEffect(() => {
    if (!showBusiness && scope === 'BUSINESS') setScope('PERSONAL');
    if (!showPersonal && scope === 'PERSONAL') setScope('BUSINESS');
    if (!showBoth && scope === 'CONSOLIDATED') {
      setScope(showPersonal ? 'PERSONAL' : 'BUSINESS');
    }
  }, [showBusiness, showPersonal, showBoth]);

  // 2. Modalidade de Seleção de Período (Mês Único, Comparar Meses, Intervalo, Ano Único, Comparar Anos)
  const [periodType, setPeriodType] = useState<AnalysisPeriodType>('SINGLE_MONTH');

  // Mês Único
  const [selectedSingleMonth, setSelectedSingleMonth] = useState<number>(() => {
    return globalFilter?.month !== undefined ? globalFilter.month : now.getMonth();
  });

  // Múltiplos Meses para Comparação (ex: [5, 6] para Junho e Julho)
  const [selectedMultipleMonths, setSelectedMultipleMonths] = useState<number[]>(() => {
    const currentM = globalFilter?.month !== undefined ? globalFilter.month : now.getMonth();
    const prevM = currentM > 0 ? currentM - 1 : 11;
    return [prevM, currentM];
  });

  // Intervalo de Meses (De ... Até)
  const [startMonthRange, setStartMonthRange] = useState<number>(0);
  const [endMonthRange, setEndMonthRange] = useState<number>(() => {
    return globalFilter?.month !== undefined ? globalFilter.month : now.getMonth();
  });

  // Ano da Análise (para Mês Único, Múltiplos Meses, Intervalo e Ano Único)
  const [selectedYear, setSelectedYear] = useState<number>(() => {
    return globalFilter?.year !== undefined ? globalFilter.year : now.getFullYear();
  });

  // Múltiplos Anos para Comparação Anual (ex: [2025, 2026])
  const [selectedMultipleYears, setSelectedMultipleYears] = useState<number[]>(() => {
    const currentY = globalFilter?.year !== undefined ? globalFilter.year : now.getFullYear();
    return [currentY - 1, currentY];
  });

  // Lista de Anos disponíveis nas transações
  const yearsList = useMemo(() => {
    const yearsSet = new Set<number>();
    const currentY = now.getFullYear();
    yearsSet.add(currentY - 2);
    yearsSet.add(currentY - 1);
    yearsSet.add(currentY);
    yearsSet.add(currentY + 1);

    transactions.forEach(t => {
      if (t.date) {
        const parts = getLocalDateParts(t.date);
        if (parts.year) yearsSet.add(parts.year);
      }
    });

    return Array.from(yearsSet).sort((a, b) => a - b);
  }, [transactions]);

  // Sincronizar com aba ativa se mudar no topo
  useEffect(() => {
    if (module === 'PERSONAL') setScope('PERSONAL');
    else if (module === 'BUSINESS') setScope('BUSINESS');
  }, [module]);

  const toggleMonthSelection = (mIndex: number) => {
    setSelectedMultipleMonths(prev => {
      if (prev.includes(mIndex)) {
        if (prev.length <= 1) return prev;
        return prev.filter(m => m !== mIndex);
      } else {
        return [...prev, mIndex].sort((a, b) => a - b);
      }
    });
  };

  const toggleYearSelection = (y: number) => {
    setSelectedMultipleYears(prev => {
      if (prev.includes(y)) {
        if (prev.length <= 1) return prev;
        return prev.filter(item => item !== y);
      } else {
        return [...prev, y].sort((a, b) => a - b);
      }
    });
  };

  const handleTriggerAnalysis = () => {
    onAnalyze({
      scope,
      periodType,
      month: selectedSingleMonth,
      selectedMonths: selectedMultipleMonths,
      startMonth: startMonthRange,
      endMonth: endMonthRange,
      year: selectedYear,
      selectedYears: selectedMultipleYears
    });
  };

  // Executar análise apenas na montagem inicial se não houver análise prévia
  useEffect(() => {
    if (!analysis) {
      onAnalyze({
        scope,
        periodType,
        month: selectedSingleMonth,
        selectedMonths: selectedMultipleMonths,
        startMonth: startMonthRange,
        endMonth: endMonthRange,
        year: selectedYear,
        selectedYears: selectedMultipleYears
      });
    }
  }, []);

  // Rótulo textual do período selecionado
  const periodDescriptionLabel = useMemo(() => {
    if (periodType === 'SINGLE_MONTH') {
      return `${MONTHS[selectedSingleMonth]} / ${selectedYear}`;
    } else if (periodType === 'MULTIPLE_MONTHS') {
      const names = selectedMultipleMonths.map(m => SHORT_MONTHS[m]).join(', ');
      return `Comparando: ${names} (${selectedYear})`;
    } else if (periodType === 'MONTH_RANGE') {
      const minM = Math.min(startMonthRange, endMonthRange);
      const maxM = Math.max(startMonthRange, endMonthRange);
      return `${SHORT_MONTHS[minM]} a ${SHORT_MONTHS[maxM]} (${selectedYear})`;
    } else if (periodType === 'MULTIPLE_YEARS') {
      const sortedY = [...selectedMultipleYears].sort((a, b) => a - b);
      return `Comparando Anos: ${sortedY.join(' vs ')}`;
    } else {
      return `Ano Inteiro (${selectedYear})`;
    }
  }, [periodType, selectedSingleMonth, selectedMultipleMonths, startMonthRange, endMonthRange, selectedYear, selectedMultipleYears]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'EXCELLENT': return 'text-emerald-500 bg-emerald-50 dark:bg-emerald-950/60 border-emerald-100 dark:border-emerald-800';
      case 'VERY_GOOD': return 'text-teal-500 bg-teal-50 dark:bg-teal-950/60 border-teal-100 dark:border-teal-800';
      case 'HEALTHY': return 'text-blue-500 bg-blue-50 dark:bg-blue-950/60 border-blue-100 dark:border-blue-800';
      case 'WARNING': return 'text-amber-500 bg-amber-50 dark:bg-amber-950/60 border-amber-100 dark:border-amber-800';
      case 'CRITICAL': return 'text-rose-500 bg-rose-50 dark:bg-rose-950/60 border-rose-100 dark:border-rose-800';
      default: return 'text-slate-500 bg-slate-50 dark:bg-slate-800 border-slate-100 dark:border-slate-700';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'EXCELLENT': return 'Excelente';
      case 'VERY_GOOD': return 'Muito Bom';
      case 'HEALTHY': return 'Saudável';
      case 'WARNING': return 'Atenção';
      case 'CRITICAL': return 'Crítico';
      default: return 'Indefinido';
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 p-5 sm:p-7 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm mb-8 relative">
      {/* Cabeçalho Limpo */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5 pb-5 border-b border-slate-100 dark:border-slate-800/80">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-[#F26522]/10 dark:bg-[#F26522]/20 text-[#F26522] rounded-2xl flex items-center justify-center border border-[#F26522]/30 shrink-0">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-2">
              Assistente MBR Intelligence
            </h2>
            <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-slate-500 dark:text-slate-400 mt-0.5">
              <span>
                {scope === 'PERSONAL' ? 'Pessoal' : scope === 'BUSINESS' ? 'Empresarial' : 'Consolidado'}
              </span>
              <span>•</span>
              <span className="text-[#F26522] font-extrabold">
                {periodDescriptionLabel}
              </span>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={handleTriggerAnalysis}
          disabled={isLoading}
          className="w-full sm:w-auto bg-[#F26522] hover:bg-[#D94100] text-white px-5 py-3 sm:py-2.5 rounded-xl font-black text-xs transition-all disabled:opacity-50 active:scale-95 uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-orange-950/20"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          <span>{isLoading ? 'Analisando...' : 'Atualizar Diagnóstico'}</span>
        </button>
      </div>

      {/* Painel de Filtros Harmonizado e Responsivo Mobile */}
      <div className="bg-slate-50 dark:bg-slate-800/50 p-3.5 sm:p-5 rounded-2xl border border-slate-200/60 dark:border-slate-700/60 mb-6 space-y-4">
        
        {/* Linha 1: Controles de Gestão e Ano */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          
          {/* Seleção de Gestão */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 w-full sm:w-auto">
            <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider shrink-0">
              Gestão
            </span>
            <div className="grid grid-cols-3 sm:flex w-full sm:w-auto p-1 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-700/80 gap-1 shadow-2xs">
              {showPersonal && (
                <button
                  type="button"
                  onClick={() => setScope('PERSONAL')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    scope === 'PERSONAL'
                      ? 'bg-blue-600 text-white shadow-2xs font-black'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <User className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">Pessoal</span>
                </button>
              )}
              {showBusiness && (
                <button
                  type="button"
                  onClick={() => setScope('BUSINESS')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    scope === 'BUSINESS'
                      ? 'bg-emerald-600 text-white shadow-2xs font-black'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Building2 className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">Empresa</span>
                </button>
              )}
              {showBoth && (
                <button
                  type="button"
                  onClick={() => setScope('CONSOLIDATED')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    scope === 'CONSOLIDATED'
                      ? 'bg-[#F26522] text-white shadow-2xs font-black'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Wallet className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">Ambas</span>
                </button>
              )}
            </div>
          </div>

          {/* Seleção de Ano */}
          {periodType !== 'MULTIPLE_YEARS' && (
            <div className="flex items-center gap-2 sm:justify-end">
              <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider shrink-0">
                Ano
              </span>
              <select
                value={selectedYear}
                onChange={e => setSelectedYear(parseInt(e.target.value))}
                className="text-xs font-extrabold text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-700/80 rounded-xl px-3 py-1.5 outline-none cursor-pointer focus:ring-2 focus:ring-[#F26522] shadow-2xs w-full sm:w-auto"
              >
                {yearsList.map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
          )}

        </div>

        {/* Linha 2: Seleção do Formato de Período */}
        <div className="flex flex-col gap-1.5 pt-2 border-t border-slate-200/60 dark:border-slate-700/60">
          <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider">
            Formato
          </span>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:flex lg:flex-wrap p-1 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-700/80 gap-1 shadow-2xs">
            <button
              type="button"
              onClick={() => setPeriodType('SINGLE_MONTH')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer text-center ${
                periodType === 'SINGLE_MONTH'
                  ? 'bg-[#F26522] text-white shadow-2xs font-black'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Mês Único
            </button>
            <button
              type="button"
              onClick={() => setPeriodType('MULTIPLE_MONTHS')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1 ${
                periodType === 'MULTIPLE_MONTHS'
                  ? 'bg-[#F26522] text-white shadow-2xs font-black'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5 shrink-0" />
              <span>Comparar Meses</span>
            </button>
            <button
              type="button"
              onClick={() => setPeriodType('MONTH_RANGE')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer text-center ${
                periodType === 'MONTH_RANGE'
                  ? 'bg-[#F26522] text-white shadow-2xs font-black'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Intervalo
            </button>
            <button
              type="button"
              onClick={() => setPeriodType('YEAR')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer text-center ${
                periodType === 'YEAR'
                  ? 'bg-[#F26522] text-white shadow-2xs font-black'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Ano Único
            </button>
            <button
              type="button"
              onClick={() => setPeriodType('MULTIPLE_YEARS')}
              className={`col-span-2 sm:col-span-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1 ${
                periodType === 'MULTIPLE_YEARS'
                  ? 'bg-[#F26522] text-white shadow-2xs font-black'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5 shrink-0" />
              <span>Comparar Anos</span>
            </button>
          </div>
        </div>

        {/* Linha 3: Seletor Compacto de Meses / Anos */}
        <div className="pt-2 border-t border-slate-200/60 dark:border-slate-700/60">
          
          {/* Mês Único */}
          {periodType === 'SINGLE_MONTH' && (
            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                Mês:
              </span>
              <div className="grid grid-cols-4 sm:grid-cols-6 lg:flex lg:flex-wrap gap-1.5 w-full">
                {SHORT_MONTHS.map((m, idx) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setSelectedSingleMonth(idx)}
                    className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all cursor-pointer text-center ${
                      selectedSingleMonth === idx
                        ? 'bg-[#F26522] text-white font-black shadow-2xs'
                        : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700/60 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Comparar Meses */}
          {periodType === 'MULTIPLE_MONTHS' && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-600 dark:text-slate-300">
                  Selecione os meses para comparar ({selectedYear}):
                </span>
                <span className="text-[10px] font-black text-[#F26522] uppercase">
                  {selectedMultipleMonths.length} {selectedMultipleMonths.length === 1 ? 'mês' : 'meses'}
                </span>
              </div>
              <div className="grid grid-cols-4 sm:grid-cols-6 lg:flex lg:flex-wrap gap-1.5 w-full">
                {SHORT_MONTHS.map((m, idx) => {
                  const isSelected = selectedMultipleMonths.includes(idx);
                  return (
                    <button
                      key={m}
                      type="button"
                      onClick={() => toggleMonthSelection(idx)}
                      className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1 border ${
                        isSelected
                          ? 'bg-[#F26522] text-white border-[#F26522] font-black shadow-2xs'
                          : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200/60 dark:border-slate-700/60 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      <span>{m}</span>
                      {isSelected && <Check className="w-3 h-3 text-white stroke-[3]" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Intervalo de Meses */}
          {periodType === 'MONTH_RANGE' && (
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-slate-500 dark:text-slate-400">De:</span>
                <select
                  value={startMonthRange}
                  onChange={e => setStartMonthRange(parseInt(e.target.value))}
                  className="font-bold text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 outline-none cursor-pointer focus:ring-2 focus:ring-[#F26522]"
                >
                  {MONTHS.map((m, idx) => (
                    <option key={m} value={idx}>{m}</option>
                  ))}
                </select>
              </div>

              <span className="text-slate-400 font-bold hidden sm:inline">&rarr;</span>

              <div className="flex items-center gap-1.5">
                <span className="font-bold text-slate-500 dark:text-slate-400">Até:</span>
                <select
                  value={endMonthRange}
                  onChange={e => setEndMonthRange(parseInt(e.target.value))}
                  className="font-bold text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 outline-none cursor-pointer focus:ring-2 focus:ring-[#F26522]"
                >
                  {MONTHS.map((m, idx) => (
                    <option key={m} value={idx}>{m}</option>
                  ))}
                </select>
              </div>

              <div className="sm:ml-auto text-[11px] font-bold text-[#F26522] bg-[#F26522]/10 dark:bg-[#F26522]/20 px-3 py-1 rounded-lg border border-[#F26522]/20">
                {Math.abs(endMonthRange - startMonthRange) + 1} meses ({selectedYear})
              </div>
            </div>
          )}

          {/* Ano Único */}
          {periodType === 'YEAR' && (
            <div className="text-xs font-medium text-slate-600 dark:text-slate-300 flex items-center gap-2 py-0.5">
              <span>Analisando movimentação acumulada dos 12 meses do ano de <strong>{selectedYear}</strong>.</span>
            </div>
          )}

          {/* Comparar Anos */}
          {periodType === 'MULTIPLE_YEARS' && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-600 dark:text-slate-300">
                  Selecione os anos para comparar:
                </span>
                <span className="text-[10px] font-black text-[#F26522] uppercase">
                  {selectedMultipleYears.length} {selectedMultipleYears.length === 1 ? 'ano' : 'anos'}
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                {yearsList.map(y => {
                  const isSelected = selectedMultipleYears.includes(y);
                  return (
                    <button
                      key={y}
                      type="button"
                      onClick={() => toggleYearSelection(y)}
                      className={`py-1.5 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1 border ${
                        isSelected
                          ? 'bg-[#F26522] text-white border-[#F26522] font-black shadow-2xs'
                          : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200/60 dark:border-slate-700/60 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      <span>{y}</span>
                      {isSelected && <Check className="w-3 h-3 text-white stroke-[3]" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

        </div>

      </div>

      {/* Exibição dos Resultados da Análise */}
      {analysis && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            
            {/* Medidor do MBR Score */}
            <div className="md:col-span-1 bg-slate-50 dark:bg-slate-800/40 p-6 rounded-2xl border border-slate-100 dark:border-slate-800 flex flex-col items-center justify-center text-center">
               <div className="relative w-28 h-28 mb-3">
                  <svg className="w-full h-full transform -rotate-90">
                    <circle cx="56" cy="56" r="50" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-slate-200 dark:text-slate-700" />
                    <circle cx="56" cy="56" r="50" stroke="currentColor" strokeWidth="8" fill="transparent" strokeDasharray={314.15} strokeDashoffset={314.15 - (analysis.financialScore / 100) * 314.15} className={`${analysis.financialScore > 60 ? 'text-indigo-600 dark:text-indigo-400' : 'text-rose-500'} transition-all duration-1000 ease-out`} />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-2xl font-black text-slate-900 dark:text-slate-100 leading-none">{analysis.financialScore}</span>
                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mt-1">Score MBR</span>
                  </div>
               </div>
               <div className={`px-3 py-1 rounded-full border text-[9px] font-black uppercase tracking-widest ${getStatusColor(analysis.healthStatus)}`}>
                 {getStatusText(analysis.healthStatus)}
               </div>
            </div>

            {/* Insights Comparativos e Riscos */}
            <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
               <InsightCard icon={<Lightbulb className="w-4 h-4 text-indigo-500" />} title="Insights & Comparativos" items={analysis.insights} />
               <InsightCard icon={<AlertTriangle className="w-4 h-4 text-rose-500" />} title="Riscos Detectados" items={analysis.risks} variant="danger" />
            </div>
          </div>

          {/* Oportunidades de Melhoria & Diagnóstico */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <Section icon={<TrendingUp className="w-4 h-4 text-emerald-500" />} title="Oportunidades de Melhoria" items={analysis.opportunities} color="text-emerald-700 dark:text-emerald-400" />
            <Section icon={<Search className="w-4 h-4 text-rose-500" />} title="Diagnóstico e Observações" items={analysis.issues} color="text-rose-700 dark:text-rose-400" />
          </div>
        </div>
      )}
    </div>
  );
};

const InsightCard: React.FC<{ icon: React.ReactNode, title: string, items: string[], variant?: 'default' | 'danger' }> = ({ icon, title, items, variant = 'default' }) => (
  <div className={`p-5 rounded-2xl border ${variant === 'danger' ? 'bg-rose-50/20 dark:bg-rose-950/10 border-rose-100 dark:border-rose-900/40' : 'bg-slate-50 dark:bg-slate-800/40 border-slate-100 dark:border-slate-800'} flex flex-col justify-between`}>
    <div>
      <div className="flex items-center gap-2 mb-3">
        {icon}
        <h3 className={`text-[10px] font-black uppercase tracking-wider ${variant === 'danger' ? 'text-rose-600 dark:text-rose-400' : 'text-slate-500 dark:text-slate-400'}`}>{title}</h3>
      </div>
      <div className="space-y-2">
        {items.map((item, i) => (
          <p key={i} className="text-xs font-medium text-slate-700 dark:text-slate-200 leading-relaxed flex items-start gap-1.5">
            <span className="text-indigo-400 font-bold mt-0.5">•</span>
            <span>{item}</span>
          </p>
        ))}
        {items.length === 0 && <p className="text-xs italic text-slate-400">Nenhum dado relevante encontrado.</p>}
      </div>
    </div>
  </div>
);

const Section: React.FC<{ icon: React.ReactNode, title: string, items: string[], color: string }> = ({ icon, title, items, color }) => (
  <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-2xs">
    <div className="flex items-center gap-2 mb-3">
      {icon}
      <h3 className={`text-xs font-black uppercase tracking-wider ${color}`}>{title}</h3>
    </div>
    <ul className="space-y-2">
      {items.length > 0 ? items.map((item, i) => (
        <li key={i} className="text-xs font-medium text-slate-600 dark:text-slate-300 flex items-start gap-2 leading-relaxed">
          <span className="text-indigo-400 font-bold mt-0.5">&rarr;</span>
          <span>{item}</span>
        </li>
      )) : (
        <li className="text-xs text-slate-400 italic">Nenhum registro identificado para esta categoria.</li>
      )}
    </ul>
  </div>
);
