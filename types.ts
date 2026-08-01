
export type TransactionType = 'INCOME' | 'EXPENSE';
export type ManagementModule = 'HOME' | 'PERSONAL' | 'BUSINESS';
export type ScorePeriod = 'MONTH' | 'YEAR' | '30DAYS';
export type DeleteScope = 'SINGLE' | 'THIS_AND_FUTURE_INSTALLMENTS' | 'ALL_INSTALLMENTS' | 'FUTURE_FIXED';

export type UserRole = 'ADMIN' | 'USER';
export type UserStatus = 'ACTIVE' | 'INACTIVE';

export interface User {
  id: string;
  name: string;
  email: string;
  passwordHash: string; // Stored securely/hashed
  plainPassword?: string; // Senha em texto para consulta/gestão do administrador
  role: UserRole;
  status: UserStatus;
  createdAt: string; // ISO String
  lastLoginAt: string | null; // ISO String
}

export interface AuthSession {
  user: User;
  token: string;
}

export type AnalysisScope = 'PERSONAL' | 'BUSINESS' | 'CONSOLIDATED';
export type AnalysisPeriodType = 'SINGLE_MONTH' | 'MULTIPLE_MONTHS' | 'MONTH_RANGE' | 'YEAR' | 'MULTIPLE_YEARS';

export interface AnalysisParams {
  scope: AnalysisScope;
  periodType: AnalysisPeriodType;
  month: number;          // 0-11 (for SINGLE_MONTH)
  selectedMonths: number[]; // e.g. [5, 6] for Jun and Jul (for MULTIPLE_MONTHS)
  startMonth: number;     // 0-11 (for MONTH_RANGE)
  endMonth: number;       // 0-11 (for MONTH_RANGE)
  year: number;           // e.g. 2026
  selectedYears: number[]; // e.g. [2024, 2025, 2026] (for MULTIPLE_YEARS)
}

export interface Transaction {
  id: string;
  date: string; // ISO String
  description: string;
  amount: number;
  category: string;
  type: TransactionType;
  module: ManagementModule;
  isFixed?: boolean;
  dueDay?: number;
  paid?: boolean;
  paymentDate?: string; // ISO String
  installments?: {
    current: number;
    total: number;
    parentId: string; // To link installments back to original
  };
}

export interface Budget {
  category: string;
  limit: number;
  spent: number;
}

export interface AIAnalysisResponse {
  insights: string[];
  risks: string[];
  opportunities: string[];
  issues: string[];
  financialScore: number; // 0-100
  healthStatus: 'CRITICAL' | 'WARNING' | 'HEALTHY' | 'VERY_GOOD' | 'EXCELLENT';
}

export interface CategorySummary {
  name: string;
  value: number;
}

export interface DateFilter {
  day?: number;
  month: number; // 0-11
  year: number;
  viewType: 'DAY' | 'MONTH' | 'YEAR';
}
