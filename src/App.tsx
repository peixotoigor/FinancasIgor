import { useEffect, useState, useMemo } from 'react';
import { auth, googleProvider, db, handleFirestoreError, OperationType } from './lib/firebase';
import { signInWithPopup, signOut, onAuthStateChanged, User } from 'firebase/auth';
import type { Transaction } from './types';
import { collection, query, where, onSnapshot, doc, setDoc, orderBy, deleteDoc, writeBatch, getDoc } from 'firebase/firestore';
import { LogOut, Plus, Wallet, FileText, Settings, Bot, BarChart3, LayoutDashboard, List, PiggyBank, ChevronDown, ChevronUp, Eye, EyeOff, X, Sun, Moon, TrendingUp, TrendingDown, Activity, AlertCircle, Cloud, CheckCircle2, RefreshCw, CloudOff, Trash2, Copy } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TransactionModal } from './components/TransactionModal';
import { AnalysisTab } from './components/AnalysisTab';
import { TransactionsTab } from './components/TransactionsTab';
import { ReservesTab } from './components/ReservesTab';
import { IntegrationTab } from './components/IntegrationTab';
import { QuickAddTransaction } from './components/QuickAddTransaction';
import { MonthlyPlanning } from './components/MonthlyPlanning';
import { MonthYearPicker } from './components/MonthYearPicker';
import type { MonthlyBudget, UserSettings } from './types';

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

  if (loading) return <div className="min-h-[100dvh] bg-gray-50 dark:bg-[#0A0A0B] text-gray-800 dark:text-gray-200 flex items-center justify-center font-mono">Carregando...</div>;

  if (!user) {
    return (
      <div className="min-h-screen bg-white dark:bg-[#0B0B0C] flex flex-col lg:flex-row w-full relative overflow-hidden font-sans selection:bg-emerald-500/30">
        {/* Left Side / Top Side on Mobile */}
        <div className="w-full lg:w-[55%] relative flex flex-col justify-center lg:justify-between p-8 lg:p-12 bg-[#0B0B0C] text-white overflow-hidden min-h-[50vh] lg:min-h-screen shrink-0">
          {/* Subtle noise/grid background texture */}
          <div className="absolute inset-0 opacity-[0.03] z-0" style={{ backgroundImage: 'linear-gradient(#ffffff 1px, transparent 1px), linear-gradient(90deg, #ffffff 1px, transparent 1px)', backgroundSize: '40px 40px' }}></div>
          <div className="absolute top-0 right-0 w-full h-full bg-gradient-to-br from-emerald-500/10 via-transparent to-transparent z-0 blur-3xl pointer-events-none"></div>

          <div className="relative z-10 flex items-center gap-3 mb-10 lg:mb-0">
             <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/20 text-black font-bold text-xl">$</div>
             <span className="font-semibold text-lg tracking-tight text-white">Finanças Pessoais</span>
          </div>

          <div className="relative z-10 max-w-2xl my-auto lg:mb-10 w-full">
            <h1 className="text-4xl sm:text-5xl lg:text-5xl xl:text-6xl font-bold tracking-tighter leading-[1.1] mb-6 text-white max-w-[15ch] sm:max-w-none">
              O controle que você <span className="text-emerald-400 italic font-mono font-medium tracking-tight whitespace-nowrap">sempre quis</span>,<br className="hidden sm:block" />em um só lugar.
            </h1>
            <p className="text-base sm:text-lg text-gray-400 font-light mb-8 lg:mb-12 max-w-xl leading-relaxed">
              Gestão inteligente de gastos, acompanhamento de reservas no detalhe e bot integrado ao Telegram para registrar movimentações.
            </p>
            
            <div className="flex flex-col gap-4">
               <div className="flex items-center gap-4 border border-white/10 bg-white/[0.02] p-4 rounded-2xl backdrop-blur-sm max-w-md transform transition duration-300 hover:-translate-y-1 hover:bg-white/[0.04]">
                 <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center shrink-0 border border-white/5 shadow-inner">
                   <Bot className="w-6 h-6 text-emerald-400" />
                 </div>
                 <div>
                   <h3 className="font-semibold text-white tracking-tight text-sm sm:text-base">Assistência Inteligente</h3>
                   <p className="text-xs sm:text-sm text-gray-400 mt-0.5">Adicione transações via chat Telegram.</p>
                 </div>
               </div>

               <div className="flex items-center gap-4 border border-white/10 bg-white/[0.02] p-4 rounded-2xl backdrop-blur-sm max-w-md lg:ml-8 transform transition duration-300 hover:-translate-y-1 hover:bg-white/[0.04]">
                 <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center shrink-0 border border-white/5 shadow-inner">
                   <PiggyBank className="w-6 h-6 text-blue-400" />
                 </div>
                 <div>
                   <h3 className="font-semibold text-white tracking-tight text-sm sm:text-base">Múltiplas Reservas</h3>
                   <p className="text-xs sm:text-sm text-gray-400 mt-0.5">Acompanhe sua Reserva de Emergência.</p>
                 </div>
               </div>
            </div>
          </div>

          <div className="hidden lg:flex relative z-10 text-sm py-2 px-4 rounded-full border border-white/10 bg-white/5 backdrop-blur-sm self-start text-gray-400 font-medium tracking-wide">
            Pronto para uma nova experiência financeira.
          </div>
        </div>

        {/* Right Side - Login Form */}
        <div className="w-full lg:w-[45%] flex flex-col justify-center px-6 py-12 lg:py-0 sm:px-12 md:px-24 bg-white dark:bg-[#121214] relative z-20 lg:border-l border-gray-100 dark:border-white/5 shadow-[0_-20px_40px_rgba(0,0,0,0.2)] lg:shadow-none flex-1 mt-[-2rem] lg:mt-0 rounded-t-3xl lg:rounded-none">
           <div className="w-12 h-1.5 bg-gray-200 dark:bg-white/10 rounded-full mx-auto mb-8 lg:hidden"></div>
           
           <div className="w-full max-w-sm mx-auto flex flex-col h-full justify-center">
             <div className="mb-10 text-center lg:text-left">
               <h2 className="text-3xl font-bold mb-3 tracking-tighter text-gray-900 dark:text-white">Acessar Conta</h2>
               <p className="text-gray-500 text-sm md:text-base leading-relaxed">
                 Faça login de forma segura e rápida usando sua conta do Google para continuar.
               </p>
             </div>
             
             <button 
               onClick={() => signInWithPopup(auth, googleProvider).catch(e => console.error(e.message || String(e)))}
               className="w-full group relative flex items-center justify-center gap-3 bg-white dark:bg-[#1A1A1D] border-2 border-gray-200 dark:border-white/10 px-4 py-4 rounded-2xl hover:border-emerald-500 hover:bg-emerald-50/50 dark:hover:border-emerald-500/50 dark:hover:bg-emerald-900/20 active:scale-[0.98] transition-all duration-300 shadow-sm"
             >
               <svg className="w-5 h-5 transition-transform group-hover:scale-110" viewBox="0 0 24 24">
                  <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
               </svg>
               <span className="font-semibold text-gray-700 dark:text-gray-200 group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors">
                 Continuar com Google
               </span>
             </button>

             <div className="mt-12 text-center flex flex-col gap-3">
               <div className="flex items-center justify-center gap-3 opacity-50 mb-2">
                  <div className="w-8 h-px bg-gray-400 dark:bg-white"></div>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-300">Vantagens</span>
                  <div className="w-8 h-px bg-gray-400 dark:bg-white"></div>
               </div>
               <p className="text-xs text-gray-500 dark:text-gray-400 font-medium flex items-center justify-center gap-1.5 focus:outline-none">
                 <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Sincronização em nuvem
               </p>
               <p className="text-xs text-gray-500 dark:text-gray-400 font-medium flex items-center justify-center gap-1.5 focus:outline-none">
                 <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Sem taxas mensais escondidas
               </p>
             </div>
           </div>
        </div>
      </div>
    );
  }

  return <Dashboard user={user} />;
}

import { SettingsTab } from './components/SettingsTab';

function Dashboard({ user }: { user: User }) {
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth() + 1);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'transactions' | 'reserves' | 'analysis' | 'integration' | 'settings'>('dashboard');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [txInitialType, setTxInitialType] = useState<'expense' | 'income'>('expense');
  const [txToEdit, setTxToEdit] = useState<Transaction | null>(null);
  const [budget, setBudget] = useState<MonthlyBudget | null>(null);
  const [isReservesOpen, setIsReservesOpen] = useState(false);
  const [hideReservesValues, setHideReservesValues] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    return document.documentElement.classList.contains('dark') || 
           localStorage.getItem('theme') === 'dark';
  });
  const [syncState, setSyncState] = useState({ transactions: false, budgets: false, settings: false, inbox: false });
  const [rightSidebarWidth, setRightSidebarWidth] = useState(380);

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
    // legacy storage removed
  }, [rightSidebarWidth]);


  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

  const [userSettings, setUserSettings] = useState<UserSettings>({
      userId: user.uid,
      categories: ['Alimentação', 'Transporte', 'Moradia', 'Saúde', 'Lazer', 'Educação', 'Compras', 'Outros'],
      incomeCategories: ['Salário', 'Investimentos', 'Outros'],
      cards: ['Nubank', 'C6', 'Inter'],
      updatedAt: Date.now()
  });
  
  useEffect(() => {
     const q = query(
        collection(db, 'transactions'),
        where('userId', '==', user.uid),
        orderBy('date', 'desc')
     );

     const unsub = onSnapshot(q, { includeMetadataChanges: true }, (snap) => {
        const tr = snap.docs.map(d => ({ id: d.id, ...d.data() } as Transaction));
        setTransactions(tr);
        setSyncState(s => ({ ...s, transactions: snap.metadata.hasPendingWrites }));
     }, (err) => handleFirestoreError(err, OperationType.LIST, 'transactions'));

     const bQ = query(
        collection(db, 'monthly_budgets'),
        where('userId', '==', user.uid),
        where('year', '==', currentYear),
        where('month', '==', currentMonth)
     );
     const unsubB = onSnapshot(bQ, { includeMetadataChanges: true }, (snap) => {
        if (!snap.empty) {
           setBudget({ id: snap.docs[0].id, ...snap.docs[0].data() } as MonthlyBudget);
        } else {
           setBudget(null);
        }
        setSyncState(s => ({ ...s, budgets: snap.metadata.hasPendingWrites }));
     }, (err) => handleFirestoreError(err, OperationType.LIST, 'monthly_budgets'));

     const inboxQ = query(collection(db, 'inbox'), where('userId', '==', user.uid));
     const unsubInbox = onSnapshot(inboxQ, { includeMetadataChanges: true }, async (snap) => {
        setSyncState(s => ({ ...s, inbox: snap.metadata.hasPendingWrites }));
        for (const inboxDoc of snap.docs) {
           const data = inboxDoc.data();
           const newTxRef = doc(collection(db, 'transactions'));
           try {
              await setDoc(newTxRef, data);
              await deleteDoc(inboxDoc.ref);
           } catch(e) {
              console.error('Failed to sync inbox item', e instanceof Error ? e.message : String(e));
           }
        }
     }, (err) => handleFirestoreError(err, OperationType.LIST, 'inbox'));

     const unsubSettings = onSnapshot(doc(db, 'user_settings', user.uid), { includeMetadataChanges: true }, (docSnap) => {
        setSyncState(s => ({ ...s, settings: docSnap.metadata.hasPendingWrites }));
        if (docSnap.exists()) {
           setUserSettings(docSnap.data() as UserSettings);
        } else {
           // Create default settings if not exists
           setDoc(doc(db, 'user_settings', user.uid), userSettings).catch(e => console.error(e.message || String(e)));
        }
     });

     return () => {
       unsub();
       unsubInbox();
       unsubB();
       unsubSettings();
     };
  }, [user.uid, currentYear, currentMonth]);

  const currentMonthTransactions = useMemo(() => {
    return transactions.filter(t => {
      const d = new Date(t.date);
      return d.getFullYear() === currentYear && (d.getMonth() + 1) === currentMonth;
    });
  }, [transactions, currentMonth, currentYear]);

  const totalIncome = currentMonthTransactions.filter(t => t.type === 'income').reduce((acc, t) => acc + t.amount, 0);
  const totalExpense = currentMonthTransactions.filter(t => t.type === 'expense').reduce((acc, t) => acc + t.amount, 0);

  const expensePercentage = totalIncome > 0 ? (totalExpense / totalIncome) * 100 : 0;
  
  const categoriesMap = currentMonthTransactions.filter(t => t.type === 'expense').reduce((acc, t) => {
    acc[t.category] = (acc[t.category] || 0) + t.amount;
    return acc;
  }, {} as Record<string, number>);
  const topCategories = Object.entries(categoriesMap).sort((a, b) => (b[1] as number) - (a[1] as number));
  const recentTransactions = [...currentMonthTransactions].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = rightSidebarWidth;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = startX - moveEvent.clientX;
      const newWidth = Math.max(280, Math.min(800, startWidth + deltaX)); // Min 280px, Max 800px
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
    <div className="flex flex-col-reverse md:flex-row h-[100dvh] w-full bg-gray-50 dark:bg-[#0B0B0C] text-gray-800 dark:text-gray-200 font-sans overflow-hidden selection:bg-emerald-500/30">
      {/* Sidebar Navigation */}
      <nav className="w-full md:w-20 bg-white dark:bg-[#121214] border-t md:border-t-0 md:border-r border-gray-200 dark:border-white/5 flex flex-row md:flex-col items-center justify-around md:justify-start pt-2 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] md:py-6 md:gap-8 min-h-[4rem] md:h-full shrink-0 z-50">
        <div className="hidden md:flex w-10 h-10 bg-emerald-500 rounded-xl items-center justify-center text-black font-bold text-xl">$</div>
        
        <div className="flex flex-row md:flex-col gap-1 md:gap-6 mt-0 md:mt-4 w-full md:w-auto justify-evenly md:justify-start px-1 md:px-0">
          <button onClick={() => setActiveTab('dashboard')} className={`p-2.5 md:p-3 rounded-2xl transition-all duration-300 relative group flex flex-col items-center gap-1 ${activeTab === 'dashboard' ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-white/5'}`} title="Dashboard">
             <LayoutDashboard className={`w-5 h-5 md:w-5 md:h-5 ${activeTab === 'dashboard' ? 'transform scale-110' : 'group-hover:scale-110 transition-transform'}`} />
             <div className={`absolute -bottom-1 md:-right-1 md:bottom-auto w-1 md:w-1 h-1 md:h-full rounded-full bg-emerald-500 transition-opacity ${activeTab === 'dashboard' ? 'opacity-100' : 'opacity-0'}`}></div>
          </button>
          <button onClick={() => setActiveTab('transactions')} className={`p-2.5 md:p-3 rounded-2xl transition-all duration-300 relative group flex flex-col items-center gap-1 ${activeTab === 'transactions' ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-white/5'}`} title="Transações">
             <List className={`w-5 h-5 md:w-5 md:h-5 ${activeTab === 'transactions' ? 'transform scale-110' : 'group-hover:scale-110 transition-transform'}`} />
             <div className={`absolute -bottom-1 md:-right-1 md:bottom-auto w-1 md:w-1 h-1 md:h-full rounded-full bg-emerald-500 transition-opacity ${activeTab === 'transactions' ? 'opacity-100' : 'opacity-0'}`}></div>
          </button>
          <button onClick={() => setActiveTab('reserves')} className={`p-2.5 md:p-3 rounded-2xl transition-all duration-300 relative group flex flex-col items-center gap-1 ${activeTab === 'reserves' ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-white/5'}`} title="Reservas">
             <PiggyBank className={`w-5 h-5 md:w-5 md:h-5 ${activeTab === 'reserves' ? 'transform scale-110' : 'group-hover:scale-110 transition-transform'}`} />
             <div className={`absolute -bottom-1 md:-right-1 md:bottom-auto w-1 md:w-1 h-1 md:h-full rounded-full bg-emerald-500 transition-opacity ${activeTab === 'reserves' ? 'opacity-100' : 'opacity-0'}`}></div>
          </button>
          <button onClick={() => setActiveTab('analysis')} className={`p-2.5 md:p-3 rounded-2xl transition-all duration-300 relative group flex flex-col items-center gap-1 ${activeTab === 'analysis' ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-white/5'}`} title="Análise">
             <BarChart3 className={`w-5 h-5 md:w-5 md:h-5 ${activeTab === 'analysis' ? 'transform scale-110' : 'group-hover:scale-110 transition-transform'}`} />
             <div className={`absolute -bottom-1 md:-right-1 md:bottom-auto w-1 md:w-1 h-1 md:h-full rounded-full bg-emerald-500 transition-opacity ${activeTab === 'analysis' ? 'opacity-100' : 'opacity-0'}`}></div>
          </button>
          <button onClick={() => setActiveTab('integration')} className={`p-2.5 md:p-3 rounded-2xl transition-all duration-300 relative group flex flex-col items-center gap-1 ${activeTab === 'integration' ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-white/5'}`} title="Integrações">
             <Bot className={`w-5 h-5 md:w-5 md:h-5 ${activeTab === 'integration' ? 'transform scale-110' : 'group-hover:scale-110 transition-transform'}`} />
             <div className={`absolute -bottom-1 md:-right-1 md:bottom-auto w-1 md:w-1 h-1 md:h-full rounded-full bg-emerald-500 transition-opacity ${activeTab === 'integration' ? 'opacity-100' : 'opacity-0'}`}></div>
          </button>
          <button onClick={() => setActiveTab('settings')} className={`p-2.5 md:p-3 rounded-2xl transition-all duration-300 relative group flex flex-col items-center gap-1 ${activeTab === 'settings' ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-white/5'}`} title="Configurações">
             <Settings className={`w-5 h-5 md:w-5 md:h-5 ${activeTab === 'settings' ? 'transform scale-110' : 'group-hover:scale-110 transition-transform'}`} />
             <div className={`absolute -bottom-1 md:-right-1 md:bottom-auto w-1 md:w-1 h-1 md:h-full rounded-full bg-emerald-500 transition-opacity ${activeTab === 'settings' ? 'opacity-100' : 'opacity-0'}`}></div>
          </button>
        </div>

        <div className="hidden md:flex flex-col mt-auto items-center gap-2 w-full">
           <button onClick={() => setIsDarkMode(!isDarkMode)} className="p-3 text-gray-500 hover:text-gray-900 dark:hover:text-white transition rounded-xl hover:bg-gray-100 dark:hover:bg-white/10" title="Alternar Tema">
              {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
           </button>
           <button onClick={() => signOut(auth)} className="mb-2 p-3 text-gray-500 hover:text-red-500 transition rounded-xl hover:bg-red-50 dark:hover:bg-red-500/10" title="Sair">
              <LogOut className="w-5 h-5" />
           </button>
        </div>
      </nav>

      <main className="flex-1 flex flex-col gap-6 p-4 md:p-8 lg:p-10 overflow-y-auto w-full">
        <header className="flex flex-col md:flex-row justify-between md:items-center gap-4 shrink-0 relative z-40 w-full mb-2">
           <div className="flex justify-between items-center w-full md:w-auto">
             <h1 className="text-xl md:text-2xl tracking-tight text-gray-900 dark:text-white font-bold flex items-center gap-3">
                <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)] animate-pulse hidden md:block"></span>
                {activeTab === 'dashboard' ? 'Visão Geral' : 
                 activeTab === 'transactions' ? 'Transações' : 
                 activeTab === 'reserves' ? 'Reservas' : 
                 activeTab === 'analysis' ? 'Análise' : 
                 activeTab === 'integration' ? 'Integração' : 'Configurações'}
             </h1>
             
             <div className="flex md:hidden items-center gap-2">
                <button onClick={() => setIsDarkMode(!isDarkMode)} className="p-2 text-gray-500 hover:text-gray-900 dark:hover:text-white transition rounded-full hover:bg-gray-200 dark:hover:bg-white/10" title="Alternar Tema">
                   {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                </button>
                <button onClick={() => signOut(auth)} className="p-2 text-gray-500 hover:text-red-500 transition rounded-full hover:bg-red-50 dark:hover:bg-red-500/10" title="Sair">
                   <LogOut className="w-5 h-5" />
                </button>      
             </div>
           </div>

           <div className="flex items-center gap-2 w-full md:w-auto justify-between md:justify-end">
              <MonthYearPicker 
                currentMonth={currentMonth} 
                currentYear={currentYear} 
                onMonthChange={setCurrentMonth} 
                onYearChange={setCurrentYear} 
              />

              <div className="flex items-center justify-center px-3 py-2 bg-white dark:bg-[#121214] border border-gray-100 dark:border-white/5 rounded-xl shadow-sm h-[40px] sm:h-[42px] transition-colors" title={Object.values(syncState).some(Boolean) ? "Sincronizando..." : "Sincronizado"}>
                {Object.values(syncState).some(Boolean) ? (
                    <RefreshCw className="w-4 h-4 text-emerald-500 animate-spin" />
                ) : (
                    <Cloud className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                )}
              </div>
           </div>
        </header>

        <div className="flex-1 flex flex-col gap-6 mt-4 md:mt-6 pb-20 md:pb-0">
           {activeTab === 'dashboard' && (
             <div className="flex flex-col lg:flex-row gap-6 w-full max-w-[1600px] mx-auto h-full">
                <div className="flex-1 min-w-0 flex flex-col gap-6 @container">
                   {/* Summary Cards */}
                   <div className="grid grid-cols-2 @2xl:grid-cols-3 gap-3 md:gap-4 lg:gap-6">
                      {/* Receitas */}
                      <div className="bg-white dark:bg-[#121214] p-4 md:p-5 lg:p-6 rounded-2xl border-l-[3px] border-y border-r border border-gray-100 dark:border-white/5 border-l-emerald-500 shadow-sm flex flex-col relative group transition-all">
                         <div className="flex justify-between items-start mb-4 md:mb-6">
                            <span className="text-[9px] md:text-[10px] font-bold uppercase tracking-widest text-gray-500">Receitas</span>
                            <div className="p-1 md:p-1.5 bg-emerald-50 dark:bg-emerald-500/10 rounded-md text-emerald-500 hidden sm:block">
                               <TrendingUp className="w-3.5 h-3.5 md:w-4 md:h-4" />
                            </div>
                         </div>
                         <p className="text-xl sm:text-2xl lg:text-3xl font-medium font-mono tracking-tighter text-gray-900 dark:text-white truncate">{formatCurrency(totalIncome)}</p>
                      </div>
                      
                      {/* Gastos */}
                      <div className="bg-white dark:bg-[#121214] p-4 md:p-5 lg:p-6 rounded-2xl border-l-[3px] border-y border-r border border-gray-100 dark:border-white/5 border-l-red-500 shadow-sm flex flex-col relative group transition-all">
                         <div className="flex justify-between items-start mb-4 md:mb-6">
                            <span className="text-[9px] md:text-[10px] font-bold uppercase tracking-widest text-gray-500">Gastos</span>
                            <div className="p-1 md:p-1.5 bg-red-50 dark:bg-red-500/10 rounded-md text-red-500 hidden sm:block">
                               <TrendingDown className="w-3.5 h-3.5 md:w-4 md:h-4" />
                            </div>
                         </div>
                         <p className="text-xl sm:text-2xl lg:text-3xl font-medium font-mono tracking-tighter text-gray-900 dark:text-white truncate">{formatCurrency(totalExpense)}</p>
                      </div>

                      {/* Saldo Líquido */}
                      <div className={`bg-white dark:bg-[#121214] col-span-2 @2xl:col-span-1 p-4 md:p-5 lg:p-6 rounded-2xl border-l-[3px] border-y border-r border-gray-100 dark:border-white/5 shadow-sm flex flex-col relative group transition-all ${totalIncome - totalExpense >= 0 ? 'border-l-blue-500' : 'border-l-red-500'}`}>
                         <div className="flex justify-between items-start mb-4 md:mb-6">
                            <span className="text-[9px] md:text-[10px] font-bold uppercase tracking-widest text-gray-500">Balanço (Mês)</span>
                            <div className={`p-1.5 rounded-md hidden sm:block ${totalIncome - totalExpense >= 0 ? 'bg-blue-50 dark:bg-blue-500/10 text-blue-500' : 'bg-red-50 dark:bg-red-500/10 text-red-500'}`}>
                               <Activity className="w-4 h-4" />
                            </div>
                         </div>
                         <div className="flex items-center justify-between">
                            <p className={`text-2xl lg:text-3xl font-medium font-mono tracking-tighter truncate ${totalIncome - totalExpense >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-red-500'}`}>{formatCurrency(totalIncome - totalExpense)}</p>
                            {/* Visual indicator for mobile */}
                            <div className={`sm:hidden w-8 h-1 rounded-full ${totalIncome - totalExpense >= 0 ? 'bg-blue-500' : 'bg-red-500'}`}></div>
                         </div>
                      </div>
                   </div>

                   {/* Quick Add For Dashboard */}
                   <QuickAddTransaction userId={user.uid} userSettings={userSettings} />

                   {/* Planejamento Mensal */}
                   <MonthlyPlanning userId={user.uid} year={currentYear} month={currentMonth} budget={budget} />

                   <div className="grid grid-cols-1 @2xl:grid-cols-2 gap-4 lg:gap-6">
                      {/* Análise Mês */}
                      <div className="bg-white dark:bg-[#121214] p-5 lg:p-6 rounded-2xl border border-gray-100 dark:border-white/5 flex flex-col shadow-sm">
                         <div className="flex items-center gap-2 mb-6 opacity-80">
                            <BarChart3 className="w-4 h-4 text-gray-400" />
                            <span className="text-[10px] font-bold uppercase tracking-widest text-gray-900 dark:text-white">Análise de Consumo</span>
                         </div>
                        
                         <div className="flex-1 flex flex-col justify-between space-y-8">
                            <div>
                               <div className="flex justify-between items-end mb-2">
                                  <span className="text-xs text-gray-500 font-medium tracking-wide">Gasto vs Receita</span>
                                  <span className={`text-lg font-bold font-mono tracking-tight ${expensePercentage > 80 ? 'text-red-500' : 'text-gray-900 dark:text-white'}`}>
                                     {expensePercentage.toFixed(1)}%
                                  </span>
                               </div>
                               <div className="w-full bg-gray-100 dark:bg-white/5 h-2 rounded-full overflow-hidden">
                                  <div 
                                    className={`h-full transition-all duration-500 ${expensePercentage > 80 ? 'bg-red-500' : 'bg-emerald-500'}`} 
                                    style={{ width: `${Math.min(expensePercentage, 100)}%` }}
                                  ></div>
                               </div>
                               {expensePercentage > 80 && (
                                  <p className="text-[11px] text-red-500 font-medium leading-relaxed mt-3 flex items-start gap-1.5">
                                     <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                                     Seus gastos atingiram um nível alto em relação à receita neste mês.
                                  </p>
                               )}
                            </div>

                            <div>
                               <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest block mb-4">Maiores Ofensores</span>
                               {topCategories.length > 0 ? (
                                 <div className="space-y-3">
                                   {topCategories.slice(0, 3).map(([cat, amt], idx) => (
                                     <div key={idx} className="flex flex-col gap-1.5">
                                        <div className="flex justify-between items-center text-xs">
                                           <span className="text-gray-600 dark:text-gray-400 capitalize font-medium">{cat}</span>
                                           <span className="text-gray-900 dark:text-white font-mono font-medium tracking-tight">{formatCurrency(amt as number)}</span>
                                        </div>
                                        <div className="w-full bg-gray-100 dark:bg-white/5 h-1.5 rounded-full overflow-hidden">
                                           <div 
                                             className="h-full bg-gray-300 dark:bg-white/20 rounded-full" 
                                             style={{ width: `${Math.min(((amt as number)/totalExpense)*100, 100)}%` }}
                                           ></div>
                                        </div>
                                     </div>
                                   ))}
                                 </div>
                               ) : (
                                 <div className="py-4 border-y border-dashed border-gray-100 dark:border-white/5 text-center">
                                    <p className="text-xs text-gray-500">Nenhum gasto no período.</p>
                                 </div>
                               )}
                            </div>
                         </div>
                      </div>

                      {/* Resumo Reservas */}
                      <div className="bg-white dark:bg-[#121214] p-5 lg:p-6 rounded-2xl border border-gray-100 dark:border-white/5 flex flex-col shadow-sm">
                         <div className="flex items-center justify-between mb-6 opacity-80">
                            <div className="flex items-center gap-2">
                                <PiggyBank className="w-4 h-4 text-gray-400" />
                                <span className="text-[10px] font-bold uppercase tracking-widest text-gray-900 dark:text-white">Posição de Reservas</span>
                            </div>
                            <button
                              onClick={() => setHideReservesValues(!hideReservesValues)}
                              className="p-1.5 text-gray-400 hover:text-gray-900 dark:text-white transition rounded-md hover:bg-gray-50 dark:hover:bg-white/5"
                              title={hideReservesValues ? "Mostrar valores" : "Ocultar valores"}
                            >
                               {hideReservesValues ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                            </button>
                         </div>

                         {budget ? (
                            <div className="flex-1 flex flex-col gap-3">
                               <div className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-white/5">
                                  <span className="text-xs text-gray-500 font-medium">Salário Declarado</span>
                                  <span className="text-sm font-mono tracking-tight font-medium text-gray-900 dark:text-white">
                                     {hideReservesValues ? '••••' : formatCurrency(budget.salary)}
                                  </span>
                               </div>
                               <div className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-white/5">
                                  <span className="text-xs text-gray-500 font-medium">Reserva Principal</span>
                                  <span className="text-sm font-mono tracking-tight font-medium text-emerald-600 dark:text-emerald-400">
                                     {hideReservesValues ? '••••' : formatCurrency(budget.reserve)}
                                  </span>
                               </div>
                               <div className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-white/5">
                                  <span className="text-xs text-gray-500 font-medium">Carteira Livre</span>
                                  <span className="text-sm font-mono tracking-tight font-medium text-blue-600 dark:text-blue-400">
                                     {hideReservesValues ? '••••' : formatCurrency(budget.wallet)}
                                  </span>
                               </div>
                               <div className="flex flex-col gap-1 mt-auto">
                                  <div className="flex justify-between items-center py-1">
                                     <span className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">Saques Carteira</span>
                                     <span className="text-xs font-mono tracking-tight text-red-500">
                                        {hideReservesValues ? '••••' : formatCurrency(budget.walletWithdrawals)}
                                     </span>
                                  </div>
                                  <div className="flex justify-between items-center py-1">
                                     <span className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">Saques Emergência</span>
                                     <span className="text-xs font-mono tracking-tight text-red-500">
                                        {hideReservesValues ? '••••' : formatCurrency(budget.emergencyWithdrawals)}
                                     </span>
                                  </div>
                               </div>
                            </div>
                         ) : (
                            <div className="flex-1 flex items-center justify-center p-4 border border-dashed border-gray-200 dark:border-white/10 rounded-xl bg-gray-50 dark:bg-white/[0.02]">
                               <p className="text-xs text-gray-500 font-medium text-center">Nenhum valor base ajustado<br/>para este mês.</p>
                            </div>
                         )}
                      </div>
                   </div>
                </div>

                {/* Right Column: Útlimas Transações */}
                <div 
                  className="w-full shrink-0 flex flex-col md:h-[400px] lg:h-[calc(100vh-2rem)] md:min-h-[250px] md:max-h-[85vh] bg-white dark:bg-[#121214] border border-gray-100 dark:border-white/5 rounded-2xl shadow-sm relative group/sidebar desktop-sidebar-width"
                  style={{ '--sidebar-width': `${rightSidebarWidth}px` } as React.CSSProperties}
                >
                   {/* Resize Handle */}
                   <div 
                     className="hidden lg:flex absolute left-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-emerald-500/50 z-20 transition-colors items-center justify-center translate-x-[-50%]"
                     onMouseDown={handleResizeStart}
                   >
                     <div className="w-1.5 h-10 bg-gray-300 dark:bg-gray-600 rounded-full opacity-0 group-hover/sidebar:opacity-100 transition-opacity" />
                   </div>
                   
                   <div className="flex flex-col h-full rounded-2xl overflow-hidden relative z-10 bg-white dark:bg-[#121214]">
                     <div className="p-5 lg:p-6 border-b border-gray-100 dark:border-white/5 flex items-center justify-between bg-gray-50/50 dark:bg-white/[0.01] sticky top-0 z-10">
                         <div className="flex items-center gap-2 opacity-80">
                            <List className="w-4 h-4 text-gray-400" />
                            <h2 className="text-[10px] font-bold uppercase tracking-widest text-gray-900 dark:text-white">Últimas do Mês</h2>
                         </div>
                         <button onClick={() => setActiveTab('transactions')} className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline font-medium">Ver tudo</button>
                     </div>
                     <div className="flex-1 overflow-auto p-2">
                     {recentTransactions.length > 0 ? (
                        <div className="flex flex-col">
                           {recentTransactions.map(tx => (
                              <div key={tx.id} onClick={(e) => { e.stopPropagation(); setTxToEdit(tx); setIsModalOpen(true); }} className="flex items-center justify-between p-3 sm:p-4 hover:bg-gray-50 dark:hover:bg-white/5 rounded-xl cursor-pointer transition-colors group border border-transparent hover:border-gray-100 dark:hover:border-white/5">
                                 <div className="flex flex-col min-w-0 pr-2">
                                    <span className="font-medium text-sm text-gray-900 dark:text-gray-100 truncate pb-0.5">{tx.description} {tx.installments ? <span className="opacity-50 text-[10px] bg-gray-200 dark:bg-white/10 px-1 rounded ml-2 font-semibold uppercase tracking-widest">{tx.installmentNumber}/{tx.installments}</span> : ''}</span>
                                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                                       <span className="text-[10px] text-gray-500 shrink-0">
                                          {new Date(tx.date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '')}
                                       </span>
                                       
                                       <span className="w-1 h-1 rounded-full bg-gray-300 dark:bg-gray-700"></span>
                                       
                                       <div className="flex items-center gap-1.5">
                                          <div 
                                            className="w-2 h-2 rounded-full" 
                                            style={{ backgroundColor: userSettings?.categoryColors?.[tx.category] || '#9ca3af' }}
                                          />
                                          <span className="text-[10px] text-gray-500 capitalize tracking-wide">{tx.category}</span>
                                       </div>

                                       {tx.paymentMethod && (
                                          <>
                                             <span className="w-1 h-1 rounded-full bg-gray-300 dark:bg-gray-700"></span>
                                             <div className="flex items-center gap-1.5">
                                                {tx.card && (
                                                   <div 
                                                     className="w-2 h-2 rounded-full"
                                                     style={{ backgroundColor: userSettings?.cardColors?.[tx.card] || '#9ca3af' }}
                                                   />
                                                )}
                                                <span className="text-[10px] text-gray-500 truncate max-w-[150px]">
                                                   {tx.type === 'income' ? 'Receita' : (tx.paymentMethod === 'Crédito' || tx.paymentMethod === 'Débito' ? tx.paymentMethod : 'Despesa')}
                                                   {tx.card ? ` • ${tx.card}` : (tx.paymentMethod !== 'Crédito' && tx.paymentMethod !== 'Débito' ? ` • ${tx.paymentMethod}` : '')}
                                                </span>
                                             </div>
                                          </>
                                       )}
                                    </div>
                                 </div>
                                 <div className="flex items-center gap-1 sm:gap-3">
                                   <span className={`text-sm font-mono tracking-tight font-medium shrink-0 mr-1 sm:mr-0 ${tx.type === 'income' ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-900 dark:text-white'}`}>
                                      {tx.type === 'income' ? '+' : '-'}{formatCurrency(tx.amount)}
                                   </span>
                                   <button 
                                      onClick={(e) => { 
                                         e.stopPropagation(); 
                                         const { id, ...copyTx } = tx; 
                                         setTxToEdit(copyTx as Transaction); 
                                         setIsModalOpen(true); 
                                      }} 
                                      className="text-gray-400 hover:text-emerald-500 transition-all p-2 rounded-lg hover:bg-white dark:hover:bg-white/10 active:bg-gray-100 dark:active:bg-white/20 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 shadow-sm border border-transparent hover:border-gray-200 dark:hover:border-white/10 bg-white/50 dark:bg-[#121214]/50" 
                                      title="Duplicar"
                                   >
                                     <Copy className="w-4 h-4" />
                                   </button>
                                   <button 
                                      onClick={(e) => { 
                                         e.stopPropagation(); 
                                         setTransactionToDelete(tx); 
                                      }} 
                                      className="text-gray-400 hover:text-red-500 transition-all p-2 rounded-lg hover:bg-white dark:hover:bg-white/10 active:bg-gray-100 dark:active:bg-white/20 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 shadow-sm border border-transparent hover:border-gray-200 dark:hover:border-white/10 bg-white/50 dark:bg-[#121214]/50" 
                                      title="Excluir"
                                   >
                                     <Trash2 className="w-4 h-4" />
                                   </button>
                                 </div>
                              </div>
                           ))}
                        </div>
                     ) : (
                        <div className="py-12 flex flex-col items-center justify-center text-center opacity-60">
                           <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-white/5 flex items-center justify-center mb-3">
                              <List className="w-5 h-5 text-gray-400" />
                           </div>
                           <p className="text-xs text-gray-500">Sem transações no momento</p>
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
          <div className="bg-white dark:bg-[#121214] border border-gray-200 dark:border-white/10 rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Excluir Transação</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
              Tem certeza de que deseja excluir <strong>{transactionToDelete.description}</strong>?
            </p>
            
            {isInstallment(transactionToDelete) && (
              <label className="flex items-start gap-3 mb-6 p-3 bg-gray-50 dark:bg-[#0A0A0B] rounded-xl border border-gray-200 dark:border-white/5 cursor-pointer hover:bg-gray-100 dark:hover:bg-white/5 transition">
                <input 
                  type="checkbox" 
                  checked={deleteSubsequent}
                  onChange={e => setDeleteSubsequent(e.target.checked)}
                  className="mt-1 w-4 h-4 text-emerald-500 rounded border-gray-300 focus:ring-emerald-500"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  Excluir também as <strong>{getSubsequentInstallments(transactionToDelete).length}</strong> parcelas futuras relacionadas a esta transação.
                </span>
              </label>
            )}

            <div className="flex gap-3 justify-end mt-2">
              <button 
                onClick={() => setTransactionToDelete(null)}
                disabled={isDeleting}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-white/10 hover:bg-gray-200 dark:hover:bg-white/20 rounded-lg transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button 
                onClick={confirmDelete}
                disabled={isDeleting}
                className="px-4 py-2 text-sm font-medium text-white bg-red-500 hover:bg-red-600 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {isDeleting ? 'Excluindo...' : 'Excluir'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
