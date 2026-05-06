import React, { useState, useMemo } from 'react';
import { Transaction } from '../types';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { doc, deleteDoc, collection, addDoc, writeBatch } from 'firebase/firestore';
import { Trash2, Pencil, Plus, Check, X, Search, Filter, RefreshCw } from 'lucide-react';

export function TransactionsTab({ userId, transactions, onEdit, userSettings }: { userId?: string, transactions: Transaction[], onEdit?: (t: Transaction) => void, userSettings?: import('../types').UserSettings }) {
  const [isAdding, setIsAdding] = useState(false);
  const [addType, setAddType] = useState<'expense' | 'income'>('expense');
  const [addDesc, setAddDesc] = useState('');
  const [addAmount, setAddAmount] = useState('');
  const [addDate, setAddDate] = useState(new Date().toISOString().split('T')[0]);
  const [addCat, setAddCat] = useState('');
  const [addMethod, setAddMethod] = useState('');
  const [addCard, setAddCard] = useState('');

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'expense' | 'income'>('all');
  const [filterMonth, setFilterMonth] = useState('all');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');

  const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  const resetAddForm = () => {
    setIsAdding(false);
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
          <table 
            className={`w-full text-left text-sm whitespace-nowrap ${!isPulling ? 'transition-transform duration-200' : ''}`}
            style={{ transform: `translateY(${pullY}px)` }}
          >
             <thead className="sticky top-0 z-10">
                <tr className="bg-gray-100 dark:bg-[#0a0a0b] text-gray-600 font-medium border-b border-gray-200 dark:border-white/5 text-[10px] uppercase tracking-wider backdrop-blur-md">
                   <th className="px-6 py-3 font-semibold">Data</th>
                   <th className="px-6 py-3 font-semibold">Descrição</th>
                   <th className="px-6 py-3 font-semibold">Categoria</th>
                   <th className="px-6 py-3 font-semibold">Método / Cartão</th>
                   <th className="px-6 py-3 font-semibold text-right">Valor</th>
                   <th className="px-6 py-3 font-semibold w-24"></th>
                </tr>
             </thead>
             <tbody className="text-xs">
                {userId && (
                  <tr className="bg-emerald-50/50 dark:bg-emerald-900/10 border-b border-emerald-100 dark:border-emerald-900/30 shadow-inner">
                    <td className="px-6 py-2">
                       <input type="date" value={addDate} onFocus={() => setIsAdding(true)} onChange={e => setAddDate(e.target.value)} className="w-full bg-white dark:bg-[#121214] border border-gray-300 dark:border-white/10 rounded px-2 py-1 text-xs focus:border-emerald-500 focus:outline-none dark:[&::-webkit-calendar-picker-indicator]:invert" />
                    </td>
                    <td className="px-6 py-2">
                       <input type="text" placeholder="Adicionar nova..." onFocus={() => setIsAdding(true)} value={addDesc} onChange={e => setAddDesc(e.target.value)} className="w-full bg-white dark:bg-[#121214] border border-gray-300 dark:border-white/10 rounded px-2 py-1 text-xs focus:border-emerald-500 focus:outline-none placeholder:text-gray-400" />
                    </td>
                    <td className="px-6 py-2">
                       {isAdding ? (
                         <select value={addCat} onChange={e => setAddCat(e.target.value)} className="w-full bg-white dark:bg-[#121214] border border-gray-300 dark:border-white/10 rounded px-2 py-1 text-xs focus:border-emerald-500 focus:outline-none">
                            <option value="" disabled>Selecione...</option>
                            {(addType === 'expense' ? userSettings?.categories : userSettings?.incomeCategories)?.map(c => <option key={c} value={c}>{c}</option>)}
                         </select>
                       ) : <span className="opacity-0">-</span>}
                    </td>
                    <td className="px-6 py-2">
                       {isAdding ? (
                         addType === 'expense' ? (
                           <div className="flex flex-col gap-1 w-full max-w-xs">
                             <select value={addMethod} onChange={e => setAddMethod(e.target.value)} className="w-full bg-white dark:bg-[#121214] border border-gray-300 dark:border-white/10 rounded px-2 py-1 text-xs focus:border-emerald-500 focus:outline-none">
                                <option value="" disabled>Selecione...</option>
                                <option value="Débito">Débito</option>
                                <option value="Crédito">Crédito</option>
                                <option value="Pix">Pix</option>
                                <option value="Dinheiro">Dinheiro</option>
                             </select>
                             {(addMethod === 'Crédito' || addMethod === 'Débito') && (
                               <select value={addCard} onChange={e => setAddCard(e.target.value)} className="w-full bg-white dark:bg-[#121214] border border-gray-300 dark:border-white/10 rounded px-2 py-1 text-xs focus:border-emerald-500 focus:outline-none">
                                  <option value="" disabled>Cartão...</option>
                                  {userSettings?.cards?.map(c => <option key={c} value={c}>{c}</option>)}
                               </select>
                             )}
                           </div>
                         ) : <span className="text-gray-500">-</span>
                       ) : <span className="opacity-0">-</span>}
                    </td>
                    <td className="px-6 py-2">
                       {isAdding ? (
                         <div className="flex items-center justify-end gap-2">
                           <button onClick={() => { setAddType(addType === 'expense' ? 'income' : 'expense'); setAddCat(''); }} className={`px-2 py-1 object-none shrink-0 rounded border text-[10px] font-bold ${addType === 'expense' ? 'border-red-500/30 text-red-500 bg-red-500/10' : 'border-emerald-500/30 text-emerald-500 bg-emerald-500/10'}`}>
                             {addType === 'expense' ? '-' : '+'}
                           </button>
                           <input type="number" step="0.01" placeholder="0.00" onFocus={() => setIsAdding(true)} value={addAmount} onChange={e => setAddAmount(e.target.value)} className="w-20 text-right bg-white dark:bg-[#121214] border border-gray-300 dark:border-white/10 rounded px-2 py-1 text-xs focus:border-emerald-500 focus:outline-none placeholder:text-gray-400" />
                         </div>
                       ) : <span className="opacity-0">-</span>}
                    </td>
                    <td className="px-6 py-2 text-right">
                       {isAdding && (
                         <div className="flex gap-1 justify-end">
                            <button onClick={handleQuickAdd} disabled={!addDesc || !addAmount || !addCat} className="p-1 rounded bg-emerald-500 text-white disabled:opacity-50 hover:bg-emerald-600 transition"><Check className="w-4 h-4" /></button>
                            <button onClick={resetAddForm} className="p-1 rounded bg-gray-200 dark:bg-white/10 text-gray-600 dark:text-gray-400 hover:bg-gray-300 dark:hover:bg-white/20 transition"><X className="w-4 h-4" /></button>
                         </div>
                       )}
                    </td>
                  </tr>
                )}
                {filteredTransactions.map(t => {
                   const m = new Date(t.date).getMonth() + 1; // 1-12
                   const monthColorsClass = [
                     '', // 0 not used
                     'bg-red-500/10', // Jan
                     'bg-orange-500/10', // Feb
                     'bg-amber-500/10', // Mar
                     'bg-lime-500/10', // Apr
                     'bg-emerald-500/10', // May
                     'bg-teal-500/10', // Jun
                     'bg-sky-500/10', // Jul
                     'bg-blue-500/10', // Aug
                     'bg-indigo-500/10', // Sep
                     'bg-violet-500/10', // Oct
                     'bg-fuchsia-500/10', // Nov
                     'bg-rose-500/10', // Dec
                   ];
                   const rowBgClass = monthColorsClass[m] || '';

                   return (
                   <tr key={t.id} className={`${rowBgClass} border-b border-gray-200 dark:border-white/5 hover:brightness-95 dark:hover:brightness-110 transition group`}>
                      <td className="px-6 py-4 text-gray-500">{new Date(t.date).toLocaleDateString('pt-BR')}</td>
                      <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">{t.description} {t.installments ? <span className="opacity-50 text-[10px] bg-gray-200 dark:bg-white/10 px-1 rounded ml-2">Parcelado</span> : ''}</td>
                      <td className="px-6 py-4">
                         <span style={getStyleForCategory(t.category)} className="bg-gray-100 dark:bg-white/5 text-gray-700 dark:text-gray-300 px-2 py-1 rounded border border-gray-200 dark:border-white/5 text-[10px] uppercase tracking-wider font-semibold">{t.category}</span>
                      </td>
                      <td className="px-6 py-4 text-gray-500">
                         {t.paymentMethod} {t.card && <span style={getStyleForCard(t.card)} className="ml-2 bg-gray-100 dark:bg-white/5 text-gray-700 dark:text-gray-300 px-2 py-1 rounded border border-gray-200 dark:border-white/5 text-[10px] uppercase tracking-wider font-semibold">{t.card}</span>}
                      </td>
                      <td className={`px-6 py-4 font-medium text-right ${t.type === 'income' ? 'text-emerald-400' : 'text-gray-900 dark:text-white'}`}>
                         {t.type === 'income' ? '+' : '-'}{formatCurrency(t.amount)}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex gap-1 justify-end opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-all">
                           {onEdit && (
                             <button onClick={() => onEdit(t)} className="text-gray-600 hover:text-emerald-500 transition-all p-2 rounded-lg hover:bg-gray-100 dark:bg-white/5 active:bg-gray-200 dark:bg-white/10" title="Editar">
                               <Pencil className="w-4 h-4" />
                             </button>
                           )}
                           <button onClick={() => setTransactionToDelete(t)} className="text-gray-600 hover:text-red-500 transition-all p-2 rounded-lg hover:bg-gray-100 dark:bg-white/5 active:bg-gray-200 dark:bg-white/10" title="Excluir">
                             <Trash2 className="w-4 h-4" />
                           </button>
                        </div>
                      </td>
                   </tr>
                   );
                })}
                {filteredTransactions.length === 0 && (
                   <tr>
                      <td colSpan={6} className="px-6 py-8 text-center text-gray-500">Nenhuma transação encontrada.</td>
                   </tr>
                )}
             </tbody>
          </table>
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

