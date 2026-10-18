import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { auth, googleProvider, db, handleFirestoreError, OperationType } from './lib/firebase';
import { signInWithPopup, signOut, onAuthStateChanged, User } from 'firebase/auth';
import type { Transaction } from './types';
import { collection, query, where, onSnapshot, doc, setDoc, orderBy, deleteDoc, writeBatch, getDoc } from 'firebase/firestore';
import { LogOut, Plus, Wallet, FileText, Settings, Bot, BarChart3, LayoutDashboard, List, PiggyBank, ChevronDown, ChevronUp, Eye, EyeOff, X, Sun, Moon, TrendingUp, TrendingDown, Activity, Landmark, AlertCircle, Cloud, CheckCircle2, RefreshCw, CloudOff, Trash2, Copy, GripVertical, Sparkles, Search, CreditCard, ArrowUpRight, ArrowDownRight, Tag, ShieldCheck, Flame, PieChart, ArrowRight, Zap, Coins, Calendar } from 'lucide-react';
import { Button, Card, Chip } from './components/ui';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TransactionModal } from './components/TransactionModal';
import { AnalysisTab } from './components/AnalysisTab';
import { TransactionsTab } from './components/TransactionsTab';
import { ReservesTab } from './components/ReservesTab';
import { IntegrationTab } from './components/IntegrationTab';
import { QuickAddTransaction } from './components/QuickAddTransaction';
import { MonthlyPlanning } from './components/MonthlyPlanning';
import { AIFinancialForecast } from "./components/AIFinancialForecast";
import { MonthYearPicker } from './components/MonthYearPicker';
import type { MonthlyBudget, UserSettings } from './types';
import { SettingsTab } from './components/SettingsTab';
import { DividasTab } from './components/DividasTab';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return unsub;
  }, []);

  if (loading) return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0A0A0B] text-gray-800 dark:text-gray-200 flex items-center justify-center font-sans">
      <div className="flex items-center gap-3">
        <div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
        <span className="text-sm font-medium">Carregando...</span>
      </div>
    </div>
  );

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-[#0A0A0B] text-gray-900 dark:text-white flex items-center justify-center p-4 font-sans relative overflow-hidden">
        {/* Ambient Glow Orbs */}
        <div className="ambient-glow-bg">
          <div className="ambient-orb ambient-orb-1" />
          <div className="ambient-orb ambient-orb-2" />
          <div className="ambient-orb ambient-orb-3" />
        </div>

        <div className="glass-card w-full max-w-md bg-white dark:bg-[#121214] border border-gray-200 dark:border-white/5 rounded-3xl p-8 sm:p-10 shadow-xl text-center relative z-10">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 text-white flex items-center justify-center font-bold text-xl mx-auto shadow-lg shadow-emerald-500/20 mb-6">
            FT
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
            FinanceTracker
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 mb-8 leading-relaxed">
            Gestão financeira inteligente, controle de reservas e planejamento patrimonial.
          </p>

          <button 
            onClick={() => signInWithPopup(auth, googleProvider).catch(e => console.error(e.message || String(e)))}
            className="w-full flex items-center justify-center gap-3 glass-card-hover bg-white dark:bg-[#1A1A1D] hover:bg-gray-50 dark:hover:bg-white/10 text-gray-900 dark:text-white border border-gray-200 dark:border-white/10 rounded-2xl px-6 py-3.5 font-medium shadow-sm transition-all duration-200 cursor-pointer"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            <span>Continuar com Google</span>
          </button>
        </div>
      </div>
    );
  }

  return <Dashboard user={user} />;
}

function Dashboard({ user }: { user: User }) {
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth() + 1);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'transactions' | 'reserves' | 'analysis' | 'debts' | 'integration' | 'settings'>('dashboard');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [txInitialType, setTxInitialType] = useState<'expense' | 'income'>('expense');
  const [txToEdit, setTxToEdit] = useState<Transaction | null>(null);
  const [budget, setBudget] = useState<MonthlyBudget | null>(null);
  const [allBudgets, setAllBudgets] = useState<MonthlyBudget[]>([]);
  const [transactionsLoaded, setTransactionsLoaded] = useState(false);
  const [isReservesOpen, setIsReservesOpen] = useState(false);
  const [hideReservesValues, setHideReservesValues] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    return document.documentElement.classList.contains('dark') || 
           localStorage.getItem('theme') === 'dark';
  });
  const [isLiquidGlass, setIsLiquidGlass] = useState(() => {
    return localStorage.getItem('liquid_glass') !== 'false';
  });
  const [isSyncing, setIsSyncing] = useState(false);
  const syncTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const initialSettingsLoadedRef = useRef(false);
  const initialTxsLoadedRef = useRef(false);
  const initialBudgetsLoadedRef = useRef(false);

  const triggerSyncPulse = useCallback(() => {
    setIsSyncing(true);
    if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
    syncTimeoutRef.current = setTimeout(() => {
      setIsSyncing(false);
    }, 1200);
  }, []);
  const [rightSidebarWidth, setRightSidebarWidth] = useState(380);
  const [draggedTxIdx, setDraggedTxIdx] = useState<number | null>(null);
  const [dragOverTxIdx, setDragOverTxIdx] = useState<number | null>(null);

  const [transactionToDelete, setTransactionToDelete] = useState<Transaction | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteSubsequent, setDeleteSubsequent] = useState(true);

  const isInstallment = (t: Transaction) => {
    if (t.groupId) return true;
    if (t.installments && t.installments > 1) return true;
    const match = t.description.match(/^(.*?) ?\((\d+)\/(\d+)\) ?(.*)$/);
    if (match) return true;
    return false;
  };

  const getSubsequentInstallments = (t: Transaction) => {
    if (t.groupId) {
      if (t.installmentNumber) {
        return transactions.filter(x => x.groupId === t.groupId && x.id !== t.id && (x.installmentNumber || 0) > t.installmentNumber!);
      } else {
        return transactions.filter(x => x.groupId === t.groupId && x.id !== t.id && x.date >= t.date);
      }
    }
    
    const match = t.description.match(/^(.*?) ?\((\d+)\/(\d+)\) ?(.*)$/);
    if (match) {
      const base1 = match[1];
      const currInst = parseInt(match[2], 10);
      const totalInst = match[3];
      const base2 = match[4];
      
      return transactions.filter(x => {
        if (x.id === t.id) return false;
        if (x.type !== t.type) return false;
        
        const m = x.description.match(/^(.*?) ?\((\d+)\/(\d+)\) ?(.*)$/);
        if (m && m[1] === base1 && m[3] === totalInst && m[4] === base2) {
          const inst = parseInt(m[2], 10);
          return inst > currInst;
        }
        return false;
      });
    }
    
    return [];
  };

  const confirmDelete = async () => {
    if (!transactionToDelete) return;
    setIsDeleting(true);
    try {
      const batch = writeBatch(db);
      
      if (transactionToDelete.reserveModifications && transactionToDelete.reserveModificationsMonth) {
        const budgetRef = doc(db, 'monthly_budgets', `${user!.uid}_${transactionToDelete.reserveModificationsMonth}`);
        const bSnap = await getDoc(budgetRef);
        if (bSnap.exists()) {
           const b = bSnap.data();
           const mods = transactionToDelete.reserveModifications;
           const undoData: any = { updatedAt: Date.now() };
           
           if (mods.walletWithdrawals) undoData.walletWithdrawals = (b.walletWithdrawals || 0) - mods.walletWithdrawals;
           if (mods.emergencyWithdrawals) undoData.emergencyWithdrawals = (b.emergencyWithdrawals || 0) - mods.emergencyWithdrawals;
           if (mods.reserveWithdrawals) undoData.reserveWithdrawals = (b.reserveWithdrawals || 0) - mods.reserveWithdrawals;
           if (mods.reserve) undoData.reserve = (b.reserve || 0) + mods.reserve;
           if (mods.walletAdd) undoData.wallet = (b.wallet || 0) - mods.walletAdd;
           
           batch.update(budgetRef, undoData);
        }
      }

      if (isInstallment(transactionToDelete) && deleteSubsequent) {
        const subsequent = getSubsequentInstallments(transactionToDelete);
        batch.delete(doc(db, 'transactions', transactionToDelete.id!));
        subsequent.forEach(sub => {
          batch.delete(doc(db, 'transactions', sub.id!));
        });
      } else {
        batch.delete(doc(db, 'transactions', transactionToDelete.id!));
      }
      
      await batch.commit();
      setTransactionToDelete(null);
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, 'transactions');
    } finally {
      setIsDeleting(false);
    }
  };

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

  useEffect(() => {
    if (isLiquidGlass) {
      document.documentElement.classList.add('liquid-glass-enabled');
      localStorage.setItem('liquid_glass', 'true');
    } else {
      document.documentElement.classList.remove('liquid-glass-enabled');
      localStorage.setItem('liquid_glass', 'false');
    }
  }, [isLiquidGlass]);

  // Load User Settings
  const [userSettings, setUserSettings] = useState<UserSettings | null>(null);
  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(doc(db, 'user_settings', user.uid), (docSnap) => {
      if (docSnap.exists()) {
        setUserSettings(docSnap.data() as UserSettings);
        if (initialSettingsLoadedRef.current) {
          triggerSyncPulse();
        } else {
          initialSettingsLoadedRef.current = true;
        }
      } else {
        const initialSettings: UserSettings = {
          userId: user.uid,
          categories: ['Alimentação', 'Moradia', 'Transporte', 'Lazer', 'Saúde', 'Educação', 'Dívidas e Empréstimos', 'Outros'],
          incomeCategories: ['Salário', 'Investimentos', 'Freelance', 'Outros'],
          paymentMethods: ['Crédito', 'Débito', 'Pix', 'Dinheiro'],
          cards: ['Nubank', 'Inter'],
          updatedAt: Date.now()
        };
        initialSettingsLoadedRef.current = true;
        setDoc(doc(db, 'user_settings', user.uid), initialSettings);
      }
    });
    return unsub;
  }, [user]);

  // Load All Transactions
  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'transactions'),
      where('userId', '==', user.uid)
    );
    const unsub = onSnapshot(q, (snapshot) => {
      const txs = snapshot.docs.map(doc => {
        const data = doc.data();
        let dateNum = Date.now();
        const rawDate = data.date;
        if (typeof rawDate === "number") {
          dateNum = rawDate < 10000000000 ? rawDate * 1000 : rawDate;
        } else if (rawDate && typeof rawDate.toMillis === "function") {
          dateNum = rawDate.toMillis();
        } else if (rawDate && typeof rawDate.toDate === "function") {
          dateNum = rawDate.toDate().getTime();
        } else if (rawDate && rawDate.seconds) {
          dateNum = rawDate.seconds * 1000;
        } else if (rawDate instanceof Date) {
          dateNum = rawDate.getTime();
        } else if (typeof rawDate === "string") {
          const trimmed = rawDate.trim();
          if (trimmed.match(/^\d{4}-\d{2}$/)) {
            dateNum = new Date(`${trimmed}-01T12:00:00`).getTime();
          } else if (trimmed.match(/^\d{4}-\d{2}-\d{2}$/)) {
            dateNum = new Date(`${trimmed}T12:00:00`).getTime();
          } else {
            const parsed = new Date(trimmed).getTime();
            if (!isNaN(parsed)) dateNum = parsed;
          }
        }
        const amount = typeof data.amount === "number" ? data.amount : parseFloat(String(data.amount).replace(",", ".")) || 0;
        return {
          ...data,
          id: doc.id,
          date: dateNum,
          amount,
        } as Transaction;
      });
      txs.sort((a, b) => b.date - a.date);
      setTransactions(txs);
      setTransactionsLoaded(true);
      
      if (!initialTxsLoadedRef.current) {
        initialTxsLoadedRef.current = true;
      } else if (snapshot.docChanges().length > 0) {
        triggerSyncPulse();
      }
    });
    return unsub;
  }, [user]);

  // Load Monthly Budgets (independent of month/year change to avoid constant resubscription)
  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'monthly_budgets'),
      where('userId', '==', user.uid)
    );
    const unsub = onSnapshot(q, (snapshot) => {
      const bList = snapshot.docs.map(doc => doc.data() as MonthlyBudget);
      setAllBudgets(bList);
      
      if (!initialBudgetsLoadedRef.current) {
        initialBudgetsLoadedRef.current = true;
      } else if (snapshot.docChanges().length > 0) {
        triggerSyncPulse();
      }
    });
    return unsub;
  }, [user]);

  // Sync selected month budget
  useEffect(() => {
    const current = allBudgets.find(b => b.year === currentYear && b.month === currentMonth);
    setBudget(current || null);
  }, [allBudgets, currentYear, currentMonth]);

  // Calculate Aggregated Reserves
  const aggregatedReserve = useMemo(() => {
    const list = allBudgets
      .filter(b => b.year < currentYear || (b.year === currentYear && b.month <= currentMonth))
      .sort((a, b) => (a.year === b.year ? a.month - b.month : a.year - b.year));

    let reserve = 0;
    let emergency = 0;
    let wallet = 0;
    let emergencyWithdrawals = 0;
    let walletWithdrawals = 0;
    let reserveWithdrawals = 0;

    list.forEach(b => {
      reserve += (b.reserve || 0);
      emergency += (b.emergency || 0);
      wallet += (b.wallet || 0);
      emergencyWithdrawals += (b.emergencyWithdrawals || 0);
      walletWithdrawals += (b.walletWithdrawals || 0);
      reserveWithdrawals += (b.reserveWithdrawals || 0);
    });

    return {
      reserve: Math.max(0, reserve - reserveWithdrawals),
      emergency: Math.max(0, emergency - emergencyWithdrawals),
      wallet: Math.max(0, wallet - walletWithdrawals),
      emergencyWithdrawals,
      walletWithdrawals,
      reserveWithdrawals
    };
  }, [allBudgets, currentYear, currentMonth]);

  // Current month transactions
  const currentMonthTransactions = useMemo(() => {
    return transactions.filter(t => {
      const d = new Date(t.date);
      return d.getFullYear() === currentYear && (d.getMonth() + 1) === currentMonth;
    });
  }, [transactions, currentYear, currentMonth]);

  const totalIncome = useMemo(() => {
    return currentMonthTransactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);
  }, [currentMonthTransactions]);

  const totalExpense = useMemo(() => {
    return currentMonthTransactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);
  }, [currentMonthTransactions]);

  const incomeTransactionsCount = useMemo(() => {
    return currentMonthTransactions.filter(t => t.type === 'income').length;
  }, [currentMonthTransactions]);

  const expenseTransactionsCount = useMemo(() => {
    return currentMonthTransactions.filter(t => t.type === 'expense').length;
  }, [currentMonthTransactions]);

  const savingsRate = useMemo(() => {
    if (totalIncome <= 0) return 0;
    return Math.round(((totalIncome - totalExpense) / totalIncome) * 100);
  }, [totalIncome, totalExpense]);

  // Apply custom drag-and-drop order if defined for this month
  const orderedCurrentMonthTransactions = useMemo(() => {
    const list = [...currentMonthTransactions];
    const order = budget?.transactionsOrder;
    if (!order || !Array.isArray(order) || order.length === 0) {
      return list;
    }

    const orderMap = new Map<string, number>();
    order.forEach((id, index) => {
      orderMap.set(id, index);
    });

    return list.sort((a, b) => {
      const posA = a.id ? orderMap.get(a.id) : undefined;
      const posB = b.id ? orderMap.get(b.id) : undefined;

      if (posA !== undefined && posB !== undefined) {
        return posA - posB;
      }
      if (posA !== undefined) return -1;
      if (posB !== undefined) return 1;
      return b.date - a.date;
    });
  }, [currentMonthTransactions, budget?.transactionsOrder]);

  // Todas as transações do mês para visualização completa sem cortes
  const recentTransactions = useMemo(() => {
    return orderedCurrentMonthTransactions;
  }, [orderedCurrentMonthTransactions]);

  const [recentTxSearch, setRecentTxSearch] = useState('');
  const [showRecentSearch, setShowRecentSearch] = useState(false);

  const displayedRecentTransactions = useMemo(() => {
    if (!recentTxSearch.trim()) return recentTransactions;
    const term = recentTxSearch.trim().toLowerCase();

    // Normalização para pesquisa por valor monetário
    // Remove "r$", "$", espaços para capturar números digitados
    const cleanAmountQuery = term.replace(/^r\$\s*|^r\s*|^\$\s*/i, '').replace(/\s+/g, '');
    const queryWithDot = cleanAmountQuery.replace(',', '.');
    const queryWithComma = cleanAmountQuery.replace('.', ',');
    const queryDigitsOnly = cleanAmountQuery.replace(/[.,]/g, '');

    return recentTransactions.filter(t => {
      // 1. Busca por texto: descrição, categoria, forma de pagamento e cartão
      if (
        t.description.toLowerCase().includes(term) ||
        t.category.toLowerCase().includes(term) ||
        (t.paymentMethod && t.paymentMethod.toLowerCase().includes(term)) ||
        (t.card && t.card.toLowerCase().includes(term))
      ) {
        return true;
      }

      // 2. Busca por valor (suporta: 150, 150,00, 150.00, R$ 150, etc.)
      if (cleanAmountQuery) {
        const amount = t.amount;
        const amountStr = amount.toString();
        const amountFixed = amount.toFixed(2);
        const amountPtBR = amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
        const amountPtBRClean = amountPtBR.replace(/\./g, '');
        const amountPtBRDot = amountPtBRClean.replace(',', '.');
        const amountInteger = Math.floor(amount).toString();

        if (
          amountStr.includes(cleanAmountQuery) ||
          amountFixed.includes(cleanAmountQuery) ||
          amountFixed.includes(queryWithDot) ||
          amountPtBR.includes(cleanAmountQuery) ||
          amountPtBR.includes(queryWithComma) ||
          amountPtBRClean.includes(cleanAmountQuery) ||
          amountPtBRClean.includes(queryWithComma) ||
          amountPtBRDot.includes(queryWithDot) ||
          (queryDigitsOnly && amountInteger.includes(queryDigitsOnly)) ||
          (queryDigitsOnly.length >= 2 && amountPtBRClean.replace(',', '').includes(queryDigitsOnly))
        ) {
          return true;
        }
      }

      return false;
    });
  }, [recentTransactions, recentTxSearch]);

  const handleReorderTransaction = async (fromIdx: number, toIdx: number) => {
    if (fromIdx === toIdx || fromIdx < 0 || toIdx < 0) return;
    
    // Obter transações alvo da lista exibida atualmente
    const fromTx = displayedRecentTransactions[fromIdx];
    const toTx = displayedRecentTransactions[toIdx];
    if (!fromTx || !toTx) return;

    const actualFromIdx = recentTransactions.findIndex(t => t.id === fromTx.id);
    const actualToIdx = recentTransactions.findIndex(t => t.id === toTx.id);
    if (actualFromIdx === -1 || actualToIdx === -1 || actualFromIdx === actualToIdx) return;

    const reordered = [...recentTransactions];
    const [moved] = reordered.splice(actualFromIdx, 1);
    reordered.splice(actualToIdx, 0, moved);

    const newOrderIds = reordered.map(t => t.id!).filter(Boolean);

    setBudget(prev => prev ? { ...prev, transactionsOrder: newOrderIds } : null);

    try {
      const docId = `${user.uid}_${currentYear}_${currentMonth}`;
      await setDoc(doc(db, 'monthly_budgets', docId), {
        userId: user.uid,
        year: currentYear,
        month: currentMonth,
        transactionsOrder: newOrderIds,
        updatedAt: Date.now()
      }, { merge: true });
    } catch (err) {
      console.error('Erro ao salvar nova ordenação de transações:', err);
    }
  };

  const handleResetTransactionOrder = async () => {
    setBudget(prev => prev ? { ...prev, transactionsOrder: [] } : null);
    try {
      const docId = `${user.uid}_${currentYear}_${currentMonth}`;
      await setDoc(doc(db, 'monthly_budgets', docId), {
        userId: user.uid,
        year: currentYear,
        month: currentMonth,
        transactionsOrder: [],
        updatedAt: Date.now()
      }, { merge: true });
    } catch (err) {
      console.error('Erro ao resetar ordem das transações:', err);
    }
  };

  const topCategories = useMemo(() => {
    const map: Record<string, number> = {};
    currentMonthTransactions
      .filter(t => t.type === 'expense')
      .forEach(t => {
        map[t.category] = (map[t.category] || 0) + t.amount;
      });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [currentMonthTransactions]);

  const expensePercentage = totalIncome > 0 ? (totalExpense / totalIncome) * 100 : 0;

  // Métricas financeiras inteligentes para Análise de Consumo
  const consumptionMetrics = useMemo(() => {
    const now = new Date();
    const isCurrentRealMonth = now.getFullYear() === currentYear && (now.getMonth() + 1) === currentMonth;
    const totalDaysInMonth = new Date(currentYear, currentMonth, 0).getDate();
    const daysElapsed = isCurrentRealMonth ? Math.max(1, now.getDate()) : totalDaysInMonth;
    const daysRemaining = isCurrentRealMonth ? Math.max(1, totalDaysInMonth - daysElapsed) : 1;
    const dailyBurnRate = totalExpense > 0 ? totalExpense / daysElapsed : 0;
    const projectedExpense = dailyBurnRate * totalDaysInMonth;

    // Gasto Diário Seguro Restante (Safe Daily Spend)
    const remainingBudget = totalIncome - totalExpense;
    const safeDailySpend = remainingBudget > 0 ? remainingBudget / daysRemaining : 0;
    const projectedSurplus = totalIncome - projectedExpense;

    let creditTotal = 0;
    let immediateTotal = 0;
    currentMonthTransactions.forEach(t => {
      if (t.type === 'expense') {
        if (t.paymentMethod === 'Crédito') {
          creditTotal += t.amount;
        } else {
          immediateTotal += t.amount;
        }
      }
    });

    const creditPct = totalExpense > 0 ? Math.round((creditTotal / totalExpense) * 100) : 0;
    const immediatePct = totalExpense > 0 ? Math.max(0, 100 - creditPct) : 0;

    // Barra de espectro de categorias (Top 4 + Outros)
    const top4 = topCategories.slice(0, 4);
    const top4Total = top4.reduce((sum, item) => sum + (item[1] as number), 0);
    const otherTotal = Math.max(0, totalExpense - top4Total);

    const colors = ['bg-emerald-500', 'bg-blue-500', 'bg-purple-500', 'bg-amber-500'];
    const spectrumSegments = top4.map(([cat, amt], idx) => ({
      name: cat,
      amount: amt as number,
      pct: totalExpense > 0 ? Math.round(((amt as number) / totalExpense) * 100) : 0,
      color: colors[idx % colors.length]
    }));

    if (otherTotal > 0 && totalExpense > 0) {
      spectrumSegments.push({
        name: 'Outros',
        amount: otherTotal,
        pct: Math.round((otherTotal / totalExpense) * 100),
        color: 'bg-gray-400 dark:bg-gray-600'
      });
    }

    return {
      daysElapsed,
      totalDaysInMonth,
      daysRemaining,
      dailyBurnRate,
      projectedExpense,
      safeDailySpend,
      projectedSurplus,
      remainingBudget,
      creditTotal,
      creditPct,
      immediateTotal,
      immediatePct,
      spectrumSegments
    };
  }, [currentMonthTransactions, totalExpense, totalIncome, currentYear, currentMonth, topCategories]);

  // Métricas financeiras inteligentes para Posição de Reservas
  const reservesMetrics = useMemo(() => {
    const total = aggregatedReserve.reserve + aggregatedReserve.emergency + aggregatedReserve.wallet;
    const reservePct = total > 0 ? Math.round((aggregatedReserve.reserve / total) * 100) : 0;
    const emergencyPct = total > 0 ? Math.round((aggregatedReserve.emergency / total) * 100) : 0;
    const walletPct = total > 0 ? Math.max(0, 100 - (reservePct + emergencyPct)) : 0;

    const monthlyCost = totalExpense > 0 ? totalExpense : (budget?.salary || 0);
    const runwayMonths = monthlyCost > 0 ? (aggregatedReserve.emergency / monthlyCost) : 0;

    // Meta recomendada de 6 meses de despesas para blindagem financeira
    const targetEmergency6m = monthlyCost * 6;
    const shieldProgress = targetEmergency6m > 0 ? Math.min(100, Math.round((aggregatedReserve.emergency / targetEmergency6m) * 100)) : 0;

    // Rendimento passivo mensal estimado das reservas a 100% CDI líquido (~0.85% ao mês)
    const estimatedYieldMonthly = total * 0.0085;

    return {
      total,
      reservePct,
      emergencyPct,
      walletPct,
      runwayMonths,
      targetEmergency6m,
      shieldProgress,
      estimatedYieldMonthly
    };
  }, [aggregatedReserve, totalExpense, budget]);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = rightSidebarWidth;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const delta = startX - moveEvent.clientX;
      const newWidth = Math.min(Math.max(startWidth + delta, 280), 550);
      setRightSidebarWidth(newWidth);
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'default';
      document.body.classList.remove('select-none');
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = 'col-resize';
    document.body.classList.add('select-none');
  };

  return (
    <div className="flex flex-col-reverse md:flex-row h-[100dvh] w-full bg-gray-50 dark:bg-[#0A0A0B] text-gray-900 dark:text-white font-sans overflow-hidden relative">
      {/* Ambient Glow Orbs for Liquid Glass Refraction */}
      <div className="ambient-glow-bg">
        <div className="ambient-orb ambient-orb-1" />
        <div className="ambient-orb ambient-orb-2" />
        <div className="ambient-orb ambient-orb-3" />
      </div>

      {/* Sidebar Navigation */}
      <nav className="w-full md:w-20 glass-nav bg-white dark:bg-[#121214] border-t md:border-t-0 md:border-r border-gray-200 dark:border-white/5 flex flex-row md:flex-col items-center justify-around md:justify-start pt-2 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] md:py-6 md:gap-4 min-h-[4rem] md:h-full shrink-0 z-50">
        <div className="hidden md:flex w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 text-white font-bold items-center justify-center text-sm shadow-md shadow-emerald-500/20">
          FT
        </div>
        
        <div className="flex flex-row md:flex-col gap-1 md:gap-2 mt-0 md:mt-2 w-full md:w-auto justify-evenly md:justify-start px-1 md:px-0">
          <button 
            onClick={() => setActiveTab('dashboard')} 
            className={`p-2.5 md:p-3 rounded-2xl transition-all duration-200 relative group flex flex-col items-center ${activeTab === 'dashboard' ? 'text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-500/10' : 'text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5'}`} 
            title="Visão Geral"
          >
             <LayoutDashboard className={`w-5 h-5 ${activeTab === 'dashboard' ? 'transform scale-110 text-emerald-500' : 'group-hover:scale-110 transition-transform'}`} />
          </button>
          <button 
            onClick={() => setActiveTab('transactions')} 
            className={`p-2.5 md:p-3 rounded-2xl transition-all duration-200 relative group flex flex-col items-center ${activeTab === 'transactions' ? 'text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-500/10' : 'text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5'}`} 
            title="Transações"
          >
             <List className={`w-5 h-5 ${activeTab === 'transactions' ? 'transform scale-110 text-emerald-500' : 'group-hover:scale-110 transition-transform'}`} />
          </button>
          <button 
            onClick={() => setActiveTab('reserves')} 
            className={`p-2.5 md:p-3 rounded-2xl transition-all duration-200 relative group flex flex-col items-center ${activeTab === 'reserves' ? 'text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-500/10' : 'text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5'}`} 
            title="Reservas"
          >
             <PiggyBank className={`w-5 h-5 ${activeTab === 'reserves' ? 'transform scale-110 text-emerald-500' : 'group-hover:scale-110 transition-transform'}`} />
          </button>
          <button 
            onClick={() => setActiveTab('analysis')} 
            className={`p-2.5 md:p-3 rounded-2xl transition-all duration-200 relative group flex flex-col items-center ${activeTab === 'analysis' ? 'text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-500/10' : 'text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5'}`} 
            title="Análise"
          >
             <BarChart3 className={`w-5 h-5 ${activeTab === 'analysis' ? 'transform scale-110 text-emerald-500' : 'group-hover:scale-110 transition-transform'}`} />
          </button>
          <button 
            onClick={() => setActiveTab('debts')} 
            className={`p-2.5 md:p-3 rounded-2xl transition-all duration-200 relative group flex flex-col items-center ${activeTab === 'debts' ? 'text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-500/10' : 'text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5'}`} 
            title="Dívidas"
          >
             <Landmark className={`w-5 h-5 ${activeTab === 'debts' ? 'transform scale-110 text-emerald-500' : 'group-hover:scale-110 transition-transform'}`} />
          </button>
          <button 
            onClick={() => setActiveTab('integration')} 
            className={`p-2.5 md:p-3 rounded-2xl transition-all duration-200 relative group flex flex-col items-center ${activeTab === 'integration' ? 'text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-500/10' : 'text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5'}`} 
            title="Integrações"
          >
             <Bot className={`w-5 h-5 ${activeTab === 'integration' ? 'transform scale-110 text-emerald-500' : 'group-hover:scale-110 transition-transform'}`} />
          </button>
          <button 
            onClick={() => setActiveTab('settings')} 
            className={`p-2.5 md:p-3 rounded-2xl transition-all duration-200 relative group flex flex-col items-center ${activeTab === 'settings' ? 'text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-500/10' : 'text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5'}`} 
            title="Configurações"
          >
             <Settings className={`w-5 h-5 ${activeTab === 'settings' ? 'transform scale-110 text-emerald-500' : 'group-hover:scale-110 transition-transform'}`} />
          </button>
        </div>

        <div className="hidden md:flex flex-col mt-auto items-center gap-2 w-full">
           <button onClick={() => setIsDarkMode(!isDarkMode)} className="p-2.5 text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5 rounded-2xl transition-colors" title="Alternar Tema">
              {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
           </button>
           <button onClick={() => signOut(auth)} className="mb-2 p-2.5 text-gray-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-2xl transition-colors" title="Sair">
              <LogOut className="w-5 h-5" />
           </button>
        </div>
      </nav>

      <main className="flex-1 flex flex-col gap-6 p-4 md:p-8 lg:p-10 overflow-y-auto w-full bg-gray-50/50 dark:bg-[#0A0A0B]/60 relative z-10">
        {/* Header */}
        <header className="flex flex-col md:flex-row justify-between md:items-center gap-4 shrink-0 relative z-40 w-full">
           <div className="flex justify-between items-center w-full md:w-auto">
             <div>
               <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
                  {activeTab === 'dashboard' ? 'Visão Geral' : 
                   activeTab === 'transactions' ? 'Transações' : 
                   activeTab === 'reserves' ? 'Reservas' :
                   activeTab === 'debts' ? 'Dívidas' : 
                   activeTab === 'analysis' ? 'Análise' : 
                   activeTab === 'integration' ? 'Integração' : 'Configurações'}
               </h1>
               <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Painel de gestão financeira e patrimonial
               </p>
             </div>
             
             <div className="flex md:hidden items-center gap-2">
                <button onClick={() => setIsDarkMode(!isDarkMode)} className="p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-white/5 rounded-xl transition-colors" title="Alternar Tema">
                   {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                </button>
                <button onClick={() => signOut(auth)} className="p-2 text-gray-500 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-xl transition-colors" title="Sair">
                   <LogOut className="w-5 h-5" />
                </button>      
             </div>
           </div>

           <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end">
              <MonthYearPicker 
                currentMonth={currentMonth} 
                currentYear={currentYear} 
                onMonthChange={setCurrentMonth} 
                onYearChange={setCurrentYear} 
              />

              <div 
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs transition-colors duration-200 select-none ${
                  isSyncing 
                    ? 'bg-emerald-50/80 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300' 
                    : 'bg-white dark:bg-[#121214] border-gray-200 dark:border-white/5 text-gray-500 dark:text-gray-400'
                }`} 
                title={isSyncing ? "Salvando alterações..." : "Todas as alterações estão salvas na nuvem"}
              >
                {isSyncing ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-500 shrink-0" />
                      <span className="text-[11px] font-medium hidden sm:inline text-emerald-600 dark:text-emerald-400">Salvando...</span>
                    </>
                ) : (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                      <span className="text-[11px] font-medium hidden sm:inline text-gray-500 dark:text-gray-400">Sincronizado</span>
                    </>
                )}
              </div>

              <Button 
                onPress={() => { setTxToEdit(null); setTxInitialType('expense'); setIsModalOpen(true); }}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-sm font-medium shadow-sm transition-colors shrink-0"
              >
                 <Plus className="w-4 h-4" />
                 <span className="hidden sm:inline">Nova Transação</span>
              </Button>
           </div>
        </header>

        {/* Dynamic Tab Body */}
        <div className="flex-1 min-h-0">
           {activeTab === 'dashboard' && (
              <div className="flex flex-col lg:flex-row gap-6 relative min-h-full">
                 <div className="flex-1 space-y-6 lg:mr-[var(--sidebar-width,380px)]" style={{ '--sidebar-width': `${rightSidebarWidth + 24}px` } as React.CSSProperties}>
                    {/* Top 3 Metric Cards - Compact Grid with Inline Icons & Smooth Animations */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 lg:gap-3.5">
                       {/* Total Receitas */}
                       <Card className="glass-card glass-card-hover bg-white dark:bg-[#121214] p-3 sm:p-3.5 rounded-2xl border border-gray-200/80 dark:border-white/10 shadow-2xs relative overflow-hidden group transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md">
                          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-emerald-500/0 via-emerald-500/70 to-emerald-500/0 group-hover:h-[3px] transition-all" />
                          
                          <div className="flex items-center justify-between gap-3">
                             {/* Icon right beside text */}
                             <div className="flex items-center gap-2.5 min-w-0">
                                <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center justify-center shrink-0 group-hover:scale-110 group-hover:rotate-6 group-hover:bg-emerald-500 group-hover:text-white transition-all duration-300 shadow-xs">
                                   <ArrowUpRight className="w-4 h-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform duration-300" />
                                </div>
                                <div className="min-w-0">
                                   <div className="flex items-center gap-1.5">
                                      <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider block">Receitas</span>
                                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block animate-pulse" />
                                   </div>
                                   <p className="text-lg sm:text-xl font-extrabold font-mono tracking-tight text-gray-900 dark:text-white truncate tabular-nums leading-tight mt-0.5">
                                      {formatCurrency(totalIncome)}
                                   </p>
                                </div>
                             </div>

                             {/* Right compact summary */}
                             <div className="text-right shrink-0">
                                <span className="inline-flex items-center gap-1 text-[10px] sm:text-[11px] font-mono px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 font-medium">
                                   {incomeTransactionsCount} {incomeTransactionsCount === 1 ? 'entrada' : 'entradas'}
                                </span>
                                <p className="text-[10px] text-gray-400 mt-1 font-mono">
                                   Média: {formatCurrency(incomeTransactionsCount > 0 ? totalIncome / incomeTransactionsCount : 0)}
                                </p>
                             </div>
                          </div>
                       </Card>

                       {/* Total Despesas */}
                       <Card className="glass-card glass-card-hover bg-white dark:bg-[#121214] p-3 sm:p-3.5 rounded-2xl border border-gray-200/80 dark:border-white/10 shadow-2xs relative overflow-hidden group transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md">
                          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-rose-500/0 via-rose-500/70 to-rose-500/0 group-hover:h-[3px] transition-all" />
                          
                          <div className="flex items-center justify-between gap-3">
                             {/* Icon right beside text */}
                             <div className="flex items-center gap-2.5 min-w-0">
                                <div className="w-9 h-9 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 flex items-center justify-center shrink-0 group-hover:scale-110 group-hover:-rotate-6 group-hover:bg-rose-500 group-hover:text-white transition-all duration-300 shadow-xs">
                                   <ArrowDownRight className="w-4 h-4 group-hover:translate-x-0.5 group-hover:translate-y-0.5 transition-transform duration-300" />
                                </div>
                                <div className="min-w-0">
                                   <div className="flex items-center gap-1.5">
                                      <span className="text-[11px] font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider block">Despesas</span>
                                      <span className="w-1.5 h-1.5 rounded-full bg-rose-500 inline-block animate-pulse" />
                                   </div>
                                   <p className="text-lg sm:text-xl font-extrabold font-mono tracking-tight text-gray-900 dark:text-white truncate tabular-nums leading-tight mt-0.5">
                                      {formatCurrency(totalExpense)}
                                   </p>
                                </div>
                             </div>

                             {/* Right compact summary with progress indicator */}
                             <div className="text-right shrink-0 flex flex-col items-end">
                                <span className={`inline-flex items-center gap-1 text-[10px] sm:text-[11px] font-mono px-2 py-0.5 rounded-full border font-bold ${expensePercentage > 85 ? 'bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20' : expensePercentage > 60 ? 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20' : 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'}`}>
                                   {expensePercentage.toFixed(0)}% da renda
                                </span>
                                <div className="w-16 bg-gray-100 dark:bg-white/5 rounded-full h-1.5 mt-1.5 overflow-hidden">
                                   <div 
                                      className={`h-full rounded-full transition-all duration-700 ease-out ${expensePercentage > 85 ? 'bg-rose-500' : expensePercentage > 60 ? 'bg-amber-500' : 'bg-emerald-500'}`} 
                                      style={{ width: `${Math.min(expensePercentage, 100)}%` }}
                                   />
                                </div>
                             </div>
                          </div>
                       </Card>

                       {/* Balanço Mês */}
                       <Card className="glass-card glass-card-hover bg-white dark:bg-[#121214] p-3 sm:p-3.5 rounded-2xl border border-gray-200/80 dark:border-white/10 shadow-2xs relative overflow-hidden group transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md">
                          <div className={`absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r ${totalIncome - totalExpense >= 0 ? 'from-emerald-500/0 via-emerald-500/70 to-emerald-500/0' : 'from-rose-500/0 via-rose-500/70 to-rose-500/0'} group-hover:h-[3px] transition-all`} />
                          
                          <div className="flex items-center justify-between gap-3">
                             {/* Icon right beside text */}
                             <div className="flex items-center gap-2.5 min-w-0">
                                <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 flex items-center justify-center shrink-0 group-hover:scale-110 group-hover:rotate-12 group-hover:bg-blue-500 group-hover:text-white transition-all duration-300 shadow-xs">
                                   <Wallet className="w-4 h-4 group-hover:scale-110 transition-transform duration-300" />
                                </div>
                                <div className="min-w-0">
                                   <div className="flex items-center gap-1.5">
                                      <span className="text-[11px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider block">Balanço Mês</span>
                                      <span className={`w-1.5 h-1.5 rounded-full inline-block animate-pulse ${totalIncome - totalExpense >= 0 ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                                   </div>
                                   <p className={`text-lg sm:text-xl font-extrabold font-mono tracking-tight truncate tabular-nums leading-tight mt-0.5 ${totalIncome - totalExpense >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                                      {formatCurrency(totalIncome - totalExpense)}
                                   </p>
                                </div>
                             </div>

                             {/* Right compact summary */}
                             <div className="text-right shrink-0">
                                <span className={`inline-flex items-center gap-1 text-[10px] sm:text-[11px] font-bold px-2 py-0.5 rounded-full border ${totalIncome - totalExpense >= 0 ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' : 'bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'}`}>
                                   <span className={`w-1.5 h-1.5 rounded-full ${totalIncome - totalExpense >= 0 ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
                                   {totalIncome - totalExpense >= 0 ? 'Superávit' : 'Déficit'}
                                </span>
                                <p className={`text-[10px] font-mono font-medium mt-1 ${totalIncome - totalExpense >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                                   {totalIncome - totalExpense >= 0 ? `${savingsRate}% retido` : 'Excedeu receita'}
                                </p>
                             </div>
                          </div>
                       </Card>
                    </div>

                    {/* Quick Add For Dashboard */}
                    <QuickAddTransaction userId={user.uid} userSettings={userSettings} />
                    <AIFinancialForecast userId={user.uid} transactions={transactions} currentMonthBudget={budget} currentYear={currentYear} currentMonth={currentMonth} userSettings={userSettings} />

                    {/* Planejamento Mensal */}
                    <MonthlyPlanning userId={user.uid} year={currentYear} month={currentMonth} budget={budget} transactions={currentMonthTransactions} transactionsLoaded={transactionsLoaded} userSettings={userSettings} />

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-5">
                       {/* Análise de Consumo Inteligente */}
                       <Card className="glass-card bg-white dark:bg-[#121214] p-4 sm:p-5 rounded-2xl border border-gray-200/80 dark:border-white/10 shadow-sm flex flex-col justify-between relative overflow-hidden group">
                          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-emerald-500/0 via-emerald-500/60 to-emerald-500/0" />
                          
                          {/* Header */}
                          <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-white/5 mb-3.5">
                             <div className="flex items-center gap-2">
                               <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                                 <BarChart3 className="w-4 h-4" />
                               </div>
                               <div>
                                 <span className="text-xs font-bold uppercase tracking-wider text-gray-900 dark:text-white block">Análise de Consumo</span>
                                 <span className="text-[10px] text-gray-400">Ritmo diário, projeção e categorias</span>
                               </div>
                             </div>
                             <Chip size="sm" variant="soft" color={expensePercentage > 85 ? "danger" : expensePercentage > 65 ? "warning" : "success"} className="font-mono text-[10px] font-bold">
                               {expensePercentage.toFixed(0)}% da renda
                             </Chip>
                          </div>
                         
                          <div className="flex-1 flex flex-col justify-between space-y-3.5">
                             {/* Métricas Chave: Ritmo Atual (Burn Rate) & Orçamento Diário Seguro */}
                             <div className="grid grid-cols-2 gap-2 text-xs">
                                {/* Ritmo Diário Atual */}
                                <div className="p-2.5 rounded-xl bg-gray-50/70 dark:bg-white/[0.02] border border-gray-100 dark:border-white/5 flex flex-col justify-between">
                                   <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                                      <Flame className="w-3.5 h-3.5 text-amber-500" />
                                      <span>Ritmo Diário</span>
                                   </div>
                                   <div className="mt-1">
                                      <span className="font-mono font-bold text-xs sm:text-sm text-gray-900 dark:text-white block tabular-nums">
                                         {formatCurrency(consumptionMetrics.dailyBurnRate)}<span className="text-[10px] text-gray-400 font-normal">/dia</span>
                                      </span>
                                      <div className="flex items-center justify-between mt-1 text-[10px]">
                                         <span className="text-gray-400">Proj. mês:</span>
                                         <span className="font-mono font-semibold text-gray-700 dark:text-gray-300">
                                            {formatCurrency(consumptionMetrics.projectedExpense)}
                                         </span>
                                      </div>
                                      <div className="mt-1 pt-1 border-t border-gray-100 dark:border-white/5">
                                         {consumptionMetrics.projectedSurplus >= 0 ? (
                                            <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 block truncate" title={`Sobra projetada de ${formatCurrency(consumptionMetrics.projectedSurplus)}`}>
                                               +{formatCurrency(consumptionMetrics.projectedSurplus)} sobra est.
                                            </span>
                                         ) : (
                                            <span className="text-[10px] font-semibold text-rose-600 dark:text-rose-400 block truncate" title={`Déficit projetado de ${formatCurrency(Math.abs(consumptionMetrics.projectedSurplus))}`}>
                                               -{formatCurrency(Math.abs(consumptionMetrics.projectedSurplus))} risco déficit
                                            </span>
                                         )}
                                      </div>
                                   </div>
                                </div>

                                {/* Orçamento Diário Seguro Restante */}
                                <div className="p-2.5 rounded-xl bg-gray-50/70 dark:bg-white/[0.02] border border-gray-100 dark:border-white/5 flex flex-col justify-between">
                                   <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                                      <Zap className="w-3.5 h-3.5 text-emerald-500" />
                                      <span>Diário Disponível</span>
                                   </div>
                                   <div className="mt-1">
                                      <span className={`font-mono font-bold text-xs sm:text-sm block tabular-nums ${consumptionMetrics.safeDailySpend > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                                         {formatCurrency(consumptionMetrics.safeDailySpend)}<span className="text-[10px] text-gray-400 font-normal">/dia</span>
                                      </span>
                                      <div className="flex items-center justify-between mt-1 text-[10px]">
                                         <span className="text-gray-400">Dias restantes:</span>
                                         <span className="font-mono font-semibold text-gray-700 dark:text-gray-300">
                                            {consumptionMetrics.daysRemaining} {consumptionMetrics.daysRemaining === 1 ? 'dia' : 'dias'}
                                         </span>
                                      </div>
                                      <div className="mt-1 pt-1 border-t border-gray-100 dark:border-white/5">
                                         {consumptionMetrics.remainingBudget > 0 ? (
                                            <span className="text-[10px] text-gray-500 dark:text-gray-400 block truncate">
                                               Saldo livre: <strong className="font-mono text-emerald-600 dark:text-emerald-400">{formatCurrency(consumptionMetrics.remainingBudget)}</strong>
                                            </span>
                                         ) : (
                                            <span className="text-[10px] font-semibold text-rose-500 block truncate">
                                               Orçamento estourado
                                            </span>
                                         )}
                                      </div>
                                   </div>
                                </div>
                             </div>

                             {/* Distribuição de Forma de Pagamento (Crédito vs Pix / À Vista) */}
                             <div className="p-2.5 rounded-xl bg-gray-50/50 dark:bg-white/[0.02] border border-gray-100 dark:border-white/5">
                                <div className="flex justify-between items-center text-[10px] uppercase font-bold text-gray-400 mb-1.5">
                                   <div className="flex items-center gap-1.5">
                                      <CreditCard className="w-3.5 h-3.5 text-purple-500" />
                                      <span>Forma de Pagamento</span>
                                   </div>
                                   <span>Crédito vs À Vista</span>
                                </div>
                                <div className="w-full h-2 rounded-full overflow-hidden flex bg-gray-100 dark:bg-white/5">
                                   <div 
                                      className="h-full bg-purple-500 transition-all duration-500" 
                                      style={{ width: `${consumptionMetrics.creditPct}%` }}
                                      title={`Crédito: ${consumptionMetrics.creditPct}% (${formatCurrency(consumptionMetrics.creditTotal)})`}
                                   />
                                   <div 
                                      className="h-full bg-emerald-500 transition-all duration-500" 
                                      style={{ width: `${consumptionMetrics.immediatePct}%` }}
                                      title={`À Vista/Pix: ${consumptionMetrics.immediatePct}% (${formatCurrency(consumptionMetrics.immediateTotal)})`}
                                   />
                                </div>
                                <div className="flex items-center justify-between text-[10px] mt-1.5">
                                   <span className="flex items-center gap-1 text-purple-600 dark:text-purple-400 font-medium">
                                      <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                                      Crédito: {consumptionMetrics.creditPct}% ({formatCurrency(consumptionMetrics.creditTotal)})
                                   </span>
                                   <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                      À Vista: {consumptionMetrics.immediatePct}% ({formatCurrency(consumptionMetrics.immediateTotal)})
                                   </span>
                                </div>
                             </div>

                             {/* Maiores Despesas por Categoria */}
                             <div>
                                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block mb-1.5">Maiores Despesas por Categoria</span>
                                {topCategories.length > 0 ? (
                                  <div className="space-y-1.5">
                                    {topCategories.slice(0, 3).map(([cat, amt], idx) => {
                                      const categoryPct = totalExpense > 0 ? Math.round(((amt as number) / totalExpense) * 100) : 0;
                                      return (
                                        <div key={idx} className="relative p-2 rounded-xl bg-gray-50/50 dark:bg-white/[0.02] border border-gray-100 dark:border-white/5 hover:border-emerald-500/20 transition-colors overflow-hidden">
                                           {/* Barra horizontal sutil de preenchimento relativo */}
                                           <div 
                                              className="absolute top-0 bottom-0 left-0 bg-emerald-500/5 dark:bg-emerald-500/10 pointer-events-none transition-all duration-500" 
                                              style={{ width: `${Math.min(100, categoryPct)}%` }}
                                           />
                                           <div className="relative z-10 flex items-center justify-between">
                                              <div className="flex items-center gap-2 min-w-0 pr-2">
                                                 <span className="text-[10px] font-mono font-bold text-gray-400 w-4">#{idx + 1}</span>
                                                 <span className="text-gray-700 dark:text-gray-300 font-medium text-xs truncate">{cat}</span>
                                              </div>
                                              <div className="flex items-center gap-2 shrink-0">
                                                 <span className="text-[10px] text-gray-400 font-mono font-medium">
                                                    {categoryPct}%
                                                 </span>
                                                 <span className="font-bold text-gray-900 dark:text-white font-mono text-xs tabular-nums">
                                                    {formatCurrency(amt as number)}
                                                 </span>
                                              </div>
                                           </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                ) : (
                                  <div className="py-3 text-center border border-dashed border-gray-200 dark:border-white/10 rounded-xl">
                                     <p className="text-xs text-gray-400">Nenhum gasto registrado neste mês.</p>
                                  </div>
                                )}
                             </div>
                          </div>
                       </Card>

                       {/* Posição de Reservas e Patrimônio */}
                       <Card className="glass-card bg-white dark:bg-[#121214] p-4 sm:p-5 rounded-2xl border border-gray-200/80 dark:border-white/10 shadow-sm flex flex-col justify-between relative overflow-hidden group">
                          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-indigo-500/0 via-indigo-500/60 to-indigo-500/0" />
                          
                          {/* Header */}
                          <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-white/5 mb-3.5">
                             <div className="flex items-center gap-2">
                                 <div className="w-7 h-7 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                                   <PiggyBank className="w-4 h-4" />
                                 </div>
                                 <div>
                                   <span className="text-xs font-bold uppercase tracking-wider text-gray-900 dark:text-white block">Posição de Reservas</span>
                                   <span className="text-[10px] text-gray-400">Patrimônio, segurança e rendimento</span>
                                 </div>
                             </div>
                             <div className="flex items-center gap-1.5">
                                <button
                                  onClick={() => setHideReservesValues(!hideReservesValues)}
                                  className="p-1 rounded-lg text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
                                  title={hideReservesValues ? "Mostrar valores" : "Ocultar valores"}
                                >
                                   {hideReservesValues ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                                </button>
                                <button 
                                  onClick={() => setActiveTab('reserves')}
                                  className="text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline font-semibold flex items-center gap-0.5 ml-1"
                                >
                                   <span>Gerenciar</span>
                                   <ArrowRight className="w-3 h-3" />
                                </button>
                             </div>
                          </div>

                          <div className="flex-1 flex flex-col justify-between space-y-3.5">
                             {/* Patrimônio Guardado Total & Rendimento Passivo Estimado */}
                             <div className="p-3 rounded-xl bg-indigo-50/40 dark:bg-indigo-500/5 border border-indigo-100 dark:border-indigo-500/10 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                <div>
                                   <span className="text-[10px] uppercase font-bold text-indigo-600 dark:text-indigo-400 block tracking-wider">
                                      Total em Reservas
                                   </span>
                                   <span className="text-xl sm:text-2xl font-mono font-extrabold text-gray-900 dark:text-white tabular-nums tracking-tight">
                                      {hideReservesValues ? '••••••••' : formatCurrency(reservesMetrics.total)}
                                   </span>
                                </div>
                                <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 shrink-0">
                                   <Coins className="w-4 h-4 text-emerald-500 shrink-0 animate-bounce" />
                                   <div>
                                      <span className="text-[9px] uppercase font-bold block text-emerald-600/80 dark:text-emerald-400/80">Rendimento Mensal Est.</span>
                                      <span className="text-xs font-mono font-bold block">
                                         {hideReservesValues ? '••••' : `+${formatCurrency(reservesMetrics.estimatedYieldMonthly)}/mês`}
                                      </span>
                                   </div>
                                </div>
                             </div>

                             {/* Blindagem Patrimonial (Runway em Meses e Meta de 6 meses) */}
                             <div className="p-2.5 rounded-xl bg-gray-50/60 dark:bg-white/[0.02] border border-gray-100 dark:border-white/5 space-y-1.5">
                                <div className="flex items-center justify-between">
                                   <div className="flex items-center gap-1.5">
                                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                                      <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                                         Blindagem Financeira
                                      </span>
                                   </div>
                                   <span className="text-[11px] font-mono font-bold text-emerald-600 dark:text-emerald-400">
                                      {reservesMetrics.runwayMonths > 0 ? `${reservesMetrics.runwayMonths.toFixed(1)} meses de cobertura` : 'Sem cobertura ativa'}
                                   </span>
                                </div>
                                
                                {/* Barra de progresso para meta recomendada de 6 meses */}
                                <div className="space-y-1">
                                   <div className="w-full bg-gray-100 dark:bg-white/5 rounded-full h-2 overflow-hidden">
                                      <div 
                                         className={`h-full rounded-full transition-all duration-700 ease-out ${reservesMetrics.shieldProgress >= 100 ? 'bg-emerald-500' : reservesMetrics.shieldProgress >= 50 ? 'bg-indigo-500' : 'bg-amber-500'}`}
                                         style={{ width: `${reservesMetrics.shieldProgress}%` }}
                                      />
                                   </div>
                                   <div className="flex justify-between items-center text-[10px] text-gray-400 font-mono">
                                      <span>{reservesMetrics.shieldProgress}% da meta ideal (6 meses de gastos)</span>
                                      <span className="font-semibold text-gray-700 dark:text-gray-300">
                                         {reservesMetrics.runwayMonths >= 6 ? 'Sólida' : reservesMetrics.runwayMonths >= 3 ? 'Estável' : 'Em construção'}
                                      </span>
                                   </div>
                                </div>
                             </div>

                             {/* Linhas detalhadas das contas */}
                             <div className="space-y-1.5 text-xs">
                                <div className="flex justify-between items-center p-2 rounded-xl bg-gray-50/60 dark:bg-white/[0.02] border border-gray-100 dark:border-white/5">
                                   <div className="flex items-center gap-1.5">
                                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                                      <span className="text-gray-600 dark:text-gray-300 font-medium">Reserva Principal</span>
                                      <span className="text-[10px] text-gray-400 font-mono">({reservesMetrics.reservePct}%)</span>
                                   </div>
                                   <span className="font-bold font-mono text-emerald-600 dark:text-emerald-400 tabular-nums">
                                      {hideReservesValues ? '••••' : formatCurrency(aggregatedReserve.reserve)}
                                   </span>
                                </div>

                                <div className="flex justify-between items-center p-2 rounded-xl bg-gray-50/60 dark:bg-white/[0.02] border border-gray-100 dark:border-white/5">
                                   <div className="flex items-center gap-1.5">
                                      <span className="w-2 h-2 rounded-full bg-indigo-500" />
                                      <span className="text-gray-600 dark:text-gray-300 font-medium">Reserva de Emergência</span>
                                      <span className="text-[10px] text-gray-400 font-mono">({reservesMetrics.emergencyPct}%)</span>
                                   </div>
                                   <span className="font-bold font-mono text-indigo-600 dark:text-indigo-400 tabular-nums">
                                      {hideReservesValues ? '••••' : formatCurrency(aggregatedReserve.emergency)}
                                   </span>
                                </div>

                                <div className="flex justify-between items-center p-2 rounded-xl bg-gray-50/60 dark:bg-white/[0.02] border border-gray-100 dark:border-white/5">
                                   <div className="flex items-center gap-1.5">
                                      <span className="w-2 h-2 rounded-full bg-blue-500" />
                                      <span className="text-gray-600 dark:text-gray-300 font-medium">Carteira Livre</span>
                                      <span className="text-[10px] text-gray-400 font-mono">({reservesMetrics.walletPct}%)</span>
                                   </div>
                                   <span className="font-bold font-mono text-blue-600 dark:text-blue-400 tabular-nums">
                                      {hideReservesValues ? '••••' : formatCurrency(aggregatedReserve.wallet)}
                                   </span>
                                </div>
                             </div>
                          </div>
                       </Card>
                    </div>
                 </div>

                 {/* Right Column: Últimas Transações */}
                 <div 
                   className="glass-card w-full mt-6 lg:mt-0 shrink-0 flex flex-col bg-white dark:bg-[#121214] border border-gray-200 dark:border-white/5 rounded-2xl shadow-sm relative lg:absolute lg:top-0 lg:bottom-0 lg:right-0 group/sidebar h-[520px] lg:h-auto overflow-hidden min-h-0"
                   style={{ width: `${rightSidebarWidth}px` }}
                 >
                    {/* Resize Handle */}
                    <div 
                      className="hidden lg:flex absolute left-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-emerald-500/20 z-20 transition-colors items-center justify-center translate-x-[-50%]"
                      onMouseDown={handleResizeStart}
                    >
                      <div className="w-1 h-8 rounded-full bg-gray-300 dark:bg-gray-600 opacity-40 group-hover/sidebar:opacity-100" />
                    </div>
                    
                    <div className="flex flex-col h-full overflow-hidden relative z-10 min-h-0">
                      <div className="glass-header p-4 border-b border-gray-100 dark:border-white/5 flex flex-col gap-2.5 sticky top-0 z-10 bg-white dark:bg-[#121214]">
                          <div className="flex items-center justify-between">
                             <div className="flex items-center gap-2">
                                <List className="w-4 h-4 text-emerald-500" />
                                <div className="flex items-center gap-1.5">
                                  <h2 className="text-xs font-bold uppercase tracking-wider text-gray-900 dark:text-white">Últimas do Mês</h2>
                                  <Chip 
                                    size="sm" 
                                    variant="soft" 
                                    color="success" 
                                    className="text-[10px] font-mono h-5 px-1.5 font-bold"
                                  >
                                    {recentTransactions.length}
                                  </Chip>
                                </div>
                             </div>
                             <div className="flex items-center gap-1.5">
                                <button
                                  onClick={() => {
                                    setShowRecentSearch(prev => !prev);
                                    if (showRecentSearch) setRecentTxSearch('');
                                  }}
                                  className={`p-1.5 rounded-lg transition-colors ${showRecentSearch || recentTxSearch ? 'text-emerald-500 bg-emerald-50 dark:bg-emerald-500/10' : 'text-gray-400 hover:text-gray-600 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5'}`}
                                  title="Filtrar movimentações"
                                >
                                  <Search className="w-3.5 h-3.5" />
                                </button>
                                {budget?.transactionsOrder && budget.transactionsOrder.length > 0 && (
                                  <button 
                                    onClick={handleResetTransactionOrder} 
                                    className="text-[11px] text-gray-400 hover:text-emerald-500 flex items-center gap-1 transition-colors px-1.5 py-0.5 rounded-md hover:bg-gray-100 dark:hover:bg-white/5" 
                                    title="Restaurar ordenação por data"
                                  >
                                    <RefreshCw className="w-3 h-3" />
                                    <span className="hidden sm:inline">Por data</span>
                                  </button>
                                )}
                                <button onClick={() => setActiveTab('transactions')} className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline font-medium">Ver tudo &rarr;</button>
                             </div>
                          </div>

                          {showRecentSearch && (
                             <div className="relative">
                                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                                <input
                                  type="text"
                                  value={recentTxSearch}
                                  onChange={(e) => setRecentTxSearch(e.target.value)}
                                  placeholder="Buscar por valor (ex: 150), nome, categoria..."
                                  className="w-full text-xs pl-8 pr-7 py-1.5 rounded-lg border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 focus:outline-none focus:border-emerald-500 text-gray-900 dark:text-white"
                                  autoFocus
                                />
                                {recentTxSearch && (
                                  <button 
                                    onClick={() => setRecentTxSearch('')} 
                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-white p-0.5"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                )}
                             </div>
                          )}

                          <div className="flex items-center justify-between text-[10px] text-gray-400">
                             <span>
                               {recentTxSearch 
                                 ? `${displayedRecentTransactions.length} de ${recentTransactions.length} filtradas` 
                                 : `${recentTransactions.length} movimentações no mês`}
                             </span>
                             <span>{recentTxSearch ? "Filtro ativo" : "Arraste para reorganizar"}</span>
                          </div>
                      </div>
                      <div className="flex-1 min-h-0 overflow-y-auto p-2.5 overscroll-contain">
                      {displayedRecentTransactions.length > 0 ? (
                         <div className="flex flex-col gap-1.5">
                            {displayedRecentTransactions.map((tx, idx) => (
                               <div 
                                 key={tx.id} 
                                 draggable="true"
                                 onDragStart={(e) => {
                                   e.dataTransfer.effectAllowed = 'move';
                                   e.dataTransfer.setData('text/plain', String(idx));
                                   setDraggedTxIdx(idx);
                                 }}
                                 onDragOver={(e) => {
                                   e.preventDefault();
                                   e.dataTransfer.dropEffect = 'move';
                                   if (draggedTxIdx === null || draggedTxIdx === idx) return;
                                   setDragOverTxIdx(idx);
                                 }}
                                 onDragLeave={() => {
                                   if (dragOverTxIdx === idx) setDragOverTxIdx(null);
                                 }}
                                 onDrop={(e) => {
                                   e.preventDefault();
                                   if (draggedTxIdx === null || draggedTxIdx === idx) return;
                                   handleReorderTransaction(draggedTxIdx, idx);
                                   setDraggedTxIdx(null);
                                   setDragOverTxIdx(null);
                                 }}
                                 onDragEnd={() => {
                                   setDraggedTxIdx(null);
                                   setDragOverTxIdx(null);
                                 }}
                                 onClick={(e) => { e.stopPropagation(); setTxToEdit(tx); setIsModalOpen(true); }} 
                                 className={`glass-subtle flex items-center justify-between p-2.5 rounded-xl cursor-pointer hover:bg-gray-100/70 dark:hover:bg-white/[0.04] transition-all group border ${
                                   draggedTxIdx === idx 
                                     ? 'opacity-35 border-dashed border-emerald-500 scale-[0.98] bg-gray-50/50 dark:bg-white/[0.02]' 
                                     : dragOverTxIdx === idx 
                                       ? 'bg-emerald-50/70 dark:bg-emerald-500/10 border-emerald-500 shadow-sm ring-1 ring-emerald-500' 
                                       : 'border-transparent hover:border-gray-200/70 dark:hover:border-white/10'
                                 }`}
                               >
                                  <div className="flex items-center gap-2.5 min-w-0 pr-2">
                                     <div 
                                       className="cursor-grab active:cursor-grabbing text-gray-300 dark:text-gray-600 group-hover:text-gray-500 dark:group-hover:text-gray-300 transition-colors p-0.5 shrink-0 touch-none"
                                       title="Arraste para reorganizar"
                                       onClick={(e) => e.stopPropagation()}
                                     >
                                        <GripVertical className="w-3.5 h-3.5" />
                                     </div>

                                     {/* Type/Category Avatar Badge */}
                                     <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border ${
                                       tx.type === 'income'
                                         ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                                         : (tx.paymentMethod === 'Crédito' || tx.paymentMethod === 'Débito')
                                           ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20'
                                           : 'bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-300 border-gray-200/60 dark:border-white/10'
                                     }`}>
                                       {tx.type === 'income' ? (
                                         <TrendingUp className="w-3.5 h-3.5" />
                                       ) : (tx.paymentMethod === 'Crédito' || tx.paymentMethod === 'Débito') ? (
                                         <CreditCard className="w-3.5 h-3.5" />
                                       ) : (
                                         <Tag className="w-3.5 h-3.5" />
                                       )}
                                     </div>

                                     <div className="flex flex-col min-w-0">
                                        <div className="flex items-center gap-1.5">
                                          <span className="font-semibold text-xs text-gray-900 dark:text-white truncate">
                                            {tx.description}
                                          </span>
                                          {tx.installments && (
                                            <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded-md bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 shrink-0">
                                              {tx.installmentNumber}/{tx.installments}
                                            </span>
                                          )}
                                        </div>
                                        <div className="flex items-center gap-1.5 mt-0.5 text-[10px] text-gray-400 truncate">
                                           <span>{new Date(tx.date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}</span>
                                           <span aria-hidden="true">&bull;</span>
                                           <span className="truncate">{tx.category}</span>
                                           {tx.paymentMethod && (
                                             <>
                                               <span aria-hidden="true">&bull;</span>
                                               <span className="truncate">{tx.paymentMethod}{tx.card ? ` (${tx.card})` : ''}</span>
                                             </>
                                           )}
                                        </div>
                                     </div>
                                  </div>

                                  <div className="flex items-center gap-2 shrink-0">
                                    <span className={`text-xs font-bold font-mono tabular-nums ${tx.type === 'income' ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-900 dark:text-white'}`}>
                                       {tx.type === 'income' ? '+ ' : '- '}{formatCurrency(tx.amount)}
                                    </span>
                                    <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                                      <button 
                                         onClick={(e) => { 
                                            e.stopPropagation(); 
                                            const { id, ...copyTx } = tx; 
                                            setTxToEdit(copyTx as Transaction); 
                                            setIsModalOpen(true); 
                                         }} 
                                         className="p-1 text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/10 rounded-lg transition-colors" 
                                         title="Duplicar"
                                      >
                                        <Copy className="w-3.5 h-3.5" />
                                      </button>
                                      <button 
                                         onClick={(e) => { 
                                            e.stopPropagation(); 
                                            setTransactionToDelete(tx); 
                                         }} 
                                         className="p-1 text-gray-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-lg transition-colors" 
                                         title="Excluir"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  </div>
                               </div>
                            ))}
                         </div>
                      ) : (
                         <div className="py-16 flex flex-col items-center justify-center text-center px-4">
                            <div className="w-10 h-10 rounded-2xl bg-gray-100 dark:bg-white/5 flex items-center justify-center text-gray-400 mb-2">
                              <List className="w-5 h-5" />
                            </div>
                            <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                              {recentTxSearch ? "Nenhuma movimentação para esta busca" : "Sem movimentações registradas neste mês"}
                            </p>
                            {recentTxSearch && (
                              <button 
                                onClick={() => setRecentTxSearch('')}
                                className="mt-2 text-xs text-emerald-600 dark:text-emerald-400 hover:underline"
                              >
                                Limpar busca
                              </button>
                            )}
                         </div>
                      )}
                    </div>
                    </div>
                 </div>
              </div>
           )}

           {activeTab === 'reserves' && (
             <ReservesTab userId={user.uid} year={currentYear} />
           )}

           {activeTab === 'transactions' && (
             <TransactionsTab userId={user.uid} transactions={transactions} onEdit={(t) => { setTxToEdit(t); setIsModalOpen(true); }} userSettings={userSettings} />
           )}

           {activeTab === 'analysis' && (
             <AnalysisTab transactions={transactions} currentYear={currentYear} currentMonth={currentMonth} />
           )}

           {activeTab === 'debts' && (
             <DividasTab userId={user.uid} userSettings={userSettings} />
           )}

           {activeTab === 'integration' && (
             <IntegrationTab user={user} userSettings={userSettings} />
           )}

           {activeTab === 'settings' && (
             <SettingsTab user={user} userSettings={userSettings} isLiquidGlass={isLiquidGlass} setIsLiquidGlass={setIsLiquidGlass} />
           )}
        </div>
      </main>

      <TransactionModal isOpen={isModalOpen} onClose={() => { setIsModalOpen(false); setTxToEdit(null); }} userId={user.uid} userSettings={userSettings} initialData={txToEdit} initialType={txInitialType} />

      {transactionToDelete && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-card bg-white dark:bg-[#121214] border border-gray-200 dark:border-white/10 p-6 sm:p-8 rounded-3xl max-w-md w-full shadow-2xl">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Excluir Transação</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 leading-relaxed">
              Tem certeza de que deseja remover permanentemente o registro de <strong>{transactionToDelete.description}</strong>?
            </p>
            
            {isInstallment(transactionToDelete) && (
              <label className="flex items-start gap-3 mb-6 p-4 bg-gray-50 dark:bg-white/5 rounded-2xl border border-gray-200 dark:border-white/10 cursor-pointer text-xs">
                <input 
                  type="checkbox" 
                  checked={deleteSubsequent}
                  onChange={e => setDeleteSubsequent(e.target.checked)}
                  className="mt-0.5 rounded text-emerald-500 focus:ring-emerald-500"
                />
                <span className="text-gray-700 dark:text-gray-300">
                  Excluir também as <strong>{getSubsequentInstallments(transactionToDelete).length}</strong> parcelas futuras vinculadas.
                </span>
              </label>
            )}

            <div className="flex gap-3 justify-end">
              <button 
                onClick={() => setTransactionToDelete(null)}
                disabled={isDeleting}
                className="px-4 py-2 rounded-xl text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button 
                onClick={confirmDelete}
                disabled={isDeleting}
                className="px-4 py-2 rounded-xl text-sm font-medium text-white bg-rose-500 hover:bg-rose-600 shadow-sm transition-colors disabled:opacity-50"
              >
                {isDeleting ? 'Excluindo...' : 'Confirmar Exclusão'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
