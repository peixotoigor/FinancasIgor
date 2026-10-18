import React, { useState } from 'react';
import { UserSettings } from '../types';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, addDoc } from 'firebase/firestore';
import { Check, X, Plus, TrendingDown, TrendingUp, CreditCard, Calendar, Zap, Tag, Wallet, DollarSign } from 'lucide-react';
import { Button, Card, Chip } from '@heroui/react';

interface QuickAddTransactionProps {
  userId?: string;
  userSettings?: UserSettings;
}

export function QuickAddTransaction({ userId, userSettings }: QuickAddTransactionProps) {
  const [addType, setAddType] = useState<'expense' | 'income'>('expense');
  const [addDesc, setAddDesc] = useState('');
  const [addAmount, setAddAmount] = useState('');
  const [addDate, setAddDate] = useState(new Date().toISOString().split('T')[0]);
  const [addCat, setAddCat] = useState('');
  const [addMethod, setAddMethod] = useState('');
  const [addCard, setAddCard] = useState('');
  const [addInstallments, setAddInstallments] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [justSaved, setJustSaved] = useState(false);

  const resetAddForm = () => {
    setAddDesc('');
    setAddAmount('');
    setAddInstallments(1);
    setAddDate(new Date().toISOString().split('T')[0]);
  };

  const isAddDisabled = 
    !userId ||
    isSubmitting ||
    !addDesc.trim() || 
    !addAmount || 
    !addCat || 
    (addType === 'expense' && !addMethod) || 
    (addType === 'expense' && (addMethod === 'Crédito' || addMethod === 'Débito') && !addCard);

  const handleQuickAdd = async () => {
    if (isAddDisabled) return;
    const parsedAmount = parseFloat(addAmount.replace(',', '.'));
    if (isNaN(parsedAmount) || parsedAmount <= 0) return;

    setIsSubmitting(true);
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

      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 2200);
      resetAddForm();
    } catch (e) {
      handleFirestoreError(e, OperationType.CREATE, 'transactions');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isAddDisabled) {
      e.preventDefault();
      handleQuickAdd();
    }
  };

  const activeCategories = (addType === 'expense' ? userSettings?.categories : userSettings?.incomeCategories) || [];

  return (
    <Card className="glass-card bg-white dark:bg-[#121214] border border-gray-200/80 dark:border-white/10 rounded-2xl p-4 sm:p-5 shadow-sm mb-6 transition-all relative overflow-hidden group">
      {/* Top subtle ambient highlight */}
      <div className={`absolute top-0 left-0 right-0 h-[2px] transition-colors duration-300 ${
        addType === 'expense' 
          ? 'bg-gradient-to-r from-rose-500/0 via-rose-500/50 to-rose-500/0' 
          : 'bg-gradient-to-r from-emerald-500/0 via-emerald-500/50 to-emerald-500/0'
      }`} />

      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-3.5 mb-4 border-b border-gray-100 dark:border-white/5 gap-3">
        <div className="flex items-center gap-2.5">
          <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
            addType === 'expense' 
              ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20' 
              : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
          }`}>
            <Zap className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-900 dark:text-white">Lançamento Rápido</h3>
              {justSaved && (
                <Chip size="sm" variant="soft" color="success" className="text-[10px] h-4.5 px-1.5 font-bold animate-pulse">
                  Gravado!
                </Chip>
              )}
            </div>
            <p className="text-[11px] text-gray-500 dark:text-gray-400">Registre uma nova entrada ou saída no ciclo</p>
          </div>
        </div>

        {/* Segmented Switch: Despesa vs Receita */}
        <div className="flex items-center p-1 bg-gray-100/90 dark:bg-white/5 rounded-xl border border-gray-200/60 dark:border-white/5 shadow-inner">
          <button 
            type="button"
            onClick={() => { setAddType('expense'); setAddCat(''); }}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              addType === 'expense' 
                ? 'bg-white dark:bg-[#1A1A1D] text-rose-600 dark:text-rose-400 shadow-sm border border-rose-500/20 font-bold' 
                : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            <TrendingDown className="w-3.5 h-3.5" />
            <span>Despesa</span>
          </button>
          <button 
            type="button"
            onClick={() => { setAddType('income'); setAddCat(''); }}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              addType === 'income' 
                ? 'bg-white dark:bg-[#1A1A1D] text-emerald-600 dark:text-emerald-400 shadow-sm border border-emerald-500/20 font-bold' 
                : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Receita</span>
          </button>
        </div>
      </div>

      {/* Inputs Form */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3" onKeyDown={handleKeyDown}>
        {/* Data */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider flex items-center gap-1">
            <Calendar className="w-3 h-3 text-gray-400" />
            <span>Data</span>
          </label>
          <input 
            type="date" 
            value={addDate} 
            onChange={e => setAddDate(e.target.value)} 
            className="w-full bg-gray-50/70 dark:bg-[#0A0A0B]/80 border border-gray-200/90 dark:border-white/10 rounded-xl px-2.5 py-2 text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-mono" 
          />
        </div>

        {/* Descrição */}
        <div className="flex flex-col gap-1.5 lg:col-span-2">
          <label className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider flex items-center gap-1">
            <Tag className="w-3 h-3 text-gray-400" />
            <span>Descrição</span>
          </label>
          <input 
            type="text" 
            placeholder="Ex: Supermercado, Almoço, Salário..." 
            value={addDesc} 
            onChange={e => setAddDesc(e.target.value)} 
            className="w-full bg-gray-50/70 dark:bg-[#0A0A0B]/80 border border-gray-200/90 dark:border-white/10 rounded-xl px-3 py-2 text-xs text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all" 
          />
        </div>

        {/* Categoria */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider flex items-center gap-1">
            <Tag className="w-3 h-3 text-gray-400" />
            <span>Categoria</span>
          </label>
          <select 
            value={addCat} 
            onChange={e => setAddCat(e.target.value)} 
            className="w-full bg-gray-50/70 dark:bg-[#0A0A0B]/80 border border-gray-200/90 dark:border-white/10 rounded-xl px-2.5 py-2 text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all cursor-pointer"
          >
            <option value="" disabled>Selecione...</option>
            {activeCategories.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        {/* Forma de Pagamento */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider flex items-center gap-1">
            <Wallet className="w-3 h-3 text-gray-400" />
            <span>Forma</span>
          </label>
          {addType === 'expense' ? (
             <select 
               value={addMethod} 
               onChange={e => setAddMethod(e.target.value)} 
               className="w-full bg-gray-50/70 dark:bg-[#0A0A0B]/80 border border-gray-200/90 dark:border-white/10 rounded-xl px-2.5 py-2 text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all cursor-pointer"
             >
               <option value="" disabled>Escolha...</option>
               <option value="Débito">Débito</option>
               <option value="Crédito">Crédito</option>
               <option value="Pix">Pix</option>
               <option value="Dinheiro">Dinheiro</option>
             </select>
          ) : (
             <div className="h-[36px] flex items-center px-3 bg-gray-50/40 dark:bg-[#0A0A0B]/40 border border-dashed border-gray-200/80 dark:border-white/5 rounded-xl text-xs text-gray-400 italic">
               Depósito / Conta
             </div>
          )}
        </div>

        {/* Valor */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider flex items-center gap-1">
            <DollarSign className="w-3 h-3 text-gray-400" />
            <span>Valor (R$)</span>
          </label>
          <div className="relative">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[11px] font-bold text-gray-400 pointer-events-none">R$</span>
            <input 
              type="number" 
              step="0.01" 
              placeholder="0,00" 
              value={addAmount} 
              onChange={e => setAddAmount(e.target.value)} 
              className="w-full bg-gray-50/70 dark:bg-[#0A0A0B]/80 border border-gray-200/90 dark:border-white/10 rounded-xl pl-8 pr-2.5 py-2 text-xs font-bold font-mono text-right text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all tabular-nums" 
            />
          </div>
        </div>
      </div>

      {/* Quick category pills (top frequent) */}
      {activeCategories.length > 0 && !addCat && (
        <div className="mt-2.5 flex items-center gap-1.5 flex-wrap">
          <span className="text-[10px] text-gray-400">Sugestões:</span>
          {activeCategories.slice(0, 5).map(cat => (
            <button
              key={cat}
              type="button"
              onClick={() => setAddCat(cat)}
              className="text-[10px] px-2 py-0.5 rounded-md bg-gray-100 hover:bg-gray-200/80 dark:bg-white/5 dark:hover:bg-white/10 text-gray-600 dark:text-gray-300 transition-colors"
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      {/* Cartão & Parcelas (if Crédito/Débito) */}
      {addType === 'expense' && (addMethod === 'Crédito' || addMethod === 'Débito') && (
        <div className="mt-3.5 pt-3 border-t border-gray-100 dark:border-white/5 flex flex-wrap items-center gap-3 bg-gray-50/60 dark:bg-white/[0.02] p-2.5 rounded-xl">
          <div className="flex items-center gap-1.5 text-xs text-gray-700 dark:text-gray-300 font-medium">
             <CreditCard className="w-3.5 h-3.5 text-emerald-500" />
             <span className="text-[11px] font-bold uppercase tracking-wider">Cartão:</span>
          </div>
          <select 
            value={addCard} 
            onChange={e => setAddCard(e.target.value)} 
            className="bg-white dark:bg-[#0A0A0B] border border-gray-200 dark:border-white/10 rounded-xl px-3 py-1.5 text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 cursor-pointer"
          >
            <option value="" disabled>Escolha o cartão...</option>
            {userSettings?.cards?.map(c => <option key={c} value={c}>{c}</option>)}
          </select>

          {addMethod === 'Crédito' && (
            <div className="flex items-center gap-2 text-xs text-gray-500 ml-auto">
              <span className="text-[11px] font-bold uppercase tracking-wider">Parcelas:</span>
              <input 
                type="number" 
                min="1" 
                max="48" 
                value={addInstallments} 
                onChange={e => setAddInstallments(Number(e.target.value) || 1)} 
                className="w-16 bg-white dark:bg-[#0A0A0B] border border-gray-200 dark:border-white/10 rounded-xl px-2 py-1.5 text-xs text-center font-mono font-bold text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500" 
              />
              {addAmount && addInstallments > 1 && (
                <span className="text-[11px] font-mono text-gray-400">
                  ≈ {(parseFloat(addAmount.replace(',', '.')) / addInstallments).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}/mês
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Action Buttons Footer */}
      <div className="mt-3.5 pt-3 border-t border-gray-100 dark:border-white/5 flex items-center justify-between">
        <div className="text-[11px] text-gray-400">
          {isAddDisabled ? (
            <span>Preencha os dados e pressione Enter ou clique em Salvar</span>
          ) : (
            <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
              <Check className="w-3 h-3" /> Pronto para salvar
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {(addDesc || addAmount !== '') && (
            <Button 
              onPress={resetAddForm} 
              variant="ghost"
              size="sm"
              className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-800 dark:hover:text-white transition-colors flex items-center gap-1 rounded-xl"
            >
              <X className="w-3.5 h-3.5" />
              <span>Limpar</span>
            </Button>
          )}
          <Button 
            onPress={handleQuickAdd} 
            isDisabled={isAddDisabled} 
            variant="primary"
            size="sm"
            className={`px-4 py-1.5 rounded-xl text-xs font-semibold shadow-xs transition-all flex items-center gap-1.5 ${
              addType === 'expense'
                ? 'bg-rose-500 hover:bg-rose-600 text-white'
                : 'bg-emerald-500 hover:bg-emerald-600 text-white'
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{isSubmitting ? 'Salvando...' : 'Salvar Registro'}</span>
          </Button>
        </div>
      </div>
    </Card>
  );
}
