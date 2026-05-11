import React, { useState, useEffect } from 'react';
import { ChevronDown, ChevronUp, Plus, Trash2, PiggyBank, Calculator, HelpCircle } from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { doc, updateDoc, setDoc } from 'firebase/firestore';
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
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (budget?.plannedExpenses) {
      setPlannedExpenses(budget.plannedExpenses);
    } else {
      setPlannedExpenses([]);
    }
  }, [budget]);

  const savePlannedExpenses = async (newExpenses: PlannedExpense[]) => {
    setIsSaving(true);
    try {
      if (budget?.id) {
        await updateDoc(doc(db, 'monthly_budgets', budget.id), {
          plannedExpenses: newExpenses,
          updatedAt: Date.now()
        });
      } else {
        const docId = `${userId}_${year}_${month}`;
        const newPayload = { 
          userId, 
          year, 
          month, 
          salary: 0,
          reserve: 0,
          reserveOfReserve: 0,
          wallet: 0,
          walletWithdrawals: 0,
          emergencyWithdrawals: 0,
          plannedExpenses: newExpenses,
          updatedAt: Date.now() 
        };
        await setDoc(doc(db, 'monthly_budgets', docId), newPayload);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'monthly_budgets');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description || !amount) return;
    
    const val = parseFloat(amount.replace(/\./g, '').replace(',', '.'));
    if (isNaN(val) || val <= 0) return;

    const newExpense: PlannedExpense = {
      id: crypto.randomUUID(),
      description,
      amount: val
    };

    const updatedExpenses = [...plannedExpenses, newExpense];
    setPlannedExpenses(updatedExpenses);
    setDescription('');
    setAmount('');
    await savePlannedExpenses(updatedExpenses);
  };

  const handleRemove = async (id: string) => {
    const updatedExpenses = plannedExpenses.filter(e => e.id !== id);
    setPlannedExpenses(updatedExpenses);
    await savePlannedExpenses(updatedExpenses);
  };

  const totalPlanned = plannedExpenses.reduce((acc, curr) => acc + curr.amount, 0);

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
            <p className="text-xs text-gray-500 font-medium">Previna seus gastos ({plannedExpenses.length} previstos)</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {plannedExpenses.length > 0 && (
            <span className="text-sm font-mono tracking-tight font-medium text-gray-900 dark:text-white hidden sm:block">
              {formatCurrency(totalPlanned)}
            </span>
          )}
          {isExpanded ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
        </div>
      </button>

      {isExpanded && (
        <div className="p-4 lg:p-5 border-t border-gray-100 dark:border-white/5 bg-gray-50/50 dark:bg-[#0B0B0C]">
          <div className="flex items-center gap-2 mb-4 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 p-3 rounded-xl">
            <HelpCircle className="w-4 h-4 shrink-0" />
            <p className="text-xs font-medium leading-relaxed">
              Adicione aqui gastos que vão acontecer no mês atual, mas que ainda não caíram na conta. Isso te ajuda a ver o quanto de saldo real você terá.
            </p>
          </div>

          <form onSubmit={handleAdd} className="flex gap-2 mb-5">
            <input
              type="text"
              placeholder="Ex: Conta de Luz"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="flex-1 bg-white dark:bg-[#1A1A1D] border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-indigo-500 dark:focus:border-indigo-500 transition-colors"
              required
            />
            <div className="relative w-[120px] sm:w-[150px]">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm font-medium">R$</span>
              <input
                type="text"
                placeholder="0,00"
                value={amount}
                onChange={(e) => setAmount(formatAmountInput(e.target.value))}
                className="w-full bg-white dark:bg-[#1A1A1D] border border-gray-200 dark:border-white/10 rounded-xl pl-9 pr-3 py-2.5 text-sm font-mono outline-none focus:border-indigo-500 dark:focus:border-indigo-500 transition-colors"
                required
              />
            </div>
            <button
              type="submit"
              disabled={isSaving || !description || !amount}
              className="bg-indigo-500 hover:bg-indigo-600 text-white p-2.5 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
              title="Adicionar Gasto Previsto"
            >
              <Plus className="w-5 h-5" />
            </button>
          </form>

          {plannedExpenses.length > 0 ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between px-2 pb-2 border-b border-gray-200 dark:border-white/10 text-[10px] font-bold uppercase tracking-widest text-gray-500">
                <span>Descrição</span>
                <span>Valor previsto</span>
              </div>
              {plannedExpenses.map(expense => (
                <div key={expense.id} className="flex items-center justify-between p-3 bg-white dark:bg-[#1A1A1D] border border-gray-100 dark:border-white/5 rounded-xl group hover:border-gray-200 dark:hover:border-white/10 transition-colors">
                  <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{expense.description}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-mono tracking-tight text-gray-600 dark:text-gray-400">
                      {formatCurrency(expense.amount)}
                    </span>
                    <button 
                      onClick={() => handleRemove(expense.id)}
                      disabled={isSaving}
                      className="text-gray-400 hover:text-red-500 transition-colors p-1"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
              <div className="flex justify-between items-center pt-3 px-2">
                <span className="text-xs font-medium text-gray-500">Total Previsto:</span>
                <span className="text-base font-bold font-mono tracking-tight text-indigo-600 dark:text-indigo-400">
                  {formatCurrency(totalPlanned)}
                </span>
              </div>
            </div>
          ) : (
            <div className="text-center py-6 text-gray-500">
              <p className="text-sm">Nenhum gasto planejado anotado.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
