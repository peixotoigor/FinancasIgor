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
          txDate.setMonth(baseDate.getMonth() + (i - 1));
          if (txDate.getMonth() !== expectedMonth) {
             txDate.setDate(0);
          }
        }

        const padZeros = (num: number) => num.toString().padStart(2, '0');
        const payload: Transaction = {
            userId,
            description: actualInstallments > 1 ? `${addDesc} (${padZeros(i)}/${padZeros(actualInstallments)})` : addDesc,
            amount: currentAmount,
            date: txDate.getTime(),
            type: addType,
            category: addCat,
            account: addType === 'expense' ? 'Conta' : '',
            paymentMethod: addType === 'expense' ? (addMethod || 'Débito') : '',
            card: addType === 'expense' && (addMethod === 'Crédito' || addMethod === 'Débito') ? addCard : undefined,
            installments: actualInstallments > 1 ? actualInstallments : undefined,
            installmentNumber: actualInstallments > 1 ? i : undefined,
            groupId,
            status: 'paid',
            createdAt: Date.now()
        };
        await addDoc(collection(db, 'transactions'), payload);
      }
      resetAddForm();
    } catch (e) {
      handleFirestoreError(e, OperationType.CREATE, 'transactions');
    }
  };

  return (
    <>
      <div className="hidden @2xl:flex flex-col mb-6 bg-white dark:bg-[#121214] border border-gray-100 dark:border-white/5 rounded-2xl p-5 shadow-sm relative overflow-hidden group/quickadd transition-shadow hover:shadow-md">
        <div className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-emerald-400 to-emerald-600 rounded-l-2xl opacity-50 group-hover/quickadd:opacity-100 transition-opacity pointer-events-none"></div>
        <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/[0.02] to-transparent pointer-events-none"></div>
        
        <div className="flex items-center justify-between mb-4 relative z-10 w-full pl-2">
          <div className="flex items-center gap-2">
             <div className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold flex items-center justify-center border border-emerald-100 dark:border-emerald-500/20">
               <Plus className="w-4 h-4" strokeWidth={2.5} />
             </div>
             <h3 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-wider">Adicionar Transação</h3>
          </div>
          <div className="flex items-center gap-2 pr-1">
             <span className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">Tipo:</span>
             <button onClick={() => { setAddType(addType === 'expense' ? 'income' : 'expense'); setAddCat(''); }} className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider flex items-center justify-center transition-all shadow-sm ${addType === 'expense' ? 'text-white bg-red-500 hover:bg-red-600 shadow-[0_2px_8px_rgba(239,68,68,0.4)]' : 'text-emerald-950 bg-emerald-400 hover:bg-emerald-500 shadow-[0_2px_8px_rgba(16,185,129,0.4)]'}`}>
               {addType === 'expense' ? 'Despesa' : 'Receita'}
             </button>
          </div>
        </div>

        <div className="flex flex-wrap items-end justify-between gap-y-4 gap-x-3 w-full relative z-10 pl-2 pr-1">
           <div className="flex flex-col gap-1.5 w-full @[500px]:w-[110px] shrink-0">
             <label className="text-[10px] text-gray-500 font-bold uppercase tracking-wider pl-1">Data</label>
             <input type="date" value={addDate} onChange={e => setAddDate(e.target.value)} className="w-full bg-gray-50/80 dark:bg-white/[0.02] border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2 text-xs focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/50 focus:outline-none dark:[&::-webkit-calendar-picker-indicator]:invert shadow-sm transition-all hover:bg-white dark:hover:bg-[#18181b] focus:bg-white dark:focus:bg-[#18181b]" />
           </div>
           
           <div className="flex flex-col gap-1.5 flex-[1_1_180px]">
             <label className="text-[10px] text-gray-500 font-bold uppercase tracking-wider pl-1">Descrição</label>
             <input type="text" placeholder="Ex: Mercado, Conta de Luz..." value={addDesc} onChange={e => setAddDesc(e.target.value)} className="w-full bg-gray-50/80 dark:bg-white/[0.02] border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2 text-xs focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/50 focus:outline-none placeholder:text-gray-400 shadow-sm transition-all hover:bg-white dark:hover:bg-[#18181b] focus:bg-white dark:focus:bg-[#18181b]" />
           </div>
           
           <div className="flex flex-col gap-1.5 flex-[1_1_130px]">
             <label className="text-[10px] text-gray-500 font-bold uppercase tracking-wider pl-1">Categoria</label>
             <select value={addCat} onChange={e => setAddCat(e.target.value)} className="w-full bg-gray-50/80 dark:bg-white/[0.02] border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2 text-xs focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/50 focus:outline-none shadow-sm transition-all hover:bg-white dark:hover:bg-[#18181b] focus:bg-white dark:focus:bg-[#18181b] font-medium">
               <option value="" disabled>Selecione...</option>
               {(addType === 'expense' ? userSettings?.categories : userSettings?.incomeCategories)?.map(c => <option key={c} value={c}>{c}</option>)}
             </select>
           </div>
           
           <div className="flex flex-col gap-1.5 flex-[1_1_110px]">
             <label className="text-[10px] text-gray-500 font-bold uppercase tracking-wider pl-1">Método</label>
             {addType === 'expense' ? (
                <select value={addMethod} onChange={e => setAddMethod(e.target.value)} className="w-full bg-gray-50/80 dark:bg-white/[0.02] border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2 text-xs focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/50 focus:outline-none shadow-sm transition-all hover:bg-white dark:hover:bg-[#18181b] focus:bg-white dark:focus:bg-[#18181b] font-medium">
                  <option value="" disabled>Método...</option>
                  <option value="Débito">Débito</option>
                  <option value="Crédito">Crédito</option>
                  <option value="Pix">Pix</option>
                  <option value="Dinheiro">Dinheiro</option>
                </select>
             ) : (
               <div className="h-[34px] flex items-center px-3 border border-dashed border-gray-200 dark:border-white/5 rounded-xl bg-gray-50/30 dark:bg-white/[0.01]">
                  <span className="text-gray-400 text-xs italic opacity-70">N/A</span>
               </div>
             )}
           </div>

           {addType === 'expense' && (addMethod === 'Crédito' || addMethod === 'Débito') && (
             <div className="flex flex-col gap-1.5 flex-[1_1_150px] animate-in fade-in slide-in-from-left-2">
               <label className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold uppercase tracking-wider pl-1">
                 Cartão {addMethod === 'Crédito' && <span className="opacity-70">/ Parc.</span>}
               </label>
               <div className="flex gap-1.5 w-full">
                 <select value={addCard} onChange={e => setAddCard(e.target.value)} className="flex-1 min-w-[80px] bg-emerald-50/80 dark:bg-emerald-900/10 border border-emerald-500/30 rounded-xl px-2 py-2 text-xs focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/50 focus:outline-none shadow-sm transition-all font-medium text-emerald-800 dark:text-emerald-300">
                   <option value="" disabled>Cartão...</option>
                   {userSettings?.cards?.map(c => <option key={c} value={c}>{c}</option>)}
                 </select>
                 {addMethod === 'Crédito' && (
                   <div className="relative shrink-0 w-[60px]">
                     <input type="number" min="1" max="48" value={addInstallments} onChange={e => setAddInstallments(Number(e.target.value) || 1)} className="w-full bg-emerald-50/80 dark:bg-emerald-900/10 border border-emerald-500/30 rounded-xl pl-2 pr-4 py-2 text-xs text-center focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/50 focus:outline-none shadow-sm transition-all font-medium text-emerald-800 dark:text-emerald-300" placeholder="1" title="Parcelas" />
                     <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-emerald-600/50 dark:text-emerald-400/50 pointer-events-none">x</span>
                   </div>
                 )}
               </div>
             </div>
           )}

           <div className="flex items-end flex-[1.5_1_220px] relative min-w-[200px]">
             <div className="flex items-end gap-2 w-full">
               <div className="flex flex-col gap-1.5 flex-1 relative w-full">
                 <label className="text-[10px] text-gray-500 font-bold uppercase tracking-wider pl-1">Valor</label>
                 <div className="relative">
                   <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs font-mono">R$</span>
                   <input type="number" step="0.01" placeholder="0.00" value={addAmount} onChange={e => setAddAmount(e.target.value)} className={`w-full pl-8 pr-3 py-2 text-right bg-white dark:bg-[#18181b] border rounded-xl text-sm font-mono focus:outline-none placeholder:text-gray-300 shadow-sm font-black transition-all ${addAmount ? (addType === 'expense' ? 'border-red-400 text-red-600 focus:ring-1 focus:ring-red-500/50' : 'border-emerald-400 text-emerald-600 focus:ring-1 focus:ring-emerald-500/50') : 'border-gray-200 dark:border-white/10 focus:border-gray-300 dark:focus:border-white/20 text-gray-900 dark:text-white'}`} />
                 </div>
               </div>
               
               <div className="flex items-center gap-1.5 h-[36px] shrink-0 self-end">
                 <button onClick={handleQuickAdd} disabled={isAddDisabled} className="h-full px-3.5 flex items-center justify-center rounded-xl bg-emerald-500 text-emerald-950 disabled:opacity-50 disabled:bg-gray-100 dark:disabled:bg-white/5 disabled:text-gray-400 hover:bg-emerald-400 transition-all shadow-[0_4px_10px_rgba(16,185,129,0.2)] hover:shadow-[0_4px_12px_rgba(16,185,129,0.3)] hover:-translate-y-0.5 active:translate-y-0 disabled:shadow-none disabled:hover:translate-y-0 disabled:border overflow-hidden group/btn font-bold text-xs" title="Salvar">
                   <span className="hidden @[800px]:inline mr-1.5">Salvar</span>
                   <Check className="w-4 h-4 transition-transform group-hover/btn:scale-110" strokeWidth={3} />
                 </button>
                 {addDesc || addAmount !== '' ? (
                   <button onClick={resetAddForm} className="h-full px-2.5 flex items-center justify-center rounded-xl bg-white dark:bg-[#121214] border border-gray-200 dark:border-white/10 text-gray-500 hover:text-red-500 hover:border-red-200 dark:hover:border-red-500/30 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all shadow-sm" title="Limpar">
                     <X className="w-4 h-4" strokeWidth={2.5} />
                   </button>
                 ) : null}
               </div>
             </div>
           </div>
        </div>
      </div>

      <div className="flex lg:hidden flex-col gap-3.5 bg-white dark:bg-[#121214] border border-emerald-100 dark:border-emerald-900/30 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)] rounded-2xl p-4 sm:p-5 mb-4 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>

        <div className="flex items-center justify-between z-10 w-full mb-1">
           <h3 className="font-black text-gray-900 dark:text-white text-[11px] uppercase tracking-wider flex items-center gap-1.5">
             <div className="p-1 rounded-md bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
               <Plus className="w-3.5 h-3.5" strokeWidth={2.5} />
             </div>
             Adicionar Transação
           </h3>
           <div className="flex items-center gap-2">
              <button onClick={() => { setAddType(addType === 'expense' ? 'income' : 'expense'); setAddCat(''); }} className={`px-3 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-wider flex items-center justify-center transition-all shadow-sm ${addType === 'expense' ? 'text-white bg-red-500 hover:bg-red-600 shadow-[0_2px_8px_rgba(239,68,68,0.4)]' : 'text-emerald-950 bg-emerald-400 hover:bg-emerald-500 shadow-[0_2px_8px_rgba(16,185,129,0.4)]'}`}>
                {addType === 'expense' ? 'Despesa' : 'Receita'}
              </button>
              {(addDesc || addAmount || addCat) && (
                <button onClick={resetAddForm} className="text-gray-400 hover:text-red-500 bg-gray-50 hover:bg-red-50 dark:bg-white/5 dark:hover:bg-red-500/10 border border-gray-200 hover:border-red-200 dark:border-white/10 dark:hover:border-red-500/30 p-1.5 rounded-lg transition-all" title="Limpar">
                  <X className="w-4 h-4" strokeWidth={2} />
                </button>
              )}
           </div>
        </div>
        
        <div className="grid grid-cols-2 gap-3 z-10">
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider ml-1">Data</label>
              <input type="date" value={addDate} onChange={e => setAddDate(e.target.value)} className="w-full bg-gray-50 dark:bg-white/[0.02] border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2.5 text-xs font-medium focus:border-emerald-500 focus:bg-white dark:focus:bg-[#18181b] transition-colors focus:outline-none dark:[&::-webkit-calendar-picker-indicator]:invert shadow-sm hover:bg-white dark:hover:bg-[#18181b]" />
            </div>
            <div className="flex flex-col gap-1.5 relative">
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider ml-1">Valor</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-mono text-xs">R$</span>
                <input type="number" step="0.01" placeholder="0.00" value={addAmount} onChange={e => setAddAmount(e.target.value)} className={`w-full bg-white dark:bg-[#18181b] border rounded-xl pl-8 pr-3 py-2.5 text-sm font-mono focus:outline-none font-black shadow-sm transition-all focus:ring-1 ${addAmount ? (addType === 'expense' ? 'text-red-600 border-red-300 focus:border-red-500 focus:ring-red-500/50' : 'text-emerald-600 border-emerald-300 focus:border-emerald-500 focus:ring-emerald-500/50') : 'text-gray-900 dark:text-white border-gray-200 dark:border-white/10 focus:border-gray-300 dark:focus:border-white/20'}`} />
              </div>
            </div>
        </div>
        
        <div className="flex flex-col gap-1.5 z-10 mt-1">
           <label className="sr-only">Descrição</label>
           <input type="text" placeholder="Nome da despesa ou receita" value={addDesc} onChange={e => setAddDesc(e.target.value)} className="w-full bg-gray-50 dark:bg-white/[0.02] border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2.5 text-xs font-medium focus:border-emerald-500 focus:bg-white dark:focus:bg-[#18181b] transition-colors focus:outline-none placeholder:text-gray-400 shadow-sm hover:bg-white dark:hover:bg-[#18181b]" />
        </div>
        
        <div className="grid grid-cols-2 gap-3 z-10">
            <div className="flex flex-col gap-1.5">
               <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider ml-1">Categoria</label>
               <select value={addCat} onChange={e => setAddCat(e.target.value)} className="w-full bg-gray-50 dark:bg-white/[0.02] border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2.5 text-xs font-medium focus:border-emerald-500 focus:bg-white dark:focus:bg-[#18181b] transition-colors focus:outline-none shadow-sm hover:bg-white dark:hover:bg-[#18181b]">
                 <option value="" disabled>Selecione...</option>
                 {(addType === 'expense' ? userSettings?.categories : userSettings?.incomeCategories)?.map(c => <option key={c} value={c}>{c}</option>)}
               </select>
            </div>
            
            <div className="flex flex-col gap-1.5">
               <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider ml-1">
                 {addType === 'expense' ? 'Método' : 'N/A'}
               </label>
               {addType === 'expense' ? (
                  <select value={addMethod} onChange={e => setAddMethod(e.target.value)} className="w-full bg-gray-50 dark:bg-white/[0.02] border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2.5 text-xs font-medium focus:border-emerald-500 focus:bg-white dark:focus:bg-[#18181b] transition-colors focus:outline-none shadow-sm hover:bg-white dark:hover:bg-[#18181b]">
                    <option value="" disabled>Selecione...</option>
                    <option value="Débito">Débito</option>
                    <option value="Crédito">Crédito</option>
                    <option value="Pix">Pix</option>
                    <option value="Dinheiro">Dinheiro</option>
                  </select>
               ) : (
                  <div className="w-full bg-gray-50/50 dark:bg-white/[0.01] border border-transparent rounded-xl px-3 py-2.5 border-dashed border-gray-200 dark:border-white/5 opacity-50 flex items-center justify-center h-[36px]">
                    <span className="text-[10px] text-gray-400 uppercase font-bold">Sem Método</span>
                  </div>
               )}
            </div>
        </div>
        
        {addType === 'expense' && (addMethod === 'Crédito' || addMethod === 'Débito') && (
           <div className="flex gap-2 z-10 w-full animate-in fade-in slide-in-from-top-2 duration-200 mt-1">
             <select value={addCard} onChange={e => setAddCard(e.target.value)} className="flex-1 min-w-[100px] bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-500/30 rounded-xl px-3 py-2.5 text-xs font-bold text-emerald-800 dark:text-emerald-400 focus:border-emerald-500 focus:bg-emerald-100/50 dark:focus:bg-emerald-900/30 transition-colors focus:outline-none shadow-sm">
               <option value="" disabled>Cartão...</option>
               {userSettings?.cards?.map(c => <option key={c} value={c}>{c}</option>)}
             </select>
             {addMethod === 'Crédito' && (
                 <div className="relative shrink-0 w-[70px]">
                   <input type="number" min="1" max="48" value={addInstallments} onChange={e => setAddInstallments(Number(e.target.value) || 1)} placeholder="1" className="w-full bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-500/30 rounded-xl pl-3 pr-6 py-2.5 text-xs font-bold text-emerald-800 dark:text-emerald-400 focus:border-emerald-500 focus:bg-emerald-100/50 dark:focus:bg-emerald-900/30 transition-colors focus:outline-none shadow-sm text-center" />
                   <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-emerald-600/50 dark:text-emerald-400/50 pointer-events-none">x</span>
                 </div>
             )}
           </div>
        )}
        
        <button onClick={handleQuickAdd} disabled={isAddDisabled} className="w-full mt-3 z-10 bg-emerald-500 text-black py-3.5 rounded-xl font-black uppercase tracking-wider text-[11px] disabled:opacity-50 disabled:bg-gray-100 disabled:text-gray-400 dark:disabled:bg-white/5 dark:disabled:text-gray-500 disabled:shadow-none disabled:border disabled:border-gray-200 dark:disabled:border-white/10 hover:bg-emerald-400 transition-all shadow-[0_4px_14px_rgba(16,185,129,0.4)] active:scale-[0.98] flex items-center justify-center gap-2 group/addbtn">
           <Check className="w-4 h-4 transition-transform group-hover/addbtn:scale-110" strokeWidth={3} /> <span>Salvar Transação</span>
        </button>
      </div>
    </>
  );
}
