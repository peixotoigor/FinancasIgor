import React, { useState, useEffect } from 'react';
import { ChevronDown, ChevronUp, Plus, Trash2, PiggyBank, Calculator, HelpCircle, PencilLine, X, Send } from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { doc, getDoc, writeBatch } from 'firebase/firestore';
import type { MonthlyBudget, PlannedExpense, Transaction, UserSettings } from '../types';

interface MonthlyPlanningProps {
  userId: string;
  year: number;
  month: number;
  budget: MonthlyBudget | null;
  transactions: Transaction[];
  transactionsLoaded: boolean;
  userSettings: UserSettings | null;
}

export function MonthlyPlanning({ userId, year, month, budget, transactions, transactionsLoaded, userSettings }: MonthlyPlanningProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [plannedExpenses, setPlannedExpenses] = useState<PlannedExpense[]>([]);
  const [fixedExpenses, setFixedExpenses] = useState<PlannedExpense[]>([]);
  
  const [editingPlannedId, setEditingPlannedId] = useState<string | null>(null);
  const [editingFixedId, setEditingFixedId] = useState<string | null>(null);
  
  const [plannedDesc, setPlannedDesc] = useState('');
  const [plannedAmt, setPlannedAmt] = useState('');
  const [plannedCategory, setPlannedCategory] = useState('');
  const [plannedAccount, setPlannedAccount] = useState('');
  const [plannedPaymentMethod, setPlannedPaymentMethod] = useState('');
  const [plannedCard, setPlannedCard] = useState('');
  
  const [fixedDesc, setFixedDesc] = useState('');
  const [fixedAmt, setFixedAmt] = useState('');
  const [fixedIsRecurring, setFixedIsRecurring] = useState(true);
  const [fixedCategory, setFixedCategory] = useState('');
  const [fixedAccount, setFixedAccount] = useState('');
  const [fixedPaymentMethod, setFixedPaymentMethod] = useState('');
  const [fixedCard, setFixedCard] = useState('');
  
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setPlannedExpenses(budget?.plannedExpenses || []);
    setFixedExpenses(budget?.fixedExpenses || []);
  }, [budget]);

  useEffect(() => {
    if (!transactionsLoaded || !budget || !budget.fixedExpenses || budget.fixedExpenses.length === 0) return;

    const createPendingTransactions = async () => {
      const batch = writeBatch(db);
      let hasChanges = false;
      const processed = budget.processedFixedExpenses || [];
      const newProcessed = [...processed];

      budget.fixedExpenses!.forEach(fixedExp => {
        if (processed.includes(fixedExp.id)) return;

        // Check if a transaction exists for this fixed expense in the current month (for legacy before processed flag)
        const exists = transactions.some(t => 
          t.type === 'expense' && 
          t.description.trim().toLowerCase() === fixedExp.description.trim().toLowerCase()
        );

        if (!exists) {
          hasChanges = true;
          // Use deterministic ID to prevent duplicates
          const newTxRef = doc(db, 'transactions', `auto_${userId}_${year}_${month}_${fixedExp.id}`);
          
          // Use the 1st day of the viewed month, or today if it's the current real month
          const now = new Date();
          let txDate = new Date(year, month - 1, 1).getTime();
          if (now.getFullYear() === year && now.getMonth() + 1 === month) {
            txDate = now.getTime();
          }

          const newTx: Transaction = {
            userId,
            description: fixedExp.description,
            amount: fixedExp.amount,
            date: txDate,
            type: 'expense',
            category: fixedExp.category || 'Gastos Fixos',
            account: fixedExp.account || '',
            paymentMethod: fixedExp.paymentMethod || '',
            card: fixedExp.card || undefined,
            status: 'pending',
            createdAt: Date.now()
          };
          batch.set(newTxRef, newTx, { merge: true });
        }
        
        if (!newProcessed.includes(fixedExp.id)) {
          newProcessed.push(fixedExp.id);
          hasChanges = true;
        }
      });

      if (hasChanges) {
        try {
          const currentDocId = `${userId}_${year}_${month}`;
          const currentDocRef = doc(db, 'monthly_budgets', currentDocId);
          batch.set(currentDocRef, { processedFixedExpenses: newProcessed }, { merge: true });
          
          await batch.commit();
        } catch (e) {
          console.error('Failed to auto-create pending transactions', e);
        }
      }
    };

    createPendingTransactions();
  }, [budget, transactions, transactionsLoaded, year, month, userId]);

  const saveExpenses = async (
    newPlanned: PlannedExpense[], 
    newFixed: PlannedExpense[], 
    propagateAction?: { type: 'add' | 'edit' | 'remove', expense: PlannedExpense }
  ) => {
    setIsSaving(true);
    try {
      const batch = writeBatch(db);
      
      const currentDocId = `${userId}_${year}_${month}`;
      const currentDocRef = doc(db, 'monthly_budgets', currentDocId);
      
      batch.set(currentDocRef, {
        userId, year, month,
        plannedExpenses: newPlanned,
        fixedExpenses: newFixed,
        updatedAt: Date.now()
      }, { merge: true });

      if (propagateAction && month < 12) {
        for (let m = month + 1; m <= 12; m++) {
          const futureDocId = `${userId}_${year}_${m}`;
          const futureDocRef = doc(db, 'monthly_budgets', futureDocId);
          const docSnap = await getDoc(futureDocRef);
          
          let futureFixed: PlannedExpense[] = [];
          if (docSnap.exists()) {
             futureFixed = docSnap.data().fixedExpenses || [];
          }

          if (propagateAction.type === 'add') {
             if (propagateAction.expense.isRecurring !== false && !futureFixed.some(e => e.id === propagateAction.expense.id)) {
                futureFixed.push(propagateAction.expense);
             }
          } else if (propagateAction.type === 'edit') {
             const exists = futureFixed.some(e => e.id === propagateAction.expense.id);
             if (propagateAction.expense.isRecurring !== false) {
                if (exists) {
                   futureFixed = futureFixed.map(e => e.id === propagateAction.expense.id ? propagateAction.expense : e);
                } else {
                   futureFixed.push(propagateAction.expense);
                }
             } else {
                futureFixed = futureFixed.filter(e => e.id !== propagateAction.expense.id);
             }
          } else if (propagateAction.type === 'remove') {
             futureFixed = futureFixed.filter(e => e.id !== propagateAction.expense.id);
          }
          
          batch.set(futureDocRef, {
            userId, year, month: m,
            fixedExpenses: futureFixed,
            updatedAt: Date.now()
          }, { merge: true });
        }
      }

      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'monthly_budgets');
    } finally {
      setIsSaving(false);
    }
  };

  
  const handlePostPlanned = async (expense: PlannedExpense) => {
    setIsSaving(true);
    try {
      const batch = writeBatch(db);
      const newTxRef = doc(db, 'transactions', `auto_var_${userId}_${year}_${month}_${expense.id}`);
      
      const now = new Date();
      let txDate = new Date(year, month - 1, 1).getTime();
      if (now.getFullYear() === year && now.getMonth() + 1 === month) {
        txDate = now.getTime();
      }

      const newTx: Transaction = {
        userId,
        description: expense.description,
        amount: expense.amount,
        date: txDate,
        type: 'expense',
        category: expense.category || 'Gastos Variáveis',
        account: expense.account || '',
        paymentMethod: expense.paymentMethod || '',
        card: expense.card || undefined,
        status: 'pending',
        createdAt: Date.now()
      };
      
      batch.set(newTxRef, newTx, { merge: true });
      
      const currentDocId = `${userId}_${year}_${month}`;
      const currentDocRef = doc(db, 'monthly_budgets', currentDocId);
      const processed = budget?.processedPlannedExpenses || [];
      batch.set(currentDocRef, { processedPlannedExpenses: [...processed, expense.id] }, { merge: true });
      
      await batch.commit();
    } catch (error) {
      console.error('Failed to post planned expense', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddPlanned = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!plannedDesc || !plannedAmt) return;
    
    const val = parseFloat(plannedAmt.replace(/\./g, '').replace(',', '.'));
    if (isNaN(val) || val <= 0) return;

    let updatedExpenses;
    if (editingPlannedId) {
       updatedExpenses = plannedExpenses.map(exp => 
          exp.id === editingPlannedId ? { 
            ...exp, 
            description: plannedDesc, 
            amount: val,
            category: plannedCategory,
            account: plannedAccount,
            paymentMethod: plannedPaymentMethod,
            card: plannedPaymentMethod === 'Crédito' || plannedPaymentMethod === 'Débito' ? plannedCard : undefined
          } : exp
       );
       setEditingPlannedId(null);
    } else {
       updatedExpenses = [...plannedExpenses, {
          id: crypto.randomUUID(),
          description: plannedDesc,
          amount: val,
          category: plannedCategory,
          account: plannedAccount,
          paymentMethod: plannedPaymentMethod,
          card: plannedPaymentMethod === 'Crédito' || plannedPaymentMethod === 'Débito' ? plannedCard : undefined
       }];
    }

    setPlannedExpenses(updatedExpenses);
    setPlannedDesc('');
    setPlannedAmt('');
    setPlannedCategory('');
    setPlannedAccount('');
    setPlannedPaymentMethod('');
    setPlannedCard('');
    await saveExpenses(updatedExpenses, fixedExpenses);
  };
  
  const handleAddFixed = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fixedDesc || !fixedAmt) return;
    
    const val = parseFloat(fixedAmt.replace(/\./g, '').replace(',', '.'));
    if (isNaN(val) || val <= 0) return;

    let updatedExpenses;
    let newExpense: PlannedExpense;
    let actionType: 'add' | 'edit' = 'add';
    
    if (editingFixedId) {
       newExpense = { 
         id: editingFixedId, 
         description: fixedDesc, 
         amount: val, 
         isRecurring: fixedIsRecurring,
         category: fixedCategory,
         account: fixedAccount,
         paymentMethod: fixedPaymentMethod,
         card: fixedCard
       };
       updatedExpenses = fixedExpenses.map(exp => 
          exp.id === editingFixedId ? newExpense : exp
       );
       actionType = 'edit';
       setEditingFixedId(null);
    } else {
       newExpense = {
          id: crypto.randomUUID(),
          description: fixedDesc,
          amount: val,
          isRecurring: fixedIsRecurring,
          category: fixedCategory,
          account: fixedAccount,
          paymentMethod: fixedPaymentMethod,
          card: fixedCard
       };
       updatedExpenses = [...fixedExpenses, newExpense];
    }

    setFixedExpenses(updatedExpenses);
    setFixedDesc('');
    setFixedAmt('');
    setFixedIsRecurring(true);
    setFixedCategory('');
    setFixedAccount('');
    setFixedPaymentMethod('');
    setFixedCard('');
    
    const propagatePayload = { type: actionType as any, expense: newExpense };
    await saveExpenses(plannedExpenses, updatedExpenses, propagatePayload);
  };

  const startEditPlanned = (exp: PlannedExpense) => {
     setEditingPlannedId(exp.id);
     setPlannedDesc(exp.description);
     setPlannedAmt(formatCurrency(exp.amount).replace('R$', '').trim());
  };

  const cancelEditPlanned = () => {
     setEditingPlannedId(null);
     setPlannedDesc('');
     setPlannedAmt('');
  };

  const startEditFixed = (exp: PlannedExpense) => {
     setEditingFixedId(exp.id);
     setFixedDesc(exp.description);
     setFixedAmt(formatCurrency(exp.amount).replace('R$', '').trim());
     setFixedIsRecurring(exp.isRecurring !== false);
     setFixedCategory(exp.category || '');
     setFixedAccount(exp.account || '');
     setFixedPaymentMethod(exp.paymentMethod || '');
     setFixedCard(exp.card || '');
  };

  const cancelEditFixed = () => {
     setEditingFixedId(null);
     setFixedDesc('');
     setFixedAmt('');
     setFixedIsRecurring(true);
     setFixedCategory('');
     setFixedAccount('');
     setFixedPaymentMethod('');
     setFixedCard('');
  };

  const handleRemovePlanned = async (id: string) => {
    const updatedExpenses = plannedExpenses.filter(e => e.id !== id);
    setPlannedExpenses(updatedExpenses);
    await saveExpenses(updatedExpenses, fixedExpenses);
  };
  
  const handleRemoveFixed = async (id: string) => {
    const expenseToRemove = fixedExpenses.find(e => e.id === id);
    if (!expenseToRemove) return;

    const updatedExpenses = fixedExpenses.filter(e => e.id !== id);
    setFixedExpenses(updatedExpenses);
    
    const propagatePayload = { type: 'remove' as any, expense: expenseToRemove };
    await saveExpenses(plannedExpenses, updatedExpenses, propagatePayload);
  };

  const totalPlanned = plannedExpenses.reduce((acc, curr) => acc + curr.amount, 0);
  const totalFixed = fixedExpenses.reduce((acc, curr) => acc + curr.amount, 0);
  const totalBoth = totalPlanned + totalFixed;

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  const formatAmountInput = (value: string) => {
    let cleanValue = value.replace(/\D/g, '');
    if (cleanValue.length === 0) return '';
    if (cleanValue.length < 3) cleanValue = cleanValue.padStart(3, '0');
    const decimalPart = cleanValue.slice(-2);
    const integerPart = cleanValue.slice(0, -2);
    const formattedInteger = parseInt(integerPart, 10).toLocaleString('pt-BR');
    return `${formattedInteger},${decimalPart}`;
  };

  return (
    <div className="bg-white dark:bg-[#121214] border border-gray-100 dark:border-white/5 rounded-2xl shadow-sm overflow-hidden flex flex-col transition-all">
      <button 
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-4 lg:p-5 hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center">
            <Calculator className="w-5 h-5 text-indigo-500" />
          </div>
          <div className="text-left">
            <h3 className="font-semibold text-gray-900 dark:text-white tracking-tight">Planejamento do Mês</h3>
            <p className="text-xs text-gray-500 font-medium">Previna seus gastos ({plannedExpenses.length + fixedExpenses.length} itens)</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {(plannedExpenses.length > 0 || fixedExpenses.length > 0) && (
            <span className="text-sm font-mono tracking-tight font-medium text-gray-900 dark:text-white hidden sm:block">
              {formatCurrency(totalBoth)}
            </span>
          )}
          {isExpanded ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
        </div>
      </button>

      {isExpanded && (
        <div className="p-4 lg:p-5 border-t border-gray-100 dark:border-white/5 bg-gray-50/50 dark:bg-[#0B0B0C]">
          <div className="flex items-center gap-2 mb-6 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 p-3 rounded-xl">
            <HelpCircle className="w-4 h-4 shrink-0" />
            <p className="text-xs font-medium leading-relaxed">
              Adicione os seus gastos fixos e despesas previstas para projetar seu saldo do mês. Isso te ajuda a visualizar o total de comprometimentos.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            
            {/* Gastos Fixos */}
            <div className="flex flex-col gap-3">
               <div>
                 <h4 className="font-bold text-sm text-gray-900 dark:text-gray-100 uppercase tracking-widest mb-1">Gastos Fixos</h4>
                 <p className="text-[10px] text-gray-500">Contas recorrentes mensais (aluguel, internet, luz)</p>
               </div>
               
               <form onSubmit={handleAddFixed} className="flex flex-col gap-2 mb-2">
                 <div className="flex gap-2">
                   <input
                     type="text"
                     placeholder="Ex: Aluguel"
                     value={fixedDesc}
                     onChange={(e) => setFixedDesc(e.target.value)}
                     className="flex-1 bg-white dark:bg-[#1A1A1D] border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2 text-sm outline-none focus:border-indigo-500 dark:focus:border-indigo-500 transition-colors"
                     required
                   />
                   <div className="relative w-[110px] sm:w-[130px]">
                     <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm font-medium">R$</span>
                     <input
                       type="text"
                       placeholder="0,00"
                       value={fixedAmt}
                       onChange={(e) => setFixedAmt(formatAmountInput(e.target.value))}
                       className="w-full bg-white dark:bg-[#1A1A1D] border border-gray-200 dark:border-white/10 rounded-xl pl-8 pr-2 py-2 text-sm font-mono outline-none focus:border-indigo-500 dark:focus:border-indigo-500 transition-colors"
                       required
                     />
                   </div>
                   {editingFixedId && (
                     <button
                       type="button"
                       onClick={cancelEditFixed}
                       className="bg-gray-100 dark:bg-white/10 hover:bg-gray-200 dark:hover:bg-white/20 text-gray-600 dark:text-gray-400 p-2 rounded-xl transition-colors shrink-0"
                       title="Cancelar Edição"
                     >
                       <X className="w-5 h-5" />
                     </button>
                   )}
                   <button
                     type="submit"
                     disabled={isSaving || !fixedDesc || !fixedAmt}
                     className="bg-indigo-500 hover:bg-indigo-600 text-white p-2 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                     title={editingFixedId ? "Salvar Edição" : "Adicionar Gasto Fixo"}
                   >
                     {editingFixedId ? <PencilLine className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
                   </button>
                 </div>

                 <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                   <select value={fixedCategory} onChange={(e) => setFixedCategory(e.target.value)} className="bg-white dark:bg-[#1A1A1D] border border-gray-200 dark:border-white/10 rounded-xl px-2 py-1.5 text-[10px] text-gray-700 dark:text-gray-300 outline-none focus:border-indigo-500 transition-colors">
                     <option value="">Sem categoria</option>
                     {userSettings?.categories?.map(c => <option key={c} value={c}>{c}</option>)}
                   </select>
                   <select value={fixedPaymentMethod} onChange={(e) => setFixedPaymentMethod(e.target.value)} className="bg-white dark:bg-[#1A1A1D] border border-gray-200 dark:border-white/10 rounded-xl px-2 py-1.5 text-[10px] text-gray-700 dark:text-gray-300 outline-none focus:border-indigo-500 transition-colors">
                     <option value="">Sem método</option>
                     <option value="Crédito">Crédito</option>
                     <option value="Pix">Pix</option>
                     <option value="Débito">Débito</option>
                     <option value="Dinheiro">Dinheiro</option>
                   </select>
                   {(fixedPaymentMethod === 'Crédito' || fixedPaymentMethod === 'Débito') && (
                     <select value={fixedCard} onChange={(e) => setFixedCard(e.target.value)} className="bg-white dark:bg-[#1A1A1D] border border-gray-200 dark:border-white/10 rounded-xl px-2 py-1.5 text-[10px] text-gray-700 dark:text-gray-300 outline-none focus:border-indigo-500 transition-colors">
                       <option value="">Sem cartão</option>
                       {userSettings?.cards?.map(c => <option key={c} value={c}>{c}</option>)}
                     </select>
                   )}
                   <input type="text" placeholder="Conta (ex: Nubank)" value={fixedAccount} onChange={(e) => setFixedAccount(e.target.value)} className="bg-white dark:bg-[#1A1A1D] border border-gray-200 dark:border-white/10 rounded-xl px-2 py-1.5 text-[10px] text-gray-700 dark:text-gray-300 outline-none focus:border-indigo-500 transition-colors placeholder:text-gray-500" />
                 </div>
                 
                 <label className="flex items-center gap-2 mt-1 cursor-pointer w-max">
                   <input type="checkbox" checked={fixedIsRecurring} onChange={e => setFixedIsRecurring(e.target.checked)} className="w-3.5 h-3.5 text-indigo-500 rounded border-gray-300 dark:border-gray-600 focus:ring-indigo-500 bg-white dark:bg-[#1A1A1D]" />
                   <span className="text-[10px] text-gray-500 dark:text-gray-400">Tornar recorrente para os próximos meses</span>
                 </label>
               </form>
               
               {fixedExpenses.length > 0 ? (
                 <div className="space-y-2">
                   {fixedExpenses.map(expense => (
                     <div key={expense.id} className="flex items-center justify-between p-2.5 bg-white dark:bg-[#1A1A1D] border border-gray-100 dark:border-white/5 rounded-xl group hover:border-gray-200 dark:hover:border-white/10 transition-colors">
                       <span className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate pr-2">{expense.description}</span>
                       <div className="flex items-center gap-2 shrink-0">
                         <span className="text-sm font-mono tracking-tight text-gray-600 dark:text-gray-400 mr-2">
                           {formatCurrency(expense.amount)}
                         </span>
                         <button 
                           onClick={() => startEditFixed(expense)}
                           disabled={isSaving}
                           className="text-gray-400 hover:text-indigo-500 transition-colors px-1"
                           title="Editar"
                         >
                           <PencilLine className="w-4 h-4" />
                         </button>
                         <button 
                           onClick={() => handleRemoveFixed(expense.id)}
                           disabled={isSaving}
                           className="text-gray-400 hover:text-red-500 transition-colors px-1"
                           title="Remover"
                         >
                           <Trash2 className="w-4 h-4" />
                         </button>
                       </div>
                     </div>
                   ))}
                   <div className="flex justify-between items-center pt-2 px-1">
                     <span className="text-xs font-medium text-gray-500">Subtotal Fixos:</span>
                     <span className="text-sm font-bold font-mono tracking-tight text-indigo-600 dark:text-indigo-400">
                       {formatCurrency(totalFixed)}
                     </span>
                   </div>
                 </div>
               ) : (
                 <div className="text-center py-4 text-gray-500 text-sm">Nenhum gasto fixo anotado.</div>
               )}
            </div>

            {/* Gastos Variáveis */}
            <div className="flex flex-col gap-3">
               <div>
                 <h4 className="font-bold text-sm text-gray-900 dark:text-gray-100 uppercase tracking-widest mb-1">Gastos Variáveis</h4>
                 <p className="text-[10px] text-gray-500">Gastos esporádicos ou avulsos programados</p>
               </div>
               
               <form onSubmit={handleAddPlanned} className="flex flex-col gap-2 mb-2">
                 <div className="flex gap-2 items-start">
                   <input
                     type="text"
                     placeholder="Ex: Presente Aniversário"
                     value={plannedDesc}
                     onChange={(e) => setPlannedDesc(e.target.value)}
                     className="flex-1 bg-white dark:bg-[#1A1A1D] border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2 text-sm outline-none focus:border-indigo-500 dark:focus:border-indigo-500 transition-colors"
                     required
                   />
                   <div className="relative w-[110px] sm:w-[130px]">
                     <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm font-medium">R$</span>
                     <input
                       type="text"
                       placeholder="0,00"
                       value={plannedAmt}
                       onChange={(e) => setPlannedAmt(formatAmountInput(e.target.value))}
                       className="w-full bg-white dark:bg-[#1A1A1D] border border-gray-200 dark:border-white/10 rounded-xl pl-8 pr-2 py-2 text-sm font-mono outline-none focus:border-indigo-500 dark:focus:border-indigo-500 transition-colors"
                       required
                     />
                   </div>
                   {editingPlannedId && (
                     <button
                       type="button"
                       onClick={cancelEditPlanned}
                       className="bg-gray-100 dark:bg-white/10 hover:bg-gray-200 dark:hover:bg-white/20 text-gray-600 dark:text-gray-400 p-2 rounded-xl transition-colors shrink-0"
                       title="Cancelar Edição"
                     >
                       <X className="w-5 h-5" />
                     </button>
                   )}
                   <button
                     type="submit"
                     disabled={isSaving || !plannedDesc || !plannedAmt}
                     className="bg-indigo-500 hover:bg-indigo-600 text-white p-2 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                     title={editingPlannedId ? "Salvar Edição" : "Adicionar Gasto Previsto"}
                   >
                     {editingPlannedId ? <PencilLine className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
                   </button>
                 </div>
                 
                 <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                   <select value={plannedCategory} onChange={(e) => setPlannedCategory(e.target.value)} className="bg-white dark:bg-[#1A1A1D] border border-gray-200 dark:border-white/10 rounded-xl px-2 py-1.5 text-[10px] text-gray-700 dark:text-gray-300 outline-none focus:border-indigo-500 transition-colors">
                     <option value="">Sem categoria</option>
                     {userSettings?.categories?.map(c => <option key={c} value={c}>{c}</option>)}
                   </select>
                   <select value={plannedPaymentMethod} onChange={(e) => setPlannedPaymentMethod(e.target.value)} className="bg-white dark:bg-[#1A1A1D] border border-gray-200 dark:border-white/10 rounded-xl px-2 py-1.5 text-[10px] text-gray-700 dark:text-gray-300 outline-none focus:border-indigo-500 transition-colors">
                     <option value="">Sem método</option>
                     <option value="Crédito">Crédito</option>
                     <option value="Pix">Pix</option>
                     <option value="Débito">Débito</option>
                     <option value="Dinheiro">Dinheiro</option>
                   </select>
                   {(plannedPaymentMethod === 'Crédito' || plannedPaymentMethod === 'Débito') && (
                     <select value={plannedCard} onChange={(e) => setPlannedCard(e.target.value)} className="bg-white dark:bg-[#1A1A1D] border border-gray-200 dark:border-white/10 rounded-xl px-2 py-1.5 text-[10px] text-gray-700 dark:text-gray-300 outline-none focus:border-indigo-500 transition-colors">
                       <option value="">Sem cartão</option>
                       {userSettings?.cards?.map(c => <option key={c} value={c}>{c}</option>)}
                     </select>
                   )}
                   <input type="text" placeholder="Conta (ex: Nubank)" value={plannedAccount} onChange={(e) => setPlannedAccount(e.target.value)} className="bg-white dark:bg-[#1A1A1D] border border-gray-200 dark:border-white/10 rounded-xl px-2 py-1.5 text-[10px] text-gray-700 dark:text-gray-300 outline-none focus:border-indigo-500 transition-colors placeholder:text-gray-500" />
                 </div>
               </form>

               {plannedExpenses.length > 0 ? (
                 <div className="space-y-2">
                   {plannedExpenses.map(expense => (
                     <div key={expense.id} className="flex items-center justify-between p-2.5 bg-white dark:bg-[#1A1A1D] border border-gray-100 dark:border-white/5 rounded-xl group hover:border-gray-200 dark:hover:border-white/10 transition-colors">
                       <span className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate pr-2">{expense.description}</span>
                       <div className="flex items-center gap-2 shrink-0">
                         <span className="text-sm font-mono tracking-tight text-gray-600 dark:text-gray-400 mr-2">
                           {formatCurrency(expense.amount)}
                         </span>
                         <button 
                           onClick={() => handlePostPlanned(expense)}
                           disabled={isSaving || (budget?.processedPlannedExpenses || []).includes(expense.id)}
                           className={`px-1 transition-colors ${(budget?.processedPlannedExpenses || []).includes(expense.id) ? 'text-green-500 opacity-50 cursor-not-allowed' : 'text-gray-400 hover:text-green-500'}`}
                           title={(budget?.processedPlannedExpenses || []).includes(expense.id) ? "Já lançado no mês" : "Lançar no mês"}
                         >
                           <Send className="w-4 h-4" />
                         </button>
                         <button 
                           onClick={() => startEditPlanned(expense)}
                           disabled={isSaving}
                           className="text-gray-400 hover:text-indigo-500 transition-colors px-1"
                           title="Editar"
                         >
                           <PencilLine className="w-4 h-4" />
                         </button>
                         <button 
                           onClick={() => handleRemovePlanned(expense.id)}
                           disabled={isSaving}
                           className="text-gray-400 hover:text-red-500 transition-colors px-1"
                           title="Remover"
                         >
                           <Trash2 className="w-4 h-4" />
                         </button>
                       </div>
                     </div>
                   ))}
                   <div className="flex justify-between items-center pt-2 px-1">
                     <span className="text-xs font-medium text-gray-500">Subtotal Variáveis:</span>
                     <span className="text-sm font-bold font-mono tracking-tight text-indigo-600 dark:text-indigo-400">
                       {formatCurrency(totalPlanned)}
                     </span>
                   </div>
                 </div>
               ) : (
                 <div className="text-center py-4 text-gray-500 text-sm">Nenhum gasto variável anotado.</div>
               )}
            </div>

          </div>
          
          {(plannedExpenses.length > 0 || fixedExpenses.length > 0) && (
             <div className="mt-6 pt-4 border-t border-gray-200/60 dark:border-white/10 flex justify-between items-center px-2">
                 <span className="text-sm font-bold text-gray-700 dark:text-gray-300 uppercase tracking-widest">Total Projetado</span>
                 <span className="text-lg font-black font-mono text-indigo-600 dark:text-indigo-400">{formatCurrency(totalBoth)}</span>
             </div>
          )}

        </div>
      )}
    </div>
  );
}
