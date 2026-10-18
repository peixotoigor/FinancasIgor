import React, { useState, useMemo } from 'react';
import { Transaction } from '../types';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { doc, deleteDoc, collection, addDoc, writeBatch } from 'firebase/firestore';
import { Trash2, Pencil, Plus, Check, X, Search, Filter, RefreshCw, Copy } from 'lucide-react';
import { Button, Chip } from './ui';
import { QuickAddTransaction } from './QuickAddTransaction';

export function TransactionsTab({ userId, transactions, onEdit, userSettings }: { userId?: string, transactions: Transaction[], onEdit?: (t: Transaction) => void, userSettings?: import('../types').UserSettings }) {
  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'expense' | 'income'>('all');
  const [filterMonth, setFilterMonth] = useState('all');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');

  const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

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
      const pullDistance = Math.min(deltaY * 0.4, 80);
      setPullY(pullDistance);
    }
  };

  const handleTouchEnd = async () => {
    if (!isPulling) return;
    setIsPulling(false);
    
    if (pullY >= 60) {
      setIsRefreshing(true);
      setPullY(60); 
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
    return { backgroundColor: col + '20', color: col, borderColor: col + '30' };
  };

  const getStyleForCard = (card: string) => {
    const col = userSettings?.cardColors?.[card];
    if (!col) return {};
    return { backgroundColor: col + '20', color: col, borderColor: col + '30' };
  };

  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      if (filterType !== 'all' && t.type !== filterType) return false;
      
      if (searchTerm) {
        const searchLow = searchTerm.toLowerCase();
        const cleanAmount = searchLow.replace(/^r\$\s*|^r\s*|^\$\s*/i, '').replace(/\s+/g, '');
        const queryWithDot = cleanAmount.replace(',', '.');
        const queryWithComma = cleanAmount.replace('.', ',');
        const queryDigitsOnly = cleanAmount.replace(/[.,]/g, '');

        const matchesText = 
          t.description.toLowerCase().includes(searchLow) || 
          t.category.toLowerCase().includes(searchLow) ||
          (t.paymentMethod && t.paymentMethod.toLowerCase().includes(searchLow)) ||
          (t.card && t.card.toLowerCase().includes(searchLow));

        let matchesAmount = false;
        if (cleanAmount) {
          const amount = t.amount;
          const amountStr = amount.toString();
          const amountFixed = amount.toFixed(2);
          const amountPtBR = amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
          const amountPtBRClean = amountPtBR.replace(/\./g, '');
          const amountPtBRDot = amountPtBRClean.replace(',', '.');
          const amountInteger = Math.floor(amount).toString();

          matchesAmount = (
            amountStr.includes(cleanAmount) ||
            amountFixed.includes(cleanAmount) ||
            amountFixed.includes(queryWithDot) ||
            amountPtBR.includes(cleanAmount) ||
            amountPtBR.includes(queryWithComma) ||
            amountPtBRClean.includes(cleanAmount) ||
            amountPtBRClean.includes(queryWithComma) ||
            amountPtBRDot.includes(queryWithDot) ||
            (queryDigitsOnly ? amountInteger.includes(queryDigitsOnly) : false) ||
            (queryDigitsOnly.length >= 2 && amountPtBRClean.replace(',', '').includes(queryDigitsOnly))
          );
        }

        if (!matchesText && !matchesAmount) return false;
      }
      
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

  const uniqueMonths = useMemo(() => {
    const m = new Set<string>();
    transactions.forEach(t => {
      const d = new Date(t.date);
      m.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    });
    return Array.from(m).sort((a, b) => b.localeCompare(a));
  }, [transactions]);

  return (
    <div className="glass-card bg-white dark:bg-[#121214] border border-gray-200 dark:border-white/5 rounded-2xl shadow-sm flex flex-col h-full max-h-[850px] overflow-hidden font-sans transition-all">
       <div className="glass-header p-4 border-b border-gray-100 dark:border-white/5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-[#121214] shrink-0">
          <div>
            <h2 className="text-base font-bold text-gray-900 dark:text-white">Transações</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">Extrato detalhado de movimentações</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:flex-none">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input 
                type="text" 
                placeholder="Buscar transação..." 
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full sm:w-48 pl-9 pr-3 py-1.5 bg-gray-50 dark:bg-[#0A0A0B] border border-gray-200 dark:border-white/10 rounded-xl text-xs text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>
            <select 
              value={filterType} 
              onChange={e => setFilterType(e.target.value as any)}
              className="bg-gray-50 dark:bg-[#0A0A0B] border border-gray-200 dark:border-white/10 rounded-xl px-2.5 py-1.5 text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
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
              className="bg-gray-50 dark:bg-[#0A0A0B] border border-gray-200 dark:border-white/10 rounded-xl px-2.5 py-1.5 text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
            >
              <option value="all">Todo período</option>
              <option value="custom">Personalizado</option>
              {uniqueMonths.map(m => {
                const [yyyy, mm] = m.split('-');
                const date = new Date(parseInt(yyyy), parseInt(mm) - 1);
                return <option key={m} value={m}>{date.toLocaleString('pt-BR', { month: 'short', year: 'numeric' })}</option>
              })}
            </select>
            {filterMonth === 'custom' && (
              <div className="flex items-center gap-1.5">
                <input 
                  type="date" 
                  value={filterStartDate}
                  onChange={e => setFilterStartDate(e.target.value)}
                  className="bg-gray-50 dark:bg-[#0A0A0B] border border-gray-200 dark:border-white/10 rounded-xl px-2 py-1 text-xs text-gray-900 dark:text-white"
                />
                <span className="text-gray-400 text-xs">/</span>
                <input 
                  type="date" 
                  value={filterEndDate}
                  onChange={e => setFilterEndDate(e.target.value)}
                  className="bg-gray-50 dark:bg-[#0A0A0B] border border-gray-200 dark:border-white/10 rounded-xl px-2 py-1 text-xs text-gray-900 dark:text-white"
                />
              </div>
            )}
          </div>
       </div>

       {userId && (
          <div className="p-4 border-b border-gray-100 dark:border-white/5 bg-gray-50/50 dark:bg-[#0A0A0B]/50">
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
             <div className="flex items-center gap-2 text-xs text-gray-500 font-medium py-2">
                <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-emerald-500' : ''}`} />
                <span>{isRefreshing ? 'Sincronizando...' : pullY >= 60 ? 'Solte para atualizar' : 'Puxe para atualizar'}</span>
             </div>
          </div>

          <div 
             className={`divide-y divide-gray-100 dark:divide-white/5 ${!isPulling ? 'transition-all duration-200' : ''}`}
             style={{ transform: `translateY(${pullY}px)` }}
          >
             {filteredTransactions.map(t => {
                return (
                <div 
                  key={t.id} 
                  onClick={(e) => { e.stopPropagation(); onEdit && onEdit(t); }} 
                  className="flex items-center justify-between p-3.5 sm:p-4 hover:bg-gray-50 dark:hover:bg-white/5 cursor-pointer transition-colors group"
                >
                   <div className="flex flex-col min-w-0 pr-3">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm text-gray-900 dark:text-white truncate">{t.description}</span>
                        {t.installments ? (
                          <Chip size="sm" variant="secondary" className="text-[10px] h-4.5 px-1.5 font-mono">
                            {t.installmentNumber}/{t.installments}
                          </Chip>
                        ) : null}
                        {t.status === 'pending' && (
                          <Chip size="sm" variant="soft" color="warning" className="text-[10px] h-4.5 px-1.5 font-medium">
                            Pendente
                          </Chip>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1 flex-wrap text-xs text-gray-400">
                         <span>
                            {new Date(t.date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                         </span>
                         
                         <span>&bull;</span>
                         
                         <span 
                           className="px-2 py-0.5 rounded-md text-[11px] font-medium"
                           style={getStyleForCategory(t.category)}
                         >
                           {t.category}
                         </span>

                         {t.paymentMethod && (
                            <>
                               <span>&bull;</span>
                               <span 
                                 className="px-2 py-0.5 rounded-md text-[11px] font-medium"
                                 style={t.card ? getStyleForCard(t.card) : {}}
                               >
                                  {t.type === 'income' ? 'Receita' : t.paymentMethod}
                                  {t.card ? ` (${t.card})` : ''}
                               </span>
                            </>
                         )}
                      </div>
                   </div>
                   <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                     <span className={`text-sm sm:text-base font-semibold font-mono ${t.type === 'income' ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-900 dark:text-white'}`}>
                        {t.type === 'income' ? '+ ' : '- '}{formatCurrency(t.amount)}
                     </span>
                     <button 
                        onClick={(e) => { 
                           e.stopPropagation(); 
                           if (onEdit) {
                              const { id, ...copyTx } = t; 
                              onEdit(copyTx as Transaction);
                           } 
                        }} 
                        className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" 
                        title="Duplicar"
                     >
                       <Copy className="w-3.5 h-3.5" />
                     </button>
                     <button 
                        onClick={(e) => { 
                           e.stopPropagation(); 
                           setTransactionToDelete(t); 
                        }} 
                        className="p-1.5 rounded-lg text-gray-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 opacity-0 group-hover:opacity-100 transition-opacity" 
                        title="Excluir"
                     >
                       <Trash2 className="w-3.5 h-3.5" />
                     </button>
                   </div>
                </div>
                );
             })}
             {filteredTransactions.length === 0 && (
                <div className="p-12 text-center text-gray-400 text-sm">
                  Nenhuma transação encontrada no período.
                </div>
             )}
          </div>
       </div>

      {transactionToDelete && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#121214] border border-gray-200 dark:border-white/10 p-6 max-w-sm w-full rounded-3xl shadow-xl flex flex-col gap-4">
            <h3 className="font-bold text-lg text-gray-900 dark:text-white">Excluir Transação</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
              Tem certeza de que deseja excluir <strong>{transactionToDelete.description}</strong>?
            </p>
            
            {isInstallment(transactionToDelete) && (
              <label className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={deleteSubsequent}
                  onChange={e => setDeleteSubsequent(e.target.checked)}
                  className="mt-0.5 rounded text-emerald-500 focus:ring-emerald-500 w-4 h-4"
                />
                <span className="text-xs text-gray-700 dark:text-gray-300">
                  Excluir também as <strong>{getSubsequentInstallments(transactionToDelete).length}</strong> parcelas futuras relacionadas.
                </span>
              </label>
            )}

            <div className="flex gap-2 justify-end mt-2">
              <Button 
                onPress={() => setTransactionToDelete(null)}
                isDisabled={isDeleting}
                variant="ghost"
                size="sm"
                className="px-4 py-2 text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5 rounded-xl transition-colors"
              >
                Cancelar
              </Button>
              <Button 
                onPress={confirmDelete}
                isDisabled={isDeleting}
                variant="danger"
                size="sm"
                className="px-4 py-2 text-xs font-medium text-white bg-rose-500 hover:bg-rose-600 rounded-xl transition-colors"
              >
                {isDeleting ? 'Excluindo...' : 'Confirmar Exclusão'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
