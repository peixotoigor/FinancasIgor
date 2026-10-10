import { useEffect, useState, useMemo } from 'react';
import { auth, googleProvider, db, handleFirestoreError, OperationType } from './lib/firebase';
import { signInWithPopup, signOut, onAuthStateChanged, User } from 'firebase/auth';
import type { Transaction } from './types';
import { collection, query, where, onSnapshot, doc, setDoc, orderBy, deleteDoc, writeBatch, getDoc } from 'firebase/firestore';
import { LogOut, Plus, Wallet, FileText, Settings, Bot, BarChart3, LayoutDashboard, List, PiggyBank, ChevronDown, ChevronUp, Eye, EyeOff, X, Sun, Moon, TrendingUp, TrendingDown, Activity, Landmark, AlertCircle, Cloud, CheckCircle2, RefreshCw, CloudOff, Trash2, Copy, GripVertical } from 'lucide-react';
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
      <div className="min-h-screen bg-gray-50 dark:bg-[#0A0A0B] text-gray-900 dark:text-white flex items-center justify-center p-4 font-sans">
        <div className="w-full max-w-md bg-white dark:bg-[#121214] border border-gray-200 dark:border-white/5 rounded-3xl p-8 sm:p-10 shadow-xl text-center">
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
            className="w-full flex items-center justify-center gap-3 bg-white dark:bg-[#1A1A1D] hover:bg-gray-50 dark:hover:bg-white/10 text-gray-900 dark:text-white border border-gray-200 dark:border-white/10 rounded-2xl px-6 py-3.5 font-medium shadow-sm transition-all duration-200"
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
  const [syncState, setSyncState] = useState({ transactions: false, budgets: false, settings: false, inbox: false });
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

  // Load User Settings
  const [userSettings, setUserSettings] = useState<UserSettings | null>(null);
  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(doc(db, 'user_settings', user.uid), (docSnap) => {
      if (docSnap.exists()) {
        setUserSettings(docSnap.data() as UserSettings);
      } else {
        const initialSettings: UserSettings = {
          userId: user.uid,
          categories: ['Alimentação', 'Moradia', 'Transporte', 'Lazer', 'Saúde', 'Educação', 'Dívidas e Empréstimos', 'Outros'],
          incomeCategories: ['Salário', 'Investimentos', 'Freelance', 'Outros'],
          paymentMethods: ['Crédito', 'Débito', 'Pix', 'Dinheiro'],
          cards: ['Nubank', 'Inter'],
          updatedAt: Date.now()
        };
        setDoc(doc(db, 'user_settings', user.uid), initialSettings);
      }
      setSyncState(s => ({ ...s, settings: true }));
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
      const txs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Transaction));
      txs.sort((a, b) => b.date - a.date);
      setTransactions(txs);
      setTransactionsLoaded(true);
      setSyncState(s => ({ ...s, transactions: true }));
    });
    return unsub;
  }, [user]);

  // Load Monthly Budgets
  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'monthly_budgets'),
      where('userId', '==', user.uid)
    );
    const unsub = onSnapshot(q, (snapshot) => {
      const bList = snapshot.docs.map(doc => doc.data() as MonthlyBudget);
      setAllBudgets(bList);
      
      const current = bList.find(b => b.year === currentYear && b.month === currentMonth);
      if (current) {
        setBudget(current);
      } else {
        setBudget(null);
      }
      setSyncState(s => ({ ...s, budgets: true }));
    });
    return unsub;
  }, [user, currentYear, currentMonth]);

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

  const recentTransactions = useMemo(() => {
    return orderedCurrentMonthTransactions.slice(0, 15);
  }, [orderedCurrentMonthTransactions]);

  const handleReorderTransaction = async (fromIdx: number, toIdx: number) => {
    if (fromIdx === toIdx || fromIdx < 0 || toIdx < 0) return;
    const reordered = [...recentTransactions];
    const [moved] = reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, moved);

    const remainingIds = orderedCurrentMonthTransactions.slice(15).map(t => t.id!).filter(Boolean);
    const newOrderIds = [...reordered.map(t => t.id!).filter(Boolean), ...remainingIds];

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
    <div className="flex flex-col-reverse md:flex-row h-[100dvh] w-full bg-gray-50 dark:bg-[#0A0A0B] text-gray-900 dark:text-white font-sans overflow-hidden">
      {/* Sidebar Navigation */}
      <nav className="w-full md:w-20 bg-white dark:bg-[#121214] border-t md:border-t-0 md:border-r border-gray-200 dark:border-white/5 flex flex-row md:flex-col items-center justify-around md:justify-start pt-2 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] md:py-6 md:gap-4 min-h-[4rem] md:h-full shrink-0 z-50">
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

      <main className="flex-1 flex flex-col gap-6 p-4 md:p-8 lg:p-10 overflow-y-auto w-full bg-gray-50 dark:bg-[#0A0A0B]">
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

              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white dark:bg-[#121214] border border-gray-200 dark:border-white/5 text-xs text-gray-500 dark:text-gray-400" title={Object.values(syncState).some(Boolean) ? "Sincronizando..." : "Sincronizado"}>
                {Object.values(syncState).some(Boolean) ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-500" />
                      <span className="text-[11px] font-medium hidden sm:inline">Sync</span>
                    </>
                ) : (
                    <>
                      <Cloud className="w-3.5 h-3.5 text-gray-400" />
                      <span className="text-[11px] font-medium hidden sm:inline">Online</span>
                    </>
                )}
              </div>

              <button 
                onClick={() => { setTxToEdit(null); setTxInitialType('expense'); setIsModalOpen(true); }}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-sm font-medium shadow-sm transition-colors shrink-0"
              >
                 <Plus className="w-4 h-4" />
                 <span className="hidden sm:inline">Nova Transação</span>
              </button>
           </div>
        </header>

        {/* Dynamic Tab Body */}
        <div className="flex-1 min-h-0">
           {activeTab === 'dashboard' && (
              <div className="flex flex-col lg:flex-row gap-6 relative min-h-full">
                 <div className="flex-1 space-y-6 lg:mr-[var(--sidebar-width,380px)]" style={{ '--sidebar-width': `${rightSidebarWidth + 24}px` } as React.CSSProperties}>
                    {/* Top 3 Metric Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                       {/* Total Receitas */}
                       <div className="bg-white dark:bg-[#121214] p-5 sm:p-6 rounded-2xl border border-gray-200 dark:border-white/5 shadow-sm flex flex-col justify-between">
                          <div className="flex items-center justify-between mb-4">
                             <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Receitas</span>
                             <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                                <TrendingUp className="w-4 h-4" />
                             </div>
                          </div>
                          <div>
                             <p className="text-2xl sm:text-3xl font-bold font-mono text-gray-900 dark:text-white truncate">{formatCurrency(totalIncome)}</p>
                          </div>
                       </div>

                       {/* Total Despesas */}
                       <div className="bg-white dark:bg-[#121214] p-5 sm:p-6 rounded-2xl border border-gray-200 dark:border-white/5 shadow-sm flex flex-col justify-between">
                          <div className="flex items-center justify-between mb-4">
                             <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Despesas</span>
                             <div className="p-2 rounded-xl bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400">
                                <TrendingDown className="w-4 h-4" />
                             </div>
                          </div>
                          <div>
                             <p className="text-2xl sm:text-3xl font-bold font-mono text-gray-900 dark:text-white truncate">{formatCurrency(totalExpense)}</p>
                          </div>
                       </div>

                       {/* Balanço Mês */}
                       <div className="bg-white dark:bg-[#121214] p-5 sm:p-6 rounded-2xl border border-gray-200 dark:border-white/5 shadow-sm flex flex-col justify-between">
                          <div className="flex items-center justify-between mb-4">
                             <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Balanço Mês</span>
                             <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400">
                                <Wallet className="w-4 h-4" />
                             </div>
                          </div>
                          <div>
                             <p className={`text-2xl sm:text-3xl font-bold font-mono truncate ${totalIncome - totalExpense >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                               {formatCurrency(totalIncome - totalExpense)}
                             </p>
                          </div>
                       </div>
                    </div>

                    {/* Quick Add For Dashboard */}
                    <QuickAddTransaction userId={user.uid} userSettings={userSettings} />
                    <AIFinancialForecast userId={user.uid} transactions={transactions} currentMonthBudget={budget} currentYear={currentYear} currentMonth={currentMonth} userSettings={userSettings} />

                    {/* Planejamento Mensal */}
                    <MonthlyPlanning userId={user.uid} year={currentYear} month={currentMonth} budget={budget} transactions={currentMonthTransactions} transactionsLoaded={transactionsLoaded} userSettings={userSettings} />

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-6">
                       {/* Análise Mês */}
                       <div className="bg-white dark:bg-[#121214] p-5 lg:p-6 rounded-2xl border border-gray-200 dark:border-white/5 shadow-sm flex flex-col">
                          <div className="flex items-center justify-between mb-5">
                             <div className="flex items-center gap-2">
                               <BarChart3 className="w-4 h-4 text-emerald-500" />
                               <span className="text-sm font-bold text-gray-900 dark:text-white">Análise de Consumo</span>
                             </div>
                             <span className="text-xs font-bold text-gray-500 dark:text-gray-400">{expensePercentage.toFixed(1)}%</span>
                          </div>
                         
                          <div className="flex-1 flex flex-col justify-between space-y-6">
                             <div>
                                <div className="flex justify-between items-end mb-2 text-xs">
                                   <span className="text-gray-500 dark:text-gray-400">Comprometimento</span>
                                   <span className="font-semibold text-gray-900 dark:text-white">{expensePercentage.toFixed(1)}% da renda</span>
                                </div>
                                <div className="w-full bg-gray-100 dark:bg-white/5 rounded-full h-2.5 overflow-hidden">
                                   <div 
                                     className={`h-full rounded-full transition-all duration-300 ${expensePercentage > 80 ? 'bg-rose-500' : expensePercentage > 60 ? 'bg-amber-500' : 'bg-emerald-500'}`} 
                                     style={{ width: `${Math.min(expensePercentage, 100)}%` }}
                                   ></div>
                                </div>
                                {expensePercentage > 80 && (
                                   <p className="text-xs text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-500/10 rounded-xl p-2.5 mt-3 flex items-start gap-2">
                                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                                      Alerta: Gastos atingiram nível elevado em relação à receita declarada.
                                   </p>
                                 )}
                             </div>

                             <div>
                                <span className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 block mb-3">Maiores Ofensores</span>
                                {topCategories.length > 0 ? (
                                  <div className="space-y-3">
                                    {topCategories.slice(0, 3).map(([cat, amt], idx) => (
                                      <div key={idx} className="flex flex-col gap-1">
                                         <div className="flex justify-between items-center text-xs">
                                            <span className="text-gray-700 dark:text-gray-300 font-medium">{cat}</span>
                                            <span className="font-bold text-gray-900 dark:text-white font-mono">{formatCurrency(amt as number)}</span>
                                         </div>
                                         <div className="w-full bg-gray-100 dark:bg-white/5 rounded-full h-2 overflow-hidden">
                                            <div 
                                              className="h-full bg-emerald-500 rounded-full" 
                                              style={{ width: `${Math.min(((amt as number)/totalExpense)*100, 100)}%` }}
                                            ></div>
                                         </div>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <div className="py-4 text-center">
                                     <p className="text-xs text-gray-400">Nenhum gasto no período.</p>
                                  </div>
                                )}
                             </div>
                          </div>
                       </div>

                       {/* Resumo Reservas */}
                       <div className="bg-white dark:bg-[#121214] p-5 lg:p-6 rounded-2xl border border-gray-200 dark:border-white/5 shadow-sm flex flex-col">
                          <div className="flex items-center justify-between mb-5">
                             <div className="flex items-center gap-2">
                                 <PiggyBank className="w-4 h-4 text-indigo-500" />
                                 <span className="text-sm font-bold text-gray-900 dark:text-white">Posição de Reservas</span>
                             </div>
                             <button
                               onClick={() => setHideReservesValues(!hideReservesValues)}
                               className="p-1.5 rounded-lg text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
                               title={hideReservesValues ? "Mostrar valores" : "Ocultar valores"}
                             >
                                {hideReservesValues ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                             </button>
                          </div>

                          {budget ? (
                             <div className="flex-1 flex flex-col gap-2.5 text-xs">
                                <div className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-white/5">
                                   <span className="text-gray-500 dark:text-gray-400">Salário Declarado</span>
                                   <span className="font-bold font-mono text-gray-900 dark:text-white">
                                      {hideReservesValues ? '••••' : formatCurrency(budget.salary)}
                                   </span>
                                </div>
                                <div className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-white/5">
                                   <span className="text-gray-500 dark:text-gray-400">Reserva Principal</span>
                                   <span className="font-bold font-mono text-emerald-600 dark:text-emerald-400">
                                      {hideReservesValues ? '••••' : formatCurrency(aggregatedReserve.reserve)}
                                   </span>
                                </div>
                                <div className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-white/5">
                                   <span className="text-gray-500 dark:text-gray-400">Reserva de Emergência</span>
                                   <span className="font-bold font-mono text-indigo-600 dark:text-indigo-400">
                                      {hideReservesValues ? '••••' : formatCurrency(aggregatedReserve.emergency)}
                                   </span>
                                </div>
                                <div className="flex justify-between items-center py-2">
                                   <span className="text-gray-500 dark:text-gray-400">Carteira Livre</span>
                                   <span className="font-bold font-mono text-blue-600 dark:text-blue-400">
                                      {hideReservesValues ? '••••' : formatCurrency(aggregatedReserve.wallet)}
                                   </span>
                                </div>
                             </div>
                          ) : (
                             <div className="flex-1 flex items-center justify-center p-4 rounded-xl border border-dashed border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/[0.02]">
                                <p className="text-xs text-gray-400 text-center">Nenhum valor base ajustado<br/>para este mês.</p>
                             </div>
                          )}
                       </div>
                    </div>
                 </div>

                 {/* Right Column: Últimas Transações */}
                 <div 
                   className="w-full mt-6 lg:mt-0 shrink-0 flex flex-col bg-white dark:bg-[#121214] border border-gray-200 dark:border-white/5 rounded-2xl shadow-sm relative lg:absolute lg:top-0 lg:bottom-0 lg:right-0 group/sidebar h-[500px] lg:h-auto overflow-hidden"
                   style={{ width: `${rightSidebarWidth}px` }}
                 >
                    {/* Resize Handle */}
                    <div 
                      className="hidden lg:flex absolute left-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-emerald-500/20 z-20 transition-colors items-center justify-center translate-x-[-50%]"
                      onMouseDown={handleResizeStart}
                    >
                      <div className="w-1 h-8 rounded-full bg-gray-300 dark:bg-gray-600 opacity-40 group-hover/sidebar:opacity-100" />
                    </div>
                    
                    <div className="flex flex-col h-full overflow-hidden relative z-10">
                      <div className="p-4 border-b border-gray-100 dark:border-white/5 flex items-center justify-between sticky top-0 z-10 bg-white dark:bg-[#121214]">
                          <div className="flex items-center gap-2">
                             <List className="w-4 h-4 text-emerald-500" />
                             <div>
                               <h2 className="text-xs font-bold uppercase tracking-wider text-gray-900 dark:text-white">Últimas do Mês</h2>
                               <span className="text-[10px] text-gray-400 block -mt-0.5">Arraste para reorganizar</span>
                             </div>
                          </div>
                          <div className="flex items-center gap-2.5">
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
                      <div className="flex-1 overflow-auto p-2">
                      {recentTransactions.length > 0 ? (
                         <div className="flex flex-col gap-1.5">
                            {recentTransactions.map((tx, idx) => (
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
                                 className={`flex items-center justify-between p-2.5 sm:p-3 rounded-xl cursor-pointer hover:bg-gray-50 dark:hover:bg-white/5 transition-all group border ${
                                   draggedTxIdx === idx 
                                     ? 'opacity-35 border-dashed border-emerald-500 scale-[0.98] bg-gray-50/50 dark:bg-white/[0.02]' 
                                     : dragOverTxIdx === idx 
                                       ? 'bg-emerald-50/70 dark:bg-emerald-500/10 border-emerald-500 shadow-sm ring-1 ring-emerald-500' 
                                       : 'border-transparent hover:border-gray-200/60 dark:hover:border-white/5'
                                 }`}
                               >
                                  <div className="flex items-center gap-2 min-w-0 pr-2">
                                     <div 
                                       className="cursor-grab active:cursor-grabbing text-gray-300 dark:text-gray-600 group-hover:text-gray-500 dark:group-hover:text-gray-300 transition-colors p-0.5 shrink-0 touch-none"
                                       title="Arraste para reorganizar"
                                       onClick={(e) => e.stopPropagation()}
                                     >
                                        <GripVertical className="w-3.5 h-3.5" />
                                     </div>

                                     <div className="flex flex-col min-w-0">
                                        <span className="font-medium text-sm text-gray-900 dark:text-white truncate">
                                          {tx.description} {tx.installments ? <span className="text-[10px] bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-gray-300 px-1.5 py-0.5 rounded ml-1 font-mono">{tx.installmentNumber}/{tx.installments}</span> : ''}
                                        </span>
                                        <div className="flex items-center gap-2 mt-0.5 flex-wrap text-[11px] text-gray-400">
                                           <span>{new Date(tx.date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}</span>
                                           <span>&bull;</span>
                                           <span>{tx.category}</span>
                                           {tx.paymentMethod && (
                                             <>
                                               <span>&bull;</span>
                                               <span>{tx.paymentMethod}{tx.card ? ` (${tx.card})` : ''}</span>
                                             </>
                                           )}
                                        </div>
                                     </div>
                                  </div>

                                  <div className="flex items-center gap-2 shrink-0">
                                    <span className={`text-xs font-bold font-mono ${tx.type === 'income' ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-900 dark:text-white'}`}>
                                       {tx.type === 'income' ? '+ ' : '- '}{formatCurrency(tx.amount)}
                                    </span>
                                    <button 
                                       onClick={(e) => { 
                                          e.stopPropagation(); 
                                          const { id, ...copyTx } = tx; 
                                          setTxToEdit(copyTx as Transaction); 
                                          setIsModalOpen(true); 
                                       }} 
                                       className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-white opacity-0 group-hover:opacity-100 transition-opacity" 
                                       title="Duplicar"
                                    >
                                      <Copy className="w-3.5 h-3.5" />
                                    </button>
                                    <button 
                                       onClick={(e) => { 
                                          e.stopPropagation(); 
                                          setTransactionToDelete(tx); 
                                       }} 
                                       className="p-1 text-gray-400 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity" 
                                       title="Excluir"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                               </div>
                            ))}
                         </div>
                      ) : (
                         <div className="py-12 flex flex-col items-center justify-center text-center">
                            <p className="text-xs text-gray-400">Sem movimentações recentes</p>
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
             <SettingsTab user={user} userSettings={userSettings} />
           )}
        </div>
      </main>

      <TransactionModal isOpen={isModalOpen} onClose={() => { setIsModalOpen(false); setTxToEdit(null); }} userId={user.uid} userSettings={userSettings} initialData={txToEdit} initialType={txInitialType} />

      {transactionToDelete && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#121214] border border-gray-200 dark:border-white/10 p-6 sm:p-8 rounded-3xl max-w-md w-full shadow-2xl">
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
