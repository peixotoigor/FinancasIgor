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

  const resetAddForm = () => {
    setAddDesc('');
    setAddAmount('');
    setAddDate(new Date().toISOString().split('T')[0]);
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

        <div className="flex flex-wrap @4xl:flex-nowrap w-full items-end gap-3 relative z-10 pl-2 pr-1">
           <div className="flex flex-col gap-1.5 w-[130px] shrink-0">
             <label className="text-[10px] text-gray-500 font-bold uppercase tracking-wider pl-1">Data</label>
             <input type="date" value={addDate} onChange={e => setAddDate(e.target.value)} className="w-full bg-gray-50/80 dark:bg-white/[0.02] border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2 text-xs focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/50 focus:outline-none dark:[&::-webkit-calendar-picker-indicator]:invert shadow-sm transition-all hover:bg-white dark:hover:bg-[#18181b] focus:bg-white dark:focus:bg-[#18181b]" />
           </div>
           
           <div className="flex flex-col gap-1.5 flex-1 min-w-[200px]">
             <label className="text-[10px] text-gray-500 font-bold uppercase tracking-wider pl-1">Descrição</label>
             <input type="text" placeholder="Ex: Mercado, Conta de Luz..." value={addDesc} onChange={e => setAddDesc(e.target.value)} className="w-full bg-gray-50/80 dark:bg-white/[0.02] border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2 text-xs focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/50 focus:outline-none placeholder:text-gray-400 shadow-sm transition-all hover:bg-white dark:hover:bg-[#18181b] focus:bg-white dark:focus:bg-[#18181b]" />
           </div>
           
           <div className="flex flex-col gap-1.5 w-full @4xl:w-[140px] shrink-0">
             <label className="text-[10px] text-gray-500 font-bold uppercase tracking-wider pl-1">Categoria</label>
             <select value={addCat} onChange={e => setAddCat(e.target.value)} className="w-full bg-gray-50/80 dark:bg-white/[0.02] border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2 text-xs focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/50 focus:outline-none shadow-sm transition-all hover:bg-white dark:hover:bg-[#18181b] focus:bg-white dark:focus:bg-[#18181b] font-medium">
               <option value="" disabled>Selecione...</option>
               {(addType === 'expense' ? userSettings?.categories : userSettings?.incomeCategories)?.map(c => <option key={c} value={c}>{c}</option>)}
             </select>
           </div>
           
           <div className="flex flex-col gap-1.5 w-full @4xl:w-[130px] shrink-0 relative">
             <label className="text-[10px] text-gray-500 font-bold uppercase tracking-wider pl-1">{addType === 'expense' ? 'Conta' : 'Destino'}</label>
             {addType === 'expense' ? (
               <div className="flex flex-col gap-1 w-full relative">
                 <select value={addMethod} onChange={e => setAddMethod(e.target.value)} className="w-full bg-gray-50/80 dark:bg-white/[0.02] border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2 text-xs focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/50 focus:outline-none shadow-sm transition-all hover:bg-white dark:hover:bg-[#18181b] focus:bg-white dark:focus:bg-[#18181b] font-medium">
                   <option value="" disabled>Método...</option>
                   <option value="Débito">Débito</option>
                   <option value="Crédito">Crédito</option>
                   <option value="Pix">Pix</option>
                   <option value="Dinheiro">Dinheiro</option>
                 </select>
                 {(addMethod === 'Crédito' || addMethod === 'Débito') && (
                   <div className="absolute top-full left-0 w-[150%] z-20 pt-1">
                     <select value={addCard} onChange={e => setAddCard(e.target.value)} className="w-full bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-500/30 dark:border-emerald-500/30 rounded-lg px-3 py-2 text-[11px] focus:border-emerald-500 focus:outline-none shadow-lg animate-in fade-in slide-in-from-top-1 transition-all text-emerald-800 dark:text-emerald-200 font-medium">
                       <option value="" disabled>Cartão...</option>
                       {userSettings?.cards?.map(c => <option key={c} value={c}>{c}</option>)}
                     </select>
                   </div>
                 )}
               </div>
             ) : (
               <div className="h-[34px] flex items-center px-3 border border-dashed border-gray-200 dark:border-white/5 rounded-xl bg-gray-50/30 dark:bg-white/[0.01]">
                  <span className="text-gray-400 text-xs italic opacity-70">N/A</span>
               </div>
             )}
           </div>

           <div className="flex items-end shrink-0 w-full @4xl:w-auto mt-2 @4xl:mt-0 justify-end h-full relative">
             
             <div className="flex items-end gap-2 border-t @4xl:border-t-0 @4xl:border-l border-gray-100 dark:border-white/5 pt-3 @4xl:pt-0 @4xl:pl-4 @4xl:ml-2">
               <div className="flex flex-col gap-1.5 w-full @4xl:w-[130px]">
                 <label className="text-[10px] text-gray-500 font-bold uppercase tracking-wider pl-1 text-right">Valor</label>
                 <div className="relative">
                   <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs font-mono">R$</span>
                   <input type="number" step="0.01" placeholder="0.00" value={addAmount} onChange={e => setAddAmount(e.target.value)} className={`w-full pl-8 pr-3 py-2 text-right bg-white dark:bg-[#18181b] border rounded-xl text-sm font-mono focus:outline-none placeholder:text-gray-300 shadow-sm font-black transition-all ${addAmount ? (addType === 'expense' ? 'border-red-400 text-red-600 focus:ring-1 focus:ring-red-500/50' : 'border-emerald-400 text-emerald-600 focus:ring-1 focus:ring-emerald-500/50') : 'border-gray-200 dark:border-white/10 focus:border-gray-300 dark:focus:border-white/20 text-gray-900 dark:text-white'}`} />
                 </div>
               </div>
               
               <div className="flex items-center gap-1.5 h-[36px] shrink-0">
                 <button onClick={handleQuickAdd} disabled={!addDesc || !addAmount || !addCat} className="h-full px-3.5 flex items-center justify-center rounded-xl bg-emerald-500 text-emerald-950 disabled:opacity-50 disabled:bg-gray-100 dark:disabled:bg-white/5 disabled:text-gray-400 hover:bg-emerald-400 transition-all shadow-[0_4px_10px_rgba(16,185,129,0.2)] hover:shadow-[0_4px_12px_rgba(16,185,129,0.3)] hover:-translate-y-0.5 active:translate-y-0 disabled:shadow-none disabled:hover:translate-y-0 disabled:border overflow-hidden group/btn font-bold text-xs" title="Salvar Transação">
                   <span className="hidden @5xl:inline mr-1.5">Salvar</span>
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
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider ml-1 text-right">Valor</label>
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
           <div className="flex flex-col z-10 w-full animate-in fade-in slide-in-from-top-2 duration-200 mt-1">
             <select value={addCard} onChange={e => setAddCard(e.target.value)} className="w-full bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-500/30 rounded-xl px-3 py-2 text-xs font-bold text-emerald-800 dark:text-emerald-400 focus:border-emerald-500 focus:bg-emerald-100/50 dark:focus:bg-emerald-900/30 transition-colors focus:outline-none shadow-sm">
               <option value="" disabled>Selecione o Cartão</option>
               {userSettings?.cards?.map(c => <option key={c} value={c}>{c}</option>)}
             </select>
           </div>
        )}
        
        <button onClick={handleQuickAdd} disabled={!addDesc || !addAmount || !addCat} className="w-full mt-3 z-10 bg-emerald-500 text-black py-3.5 rounded-xl font-black uppercase tracking-wider text-[11px] disabled:opacity-50 disabled:bg-gray-100 disabled:text-gray-400 dark:disabled:bg-white/5 dark:disabled:text-gray-500 disabled:shadow-none disabled:border disabled:border-gray-200 dark:disabled:border-white/10 hover:bg-emerald-400 transition-all shadow-[0_4px_14px_rgba(16,185,129,0.4)] active:scale-[0.98] flex items-center justify-center gap-2 group/addbtn">
           <Check className="w-4 h-4 transition-transform group-hover/addbtn:scale-110" strokeWidth={3} /> <span>Salvar Transação</span>
        </button>
      </div>
    </>
  );
}
