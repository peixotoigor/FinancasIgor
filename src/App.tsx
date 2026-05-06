import { useEffect, useState, useMemo } from 'react';
import { auth, googleProvider, db, handleFirestoreError, OperationType } from './lib/firebase';
import { signInWithPopup, signOut, onAuthStateChanged, User } from 'firebase/auth';
import type { Transaction } from './types';
import { collection, query, where, onSnapshot, doc, setDoc, orderBy, deleteDoc } from 'firebase/firestore';
import { LogOut, Plus, Wallet, FileText, Settings, Bot, BarChart3, LayoutDashboard, List, PiggyBank, ChevronDown, ChevronUp, Eye, EyeOff, X, Sun, Moon, TrendingUp, TrendingDown, Activity, AlertCircle, Cloud, CheckCircle2, RefreshCw, CloudOff } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TransactionModal } from './components/TransactionModal';
import { AnalysisTab } from './components/AnalysisTab';
import { TransactionsTab } from './components/TransactionsTab';
import { ReservesTab } from './components/ReservesTab';
import { IntegrationTab } from './components/IntegrationTab';
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
      <div className="min-h-[100dvh] bg-gray-50 dark:bg-[#0A0A0B] flex flex-col items-center justify-center p-4 font-sans text-gray-800 dark:text-gray-200">
         <div className="max-w-md w-full bg-white dark:bg-[#121214] p-8 border border-gray-200 dark:border-white/5 shadow-2xl shadow-gray-200 dark:shadow-black rounded-2xl flex flex-col items-center">
            <div className="w-16 h-16 bg-emerald-500 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-500/20 text-black font-bold text-3xl mb-6">$</div>
            <h1 className="text-2xl font-bold mb-2 tracking-tight text-gray-900 dark:text-white">Finanças Pessoais</h1>
            <p className="text-gray-500 mb-8 text-center text-sm">Controle seus gastos e gerencie seu dinheiro via Web ou Telegram.</p>
            <button 
              onClick={() => signInWithPopup(auth, googleProvider).catch(e => console.error(e.message || String(e)))}
              className="w-full bg-emerald-500 py-3 rounded-xl font-medium hover:bg-emerald-400 transition flex items-center justify-center gap-2 text-black shadow-lg shadow-emerald-500/20"
            >
              Entrar com Google
            </button>
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
  const [txToEdit, setTxToEdit] = useState<Transaction | null>(null);
  const [budget, setBudget] = useState<MonthlyBudget | null>(null);
  const [isReservesOpen, setIsReservesOpen] = useState(false);
  const [hideReservesValues, setHideReservesValues] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    return document.documentElement.classList.contains('dark') || 
           localStorage.getItem('theme') === 'dark';
  });
  const [syncState, setSyncState] = useState({ transactions: false, budgets: false, settings: false, inbox: false });

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

  const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  return (
    <div className="flex flex-col-reverse md:flex-row h-[100dvh] w-full bg-gray-50 dark:bg-[#0A0A0B] text-gray-800 dark:text-gray-200 font-sans overflow-hidden">
      {/* Sidebar Navigation */}
      <nav className="w-full md:w-20 bg-white dark:bg-[#121214] border-t md:border-t-0 md:border-r border-gray-200 dark:border-white/5 flex flex-row md:flex-col items-center justify-around md:justify-start py-2 md:py-6 md:gap-8 h-16 md:h-full shrink-0 z-50">
        <div className="hidden md:flex w-10 h-10 bg-emerald-500 rounded-xl items-center justify-center shadow-lg shadow-emerald-500/20 text-black font-bold text-xl">$</div>
        
        <div className="flex flex-row md:flex-col gap-1 md:gap-6 mt-0 md:mt-4 opacity-80 w-full md:w-auto justify-around md:justify-start px-2 md:px-0">
          <button onClick={() => setActiveTab('dashboard')} className={`p-2 md:p-3 rounded-xl transition ${activeTab === 'dashboard' ? 'bg-gray-200 dark:bg-white/10 text-gray-900 dark:text-white' : 'text-gray-500 hover:text-gray-900 dark:text-white'}`} title="Dashboard">
             <LayoutDashboard className="w-5 h-5 md:w-5 md:h-5" />
          </button>
          <button onClick={() => setActiveTab('transactions')} className={`p-2 md:p-3 rounded-xl transition ${activeTab === 'transactions' ? 'bg-gray-200 dark:bg-white/10 text-gray-900 dark:text-white' : 'text-gray-500 hover:text-gray-900 dark:text-white'}`} title="Transações">
             <List className="w-5 h-5 md:w-5 md:h-5" />
          </button>
          <button onClick={() => setActiveTab('reserves')} className={`p-2 md:p-3 rounded-xl transition ${activeTab === 'reserves' ? 'bg-gray-200 dark:bg-white/10 text-gray-900 dark:text-white' : 'text-gray-500 hover:text-gray-900 dark:text-white'}`} title="Reservas">
             <PiggyBank className="w-5 h-5 md:w-5 md:h-5" />
          </button>
          <button onClick={() => setActiveTab('analysis')} className={`p-2 md:p-3 rounded-xl transition ${activeTab === 'analysis' ? 'bg-gray-200 dark:bg-white/10 text-gray-900 dark:text-white' : 'text-gray-500 hover:text-gray-900 dark:text-white'}`} title="Análise">
             <BarChart3 className="w-5 h-5 md:w-5 md:h-5" />
          </button>
          <button onClick={() => setActiveTab('integration')} className={`p-2 md:p-3 rounded-xl transition ${activeTab === 'integration' ? 'bg-gray-200 dark:bg-white/10 text-gray-900 dark:text-white' : 'text-gray-500 hover:text-gray-900 dark:text-white'}`} title="Integrações">
             <Bot className="w-5 h-5 md:w-5 md:h-5" />
          </button>
          <button onClick={() => setActiveTab('settings')} className={`p-2 md:p-3 rounded-xl transition ${activeTab === 'settings' ? 'bg-gray-200 dark:bg-white/10 text-gray-900 dark:text-white' : 'text-gray-500 hover:text-gray-900 dark:text-white'}`} title="Configurações">
             <Settings className="w-5 h-5 md:w-5 md:h-5" />
          </button>
        </div>

        <div className="hidden md:flex flex-col mt-auto items-center gap-2 w-full">
           <button onClick={() => setIsDarkMode(!isDarkMode)} className="p-3 text-gray-500 hover:text-gray-900 dark:hover:text-white transition rounded-xl hover:bg-gray-200 dark:hover:bg-white/10" title="Alternar Tema">
              {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
           </button>
           <button onClick={() => signOut(auth)} className="mb-2 p-3 text-gray-500 hover:text-red-400 transition rounded-xl hover:bg-red-400/10" title="Sair">
              <LogOut className="w-5 h-5" />
           </button>
        </div>
      </nav>

      <main className="flex-1 flex flex-col gap-6 p-4 md:p-6 lg:p-8 overflow-y-auto w-full">
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 shrink-0">
           <div className="flex justify-between items-start w-full sm:w-auto">
              <div>
                 <h1 className="text-[10px] uppercase tracking-[0.2em] text-gray-500 font-semibold mb-1">Visão Geral</h1>
                 <p className="text-3xl font-light text-gray-900 dark:text-white">{formatCurrency(totalIncome - totalExpense)} <span className="text-sm text-emerald-400 font-medium ml-2 relative -top-1">Livre</span></p>
              </div>
              <div className="flex md:hidden gap-1">
                 <button onClick={() => setIsDarkMode(!isDarkMode)} className="p-2 text-gray-500 hover:text-gray-900 dark:hover:text-white transition rounded-lg hover:bg-gray-200 dark:hover:bg-white/10" title="Alternar Tema">
                    {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                 </button>
                 <button onClick={() => signOut(auth)} className="p-2 text-gray-500 hover:text-red-400 transition rounded-lg hover:bg-red-400/10" title="Sair">
                    <LogOut className="w-5 h-5" />
                 </button>      
              </div>
           </div>
           
           <div className="flex flex-wrap items-center gap-4 w-full sm:w-auto overflow-x-auto pb-2 sm:pb-0">
              <div className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-[#121214] border border-gray-200 dark:border-white/5 rounded-lg text-xs" title={Object.values(syncState).some(Boolean) ? "Sincronizando..." : "Sincronizado"}>
                {Object.values(syncState).some(Boolean) ? (
                  <>
                    <RefreshCw className="w-3 h-3 text-emerald-500 animate-spin" />
                    <span className="text-gray-500">Salvando...</span>
                  </>
                ) : (
                  <>
                    <Cloud className="w-3 h-3 text-gray-400 dark:text-gray-500" />
                    <span className="text-gray-400 dark:text-gray-500 hidden sm:inline">Salvo</span>
                  </>
                )}
              </div>
              <div className="flex gap-2">
                 <select value={currentYear} onChange={e => setCurrentYear(Number(e.target.value))} className="bg-white dark:bg-[#121214] border border-gray-200 dark:border-white/5 rounded-lg text-xs p-2 text-gray-900 dark:text-white outline-none cursor-pointer hover:bg-gray-100 dark:bg-white/5 transition focus:border-emerald-500/50">
                    {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
                 </select>
                 <select value={currentMonth} onChange={e => setCurrentMonth(Number(e.target.value))} className="bg-white dark:bg-[#121214] border border-gray-200 dark:border-white/5 rounded-lg text-xs p-2 text-gray-900 dark:text-white outline-none cursor-pointer hover:bg-gray-100 dark:bg-white/5 transition focus:border-emerald-500/50">
                    {Array.from({length: 12}).map((_, i) => <option key={i+1} value={i+1}>{new Date(0, i).toLocaleString('pt-BR', { month: 'long' })}</option>)}
                 </select>
              </div>
              <button onClick={() => setIsModalOpen(true)} className="bg-emerald-500 text-black px-4 py-2 rounded-lg font-bold text-xs uppercase tracking-wider hover:bg-emerald-400 transition shadow-lg shadow-emerald-500/20 flex items-center gap-2">
                 <Plus className="w-4 h-4" /> <span className="hidden sm:inline">Nova Transação</span>
              </button>
           </div>
        </header>

        <div className="flex-1 flex flex-col gap-6 mt-4">
           {activeTab === 'dashboard' && (
             <div className="flex flex-col gap-8 w-full max-w-7xl mx-auto">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                   {/* Receitas */}
                   <div className="bg-white dark:bg-[#121214] p-6 rounded-2xl border border-emerald-500/20 shadow-sm flex flex-col relative overflow-hidden group hover:border-emerald-500/40 transition-colors duration-300">
                      <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent pointer-events-none"></div>
                      <div className="flex justify-between items-start mb-4 z-10 relative">
                         <div className="flex items-center gap-2 text-emerald-500">
                            <div className="p-2 bg-emerald-500/10 rounded-lg">
                               <TrendingUp className="w-4 h-4" />
                            </div>
                            <span className="text-xs font-bold uppercase tracking-wider">Receitas</span>
                         </div>
                      </div>
                      <p className="text-3xl font-bold text-gray-900 dark:text-white z-10 relative">{formatCurrency(totalIncome)}</p>
                   </div>
                   
                   {/* Gastos */}
                   <div className="bg-white dark:bg-[#121214] p-6 rounded-2xl border border-red-500/20 shadow-sm flex flex-col relative overflow-hidden group hover:border-red-500/40 transition-colors duration-300">
                      <div className="absolute inset-0 bg-gradient-to-br from-red-500/5 to-transparent pointer-events-none"></div>
                      <div className="flex justify-between items-start mb-4 z-10 relative">
                         <div className="flex items-center gap-2 text-red-500">
                            <div className="p-2 bg-red-500/10 rounded-lg">
                               <TrendingDown className="w-4 h-4" />
                            </div>
                            <span className="text-xs font-bold uppercase tracking-wider">Gastos</span>
                         </div>
                      </div>
                      <p className="text-3xl font-bold text-gray-900 dark:text-white z-10 relative">{formatCurrency(totalExpense)}</p>
                   </div>

                   {/* Saldo Líquido */}
                   <div className={`p-6 rounded-2xl border shadow-sm flex flex-col relative overflow-hidden group transition-colors duration-300 ${totalIncome - totalExpense >= 0 ? 'bg-white dark:bg-[#121214] border-blue-500/20 hover:border-blue-500/40' : 'bg-white dark:bg-[#121214] border-red-500/20 hover:border-red-500/40'}`}>
                      <div className={`absolute inset-0 bg-gradient-to-br pointer-events-none ${totalIncome - totalExpense >= 0 ? 'from-blue-500/5 to-transparent' : 'from-red-500/5 to-transparent'}`}></div>
                      <div className="flex justify-between items-start mb-4 z-10 relative">
                         <div className={`flex items-center gap-2 ${totalIncome - totalExpense >= 0 ? 'text-blue-500' : 'text-red-500'}`}>
                            <div className={`p-2 rounded-lg ${totalIncome - totalExpense >= 0 ? 'bg-blue-500/10' : 'bg-red-500/10'}`}>
                               <Activity className="w-4 h-4" />
                            </div>
                            <span className="text-xs font-bold uppercase tracking-wider">Livre no Mês</span>
                         </div>
                      </div>
                      <p className={`text-3xl font-bold z-10 relative ${totalIncome - totalExpense >= 0 ? 'text-blue-500' : 'text-red-500'}`}>{formatCurrency(totalIncome - totalExpense)}</p>
                   </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                   {/* Análise Mês */}
                   <div className="bg-white dark:bg-[#121214] p-6 rounded-2xl border border-gray-200 dark:border-white/5 flex flex-col shadow-sm">
                      <div className="flex items-center gap-2 mb-6">
                         <BarChart3 className="w-5 h-5 text-gray-400" />
                         <span className="text-sm font-bold uppercase tracking-wider text-gray-900 dark:text-white">Análise de Consumo</span>
                      </div>
                     
                      <div className="flex-1 flex flex-col justify-center space-y-8">
                         <div>
                            <div className="flex justify-between items-end mb-2">
                               <span className="text-sm text-gray-500 font-medium">Gasto vs Receita</span>
                               <span className={`text-xl font-bold ${expensePercentage > 80 ? 'text-red-500' : 'text-gray-900 dark:text-white'}`}>
                                  {expensePercentage.toFixed(1)}%
                               </span>
                            </div>
                            <div className="w-full bg-gray-100 dark:bg-white/5 h-3 rounded-full overflow-hidden">
                               <div 
                                 className={`h-full transition-all duration-500 ${expensePercentage > 80 ? 'bg-red-500' : 'bg-emerald-500'}`} 
                                 style={{ width: `${Math.min(expensePercentage, 100)}%` }}
                               ></div>
                            </div>
                            {expensePercentage > 80 && (
                               <div className="flex items-start gap-2 mt-4 p-4 bg-red-50 dark:bg-red-500/10 rounded-xl border border-red-100 dark:border-red-500/20">
                                  <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
                                  <p className="text-sm text-red-700 dark:text-red-400 font-medium leading-relaxed">
                                     Atenção: Seus gastos atingiram um nível alto em relação à receita. Considere frear as despesas.
                                  </p>
                               </div>
                            )}
                         </div>

                         <div>
                            <span className="text-xs text-gray-400 font-bold uppercase tracking-wider block mb-4">Maiores Ofensores</span>
                            {topCategories.length > 0 ? (
                              <div className="space-y-4">
                                {topCategories.slice(0, 3).map(([cat, amt], idx) => (
                                  <div key={idx} className="flex flex-col gap-2">
                                     <div className="flex justify-between items-center text-sm">
                                        <span className="text-gray-700 dark:text-gray-300 capitalize font-medium">{cat}</span>
                                        <span className="text-gray-900 dark:text-white font-bold">{formatCurrency(amt as number)}</span>
                                     </div>
                                     <div className="w-full bg-gray-100 dark:bg-white/5 h-2 rounded-full overflow-hidden">
                                        <div 
                                          className="h-full bg-gray-300 dark:bg-white/20 rounded-full" 
                                          style={{ width: `${Math.min(((amt as number)/totalExpense)*100, 100)}%` }}
                                        ></div>
                                     </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="p-4 rounded-xl bg-gray-50 dark:bg-white/[0.02] border border-gray-100 dark:border-white/5 text-center">
                                 <p className="text-sm text-gray-500">Nenhum gasto registrado no período.</p>
                              </div>
                            )}
                         </div>
                      </div>
                   </div>

                   {/* Resumo Reservas */}
                   <div className="bg-white dark:bg-[#121214] p-6 rounded-2xl border border-gray-200 dark:border-white/5 flex flex-col shadow-sm">
                      <div className="flex items-center justify-between mb-6">
                         <div className="flex items-center gap-2">
                             <PiggyBank className="w-5 h-5 text-gray-400" />
                             <span className="text-sm font-bold uppercase tracking-wider text-gray-900 dark:text-white">Posição de Reservas</span>
                         </div>
                         <button
                           onClick={() => setHideReservesValues(!hideReservesValues)}
                           className="p-2 text-gray-400 hover:text-gray-900 dark:text-white transition rounded-xl hover:bg-gray-100 dark:bg-white/5"
                           title={hideReservesValues ? "Mostrar valores" : "Ocultar valores"}
                         >
                            {hideReservesValues ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                         </button>
                      </div>

                      {budget ? (
                         <div className="flex-1 flex flex-col justify-center gap-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                               <div className="bg-gray-50 dark:bg-[#0A0A0B] p-4 rounded-xl border border-gray-200 dark:border-white/5 flex flex-col">
                                  <p className="text-[10px] text-gray-500 uppercase tracking-wider font-bold mb-1">Salário Declarado</p>
                                  <p className="text-lg text-gray-900 dark:text-white font-semibold truncate">
                                     {hideReservesValues ? '••••' : formatCurrency(budget.salary)}
                                  </p>
                               </div>
                               <div className="bg-emerald-50 dark:bg-emerald-500/5 p-4 rounded-xl border border-emerald-100 dark:border-emerald-500/10 flex flex-col">
                                  <p className="text-[10px] text-emerald-600 dark:text-emerald-500 uppercase tracking-wider font-bold mb-1">Reserva Principal</p>
                                  <p className="text-lg text-emerald-700 dark:text-emerald-400 font-semibold truncate">
                                     {hideReservesValues ? '••••' : formatCurrency(budget.reserve)}
                                  </p>
                               </div>
                               <div className="bg-emerald-50 dark:bg-emerald-500/5 p-4 rounded-xl border border-emerald-100 dark:border-emerald-500/10 flex flex-col">
                                  <p className="text-[10px] text-emerald-600 dark:text-emerald-500 uppercase tracking-wider font-bold mb-1">Res. da Reserva</p>
                                  <p className="text-lg text-emerald-700 dark:text-emerald-400 font-semibold truncate">
                                     {hideReservesValues ? '••••' : formatCurrency(budget.reserveOfReserve)}
                                  </p>
                               </div>
                               <div className="bg-blue-50 dark:bg-blue-500/5 p-4 rounded-xl border border-blue-100 dark:border-blue-500/10 flex flex-col">
                                  <p className="text-[10px] text-blue-600 dark:text-blue-500 uppercase tracking-wider font-bold mb-1">Carteira Livre</p>
                                  <p className="text-lg text-blue-700 dark:text-blue-400 font-semibold truncate">
                                     {hideReservesValues ? '••••' : formatCurrency(budget.wallet)}
                                  </p>
                               </div>
                               <div className="bg-red-50 dark:bg-red-500/5 p-4 rounded-xl border border-red-100 dark:border-red-500/10 flex flex-col col-span-2 sm:col-span-1">
                                  <p className="text-[10px] text-red-600 dark:text-red-500 uppercase tracking-wider font-bold mb-1">Saques da Carteira</p>
                                  <p className="text-lg text-red-700 dark:text-red-400 font-semibold truncate">
                                     {hideReservesValues ? '••••' : formatCurrency(budget.walletWithdrawals)}
                                  </p>
                               </div>
                               <div className="bg-red-50 dark:bg-red-500/5 p-4 rounded-xl border border-red-100 dark:border-red-500/10 flex flex-col col-span-2 sm:col-span-1">
                                  <p className="text-[10px] text-red-600 dark:text-red-500 uppercase tracking-wider font-bold mb-1">Saques de Emergência</p>
                                  <p className="text-lg text-red-700 dark:text-red-400 font-semibold truncate">
                                     {hideReservesValues ? '••••' : formatCurrency(budget.emergencyWithdrawals)}
                                  </p>
                               </div>
                            </div>
                         </div>
                      ) : (
                         <div className="flex-1 flex items-center justify-center p-6 border-2 border-dashed border-gray-200 dark:border-white/10 rounded-xl bg-gray-50 dark:bg-white/[0.02]">
                            <p className="text-sm text-gray-500 font-medium text-center">Nenhum valor base configurado no mês.</p>
                         </div>
                      )}
                   </div>
                </div>

                <div className="bg-white dark:bg-[#121214] border border-gray-200 dark:border-white/5 rounded-2xl overflow-hidden shadow-sm flex flex-col min-h-[500px]">
                   <div className="p-6 border-b border-gray-200 dark:border-white/5 flex items-center justify-between">
                       <div className="flex items-center gap-2">
                          <List className="w-5 h-5 text-gray-400" />
                          <h2 className="text-sm font-bold uppercase tracking-wider text-gray-900 dark:text-white">Últimas Transações ({currentMonth}/{currentYear})</h2>
                       </div>
                   </div>
                   <div className="flex-1 overflow-auto">
                     <TransactionsTab userId={user.uid} transactions={transactions} onEdit={(t) => { setTxToEdit(t); setIsModalOpen(true); }} userSettings={userSettings} />
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

      <TransactionModal isOpen={isModalOpen} onClose={() => { setIsModalOpen(false); setTxToEdit(null); }} userId={user.uid} userSettings={userSettings} initialData={txToEdit} />
    </div>
  );
}
