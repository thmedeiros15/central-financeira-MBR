
import React, { useState } from 'react';
import { Transaction, DeleteScope } from '../types';

interface Props {
  transactions: Transaction[];
  onDelete: (id: string, scope?: DeleteScope) => void;
  onEdit: (transaction: Transaction) => void;
  onTogglePaid: (id: string) => void;
}

const getLocalDateParts = (isoString: string) => {
  const date = new Date(isoString);
  return {
    day: date.getUTCDate(),
    month: date.getUTCMonth(),
    year: date.getUTCFullYear()
  };
};

const formatDate = (isoString?: string) => {
  if (!isoString) return '';
  const parts = getLocalDateParts(isoString);
  if (isNaN(parts.day)) return '';
  const day = String(parts.day).padStart(2, '0');
  const month = String(parts.month + 1).padStart(2, '0');
  return `${day}/${month}/${parts.year}`;
};

export const TransactionTable: React.FC<Props> = ({ transactions, onDelete, onEdit, onTogglePaid }) => {
  const [deletingTx, setDeletingTx] = useState<Transaction | null>(null);

  const isOverdue = (t: Transaction) => {
    if (t.paid || !t.dueDay) return false;
    const today = new Date();
    const todayNum = today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate();
    
    const parts = getLocalDateParts(t.date);
    const targetDay = t.dueDay || parts.day;
    const targetNum = parts.year * 10000 + (parts.month + 1) * 100 + targetDay;
    
    return todayNum >= targetNum;
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 overflow-hidden">
      {/* Desktop View */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-left">
          <thead className="bg-gray-50 dark:bg-slate-800/80 border-b border-gray-100 dark:border-slate-800 text-[10px] uppercase font-black text-gray-400 dark:text-slate-400 tracking-widest">
            <tr>
              <th className="px-6 py-4">Data / Status</th>
              <th className="px-6 py-4">Descrição / Status</th>
              <th className="px-6 py-4">Categoria</th>
              <th className="px-6 py-4">Valor</th>
              <th className="px-6 py-4 text-center">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-slate-800/80">
            {transactions.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <span className="text-3xl grayscale opacity-30">📂</span>
                    <p className="text-xs font-bold text-gray-300 dark:text-slate-600 uppercase tracking-widest">Nenhum registro encontrado</p>
                  </div>
                </td>
              </tr>
            ) : (
              transactions.map((t) => (
                <tr key={t.id} className="group hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-bold text-slate-400 dark:text-slate-400 tabular-nums">
                          {formatDate(t.date)}
                        </span>
                        {isOverdue(t) && (
                          <span className="text-rose-500 animate-pulse" title="Pagamento Pendente / Vencido">
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {t.isFixed && (
                          <span className="bg-[#F26522]/10 dark:bg-[#F26522]/20 text-[#F26522] text-[7px] font-black px-1.5 py-0.5 rounded uppercase tracking-tighter border border-[#F26522]/20">Fixo</span>
                        )}
                        {t.dueDay && (
                          <span className="bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-[7px] font-black px-1.5 py-0.5 rounded uppercase tracking-tighter">Vence dia {t.dueDay}</span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-2">
                      <div>
                        <p className="text-xs font-black text-slate-800 dark:text-slate-100 uppercase tracking-tight truncate max-w-[200px]">
                          {t.description}
                        </p>
                        {t.installments && (
                          <p className="text-[9px] font-bold text-amber-600 dark:text-amber-400 mt-0.5 flex items-center gap-1">
                            <span className="text-[11px]">📦</span> Parcela {String(t.installments.current).padStart(2, '0')} de {String(t.installments.total).padStart(2, '0')}
                          </p>
                        )}
                      </div>
                      {(t.dueDay !== undefined || t.isFixed || t.installments) && (
                        <button 
                          onClick={() => onTogglePaid(t.id)}
                          className={`w-fit px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest transition-all ${
                            t.paid 
                              ? 'bg-emerald-500 text-white shadow-sm shadow-emerald-100 dark:shadow-none' 
                              : 'bg-rose-500 text-white shadow-sm shadow-rose-100 dark:shadow-none'
                          }`}
                        >
                          {t.paid ? '✓ Pago' : '✕ Não Pago'}
                        </button>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-2">
                      <span className={`w-fit px-2.5 py-1 text-[9px] font-black rounded-lg uppercase tracking-wider ${
                        t.module === 'PERSONAL' 
                          ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400' 
                          : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400'
                      }`}>
                        {t.category}
                      </span>
                      {t.paid && t.paymentDate && (
                        <div className="flex flex-col">
                          <span className="text-[8px] font-black text-slate-400 uppercase tracking-tighter">Pago em:</span>
                          <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                            {formatDate(t.paymentDate)}
                          </span>
                        </div>
                      )}
                    </div>
                  </td>
                  <td className={`px-6 py-4 text-xs font-black tabular-nums ${t.type === 'INCOME' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                    {t.type === 'INCOME' ? '▲' : '▼'} {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(t.amount)}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button 
                        onClick={() => onEdit(t)}
                        className="opacity-0 group-hover:opacity-100 transition-all p-2 text-slate-300 dark:text-slate-500 hover:text-indigo-500 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 rounded-lg"
                        title="Editar este item"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                      </button>
                      <button 
                        onClick={() => setDeletingTx(t)}
                        className="opacity-0 group-hover:opacity-100 transition-all p-2 text-slate-300 dark:text-slate-500 hover:text-rose-500 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-lg"
                        title="Remover este item"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile View */}
      <div className="md:hidden divide-y divide-gray-100 dark:divide-slate-800">
        {transactions.length === 0 ? (
          <div className="p-8 text-center">
            <div className="flex flex-col items-center gap-2">
              <span className="text-3xl grayscale opacity-30">📂</span>
              <p className="text-xs font-bold text-gray-300 dark:text-slate-600 uppercase tracking-widest">Nenhum registro encontrado</p>
            </div>
          </div>
        ) : (
          transactions.map((t) => (
            <div key={t.id} className="p-4 flex flex-col gap-3 hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
              {/* Top row: Description & Value */}
              <div className="flex justify-between items-start gap-2">
                <div className="flex flex-col">
                  <p className="text-xs font-black text-slate-800 dark:text-slate-100 uppercase tracking-tight">
                    {t.description}
                  </p>
                  {t.installments && (
                    <p className="text-[9px] font-bold text-amber-600 dark:text-amber-400 mt-0.5 flex items-center gap-1">
                      <span className="text-[11px]">📦</span> Parcela {String(t.installments.current).padStart(2, '0')} de {String(t.installments.total).padStart(2, '0')}
                    </p>
                  )}
                </div>
                <div className={`text-xs font-black tabular-nums whitespace-nowrap ${t.type === 'INCOME' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                  {t.type === 'INCOME' ? '▲' : '▼'} {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(t.amount)}
                </div>
              </div>

              {/* Middle row: Category, Date, Status */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-1 text-[8px] font-black rounded-md uppercase tracking-wider ${
                    t.module === 'PERSONAL' ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400' : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400'
                  }`}>
                    {t.category}
                  </span>
                  <div className="flex items-center gap-1">
                    <span className="text-[9px] font-bold text-slate-400 tabular-nums">
                      {formatDate(t.date)}
                    </span>
                    {isOverdue(t) && (
                      <span className="text-rose-500 animate-pulse" title="Pagamento Pendente / Vencido">
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                      </span>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  {(t.dueDay !== undefined || t.isFixed || t.installments) && (
                    <button 
                      onClick={() => onTogglePaid(t.id)}
                      className={`px-2.5 py-1 rounded-full text-[8px] font-black uppercase tracking-widest transition-all ${
                        t.paid 
                          ? 'bg-emerald-500 text-white shadow-sm shadow-emerald-100 dark:shadow-none' 
                          : 'bg-rose-500 text-white shadow-sm shadow-rose-100 dark:shadow-none'
                      }`}
                    >
                      {t.paid ? '✓ Pago' : '✕ Não Pago'}
                    </button>
                  )}
                </div>
              </div>

              {/* Bottom row: Payment Date, Actions */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-50 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  {t.paid && t.paymentDate && (
                    <div className="flex items-center gap-1">
                      <span className="text-[8px] font-black text-slate-400 uppercase tracking-tighter">Pago em:</span>
                      <span className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                        {formatDate(t.paymentDate)}
                      </span>
                    </div>
                  )}
                  {t.isFixed && (
                    <span className="bg-indigo-50 dark:bg-indigo-950/60 text-indigo-500 dark:text-indigo-400 text-[7px] font-black px-1.5 py-0.5 rounded uppercase tracking-tighter">Fixo</span>
                  )}
                </div>
                
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-3">
                    <button onClick={() => onEdit(t)} className="text-slate-400 dark:text-slate-500 hover:text-indigo-500 dark:hover:text-indigo-400 p-1">
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    </button>
                    <button onClick={() => setDeletingTx(t)} className="text-slate-400 dark:text-slate-500 hover:text-rose-500 dark:hover:text-rose-400 p-1">
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal De exclusão inteligente */}
      {deletingTx && (
        <div className="fixed inset-0 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-xs z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-7 max-w-md w-full border border-slate-100 dark:border-slate-800 shadow-2xl space-y-5 animate-in zoom-in-95 duration-200">
            
            {/* Header */}
            <div className="flex items-start gap-3.5">
              <div className="p-3 bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 rounded-2xl flex-shrink-0">
                <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
                  <line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/>
                </svg>
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-slate-100 uppercase tracking-tight">
                  {deletingTx.installments 
                    ? 'Excluir Conta Parcelada' 
                    : deletingTx.isFixed 
                      ? 'Excluir Conta Fixa' 
                      : 'Excluir Lançamento'}
                </h3>
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-0.5">
                  {deletingTx.installments 
                    ? 'Atenção: Este lançamento possui parcelamento.' 
                    : deletingTx.isFixed 
                      ? 'Atenção: Esta é uma conta recorrente/fixa.' 
                      : 'Confirmar a remoção do registro.'}
                </p>
              </div>
            </div>

            {/* Target Transaction Card Summary */}
            <div className="bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-2xl border border-slate-100 dark:border-slate-700/80 flex flex-col gap-1.5">
              <div className="flex justify-between items-center">
                <span className="text-xs font-black text-slate-800 dark:text-slate-100 uppercase">
                  {deletingTx.description}
                </span>
                <span className={`text-xs font-black tabular-nums ${deletingTx.type === 'INCOME' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                  {deletingTx.type === 'INCOME' ? '▲' : '▼'} {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(deletingTx.amount)}
                </span>
              </div>
              <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 dark:text-slate-400">
                <span>{deletingTx.category}</span>
                <span>•</span>
                <span>{formatDate(deletingTx.date)}</span>
                {deletingTx.installments && (
                  <span className="ml-auto bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 font-black px-2 py-0.5 rounded-md text-[9px]">
                    Parcela {String(deletingTx.installments.current).padStart(2, '0')} de {String(deletingTx.installments.total).padStart(2, '0')}
                  </span>
                )}
                {deletingTx.isFixed && (
                  <span className="ml-auto bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 font-black px-2 py-0.5 rounded-md text-[9px]">
                    Fixo
                  </span>
                )}
              </div>
            </div>

            {/* Decision Options */}
            <div className="space-y-2.5">
              {deletingTx.installments ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      onDelete(deletingTx.id, 'SINGLE');
                      setDeletingTx(null);
                    }}
                    className="w-full text-left p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 transition-all group"
                  >
                    <div className="text-xs font-black text-slate-800 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
                      1. Excluir Apenas esta Parcela ({deletingTx.installments.current}/{deletingTx.installments.total})
                    </div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                      Remove somente o lançamento do mês selecionado. As outras parcelas continuam salvas.
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      onDelete(deletingTx.id, 'THIS_AND_FUTURE_INSTALLMENTS');
                      setDeletingTx(null);
                    }}
                    className="w-full text-left p-3.5 rounded-2xl bg-amber-50/60 dark:bg-amber-950/30 hover:bg-amber-100/80 dark:hover:bg-amber-950/60 border border-amber-200 dark:border-amber-800/60 transition-all group"
                  >
                    <div className="text-xs font-black text-amber-900 dark:text-amber-200 group-hover:text-amber-700 dark:group-hover:text-amber-100">
                      2. Excluir Esta e as Parcelas Seguintes ({deletingTx.installments.current} a {deletingTx.installments.total})
                    </div>
                    <div className="text-[10px] text-amber-700 dark:text-amber-300 font-medium mt-0.5">
                      Remove a parcela atual e cancela automaticamente todas as parcelas dos meses futuros.
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      onDelete(deletingTx.id, 'ALL_INSTALLMENTS');
                      setDeletingTx(null);
                    }}
                    className="w-full text-left p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-950/80 border border-rose-200 dark:border-rose-800/80 transition-all group"
                  >
                    <div className="text-xs font-black text-rose-800 dark:text-rose-200 group-hover:text-rose-600 dark:group-hover:text-rose-100">
                      3. Excluir TODAS as Parcelas do Parcelamento
                    </div>
                    <div className="text-[10px] text-rose-600 dark:text-rose-300 font-medium mt-0.5">
                      Exclui o parcelamento completo (todas as {deletingTx.installments.total} parcelas passadas, atuais e futuras).
                    </div>
                  </button>
                </>
              ) : deletingTx.isFixed ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      onDelete(deletingTx.id, 'SINGLE');
                      setDeletingTx(null);
                    }}
                    className="w-full text-left p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 transition-all group"
                  >
                    <div className="text-xs font-black text-slate-800 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
                      1. Excluir Apenas a Cobrança deste Mês
                    </div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                      Remove somente este mês. A conta continuará ativa e sendo cobrada nos meses seguintes.
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      onDelete(deletingTx.id, 'FUTURE_FIXED');
                      setDeletingTx(null);
                    }}
                    className="w-full text-left p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-950/80 border border-rose-200 dark:border-rose-800/80 transition-all group"
                  >
                    <div className="text-xs font-black text-rose-800 dark:text-rose-200 group-hover:text-rose-600 dark:group-hover:text-rose-100">
                      2. Excluir Esta e as Cobranças dos Meses Seguintes
                    </div>
                    <div className="text-[10px] text-rose-600 dark:text-rose-300 font-medium mt-0.5">
                      Remove este mês e cancela/encerra as cobranças fixas para todos os meses futuros.
                    </div>
                  </button>
                </>
              ) : (
                <div className="space-y-3 pt-1">
                  <p className="text-xs text-slate-600 dark:text-slate-300 font-medium">
                    Tem certeza de que deseja remover este lançamento do seu fluxo de caixa?
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      onDelete(deletingTx.id, 'SINGLE');
                      setDeletingTx(null);
                    }}
                    className="w-full py-3 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-black text-xs uppercase tracking-wider transition-all shadow-md shadow-rose-200 dark:shadow-none"
                  >
                    Sim, Excluir Lançamento
                  </button>
                </div>
              )}
            </div>

            {/* Cancel Button */}
            <div className="pt-1">
              <button
                type="button"
                onClick={() => setDeletingTx(null)}
                className="w-full py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold text-xs transition-all"
              >
                Cancelar
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
};
