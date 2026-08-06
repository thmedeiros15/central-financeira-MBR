
import React from 'react';

interface Props {
  income: number;
  expenses: number;
  personalIncome?: number;
  businessIncome?: number;
  personalExpenses?: number;
  businessExpenses?: number;
  proLaboreMonth?: number;
  proLaboreYear?: number;
  dueSoonTotal?: number;
  dueSoonCount?: number;
  dueTodayCount?: number;
  dueTodayTotal?: number;
  overdueTotal?: number;
  overdueCount?: number;
  onOpenDueSoonModal?: () => void;
  onOpenOverdueModal?: () => void;
  isHomeTab?: boolean;
  showBalance?: boolean;
  showProLabore?: boolean;
  enabledModules?: { business: boolean; personal: boolean };
}

export const FinancialSummary: React.FC<Props> = ({ 
  income, 
  expenses, 
  personalIncome = 0,
  businessIncome = 0,
  personalExpenses = 0,
  businessExpenses = 0,
  proLaboreMonth = 0, 
  proLaboreYear = 0,
  dueSoonTotal = 0,
  dueSoonCount = 0,
  dueTodayCount = 0,
  dueTodayTotal = 0,
  overdueTotal = 0,
  overdueCount = 0,
  onOpenDueSoonModal,
  onOpenOverdueModal,
  isHomeTab = false,
  showBalance = true,
  showProLabore = true,
  enabledModules
}) => {
  const balance = income - expenses;
  const formatCurrency = (val: number) => 
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  const showBusiness = enabledModules ? enabledModules.business : true;
  const showPersonal = enabledModules ? enabledModules.personal : true;
  const showBoth = showBusiness && showPersonal;

  if (isHomeTab) {
    const boletosAVencerCard = (
      <button
        key="boletos-a-vencer"
        type="button"
        onClick={onOpenDueSoonModal}
        className={`p-3.5 sm:p-5 rounded-2xl shadow-sm flex flex-col justify-between relative overflow-hidden group text-left transition-all cursor-pointer hover:shadow-md ${
          dueTodayCount > 0
            ? 'bg-amber-500/15 dark:bg-amber-950/80 border-2 border-amber-500 dark:border-amber-400 ring-4 ring-amber-500/30 animate-pulse shadow-xl shadow-amber-500/25'
            : 'bg-white dark:bg-slate-900 border border-amber-200/80 dark:border-amber-900/50 hover:border-amber-400 dark:hover:border-amber-500'
        }`}
      >
        <div className="flex items-center justify-between mb-1">
          <p className="text-[9px] sm:text-xs font-black text-amber-600 dark:text-amber-400 uppercase tracking-wider flex items-center gap-1">
            {dueTodayCount > 0 && <span className="animate-ping text-xs">⚠️</span>}
            <span>A Vencer (Mês)</span>
          </p>
          <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold ${
            dueTodayCount > 0
              ? 'bg-amber-500 text-white animate-bounce shadow-md'
              : 'bg-amber-50 dark:bg-amber-950/60 text-amber-500 dark:text-amber-400'
          }`}>
            ⚠️
          </div>
        </div>
        <div>
          {dueTodayCount > 0 && (
            <div className="mb-1.5 px-2 py-1 rounded-lg bg-amber-600 text-white font-black text-[10px] uppercase tracking-wider flex items-center gap-1 w-fit animate-pulse shadow-md">
              <span>🚨</span>
              <span>{dueTodayCount === 1 ? '1 boleto vence HOJE!' : `${dueTodayCount} boletos vencem HOJE!`}</span>
            </div>
          )}
          <p className="text-base sm:text-xl font-black text-amber-600 dark:text-amber-400 truncate tabular-nums">
            {formatCurrency(dueSoonTotal)}
          </p>
          <div className="flex items-center justify-between mt-0.5">
            <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase">
              {dueSoonCount} {dueSoonCount === 1 ? 'boleto no mês' : 'boletos no mês'}
            </span>
            <span className="text-[9px] font-black text-amber-600 dark:text-amber-400 uppercase group-hover:translate-x-0.5 transition-transform">
              Ver ↗
            </span>
          </div>
        </div>
      </button>
    );

    const boletosVencidosCard = (
      <button
        key="boletos-vencidos"
        type="button"
        onClick={onOpenOverdueModal}
        className="bg-white dark:bg-slate-900 p-3.5 sm:p-5 rounded-2xl shadow-sm border border-rose-200/80 dark:border-rose-900/50 hover:border-rose-400 dark:hover:border-rose-500 flex flex-col justify-between relative overflow-hidden group text-left transition-all cursor-pointer hover:shadow-md"
      >
        <div className="flex items-center justify-between mb-1">
          <p className="text-[9px] sm:text-xs font-black text-rose-600 dark:text-rose-400 uppercase tracking-wider">Boletos Vencidos</p>
          <div className="w-6 h-6 rounded-lg bg-rose-50 dark:bg-rose-950/60 flex items-center justify-center text-rose-500 dark:text-rose-400 text-xs font-bold">
            🚨
          </div>
        </div>
        <div>
          <p className="text-base sm:text-xl font-black text-rose-600 dark:text-rose-400 truncate tabular-nums">
            {formatCurrency(overdueTotal)}
          </p>
          <div className="flex items-center justify-between mt-0.5">
            <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase">
              {overdueCount} {overdueCount === 1 ? 'boleto' : 'boletos'}
            </span>
            <span className="text-[9px] font-black text-rose-600 dark:text-rose-400 uppercase group-hover:translate-x-0.5 transition-transform">
              Ver ↗
            </span>
          </div>
        </div>
      </button>
    );

    // Se APENAS modo PESSOAL estiver ativo:
    if (showPersonal && !showBusiness) {
      return (
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
          <div className="bg-white dark:bg-slate-900 p-3.5 sm:p-5 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-1">
              <p className="text-[9px] sm:text-xs font-black text-slate-400 uppercase tracking-wider">Entrada Gestão Pessoal</p>
              <div className="w-6 h-6 rounded-lg bg-blue-50 dark:bg-blue-950/60 flex items-center justify-center text-blue-500 text-xs font-bold">👤</div>
            </div>
            <p className="text-base sm:text-xl font-black text-blue-600 dark:text-blue-400 truncate tabular-nums">{formatCurrency(personalIncome)}</p>
          </div>

          <div className="bg-white dark:bg-slate-900 p-3.5 sm:p-5 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-1">
              <p className="text-[9px] sm:text-xs font-black text-slate-400 uppercase tracking-wider">Despesas Pessoais</p>
              <div className="w-6 h-6 rounded-lg bg-amber-50 dark:bg-amber-950/60 flex items-center justify-center text-amber-500 text-xs font-bold">🏠</div>
            </div>
            <p className="text-base sm:text-xl font-black text-amber-600 dark:text-amber-400 truncate tabular-nums">{formatCurrency(personalExpenses)}</p>
          </div>

          {boletosAVencerCard}
          {boletosVencidosCard}
        </div>
      );
    }

    // Se APENAS modo EMPRESA estiver ativo:
    if (showBusiness && !showPersonal) {
      const bBalance = businessIncome - businessExpenses;
      return (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4 mb-6 sm:mb-8">
          <div className="bg-white dark:bg-slate-900 p-3.5 sm:p-5 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-1">
              <p className="text-[9px] sm:text-xs font-black text-slate-400 uppercase tracking-wider">Entrada Empresarial</p>
              <div className="w-6 h-6 rounded-lg bg-teal-50 dark:bg-teal-950/60 flex items-center justify-center text-teal-500 text-xs font-bold">🏢</div>
            </div>
            <p className="text-base sm:text-xl font-black text-teal-600 dark:text-teal-400 truncate tabular-nums">{formatCurrency(businessIncome)}</p>
          </div>

          <div className="bg-white dark:bg-slate-900 p-3.5 sm:p-5 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-1">
              <p className="text-[9px] sm:text-xs font-black text-slate-400 uppercase tracking-wider">Despesas Empresariais</p>
              <div className="w-6 h-6 rounded-lg bg-red-50 dark:bg-red-950/60 flex items-center justify-center text-red-500 text-xs font-bold">💼</div>
            </div>
            <p className="text-base sm:text-xl font-black text-red-600 dark:text-red-400 truncate tabular-nums">{formatCurrency(businessExpenses)}</p>
          </div>

          <div className="bg-slate-900 dark:bg-slate-950 p-3.5 sm:p-5 rounded-2xl shadow-lg border border-slate-800 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-1">
              <p className="text-[9px] sm:text-xs font-black text-slate-400 uppercase tracking-wider">Balanço Empresarial</p>
              <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold ${bBalance >= 0 ? 'bg-emerald-950 text-emerald-400' : 'bg-rose-950 text-rose-400'}`}>
                {bBalance >= 0 ? '✓' : '!'}
              </div>
            </div>
            <p className={`text-base sm:text-xl font-black truncate tabular-nums ${bBalance >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{formatCurrency(bBalance)}</p>
          </div>

          {boletosAVencerCard}
          {boletosVencidosCard}
        </div>
      );
    }

    // Se AMBOS estiverem ativos (Visão Completa Consolidada):
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4 mb-6 sm:mb-8">
        {/* Se houver boleto vencendo HOJE, o card de Boletos a Vencer assume o 1º lugar */}
        {dueTodayCount > 0 && boletosAVencerCard}

        {/* Receita Consolidada */}
        <div className="bg-white dark:bg-slate-900 p-3.5 sm:p-5 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 flex flex-col justify-between relative overflow-hidden group">
          <div className="flex items-center justify-between mb-1">
            <p className="text-[9px] sm:text-xs font-black text-slate-400 dark:text-slate-400 uppercase tracking-wider">Receita Consolidada</p>
            <div className="w-6 h-6 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 flex items-center justify-center text-emerald-500 dark:text-emerald-400 text-xs font-bold">
              📊
            </div>
          </div>
          <p className="text-base sm:text-xl font-black text-emerald-600 dark:text-emerald-400 truncate tabular-nums">
            {formatCurrency(income)}
          </p>
        </div>

        {/* Entrada Gestão Pessoal */}
        <div className="bg-white dark:bg-slate-900 p-3.5 sm:p-5 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 flex flex-col justify-between relative overflow-hidden group">
          <div className="flex items-center justify-between mb-1">
            <p className="text-[9px] sm:text-xs font-black text-slate-400 dark:text-slate-400 uppercase tracking-wider">Entrada Gestão Pessoal</p>
            <div className="w-6 h-6 rounded-lg bg-blue-50 dark:bg-blue-950/60 flex items-center justify-center text-blue-500 dark:text-blue-400 text-xs font-bold">
              👤
            </div>
          </div>
          <p className="text-base sm:text-xl font-black text-blue-600 dark:text-blue-400 truncate tabular-nums">
            {formatCurrency(personalIncome)}
          </p>
        </div>

        {/* Entrada Gestão Empresarial */}
        <div className="bg-white dark:bg-slate-900 p-3.5 sm:p-5 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 flex flex-col justify-between relative overflow-hidden group">
          <div className="flex items-center justify-between mb-1">
            <p className="text-[9px] sm:text-xs font-black text-slate-400 dark:text-slate-400 uppercase tracking-wider">Entrada Gestão Empresarial</p>
            <div className="w-6 h-6 rounded-lg bg-teal-50 dark:bg-teal-950/60 flex items-center justify-center text-teal-500 dark:text-teal-400 text-xs font-bold">
              🏢
            </div>
          </div>
          <p className="text-base sm:text-xl font-black text-teal-600 dark:text-teal-400 truncate tabular-nums">
            {formatCurrency(businessIncome)}
          </p>
        </div>

        {/* Saída Consolidada */}
        <div className="bg-white dark:bg-slate-900 p-3.5 sm:p-5 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 flex flex-col justify-between relative overflow-hidden group">
          <div className="flex items-center justify-between mb-1">
            <p className="text-[9px] sm:text-xs font-black text-slate-400 dark:text-slate-400 uppercase tracking-wider">Saída Consolidada</p>
            <div className="w-6 h-6 rounded-lg bg-rose-50 dark:bg-rose-950/60 flex items-center justify-center text-rose-500 dark:text-rose-400 text-xs font-bold">
              ↑
            </div>
          </div>
          <p className="text-base sm:text-xl font-black text-rose-600 dark:text-rose-400 truncate tabular-nums">
            {formatCurrency(expenses)}
          </p>
        </div>

        {/* Despesas Pessoais */}
        <div className="bg-white dark:bg-slate-900 p-3.5 sm:p-5 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 flex flex-col justify-between relative overflow-hidden group">
          <div className="flex items-center justify-between mb-1">
            <p className="text-[9px] sm:text-xs font-black text-slate-400 dark:text-slate-400 uppercase tracking-wider">Despesas Pessoais</p>
            <div className="w-6 h-6 rounded-lg bg-amber-50 dark:bg-amber-950/60 flex items-center justify-center text-amber-500 dark:text-amber-400 text-xs font-bold">
              🏠
            </div>
          </div>
          <p className="text-base sm:text-xl font-black text-amber-600 dark:text-amber-400 truncate tabular-nums">
            {formatCurrency(personalExpenses)}
          </p>
        </div>

        {/* Despesas Empresariais */}
        <div className="bg-white dark:bg-slate-900 p-3.5 sm:p-5 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 flex flex-col justify-between relative overflow-hidden group">
          <div className="flex items-center justify-between mb-1">
            <p className="text-[9px] sm:text-xs font-black text-slate-400 dark:text-slate-400 uppercase tracking-wider">Despesas Empresariais</p>
            <div className="w-6 h-6 rounded-lg bg-red-50 dark:bg-red-950/60 flex items-center justify-center text-red-500 dark:text-red-400 text-xs font-bold">
              💼
            </div>
          </div>
          <p className="text-base sm:text-xl font-black text-red-600 dark:text-red-400 truncate tabular-nums">
            {formatCurrency(businessExpenses)}
          </p>
        </div>

        {/* Pró-labore Mensal */}
        <div className="bg-white dark:bg-slate-900 p-3.5 sm:p-5 rounded-2xl shadow-sm border border-[#F26522]/20 dark:border-[#F26522]/20 flex flex-col justify-between relative overflow-hidden group">
          <div className="flex items-center justify-between mb-1">
            <p className="text-[9px] sm:text-xs font-black text-slate-400 dark:text-slate-400 uppercase tracking-wider">Pró-labore Mensal</p>
            <div className="w-6 h-6 rounded-lg bg-[#F26522]/10 dark:bg-[#F26522]/20 flex items-center justify-center text-[#F26522] text-xs font-bold">
              💵
            </div>
          </div>
          <p className="text-base sm:text-xl font-black text-[#F26522] dark:text-[#F26522] truncate tabular-nums">
            {formatCurrency(proLaboreMonth)}
          </p>
        </div>

        {/* Pró-labore Anual */}
        <div className="bg-white dark:bg-slate-900 p-3.5 sm:p-5 rounded-2xl shadow-sm border border-[#F26522]/20 dark:border-[#F26522]/20 flex flex-col justify-between relative overflow-hidden group">
          <div className="flex items-center justify-between mb-1">
            <p className="text-[9px] sm:text-xs font-black text-slate-400 dark:text-slate-400 uppercase tracking-wider">Pró-labore Anual</p>
            <div className="w-6 h-6 rounded-lg bg-[#F26522]/10 dark:bg-[#F26522]/20 flex items-center justify-center text-[#F26522] text-xs font-bold">
              🗓️
            </div>
          </div>
          <p className="text-base sm:text-xl font-black text-[#F26522] dark:text-[#F26522] truncate tabular-nums">
            {formatCurrency(proLaboreYear)}
          </p>
        </div>

        {/* Se NÃO houver boleto vencendo HOJE, o card fica na sua posição de origem normal */}
        {dueTodayCount === 0 && boletosAVencerCard}

        {/* Boletos Vencidos (Alerta Vencidos) */}
        {boletosVencidosCard}
      </div>
    );
  }

  // Abas Gestão Pessoal / Empresarial
  const canShowProLabore = showProLabore && showBusiness;

  let cardCount = 2;
  if (showBalance) cardCount += 1;
  if (canShowProLabore) cardCount += 2;

  let gridColsClass = "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5";
  if (cardCount === 3) {
    gridColsClass = "grid-cols-1 sm:grid-cols-3";
  } else if (cardCount === 4) {
    gridColsClass = "grid-cols-2 sm:grid-cols-4";
  }

  return (
    <div className={`grid ${gridColsClass} gap-3 sm:gap-4 mb-6 sm:mb-8`}>
      {/* Entradas */}
      <div className="bg-white dark:bg-slate-900 p-3.5 sm:p-5 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 flex flex-col justify-between relative overflow-hidden group">
        <div className="flex items-center justify-between mb-1">
          <p className="text-[9px] sm:text-xs font-black text-slate-400 dark:text-slate-400 uppercase tracking-wider">Entradas</p>
          <div className="w-6 h-6 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 flex items-center justify-center text-emerald-500 dark:text-emerald-400 text-xs font-bold">
            ↓
          </div>
        </div>
        <p className="text-base sm:text-xl font-black text-emerald-600 dark:text-emerald-400 truncate tabular-nums">
          {formatCurrency(income)}
        </p>
      </div>

      {/* Saídas */}
      <div className="bg-white dark:bg-slate-900 p-3.5 sm:p-5 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 flex flex-col justify-between relative overflow-hidden group">
        <div className="flex items-center justify-between mb-1">
          <p className="text-[9px] sm:text-xs font-black text-slate-400 dark:text-slate-400 uppercase tracking-wider">Saídas</p>
          <div className="w-6 h-6 rounded-lg bg-rose-50 dark:bg-rose-950/60 flex items-center justify-center text-rose-500 dark:text-rose-400 text-xs font-bold">
            ↑
          </div>
        </div>
        <p className="text-base sm:text-xl font-black text-rose-600 dark:text-rose-400 truncate tabular-nums">
          {formatCurrency(expenses)}
        </p>
      </div>

      {/* Balanço Líquido */}
      {showBalance && (
        <div className="bg-slate-900 dark:bg-slate-950 p-3.5 sm:p-5 rounded-2xl shadow-lg border border-slate-800 flex flex-col justify-between relative overflow-hidden group col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between mb-1">
            <p className="text-[9px] sm:text-xs font-black text-slate-400 uppercase tracking-wider">Balanço Líquido</p>
            <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold ${balance >= 0 ? 'bg-emerald-950 text-emerald-400' : 'bg-rose-950 text-rose-400'}`}>
              {balance >= 0 ? '✓' : '!'}
            </div>
          </div>
          <p className={`text-base sm:text-xl font-black truncate tabular-nums ${balance >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {formatCurrency(balance)}
          </p>
        </div>
      )}

      {/* Pró-labore Mensal e Anual */}
      {canShowProLabore && (
        <>
          {/* Pró-labore Mensal */}
          <div className="bg-white dark:bg-slate-900 p-3.5 sm:p-5 rounded-2xl shadow-sm border border-[#F26522]/20 dark:border-[#F26522]/20 flex flex-col justify-between relative overflow-hidden group">
            <div className="flex items-center justify-between mb-1">
              <p className="text-[9px] sm:text-xs font-black text-slate-400 dark:text-slate-400 uppercase tracking-wider">Pró-labore Mensal</p>
              <div className="w-6 h-6 rounded-lg bg-[#F26522]/10 dark:bg-[#F26522]/20 flex items-center justify-center text-[#F26522] text-xs font-bold">
                💼
              </div>
            </div>
            <p className="text-base sm:text-xl font-black text-[#F26522] dark:text-[#F26522] truncate tabular-nums">
              {formatCurrency(proLaboreMonth)}
            </p>
          </div>

          {/* Pró-labore Anual */}
          <div className="bg-white dark:bg-slate-900 p-3.5 sm:p-5 rounded-2xl shadow-sm border border-[#F26522]/20 dark:border-[#F26522]/20 flex flex-col justify-between relative overflow-hidden group">
            <div className="flex items-center justify-between mb-1">
              <p className="text-[9px] sm:text-xs font-black text-slate-400 dark:text-slate-400 uppercase tracking-wider">Pró-labore Anual</p>
              <div className="w-6 h-6 rounded-lg bg-[#F26522]/10 dark:bg-[#F26522]/20 flex items-center justify-center text-[#F26522] text-xs font-bold">
                🗓️
              </div>
            </div>
            <p className="text-base sm:text-xl font-black text-[#F26522] dark:text-[#F26522] truncate tabular-nums">
              {formatCurrency(proLaboreYear)}
            </p>
          </div>
        </>
      )}
    </div>
  );
};

