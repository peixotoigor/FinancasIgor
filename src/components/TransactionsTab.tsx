import React, { useState, useMemo } from 'react';
import { Transaction } from '../types';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { doc, deleteDoc, collection, addDoc, writeBatch } from 'firebase/firestore';
import { Trash2, Pencil, Plus, Check, X, Search, Filter, RefreshCw } from 'lucide-react';
import { QuickAddTransaction } from './QuickAddTransaction';

export function TransactionsTab({ userId, transactions, onEdit, userSettings }: { userId?: string, transactions: Transaction[], onEdit?: (t: Transaction) => void, userSettings?: import('../types').UserSettings }) {
  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'expense' | 'income'>('all');
  const [filterMonth, setFilterMonth] = useState('all');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');

  const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  const resetAddForm = () => {
    setAddDesc('');
    setAddAmount('');
    setAddDate(new Date().toISOString().split('T')[0]);
    // Keeps type, cat, method stable for rapid entry
  };

  const handleQuickAdd = async () => {
    if (!userId || !addDesc || !addAmount || !addCat) return;
    const parsedAmount = parseFloat(addAmount.replace(',', '.'));
    if (isNaN(parsedAmount) || parsedAmount <= 0) return;

    try {
      const baseDate = new Date(addDate + 'T12:00:00');
      const payload: Transaction = {
          userId,
          description: addDesc,
          amount: parsedAmount,
          date: baseDate.getTime(),
          type: addType,
          category: addCat,
          account: addType === 'expense' ? 'Conta' : '',
          paymentMethod: addType === 'expense' ? (addMethod || 'Débito') : '',
          card: addType === 'expense' && (addMethod === 'Crédito' || addMethod === 'Débito') ? addCard : undefined,
          createdAt: Date.now()
      };
      await addDoc(collection(db, 'transactions'), payload);
      resetAddForm();
    } catch (e) {
      handleFirestoreError(e, OperationType.CREATE, 'transactions');
    }
  };

  const [transactionToDelete, setTransactionToDelete] = useState<Transaction | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteSubsequent, setDeleteSubsequent] = useState(true);

  // Pull to refresh state
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const [pullY, setPullY] = useState(0);
  const [isPulling, setIsPulling] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const startYRef = React.useRef(0);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (scrollRef.current && scrollRef.current.scrollTop <= 0) {
      startYRef.current = e.touches[0].clientY;
      setIsPulling(true);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isPulling) return;
    const y = e.touches[0].clientY;
    const deltaY = y - startYRef.current;
    
    if (deltaY > 0 && scrollRef.current && scrollRef.current.scrollTop <= 0) {
      const pullDistance = Math.min(deltaY * 0.4, 80); // Resistance factor
      setPullY(pullDistance);
    }
  };

  const handleTouchEnd = async () => {
    if (!isPulling) return;
    setIsPulling(false);
    
    if (pullY >= 60) {
      setIsRefreshing(true);
      setPullY(60); 
      // Simulate real network request sync (since onSnapshot handles actual real-time)
      await new Promise(resolve => setTimeout(resolve, 1000));
      setIsRefreshing(false);
    }
    setPullY(0);
  };

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
    
    // Fallback to description matching for legacy/imported data
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
      if (isInstallment(transactionToDelete) && deleteSubsequent) {
        const subsequent = getSubsequentInstallments(transactionToDelete);
        const batch = writeBatch(db);
        batch.delete(doc(db, 'transactions', transactionToDelete.id!));
        subsequent.forEach(sub => {
          batch.delete(doc(db, 'transactions', sub.id!));
        });
        await batch.commit();
      } else {
        await deleteDoc(doc(db, 'transactions', transactionToDelete.id!));
      }
      setTransactionToDelete(null);
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, 'transactions');
    } finally {
      setIsDeleting(false);
    }
  };

  const getStyleForCategory = (cat: string) => {
    const col = userSettings?.categoryColors?.[cat];
    if (!col) return {};
    return { backgroundColor: col + '20', color: col, borderColor: col + '30' }; // 20 is low opacity hex (approx 12%)
  };

  const getStyleForCard = (card: string) => {
    const col = userSettings?.cardColors?.[card];
    if (!col) return {};
    return { backgroundColor: col + '20', color: col, borderColor: col + '30' };
  };

  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      // Type filter
      if (filterType !== 'all' && t.type !== filterType) return false;
      
      // Search filter
      if (searchTerm) {
        const searchLow = searchTerm.toLowerCase();
        if (!t.description.toLowerCase().includes(searchLow) && !t.category.toLowerCase().includes(searchLow)) return false;
      }
      
      // Month & Date range filter
      if (filterMonth === 'custom') {
        const tDate = new Date(t.date);
        tDate.setHours(0,0,0,0);
        if (filterStartDate) {
           const sDate = new Date(filterStartDate + 'T00:00:00');
           if (tDate < sDate) return false;
        }
        if (filterEndDate) {
           const eDate = new Date(filterEndDate + 'T23:59:59');
           if (tDate > eDate) return false;
        }
      } else if (filterMonth !== 'all') {
        const d = new Date(t.date);
        const yyyyMM = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        if (yyyyMM !== filterMonth) return false;
      }
      
      return true;
    });
  }, [transactions, filterType, searchTerm, filterMonth, filterStartDate, filterEndDate]);

  // Extract unique months for the filter dropdown
  const uniqueMonths = useMemo(() => {
    const m = new Set<string>();
    transactions.forEach(t => {
      const d = new Date(t.date);
      m.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    });
    return Array.from(m).sort((a, b) => b.localeCompare(a));
  }, [transactions]);

  return (
    <div className="bg-white dark:bg-[#121214] border border-gray-200 dark:border-white/5 rounded-2xl flex flex-col h-full max-h-[800px] shadow-sm">
       <div className="p-4 border-b border-gray-200 dark:border-white/5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-[#121214] rounded-t-2xl shrink-0">
          <h2 className="text-sm text-gray-800 dark:text-gray-200 font-bold tracking-tight">Transações</h2>
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:flex-none">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input 
                type="text" 
                placeholder="Buscar..." 
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full sm:w-48 pl-9 pr-3 py-1.5 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg text-xs focus:outline-none focus:border-emerald-500 transition-colors"
              />
            </div>
            <select 
              value={filterType} 
              onChange={e => setFilterType(e.target.value as any)}
              className="bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-emerald-500 transition-colors"
            >
              <option value="all">Todas</option>
              <option value="expense">Despesas</option>
              <option value="income">Receitas</option>
            </select>
            <select 
              value={filterMonth} 
              onChange={e => {
                setFilterMonth(e.target.value);
                if (e.target.value !== 'custom') {
                  setFilterStartDate('');
                  setFilterEndDate('');
                }
              }}
              className="bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-emerald-500 transition-colors"
            >
              <option value="all">Todo período</option>
              <option value="custom">Período customizado</option>
              {uniqueMonths.map(m => {
                const [yyyy, mm] = m.split('-');
                const date = new Date(parseInt(yyyy), parseInt(mm) - 1);
                return <option key={m} value={m}>{date.toLocaleString('pt-BR', { month: 'short', year: 'numeric' })}</option>
              })}
            </select>
            {filterMonth === 'custom' && (
              <div className="flex items-center gap-2">
                <input 
                  type="date"
                  value={filterStartDate}
                  onChange={e => setFilterStartDate(e.target.value)}
                  className="bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-emerald-500 transition-colors"
                />
                <span className="text-gray-400 text-xs text-center px-1">até</span>
                <input 
                  type="date"
                  value={filterEndDate}
                  onChange={e => setFilterEndDate(e.target.value)}
                  className="bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-emerald-500 transition-colors"
                />
              </div>
            )}
          </div>
       </div>
       {userId && (
          <div className="p-4 px-4 sm:px-6 pb-0 pt-6 border-b border-gray-100 dark:border-white/5 bg-gray-50/50 dark:bg-white/[0.01]">
            <QuickAddTransaction userId={userId} userSettings={userSettings} />
          </div>
       )}
       <div 
         ref={scrollRef}
         className="overflow-auto flex-1 p-0 relative"
         onTouchStart={handleTouchStart}
         onTouchMove={handleTouchMove}
         onTouchEnd={handleTouchEnd}
         style={{ overscrollBehaviorY: 'contain' }}
       >
          <div 
            className={`absolute top-0 left-0 w-full flex justify-center items-center overflow-hidden ${!isPulling ? 'transition-all duration-200' : ''}`}
            style={{ 
              height: `${pullY}px`,
              opacity: pullY / 60
            }}
          >
            <RefreshCw className={`w-5 h-5 text-emerald-500 ${isRefreshing ? 'animate-spin' : ''}`} style={{ transform: `rotate(${pullY * 3}deg)` }} />
          </div>
          <div 
            className={`w-full flex-1 flex flex-col p-2 sm:p-4 gap-1 ${!isPulling ? 'transition-transform duration-200' : ''}`}
            style={{ transform: `translateY(${pullY}px)` }}
          >
             {filteredTransactions.map(t => {
                const m = new Date(t.date).getMonth() + 1; // 1-12
                const monthColorsClass = [
                  '', // 0 not used
                  'bg-red-500/5 hover:bg-red-500/10 dark:bg-red-500/10 dark:hover:bg-red-500/20', // Jan
                  'bg-orange-500/5 hover:bg-orange-500/10 dark:bg-orange-500/10 dark:hover:bg-orange-500/20', // Feb
                  'bg-amber-500/5 hover:bg-amber-500/10 dark:bg-amber-500/10 dark:hover:bg-amber-500/20', // Mar
                  'bg-lime-500/5 hover:bg-lime-500/10 dark:bg-lime-500/10 dark:hover:bg-lime-500/20', // Apr
                  'bg-emerald-500/5 hover:bg-emerald-500/10 dark:bg-emerald-500/10 dark:hover:bg-emerald-500/20', // May
                  'bg-teal-500/5 hover:bg-teal-500/10 dark:bg-teal-500/10 dark:hover:bg-teal-500/20', // Jun
                  'bg-sky-500/5 hover:bg-sky-500/10 dark:bg-sky-500/10 dark:hover:bg-sky-500/20', // Jul
                  'bg-blue-500/5 hover:bg-blue-500/10 dark:bg-blue-500/10 dark:hover:bg-blue-500/20', // Aug
                  'bg-indigo-500/5 hover:bg-indigo-500/10 dark:bg-indigo-500/10 dark:hover:bg-indigo-500/20', // Sep
                  'bg-violet-500/5 hover:bg-violet-500/10 dark:bg-violet-500/10 dark:hover:bg-violet-500/20', // Oct
                  'bg-fuchsia-500/5 hover:bg-fuchsia-500/10 dark:bg-fuchsia-500/10 dark:hover:bg-fuchsia-500/20', // Nov
                  'bg-rose-500/5 hover:bg-rose-500/10 dark:bg-rose-500/10 dark:hover:bg-rose-500/20', // Dec
                ];
                const rowBgClass = monthColorsClass[m] || 'hover:bg-gray-50 dark:hover:bg-white/5';

                return (
                <div key={t.id} onClick={(e) => { e.stopPropagation(); onEdit && onEdit(t); }} className={`${rowBgClass} flex items-center justify-between p-3 sm:p-4 rounded-xl cursor-pointer transition-colors group border border-transparent hover:border-gray-100 dark:hover:border-white/5`}>
                   <div className="flex flex-col min-w-0 pr-2">
                      <span className="font-medium text-sm text-gray-900 dark:text-gray-100 truncate pb-0.5">{t.description} {t.installments ? <span className="opacity-50 text-[10px] bg-gray-200 dark:bg-white/10 px-1 rounded ml-2 font-semibold uppercase tracking-widest">{t.installmentNumber}/{t.installments}</span> : ''}</span>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                         <span className="text-[10px] text-gray-500 shrink-0">
                            {new Date(t.date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '')}
                         </span>
                         
                         <span className="w-1 h-1 rounded-full bg-gray-300 dark:bg-gray-700"></span>
                         
                         <div className="flex items-center gap-1.5">
                            <div 
                              className="w-2 h-2 rounded-full" 
                              style={{ backgroundColor: userSettings?.categoryColors?.[t.category] || '#9ca3af' }}
                            />
                            <span className="text-[10px] text-gray-500 capitalize tracking-wide">{t.category}</span>
                         </div>

                         {t.paymentMethod && (
                            <>
                               <span className="w-1 h-1 rounded-full bg-gray-300 dark:bg-gray-700"></span>
                               <div className="flex items-center gap-1.5">
                                  {t.card && (
                                     <div 
                                       className="w-2 h-2 rounded-full"
                                       style={{ backgroundColor: userSettings?.cardColors?.[t.card] || '#9ca3af' }}
                                     />
                                  )}
                                  <span className="text-[10px] text-gray-500 truncate max-w-[150px]">
                                     {t.type === 'income' ? 'Receita' : (t.paymentMethod === 'Crédito' || t.paymentMethod === 'Débito' ? t.paymentMethod : 'Despesa')}
                                     {t.card ? ` • ${t.card}` : (t.paymentMethod !== 'Crédito' && t.paymentMethod !== 'Débito' ? ` • ${t.paymentMethod}` : '')}
                                  </span>
                               </div>
                            </>
                         )}
                      </div>
                   </div>
                   <div className="flex items-center gap-3">
                     <span className={`text-sm font-mono tracking-tight font-medium shrink-0 ${t.type === 'income' ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-900 dark:text-white'}`}>
                        {t.type === 'income' ? '+' : '-'}{formatCurrency(t.amount)}
                     </span>
                     <button onClick={(e) => { e.stopPropagation(); setTransactionToDelete(t); }} className="text-gray-400 hover:text-red-500 transition-all p-2 rounded-lg hover:bg-white dark:hover:bg-white/10 active:bg-gray-100 dark:active:bg-white/20 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 shadow-sm border border-transparent hover:border-gray-200 dark:hover:border-white/10 bg-white/50 dark:bg-[#121214]/50" title="Excluir">
                       <Trash2 className="w-4 h-4" />
                     </button>
                   </div>
                </div>
                );
             })}
             {filteredTransactions.length === 0 && (
                <div className="p-8 text-center text-gray-500">Nenhuma transação encontrada.</div>
             )}
          </div>
       </div>

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

