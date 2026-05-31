import React, { useState, useEffect } from 'react';
import { ChevronDown, ChevronUp, Plus, Trash2, PiggyBank, Calculator, HelpCircle } from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { doc, updateDoc, setDoc, writeBatch } from 'firebase/firestore';
import type { MonthlyBudget, PlannedExpense } from '../types';

interface MonthlyPlanningProps {
  userId: string;
  year: number;
  month: number;
  budget: MonthlyBudget | null;
}

export function MonthlyPlanning({ userId, year, month, budget }: MonthlyPlanningProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [plannedExpenses, setPlannedExpenses] = useState<PlannedExpense[]>([]);
  const [fixedExpenses, setFixedExpenses] = useState<PlannedExpense[]>([]);
  
  const [plannedDesc, setPlannedDesc] = useState('');
  const [plannedAmt, setPlannedAmt] = useState('');
  
  const [fixedDesc, setFixedDesc] = useState('');
  const [fixedAmt, setFixedAmt] = useState('');
  
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setPlannedExpenses(budget?.plannedExpenses || []);
    setFixedExpenses(budget?.fixedExpenses || []);
  }, [budget]);

  const saveExpenses = async (newPlanned: PlannedExpense[], newFixed: PlannedExpense[]) => {
    setIsSaving(true);
    try {
      const batch = writeBatch(db);
      
      for (let m = month; m <= 12; m++) {
        const docId = `${userId}_${year}_${m}`;
        const docRef = doc(db, 'monthly_budgets', docId);

        if (m === month) {
          batch.set(docRef, {
            userId, year, month: m,
            plannedExpenses: newPlanned,
            fixedExpenses: newFixed,
            updatedAt: Date.now()
          }, { merge: true });
        } else {
          batch.set(docRef, {
            userId, year, month: m,
            fixedExpenses: newFixed,
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

  const handleAddPlanned = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!plannedDesc || !plannedAmt) return;
    
    const val = parseFloat(plannedAmt.replace(/\./g, '').replace(',', '.'));
    if (isNaN(val) || val <= 0) return;

    const newExpense: PlannedExpense = {
      id: crypto.randomUUID(),
      description: plannedDesc,
      amount: val
    };

    const updatedExpenses = [...plannedExpenses, newExpense];
    setPlannedExpenses(updatedExpenses);
    setPlannedDesc('');
    setPlannedAmt('');
    await saveExpenses(updatedExpenses, fixedExpenses);
  };
  
  const handleAddFixed = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fixedDesc || !fixedAmt) return;
    
    const val = parseFloat(fixedAmt.replace(/\./g, '').replace(',', '.'));
    if (isNaN(val) || val <= 0) return;

    const newExpense: PlannedExpense = {
      id: crypto.randomUUID(),
      description: fixedDesc,
      amount: val
    };

    const updatedExpenses = [...fixedExpenses, newExpense];
    setFixedExpenses(updatedExpenses);
    setFixedDesc('');
    setFixedAmt('');
    await saveExpenses(plannedExpenses, updatedExpenses);
  };

  const handleRemovePlanned = async (id: string) => {
    const updatedExpenses = plannedExpenses.filter(e => e.id !== id);
    setPlannedExpenses(updatedExpenses);
    await saveExpenses(updatedExpenses, fixedExpenses);
  };
  
  const handleRemoveFixed = async (id: string) => {
    const updatedExpenses = fixedExpenses.filter(e => e.id !== id);
    setFixedExpenses(updatedExpenses);
    await saveExpenses(plannedExpenses, updatedExpenses);
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
               
               <form onSubmit={handleAddFixed} className="flex gap-2 mb-2">
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
                 <button
                   type="submit"
                   disabled={isSaving || !fixedDesc || !fixedAmt}
                   className="bg-indigo-500 hover:bg-indigo-600 text-white p-2 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                   title="Adicionar Gasto Fixo"
                 >
                   <Plus className="w-5 h-5" />
                 </button>
               </form>
               
               {fixedExpenses.length > 0 ? (
                 <div className="space-y-2">
                   {fixedExpenses.map(expense => (
                     <div key={expense.id} className="flex items-center justify-between p-2.5 bg-white dark:bg-[#1A1A1D] border border-gray-100 dark:border-white/5 rounded-xl group hover:border-gray-200 dark:hover:border-white/10 transition-colors">
                       <span className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate pr-2">{expense.description}</span>
                       <div className="flex items-center gap-3 shrink-0">
                         <span className="text-sm font-mono tracking-tight text-gray-600 dark:text-gray-400">
                           {formatCurrency(expense.amount)}
                         </span>
                         <button 
                           onClick={() => handleRemoveFixed(expense.id)}
                           disabled={isSaving}
                           className="text-gray-400 hover:text-red-500 transition-colors px-1"
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
               
               <form onSubmit={handleAddPlanned} className="flex gap-2 mb-2">
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
                 <button
                   type="submit"
                   disabled={isSaving || !plannedDesc || !plannedAmt}
                   className="bg-indigo-500 hover:bg-indigo-600 text-white p-2 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                   title="Adicionar Gasto Previsto"
                 >
                   <Plus className="w-5 h-5" />
                 </button>
               </form>

               {plannedExpenses.length > 0 ? (
                 <div className="space-y-2">
                   {plannedExpenses.map(expense => (
                     <div key={expense.id} className="flex items-center justify-between p-2.5 bg-white dark:bg-[#1A1A1D] border border-gray-100 dark:border-white/5 rounded-xl group hover:border-gray-200 dark:hover:border-white/10 transition-colors">
                       <span className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate pr-2">{expense.description}</span>
                       <div className="flex items-center gap-3 shrink-0">
                         <span className="text-sm font-mono tracking-tight text-gray-600 dark:text-gray-400">
                           {formatCurrency(expense.amount)}
                         </span>
                         <button 
                           onClick={() => handleRemovePlanned(expense.id)}
                           disabled={isSaving}
                           className="text-gray-400 hover:text-red-500 transition-colors px-1"
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
