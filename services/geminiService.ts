import { GoogleGenAI, Type } from "@google/genai";
import { Transaction, AIAnalysisResponse, AnalysisParams } from "../types";
import { getLocalDateParts } from "../utils/dateUtils";

const getAIClient = () => {
  const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY || '';
  return new GoogleGenAI({ apiKey: apiKey || 'DUMMY_KEY' });
};

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

interface Totals {
  income: number;
  expenses: number;
  balance: number;
  margin: number;
  proLabore: number;
  businessIncome: number;
  personalIncome: number;
  businessExpenses: number;
  personalExpenses: number;
  categories: Array<{ category: string; amount: number; pct: number }>;
  count: number;
}

const calcTotals = (txs: Transaction[]): Totals => {
  const income = txs.filter(t => t.type === 'INCOME').reduce((s, t) => s + t.amount, 0);
  const expenses = txs.filter(t => t.type === 'EXPENSE').reduce((s, t) => s + t.amount, 0);
  const balance = income - expenses;
  const margin = income > 0 ? (balance / income) * 100 : 0;

  const proLabore = txs.filter(t =>
    t.category.toLowerCase().includes('pró-labore') ||
    t.category.toLowerCase().includes('pro-labore') ||
    t.category.toLowerCase().includes('retirada') ||
    t.description.toLowerCase().includes('pró-labore') ||
    t.description.toLowerCase().includes('pro-labore') ||
    t.description.toLowerCase().includes('retirada')
  ).reduce((s, t) => s + t.amount, 0);

  const businessIncome = txs.filter(t => t.module === 'BUSINESS' && t.type === 'INCOME').reduce((s, t) => s + t.amount, 0);
  const personalIncome = txs.filter(t => t.module === 'PERSONAL' && t.type === 'INCOME').reduce((s, t) => s + t.amount, 0);
  const businessExpenses = txs.filter(t => t.module === 'BUSINESS' && t.type === 'EXPENSE').reduce((s, t) => s + t.amount, 0);
  const personalExpenses = txs.filter(t => t.module === 'PERSONAL' && t.type === 'EXPENSE').reduce((s, t) => s + t.amount, 0);

  const categoryMap: Record<string, number> = {};
  txs.filter(t => t.type === 'EXPENSE').forEach(t => {
    categoryMap[t.category] = (categoryMap[t.category] || 0) + t.amount;
  });

  const sortedCategories = Object.entries(categoryMap)
    .map(([category, amount]) => ({ category, amount, pct: expenses > 0 ? (amount / expenses) * 100 : 0 }))
    .sort((a, b) => b.amount - a.amount);

  return {
    income,
    expenses,
    balance,
    margin,
    proLabore,
    businessIncome,
    personalIncome,
    businessExpenses,
    personalExpenses,
    categories: sortedCategories,
    count: txs.length
  };
};

export const analyzeFinancials = async (
  transactions: Transaction[],
  params?: Partial<AnalysisParams>
): Promise<AIAnalysisResponse> => {
  const now = new Date();
  const currentY = now.getFullYear();
  const fullParams: AnalysisParams = {
    scope: params?.scope || 'CONSOLIDATED',
    periodType: params?.periodType || 'SINGLE_MONTH',
    month: params?.month !== undefined ? params.month : now.getMonth(),
    selectedMonths: params?.selectedMonths && params.selectedMonths.length > 0 ? params.selectedMonths : [now.getMonth()],
    startMonth: params?.startMonth !== undefined ? params.startMonth : 0,
    endMonth: params?.endMonth !== undefined ? params.endMonth : now.getMonth(),
    year: params?.year !== undefined ? params.year : currentY,
    selectedYears: params?.selectedYears && params.selectedYears.length > 0 ? params.selectedYears : [currentY - 1, currentY],
  };

  // 1. Filtrar transações pelo Âmbito/Escopo (PERSONAL, BUSINESS ou CONSOLIDATED)
  const scopeTransactions = transactions.filter(t => {
    if (fullParams.scope === 'PERSONAL') return t.module === 'PERSONAL';
    if (fullParams.scope === 'BUSINESS') return t.module === 'BUSINESS';
    return true; // CONSOLIDATED
  });

  // 2. Filtrar transações do Período Selecionado
  const currentPeriodTransactions = scopeTransactions.filter(t => {
    const parts = getLocalDateParts(t.date);

    if (fullParams.periodType === 'MULTIPLE_YEARS') {
      return fullParams.selectedYears.includes(parts.year);
    }

    if (parts.year !== fullParams.year) return false;

    if (fullParams.periodType === 'SINGLE_MONTH') {
      return parts.month === fullParams.month;
    } else if (fullParams.periodType === 'MULTIPLE_MONTHS') {
      return fullParams.selectedMonths.includes(parts.month);
    } else if (fullParams.periodType === 'MONTH_RANGE') {
      const minM = Math.min(fullParams.startMonth, fullParams.endMonth);
      const maxM = Math.max(fullParams.startMonth, fullParams.endMonth);
      return parts.month >= minM && parts.month <= maxM;
    } else {
      // YEAR (Ano Único)
      return true;
    }
  });

  const currentTotals = calcTotals(currentPeriodTransactions);

  // 3. Métricas e Comparações Históricas Calculadas
  let historicalComparisonContext = '';

  if (fullParams.periodType === 'SINGLE_MONTH') {
    const m = fullParams.month;
    const y = fullParams.year;

    // Mês Anterior
    const prevM = m === 0 ? 11 : m - 1;
    const prevMY = m === 0 ? y - 1 : y;
    const prevMonthTxs = scopeTransactions.filter(t => {
      const p = getLocalDateParts(t.date);
      return p.month === prevM && p.year === prevMY;
    });
    const prevMonthTotals = calcTotals(prevMonthTxs);

    // Variação vs Mês Anterior
    const incomeDiffPrev = currentTotals.income - prevMonthTotals.income;
    const incomePctPrev = prevMonthTotals.income > 0 ? (incomeDiffPrev / prevMonthTotals.income) * 100 : 0;
    const expDiffPrev = currentTotals.expenses - prevMonthTotals.expenses;
    const expPctPrev = prevMonthTotals.expenses > 0 ? (expDiffPrev / prevMonthTotals.expenses) * 100 : 0;
    const marginDiffPrev = currentTotals.margin - prevMonthTotals.margin;

    // Mesmo Mês do Ano Anterior
    const sameMonthPrevYearTxs = scopeTransactions.filter(t => {
      const p = getLocalDateParts(t.date);
      return p.month === m && p.year === y - 1;
    });
    const sameMonthPrevYearTotals = calcTotals(sameMonthPrevYearTxs);

    const incomeDiffYoY = currentTotals.income - sameMonthPrevYearTotals.income;
    const incomePctYoY = sameMonthPrevYearTotals.income > 0 ? (incomeDiffYoY / sameMonthPrevYearTotals.income) * 100 : 0;
    const expDiffYoY = currentTotals.expenses - sameMonthPrevYearTotals.expenses;

    // Acumulado do Ano Atual vs Ano Anterior
    const ytdTxs = scopeTransactions.filter(t => {
      const p = getLocalDateParts(t.date);
      return p.year === y && p.month <= m;
    });
    const ytdTotals = calcTotals(ytdTxs);

    const prevYtdTxs = scopeTransactions.filter(t => {
      const p = getLocalDateParts(t.date);
      return p.year === y - 1 && p.month <= m;
    });
    const prevYtdTotals = calcTotals(prevYtdTxs);

    historicalComparisonContext = `
      COMPARATIVOS HISTÓRICOS CALCULADOS PELO SISTEMA:
      - VS MÊS ANTERIOR (${MONTH_NAMES[prevM]}/${prevMY}):
        • Receita Mês Anterior: R$ ${prevMonthTotals.income.toFixed(2)} -> Variação: ${incomeDiffPrev >= 0 ? '+' : ''}R$ ${incomeDiffPrev.toFixed(2)} (${incomePctPrev.toFixed(1)}%)
        • Despesas Mês Anterior: R$ ${prevMonthTotals.expenses.toFixed(2)} -> Variação: ${expDiffPrev >= 0 ? '+' : ''}R$ ${expDiffPrev.toFixed(2)} (${expPctPrev.toFixed(1)}%)
        • Margem de Lucro Mês Anterior: ${prevMonthTotals.margin.toFixed(1)}% -> Variação na Margem: ${marginDiffPrev >= 0 ? '+' : ''}${marginDiffPrev.toFixed(1)} p.p.
        • Saldo Mês Anterior: R$ ${prevMonthTotals.balance.toFixed(2)} (Saldo Atual: R$ ${currentTotals.balance.toFixed(2)})

      - VS MESMO MÊS DO ANO ANTERIOR (${MONTH_NAMES[m]}/${y - 1}):
        • Receita Ano Anterior: R$ ${sameMonthPrevYearTotals.income.toFixed(2)} -> Variação YoY: ${incomeDiffYoY >= 0 ? '+' : ''}R$ ${incomeDiffYoY.toFixed(2)} (${incomePctYoY.toFixed(1)}%)
        • Despesas Ano Anterior: R$ ${sameMonthPrevYearTotals.expenses.toFixed(2)} -> Variação YoY: ${expDiffYoY >= 0 ? '+' : ''}R$ ${expDiffYoY.toFixed(2)}

      - ACUMULADO ANUAL ATÉ O MÊS ATUAL (YTD ${y} vs YTD ${y - 1}):
        • Acumulado ${y}: Receita R$ ${ytdTotals.income.toFixed(2)} | Despesas R$ ${ytdTotals.expenses.toFixed(2)} | Saldo R$ ${ytdTotals.balance.toFixed(2)}
        • Acumulado ${y - 1}: Receita R$ ${prevYtdTotals.income.toFixed(2)} | Despesas R$ ${prevYtdTotals.expenses.toFixed(2)} | Saldo R$ ${prevYtdTotals.balance.toFixed(2)}
    `;
  } else if (fullParams.periodType === 'YEAR') {
    const y = fullParams.year;
    const prevYearTxs = scopeTransactions.filter(t => getLocalDateParts(t.date).year === y - 1);
    const prevYearTotals = calcTotals(prevYearTxs);

    const incomeDiffYoY = currentTotals.income - prevYearTotals.income;
    const incomePctYoY = prevYearTotals.income > 0 ? (incomeDiffYoY / prevYearTotals.income) * 100 : 0;
    const expDiffYoY = currentTotals.expenses - prevYearTotals.expenses;

    historicalComparisonContext = `
      COMPARATIVO HISTÓRICO COM O ANO ANTERIOR (${y - 1}):
      - Receita ${y - 1}: R$ ${prevYearTotals.income.toFixed(2)} -> Variação: ${incomeDiffYoY >= 0 ? '+' : ''}R$ ${incomeDiffYoY.toFixed(2)} (${incomePctYoY.toFixed(1)}%)
      - Despesas ${y - 1}: R$ ${prevYearTotals.expenses.toFixed(2)} -> Variação: ${expDiffYoY >= 0 ? '+' : ''}R$ ${expDiffYoY.toFixed(2)}
      - Saldo ${y - 1}: R$ ${prevYearTotals.balance.toFixed(2)} (Saldo Atual: R$ ${currentTotals.balance.toFixed(2)})
    `;
  } else if (fullParams.periodType === 'MULTIPLE_YEARS') {
    const yearlyBreakdown: Record<number, Totals> = {};
    fullParams.selectedYears.forEach(y => {
      const txs = scopeTransactions.filter(t => getLocalDateParts(t.date).year === y);
      yearlyBreakdown[y] = calcTotals(txs);
    });

    historicalComparisonContext = `
      COMPARATIVO DETALHADO ANO A ANO:
      ${JSON.stringify(yearlyBreakdown, null, 2)}
    `;
  }

  // 4. Detalhamento mensal para identificação do melhor/pior mês e tendências
  const monthlyBreakdown: Record<string, Totals> = {};
  currentPeriodTransactions.forEach(t => {
    const parts = getLocalDateParts(t.date);
    const key = `${MONTH_NAMES[parts.month]}/${parts.year}`;
    if (!monthlyBreakdown[key]) {
      monthlyBreakdown[key] = {
        income: 0, expenses: 0, balance: 0, margin: 0, proLabore: 0,
        businessIncome: 0, personalIncome: 0, businessExpenses: 0, personalExpenses: 0,
        categories: [], count: 0
      };
    }
    monthlyBreakdown[key].count += 1;
    if (t.type === 'INCOME') monthlyBreakdown[key].income += t.amount;
    if (t.type === 'EXPENSE') monthlyBreakdown[key].expenses += t.amount;
    monthlyBreakdown[key].balance = monthlyBreakdown[key].income - monthlyBreakdown[key].expenses;
    monthlyBreakdown[key].margin = monthlyBreakdown[key].income > 0 ? (monthlyBreakdown[key].balance / monthlyBreakdown[key].income) * 100 : 0;
  });

  const moduleLabel =
    fullParams.scope === 'PERSONAL' ? 'Somente Gestão Pessoal' :
    fullParams.scope === 'BUSINESS' ? 'Somente Gestão Empresarial' :
    'Consolidado (Gestão Pessoal + Empresarial)';

  let periodLabel = '';
  if (fullParams.periodType === 'SINGLE_MONTH') {
    periodLabel = `${MONTH_NAMES[fullParams.month]} / ${fullParams.year}`;
  } else if (fullParams.periodType === 'MULTIPLE_MONTHS') {
    const sortedM = [...fullParams.selectedMonths].sort((a, b) => a - b);
    periodLabel = `Comparativo dos meses: ${sortedM.map(m => MONTH_NAMES[m]).join(', ')} (${fullParams.year})`;
  } else if (fullParams.periodType === 'MONTH_RANGE') {
    const minM = Math.min(fullParams.startMonth, fullParams.endMonth);
    const maxM = Math.max(fullParams.startMonth, fullParams.endMonth);
    periodLabel = `Intervalo de ${MONTH_NAMES[minM]} a ${MONTH_NAMES[maxM]} de ${fullParams.year}`;
  } else if (fullParams.periodType === 'MULTIPLE_YEARS') {
    const sortedY = [...fullParams.selectedYears].sort((a, b) => a - b);
    periodLabel = `Comparativo Anual entre os Anos: ${sortedY.join(' vs ')}`;
  } else {
    periodLabel = `Ano Completo de ${fullParams.year}`;
  }

  const prompt = `
    Você é o Consultor Financeiro e Gerencial MBR Intelligence.
    Sua missão é atuar como um gestor financeiro sênior, gerando um diagnóstico executivo com conclusões diretas e de alto valor prático.

    CONFIGURAÇÕES DA ANÁLISE:
    - Âmbito Selecionado: ${moduleLabel}
    - Modalidade de Período: ${fullParams.periodType}
    - Período: ${periodLabel}

    DADOS CONSOLIDADOS DO PERÍODO SELECIONADO:
    - Receita Total: R$ ${currentTotals.income.toFixed(2)}
    - Despesas Totais: R$ ${currentTotals.expenses.toFixed(2)}
    - Resultado Líquido: R$ ${currentTotals.balance.toFixed(2)}
    - Margem de Lucro: ${currentTotals.margin.toFixed(1)}%
    - Pró-labore / Retiradas Identificadas: R$ ${currentTotals.proLabore.toFixed(2)}
    ${fullParams.scope === 'CONSOLIDATED' ? `- Participação Empresarial na Receita: R$ ${currentTotals.businessIncome.toFixed(2)} (${currentTotals.income > 0 ? ((currentTotals.businessIncome / currentTotals.income) * 100).toFixed(1) : 0}%)
    - Participação Pessoal na Receita: R$ ${currentTotals.personalIncome.toFixed(2)} (${currentTotals.income > 0 ? ((currentTotals.personalIncome / currentTotals.income) * 100).toFixed(1) : 0}%)` : ''}
    - Principais Categorias de Despesas no Período:
      ${currentTotals.categories.slice(0, 5).map(c => `• ${c.category}: R$ ${c.amount.toFixed(2)} (${c.pct.toFixed(1)}% das despesas)`).join('\n      ')}

    ${historicalComparisonContext}

    DETALHAMENTO MÊS A MÊS DO PERÍODO:
    ${JSON.stringify(monthlyBreakdown, null, 2)}

    =================================================================================
    REGRA OBRIGATÓRIA DE PRIORIZAÇÃO POR IMPACTO FINANCEIRO (PENSAMENTO DE GESTOR):
    =================================================================================
    Antes de gerar a resposta, CLASSIFIQUE todos os acontecimentos por impacto financeiro real.
    Considere SIMULTANEAMENTE o valor absoluto em Reais (R$) e a variação percentual (%).
    Priorize SEMPRE os 3 acontecimentos de maior impacto para a análise.
    IGNORE variações pequenas, irrisórias ou sem relevância prática para a gestão.

    EXEMPLOS DE RACIOCÍNIO DE PRIORIZAÇÃO:
    - Uma categoria/fornecedor que aumentou R$ 800 merece destaque prioritário em relação a um que aumentou R$ 20, mesmo que a % do segundo seja numericamente maior.
    - Uma queda de faturamento de R$ 3.000 é muito mais relevante do que uma economia secundária de R$ 50.
    - Uma categoria de despesa que representa 35% das despesas totais deve ter prioridade máxima.

    =================================================================================
    REGRAS RÍGIDAS DE ESTILO E FORMATAÇÃO:
    =================================================================================
    1. CADA BLOCO ('insights', 'risks', 'opportunities', 'issues') PODE CONTER NO MÁXIMO 3 OBSERVAÇÕES.
    2. CADA OBSERVAÇÃO DEVE POSSUIR NO MÁXIMO 2 LINHAS DE TEXTO.
    3. Escreva de forma DIRETA, OBJETIVA, TÉCNICA E SEM PROLIXIDADE.
    4. NÃO repetir números brutos já exibidos nos cartões. Focar em variações %, evoluções, tendências e impactos.
    5. Dar preferência absoluta para frases como:
       ✔ "Faturamento caiu 18% em relação ao mês anterior (queda de R$ 3.200)."
       ✔ "Margem de lucro aumentou 6%, atingindo 32%."
       ✔ "Fornecedores representam 42% das despesas totais."
       ✔ "Julho registrou o menor faturamento do semestre."
       EVITAR frases prolixas ou vazias como "O comportamento financeiro evidencia uma tendência de...".
    6. Se os dados estiverem estáveis, sem mudanças significativas, ou se não houver informações suficientes para um determinado bloco, informe exatamente:
       "Nenhuma observação relevante no período."
    7. NUNCA invente dados ou gere recomendações genéricas.

    =================================================================================
    ORIENTAÇÕES ESPECÍFICAS PARA CADA BLOCO:
    =================================================================================

    1. 'financialScore' & 'healthStatus':
       - Score 0 a 100 baseado em: Evolução do faturamento, despesas, resultado líquido, margem de lucro, fluxo financeiro, tendência recente e regularidade.
       - 'healthStatus' aceita APENAS: 'EXCELLENT' (Excelente), 'VERY_GOOD' (Muito Bom), 'HEALTHY' (Saudável), 'WARNING' (Atenção), 'CRITICAL' (Crítico).

    2. 'insights' (MÁXIMO 3 ITENS, máx 2 linhas cada):
       - Acontecimentos de MAIOR IMPACTO FINANCEIRO: Crescimento/queda do faturamento vs mês anterior ou mesmo período do ano anterior, evolução da margem de lucro, melhor/pior mês do ano, participação Empresarial vs Pessoal.

    3. 'risks' (MÁXIMO 3 ITENS, máx 2 linhas cada):
       - Riscos REAIS e classificados por GRAVIDADE (coloque o mais grave primeiro): despesas superiores à receita, queda relevante de faturamento, aumento expressivo de custos, margem reduzida, resultado negativo, concentração excessiva de despesas.

    4. 'opportunities' (MÁXIMO 3 ITENS, máx 2 linhas cada):
       - Sugestões práticas JUSTIFICADAS PELOS DADOS: Categoria de despesa que mais cresceu em R$, fornecedor de maior custo, potencial de economia, replicar mês com maior margem, melhor equilíbrio Pessoal vs Empresarial.

    5. 'issues' (DIAGNÓSTICO EXECUTIVO - MÁXIMO 3 ITENS, máx 2 linhas cada):
       - Resumo executivo respondendo especificamente:
         • O negócio está crescendo e lucrativo?
         • O fluxo financeiro está saudável?
         • Qual a principal mudança do período e o principal ponto de atenção imediata?
       - NÃO REPETIR o que já foi dito nos outros blocos.
  `;

  try {
    const ai = getAIClient();
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            insights: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: 'No máximo 3 insights de maior impacto financeiro (máx 2 linhas cada).'
            },
            risks: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: 'No máximo 3 riscos ordenados por gravidade (máx 2 linhas cada).'
            },
            opportunities: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: 'No máximo 3 oportunidades práticas baseadas nos dados (máx 2 linhas cada).'
            },
            issues: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: 'No máximo 3 observações do diagnóstico executivo (máx 2 linhas cada).'
            },
            financialScore: {
              type: Type.INTEGER,
              description: 'Score de 0 a 100.'
            },
            healthStatus: {
              type: Type.STRING,
              description: 'Status: EXCELLENT, VERY_GOOD, HEALTHY, WARNING, CRITICAL'
            }
          },
          required: ["insights", "risks", "opportunities", "issues", "financialScore", "healthStatus"]
        }
      }
    });

    const parsed = JSON.parse(response.text.trim()) as AIAnalysisResponse;

    return {
      insights: (parsed.insights && parsed.insights.length > 0) ? parsed.insights.slice(0, 3) : ["Nenhuma observação relevante no período."],
      risks: (parsed.risks && parsed.risks.length > 0) ? parsed.risks.slice(0, 3) : ["Nenhuma observação relevante no período."],
      opportunities: (parsed.opportunities && parsed.opportunities.length > 0) ? parsed.opportunities.slice(0, 3) : ["Nenhuma observação relevante no período."],
      issues: (parsed.issues && parsed.issues.length > 0) ? parsed.issues.slice(0, 3) : ["Nenhuma observação relevante no período."],
      financialScore: typeof parsed.financialScore === 'number' ? parsed.financialScore : 50,
      healthStatus: parsed.healthStatus || 'HEALTHY'
    };
  } catch (error) {
    console.warn("API de IA indisponível ou cota excedida, gerando diagnóstico baseado em dados reais:", error);
    
    // Gerador de Análise Local Determinística (Fallback Inteligente)
    const income = currentTotals.income || 0;
    const expense = currentTotals.expenses || 0;
    const net = income - expense;
    const margin = income > 0 ? ((net / income) * 100) : 0;

    let score = 50;
    let healthStatus: 'EXCELLENT' | 'VERY_GOOD' | 'HEALTHY' | 'WARNING' | 'CRITICAL' = 'HEALTHY';

    if (income === 0 && expense === 0) {
      score = 50;
      healthStatus = 'HEALTHY';
    } else if (net < 0) {
      score = Math.max(15, Math.round(40 - Math.abs(net / (income || 1)) * 20));
      healthStatus = score < 25 ? 'CRITICAL' : 'WARNING';
    } else if (margin >= 30) {
      score = Math.min(98, Math.round(80 + (margin - 30) * 0.5));
      healthStatus = score > 90 ? 'EXCELLENT' : 'VERY_GOOD';
    } else if (margin >= 10) {
      score = Math.round(65 + (margin - 10) * 0.75);
      healthStatus = 'HEALTHY';
    } else {
      score = 50;
      healthStatus = 'WARNING';
    }

    const formatBRL = (val: number) => 
      new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

    const insights: string[] = [];
    const risks: string[] = [];
    const opportunities: string[] = [];
    const issues: string[] = [];

    if (income > 0 || expense > 0) {
      insights.push(`Entradas totais do período: ${formatBRL(income)} com despesas consolidadas de ${formatBRL(expense)}.`);
      if (margin > 0) {
        insights.push(`Margem operacional líquida positiva calculada em ${margin.toFixed(1)}%.`);
      } else if (net < 0) {
        insights.push(`Resultado líquido deficitário de ${formatBRL(Math.abs(net))} no período analisado.`);
      }
    } else {
      insights.push("Sem movimentações financeiras registradas para este filtro ou período.");
    }

    if (net < 0) {
      risks.push(`Despesas superaram os recebimentos em ${formatBRL(Math.abs(net))}, gerando pressão no fluxo de caixa.`);
    }
    if (income > 0 && (expense / income) > 0.85) {
      risks.push(`Comprometimento elevado das receitas: ${( (expense/income)*100 ).toFixed(0)}% da renda foi direcionada a despesas.`);
    }
    if (risks.length === 0) {
      risks.push("Nenhum risco crítico de alavancagem ou déficit detectado no período.");
    }

    if (net > 0) {
      opportunities.push(`Saldo livre de ${formatBRL(net)} disponível para reserva de emergência ou investimentos estratégicos.`);
    }
    opportunities.push("Mantenha o acompanhamento contínuo das categorias com maior impacto no orçamento.");

    issues.push(`A saúde financeira geral do período foi classificada como ${healthStatus}.`);
    issues.push(net >= 0 ? "Fluxo financeiro sob controle e com margem positiva." : "Necessário reavaliar gastos operacionais para reestabelecer o equilíbrio.");

    return {
      insights,
      risks,
      opportunities,
      issues,
      financialScore: score,
      healthStatus
    };
  }
};
