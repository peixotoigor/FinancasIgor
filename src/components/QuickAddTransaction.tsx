import React, { useState } from 'react';
import { Transaction, UserSettings } from '../types';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, addDoc } from 'firebase/firestore';
import { Check, X, Plus } from 'lucide-react';

interface QuickAddTransactionProps {
  userId?: string;
  userSettings?: UserSettings;
}

export function QuickAddTransaction({ userId, userSettings }: QuickAddTransactionProps) {
  const [addType, setAddType] = useState<('expense' | 'income')>('expense');
  const [addDesc, setAddDesc] = useState('');
  const [addAmount, setAddAmount] = useState('');
  const [addDate, setAddDate] = useState(new Date().toISOString().split('T')[0]);
  const [addCat, setAddCat] = useState('');
  const [addMethod, setAddMethod] = useState('');
  const [addCard, setAddCard] = useState('');
  const [addInstallments, setAddInstallments] = useState(1);

  const resetAddForm = () => {
    setAddDesc('');
    setAddAmount('');
    setAddInstallments(1);
    setAddDate(new Date().toISOString().split('T')[0]);
  };

  const isAddDisabled = 
    !userId ||
    !addDesc.trim() || 
    !addAmount || 
    !addCat || 
    (addType === 'expense' && !addMethod) || 
    (addType === 'expense' && (addMethod === 'Crédito' || addMethod === 'Débito') && !addCard);

  const handleQuickAdd = async () => {
    if (isAddDisabled) return;
    const parsedAmount = parseFloat(addAmount.replace(',', '.'));
    if (isNaN(parsedAmount) || parsedAmount <= 0) return;

    try {
      const baseDate = new Date(addDate + 'T12:00:00');
      
      const actualInstallments = addType === 'expense' && addMethod === 'Crédito' ? addInstallments : 1;
      const groupId = actualInstallments > 1 ? crypto.randomUUID() : undefined;
      const perInstallmentAmount = Number((parsedAmount / actualInstallments).toFixed(2));
      let remainingAmount = parsedAmount;

      for (let i = 1; i <= actualInstallments; i++) {
        let currentAmount = perInstallmentAmount;
        if (i === actualInstallments) {
           currentAmount = remainingAmount;
        } else {
           remainingAmount -= currentAmount;
        }

        const txDate = new Date(baseDate.getTime());
        if (i > 1) {
          const expectedMonth = (baseDate.getMonth() + i - 1) % 12;
          const expectedYear = baseDate.getFullYear() + Math.floor((baseDate.getMonth() + i - 1) / 12);
          txDate.setFullYear(expectedYear);
          txDate.setMonth(expectedMonth);
          if (txDate.getMonth() !== expectedMonth) {
             txDate.setDate(0);
          }
        }

        const newTx: any = {
          userId,
          description: actualInstallments > 1 ? `${addDesc.trim()} (${i}/${actualInstallments})` : addDesc.trim(),
          amount: currentAmount,
          date: txDate.getTime(),
          type: addType,
          category: addCat,
          paymentMethod: addType === 'expense' ? addMethod : undefined,
          card: (addType === 'expense' && (addMethod === 'Crédito' || addMethod === 'Débito')) ? addCard : undefined,
          createdAt: Date.now(),
          ...(actualInstallments > 1 && {
             installments: actualInstallments,
             installmentNumber: i,
             groupId: groupId
          })
        };

        await addDoc(collection(db, 'transactions'), newTx);
      }

      resetAddForm();
    } catch (e) {
      handleFirestoreError(e, OperationType.CREATE, 'transactions');
    }
  };

  return (
    <div className="bg-white dark:bg-[#121214] border border-gray-200 dark:border-white/5 rounded-2xl p-4 sm:p-5 shadow-sm mb-4">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-3 mb-4 border-b border-gray-100 dark:border-white/5 gap-2">
        <div className="flex items-center gap-2">
           <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
           <h3 className="text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">Lançamento Rápido</h3>
        </div>
        
        <div className="flex items-center gap-2">
           <div className="flex p-0.5 bg-gray-100 dark:bg-white/5 rounded-xl">
              <button 
                type="button"
                onClick={() => { setAddType('expense'); setAddCat(''); }}
                className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors ${
                  addType === 'expense' ? 'bg-white dark:bg-[#1A1A1D] text-rose-600 dark:text-rose-400 shadow-sm' : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                Despesa
              </button>
              <button 
                type="button"
                onClick={() => { setAddType('income'); setAddCat(''); }}
                className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors ${
                  addType === 'income' ? 'bg-white dark:bg-[#1A1A1D] text-emerald-600 dark:text-emerald-400 shadow-sm' : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                Receita
              </button>
           </div>
        </div>
      </div>

      {/* Grid Inputs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
        {/* Data */}
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Data</label>
          <input 
            type="date" 
            value={addDate} 
            onChange={e => setAddDate(e.target.value)} 
            className="w-full bg-gray-50 dark:bg-[#0A0A0B] border border-gray-200 dark:border-white/10 rounded-xl px-2.5 py-2 text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-500" 
          />
        </div>

        {/* Descrição */}
        <div className="flex flex-col gap-1 lg:col-span-2">
          <label className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Descrição</label>
          <input 
            type="text" 
            placeholder="Ex: Aluguel, Supermercado..." 
            value={addDesc} 
            onChange={e => setAddDesc(e.target.value)} 
            className="w-full bg-gray-50 dark:bg-[#0A0A0B] border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2 text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-500" 
          />
        </div>

        {/* Categoria */}
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Categoria</label>
          <select 
            value={addCat} 
            onChange={e => setAddCat(e.target.value)} 
            className="w-full bg-gray-50 dark:bg-[#0A0A0B] border border-gray-200 dark:border-white/10 rounded-xl px-2.5 py-2 text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
          >
            <option value="" disabled>Selecione...</option>
            {(addType === 'expense' ? userSettings?.categories : userSettings?.incomeCategories)?.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        {/* Método */}
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Forma</label>
          {addType === 'expense' ? (
             <select 
               value={addMethod} 
               onChange={e => setAddMethod(e.target.value)} 
               className="w-full bg-gray-50 dark:bg-[#0A0A0B] border border-gray-200 dark:border-white/10 rounded-xl px-2.5 py-2 text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
             >
               <option value="" disabled>Forma...</option>
               <option value="Débito">Débito</option>
               <option value="Crédito">Crédito</option>
               <option value="Pix">Pix</option>
               <option value="Dinheiro">Dinheiro</option>
             </select>
          ) : (
             <div className="h-[37px] flex items-center px-3 bg-gray-50 dark:bg-[#0A0A0B] border border-dashed border-gray-200 dark:border-white/10 rounded-xl text-xs text-gray-400">
               N/A
             </div>
          )}
        </div>

        {/* Valor */}
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Valor (R$)</label>
          <input 
            type="number" 
            step="0.01" 
            placeholder="0.00" 
            value={addAmount} 
            onChange={e => setAddAmount(e.target.value)} 
            className="w-full bg-gray-50 dark:bg-[#0A0A0B] border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2 text-xs font-semibold text-right text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-500" 
          />
        </div>
      </div>

      {/* Cartão & Parcelas (if Crédito) */}
      {addType === 'expense' && (addMethod === 'Crédito' || addMethod === 'Débito') && (
        <div className="mt-3 pt-3 border-t border-gray-100 dark:border-white/5 flex flex-wrap items-center gap-3">
          <span className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Cartão:</span>
          <select 
            value={addCard} 
            onChange={e => setAddCard(e.target.value)} 
            className="bg-gray-50 dark:bg-[#0A0A0B] border border-gray-200 dark:border-white/10 rounded-xl px-3 py-1.5 text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
          >
            <option value="" disabled>Escolha o cartão...</option>
            {userSettings?.cards?.map(c => <option key={c} value={c}>{c}</option>)}
          </select>

          {addMethod === 'Crédito' && (
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <span>Parcelas:</span>
              <input 
                type="number" 
                min="1" 
                max="48" 
                value={addInstallments} 
                onChange={e => setAddInstallments(Number(e.target.value) || 1)} 
                className="w-16 bg-gray-50 dark:bg-[#0A0A0B] border border-gray-200 dark:border-white/10 rounded-xl px-2 py-1.5 text-xs text-center text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-500" 
              />
            </div>
          )}
        </div>
      )}

      {/* Action Buttons Footer */}
      <div className="mt-4 pt-3 border-t border-gray-100 dark:border-white/5 flex justify-end gap-2">
        {(addDesc || addAmount !== '') && (
          <button 
            type="button" 
            onClick={resetAddForm} 
            className="px-3.5 py-1.5 text-xs text-gray-500 hover:text-gray-800 dark:hover:text-white transition-colors flex items-center gap-1"
          >
            <X className="w-3.5 h-3.5" />
            <span>Limpar</span>
          </button>
        )}
        <button 
          type="button" 
          onClick={handleQuickAdd} 
          disabled={isAddDisabled} 
          className="px-5 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-semibold shadow-sm transition-colors disabled:opacity-40 flex items-center gap-1.5"
        >
          <Check className="w-3.5 h-3.5" />
          <span>Salvar Registro</span>
        </button>
      </div>
    </div>
  );
}
