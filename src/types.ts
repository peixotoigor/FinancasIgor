export interface Transaction {
  id?: string;
  userId: string;
  description: string;
  date: number;
  amount: number;
  type: 'income' | 'expense' | 'transfer';
  category: string;
  account: string;
  paymentMethod: string;
  card?: string;
  installments?: number;
  installmentNumber?: number;
  groupId?: string;
  createdAt: number;
}

export interface PlannedExpense {
  id: string;
  description: string;
  amount: number;
}

export interface MonthlyBudget {
  id?: string;
  userId: string;
  year: number;
  month: number;
  salary: number;
  reserve: number;
  reserveOfReserve: number;
  wallet: number;
  walletWithdrawals: number;
  emergencyWithdrawals: number;
  plannedExpenses?: PlannedExpense[];
  updatedAt: number;
}

export interface UserSettings {
  userId: string;
  categories: string[];
  incomeCategories?: string[];
  cards: string[];
  updatedAt: number;
  spendingLimits?: {
    overall: number | null;
    categories: Record<string, number>;
  };
  categoryColors?: Record<string, string>;
  cardColors?: Record<string, string>;
  aiProvider?: 'gemini' | 'openrouter';
  openRouterApiKey?: string;
  openRouterModel?: string;
  ollamaEndpoint?: string;
  ollamaModel?: string;
  ollamaApiKey?: string;
}

export interface WebhookToken {
  id?: string;
  userId: string;
  token: string;
  createdAt: number;
}
