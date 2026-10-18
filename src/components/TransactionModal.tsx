import React, { useState, useEffect } from 'react';
import { Transaction, UserSettings } from '../types';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { doc, setDoc, collection, updateDoc, arrayUnion, arrayRemove, writeBatch } from 'firebase/firestore';
import { X, Plus, Trash2, Pencil, MoreVertical } from 'lucide-react';
import { Button } from './ui';

export function TransactionModal({ isOpen, onClose, userId, userSettings, initialData, initialType }: { isOpen: boolean, onClose: () => void, userId: string, userSettings: UserSettings, initialData?: Transaction | null, initialType?: 'expense' | 'income' }) {
  const [type, setType] = useState<'income' | 'expense' | 'transfer'>(initialType || 'expense');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [category, setCategory] = useState('');
  const [account, setAccount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Crédito');
  const [card, setCard] = useState('');
  const [installments, setInstallments] = useState(1);
  const [status, setStatus] = useState<'pending' | 'paid'>('paid');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrencePeriod, setRecurrencePeriod] = useState<'monthly' | 'yearly'>('monthly');
  
  // Set defaults when modal opens
  useEffect(() => {
     if (isOpen) {
        if (initialData) {
            setType(initialData.type);
            setDescription(initialData.description);
            setAmount(initialData.amount.toString());
            setStatus(initialData.status || 'paid');
            
            const localDate = new Date(initialData.date);
            const yyyy = localDate.getFullYear();
            const mm = String(localDate.getMonth() + 1).padStart(2, '0');
            const dd = String(localDate.getDate()).padStart(2, '0');
            setDate(`${yyyy}-${mm}-${dd}`);
            
            let initialCat = initialData.category;
            const targetList = initialData.type === 'expense' ? userSettings?.categories : userSettings?.incomeCategories;
            if (targetList) {
               const matched = targetList.find(c => c.toLowerCase() === initialCat.toLowerCase());
               if (matched) initialCat = matched;
            }
            setCategory(initialCat);
            setAccount(initialData.account || '');
            setPaymentMethod(initialData.paymentMethod || '');
            setCard(initialData.card || (userSettings?.cards?.length ? userSettings.cards[0] : ''));
            setInstallments(1);
            setIsRecurring(false);
            setRecurrencePeriod('monthly'); // Only edit single installment
        } else {
            setType(initialType || 'expense');
            setDescription('');
            setAmount('');
            setDate(new Date().toISOString().split('T')[0]);
            setAccount('');
            setPaymentMethod('Crédito');
            setInstallments(1);
            setIsRecurring(false);
            setRecurrencePeriod('monthly');
            if (userSettings?.categories?.length) setCategory(userSettings.categories[0]);
            if (userSettings?.cards?.length) setCard(userSettings.cards[0]);
        }
     }
  }, [isOpen, initialData, userSettings]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      const parsedAmount = parseFloat(amount.replace(',', '.'));
      if (isNaN(parsedAmount) || parsedAmount <= 0) throw new Error("Valor inválido");

      const baseDate = new Date(date + 'T12:00:00');

      if (initialData?.id) {
          // Update existing transaction
          const payload: Partial<Transaction> = {
              description,
              amount: parsedAmount,
              date: baseDate.getTime(),
              type,
              category,
              status,
          };
          if (type === 'expense') {
              payload.account = account;
              payload.paymentMethod = paymentMethod;
              if (paymentMethod === 'Crédito' || paymentMethod === 'Débito') {
                  payload.card = card;
              } else {
                  payload.card = undefined;
              }
          } else {
              payload.account = '';
              payload.paymentMethod = '';
              payload.card = undefined;
          }
          await updateDoc(doc(db, 'transactions', initialData.id), payload);
      } else {
          // Create new transaction(s)
          const actualInstallments = type === 'expense' && !isRecurring && paymentMethod === 'Crédito' ? installments : 1;
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
              description: actualInstallments > 1 ? `${description} (${padZeros(i)}/${padZeros(actualInstallments)})` : description,
              amount: currentAmount,
              date: txDate.getTime(),
              type,
              category,
              account: type === 'expense' ? account : '',
              paymentMethod: type === 'expense' ? paymentMethod : '',
              card: type === 'expense' && (paymentMethod === 'Crédito' || paymentMethod === 'Débito') ? card : undefined,
              installments: actualInstallments > 1 ? actualInstallments : undefined,
              installmentNumber: actualInstallments > 1 ? i : undefined,
              groupId,
              status,
              createdAt: Date.now()
            };

            const docRef = doc(collection(db, 'transactions'));
            await setDoc(docRef, payload);
          }
          
          if (type === 'expense' && isRecurring) {
            const d = new Date(date + 'T12:00:00');
            const year = d.getFullYear();
            const month = d.getMonth() + 1;
            const expenseId = crypto.randomUUID();
            
            const newFixedExpense = {
              id: expenseId,
              description: description,
              amount: parsedAmount,
              isRecurring: true,
              frequency: recurrencePeriod,
              category: category,
              account: account,
              paymentMethod: paymentMethod,
              card: (paymentMethod === 'Crédito' || paymentMethod === 'Débito') ? card : undefined
            };
            
            const batch = writeBatch(db);
            
            if (recurrencePeriod === 'monthly') {
               for (let m = month; m <= 12; m++) {
                  const docId = `${userId}_${year}_${m}`;
                  const docRef = doc(db, 'monthly_budgets', docId);
                  const updates: any = {
                     fixedExpenses: arrayUnion(newFixedExpense),
                     updatedAt: Date.now()
                  };
                  if (m === month) {
                     updates.processedFixedExpenses = arrayUnion(expenseId);
                  }
                  batch.set(docRef, updates, { merge: true });
               }
            } else if (recurrencePeriod === 'yearly') {
               for (let y = year; y <= year + 5; y++) {
                  const docId = `${userId}_${y}_${month}`;
                  const docRef = doc(db, 'monthly_budgets', docId);
                  const updates: any = {
                     fixedExpenses: arrayUnion(newFixedExpense),
                     updatedAt: Date.now()
                  };
                  if (y === year) {
                     updates.processedFixedExpenses = arrayUnion(expenseId);
                  }
                  batch.set(docRef, updates, { merge: true });
               }
            }
            
            await batch.commit();
          }
      }
      
      onClose();
    } catch (e) {
      handleFirestoreError(e, initialData?.id ? OperationType.UPDATE : OperationType.CREATE, 'transactions');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm font-sans">
      <div className="glass-card bg-white dark:bg-[#121214] border border-gray-100 dark:border-white/10 rounded-3xl w-full max-w-md p-6 sm:p-8 shadow-2xl relative max-h-[95vh] overflow-y-auto text-gray-900 dark:text-white transition-all">
        <button 
          onClick={onClose} 
          className="absolute top-5 right-5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
        >
           <X className="w-5 h-5" />
        </button>
        <div className="mb-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            {initialData?.id ? 'Editar Transação' : 'Nova Transação'}
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Preencha os dados da movimentação financeira
          </p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
           <div className="grid grid-cols-2 gap-2 p-1 bg-gray-100 dark:bg-white/5 rounded-2xl">
              <button 
                type="button" 
                onClick={() => { setType('expense'); setCategory(userSettings?.categories?.[0] || ''); }} 
                className={`py-2.5 text-xs font-semibold rounded-xl transition-all ${type === 'expense' ? 'bg-rose-500 text-white shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'}`}
              >
                Despesa
              </button>
              <button 
                type="button" 
                onClick={() => { setType('income'); setCategory((userSettings?.incomeCategories || ['Salário', 'Investimentos', 'Outros'])[0] || ''); }} 
                className={`py-2.5 text-xs font-semibold rounded-xl transition-all ${type === 'income' ? 'bg-emerald-500 text-white shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'}`}
              >
                Receita
              </button>
           </div>
           
           <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">Descrição</label>
              <input 
                required 
                value={description} 
                onChange={e => setDescription(e.target.value)} 
                className="w-full bg-gray-50 dark:bg-[#0A0A0B] border border-gray-200 dark:border-white/10 rounded-xl p-3 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-all placeholder:text-gray-400" 
                placeholder="Ex: Supermercado" 
              />
           </div>

           <div className="grid grid-cols-2 gap-4">
               <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">Valor (R$)</label>
                  <input 
                    required 
                    value={amount} 
                    onChange={e => setAmount(e.target.value)} 
                    type="number" 
                    step="0.01" 
                    className="w-full bg-gray-50 dark:bg-[#0A0A0B] border border-gray-200 dark:border-white/10 rounded-xl p-3 text-sm font-mono font-bold text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-all" 
                    placeholder="0.00" 
                  />
               </div>
               <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">Data</label>
                  <input 
                    required 
                    value={date} 
                    onChange={e => setDate(e.target.value)} 
                    type="date" 
                    className="w-full bg-gray-50 dark:bg-[#0A0A0B] border border-gray-200 dark:border-white/10 rounded-xl p-3 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-all" 
                  />
               </div>
           </div>

           <div className={`grid ${type === 'income' ? 'grid-cols-1' : 'grid-cols-2'} gap-4`}>
              <div className="space-y-1.5 relative">
                 <div className="flex justify-between items-center mb-1">
                    <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">Categoria</label>
                    <div className="relative group">
                       <button type="button" className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-0.5 rounded transition-colors" title="Opções"><MoreVertical className="w-3.5 h-3.5" /></button>
                       <div className="absolute right-0 top-full mt-1 bg-white dark:bg-[#1A1A1D] border border-gray-200 dark:border-white/10 rounded-xl shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-[100] w-40 flex flex-col overflow-hidden text-left origin-top-right">
                          <button type="button" onClick={() => {
                             const cat = window.prompt('Nova Categoria:');
                             const targetList = type === 'expense' ? userSettings?.categories : (userSettings?.incomeCategories || ['Salário', 'Investimentos', 'Outros']);
                             if (cat && !targetList?.includes(cat)) {
                                 setCategory(cat);
                                 if (type === 'expense') {
                                    updateDoc(doc(db, 'user_settings', userId), { categories: arrayUnion(cat) });
                                 } else {
                                    updateDoc(doc(db, 'user_settings', userId), { incomeCategories: arrayUnion(cat) });
                                 }
                             }
                          }} className="text-xs p-2.5 hover:bg-gray-50 dark:hover:bg-white/5 text-gray-700 dark:text-gray-300 text-left flex items-center gap-2 w-full"><Plus className="w-3.5 h-3.5" /> Adicionar</button>
                          <button type="button" onClick={() => {
                             if (!category) return;
                             const newCat = window.prompt(`Renomear ${category} para:`, category);
                             const targetList = type === 'expense' ? userSettings?.categories : (userSettings?.incomeCategories || ['Salário', 'Investimentos', 'Outros']);
                             if (newCat && newCat !== category) {
                                 setCategory(newCat);
                                 const newList = targetList.map(c => c === category ? newCat : c);
                                 if (type === 'expense') {
                                    updateDoc(doc(db, 'user_settings', userId), { categories: newList });
                                 } else {
                                    updateDoc(doc(db, 'user_settings', userId), { incomeCategories: newList });
                                 }
                             }
                          }} className="text-xs p-2.5 hover:bg-gray-50 dark:hover:bg-white/5 text-gray-700 dark:text-gray-300 border-y border-gray-100 dark:border-white/5 text-left flex items-center gap-2 w-full"><Pencil className="w-3.5 h-3.5" /> Editar</button>
                          <button type="button" onClick={() => {
                             if (!category) return;
                             const targetList = type === 'expense' ? userSettings?.categories : (userSettings?.incomeCategories || ['Salário', 'Investimentos', 'Outros']);
                             if (type === 'expense') {
                                updateDoc(doc(db, 'user_settings', userId), { categories: arrayRemove(category) });
                                setCategory((userSettings?.categories || []).filter(c => c !== category)[0] || '');
                             } else {
                                updateDoc(doc(db, 'user_settings', userId), { incomeCategories: arrayRemove(category) });
                                setCategory((userSettings?.incomeCategories || ['Salário']).filter(c => c !== category)[0] || '');
                             }
                          }} className="text-xs p-2.5 hover:bg-red-50 dark:hover:bg-red-500/10 text-red-500 text-left flex items-center gap-2 w-full"><Trash2 className="w-3.5 h-3.5" /> Remover</button>
                       </div>
                    </div>
                 </div>
                 <select required value={category} onChange={e => setCategory(e.target.value)} className="w-full bg-gray-50 dark:bg-[#0A0A0B] border border-gray-200 dark:border-white/10 rounded-xl p-3 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-all truncate cursor-pointer">
                    {type === 'expense' ? (
                       <>
                         {!userSettings?.categories?.length && <option value="" disabled>Adicione Categorias</option>}
                         {category && !userSettings?.categories?.includes(category) && <option value={category}>{category} (Não cadastrada)</option>}
                         {userSettings?.categories?.map(c => <option key={c} value={c}>{c}</option>)}
                       </>
                    ) : (
                       <>
                         {!(userSettings?.incomeCategories?.length) && <option value="" disabled>Adicione Categorias</option>}
                         {category && !(userSettings?.incomeCategories || ['Salário', 'Investimentos', 'Outros'])?.includes(category) && <option value={category}>{category} (Não cadastrada)</option>}
                         {(userSettings?.incomeCategories || ['Salário', 'Investimentos', 'Outros'])?.map(c => <option key={c} value={c}>{c}</option>)}
                       </>
                    )}
                 </select>
              </div>
              {type === 'expense' && (
                 <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">Conta (Banco)</label>
                    <input value={account} onChange={e => setAccount(e.target.value)} placeholder="Ex: Nubank" className="w-full bg-gray-50 dark:bg-[#0A0A0B] border border-gray-200 dark:border-white/10 rounded-xl p-3 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-all placeholder:text-gray-400" />
                 </div>
              )}
           </div>

           {type === 'expense' && (
             <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                   <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">Método</label>
                   <select required value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)} className="w-full bg-gray-50 dark:bg-[#0A0A0B] border border-gray-200 dark:border-white/10 rounded-xl p-3 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-all cursor-pointer">
                      <option value="Crédito">Crédito</option>
                      <option value="Pix">Pix</option>
                      <option value="Débito">Débito</option>
                      <option value="Dinheiro">Dinheiro</option>
                   </select>
                </div>
                {(paymentMethod === 'Crédito' || paymentMethod === 'Débito') && (
                    <div className="space-y-1.5">
                       <div className="flex justify-between items-center mb-1">
                          <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">Cartão</label>
                          <div className="relative group">
                             <button type="button" className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-0.5 rounded transition-colors" title="Opções"><MoreVertical className="w-3.5 h-3.5" /></button>
                             <div className="absolute right-0 top-full mt-1 bg-white dark:bg-[#1A1A1D] border border-gray-200 dark:border-white/10 rounded-xl shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-[100] w-40 flex flex-col overflow-hidden text-left origin-top-right">
                                <button type="button" onClick={() => {
                                   const c = window.prompt('Novo Cartão:');
                                   if (c && (!userSettings?.cards || !userSettings.cards.includes(c))) {
                                       setCard(c);
                                       updateDoc(doc(db, 'user_settings', userId), { cards: arrayUnion(c) });
                                   }
                                }} className="text-xs p-2.5 hover:bg-gray-50 dark:hover:bg-white/5 text-gray-700 dark:text-gray-300 text-left flex items-center gap-2 w-full"><Plus className="w-3.5 h-3.5" /> Adicionar</button>
                                <button type="button" onClick={() => {
                                   if (!card) return;
                                   const newC = window.prompt(`Renomear ${card} para:`, card);
                                   if (newC && newC !== card) {
                                       setCard(newC);
                                       const newCards = userSettings.cards.map(x => x === card ? newC : x);
                                       updateDoc(doc(db, 'user_settings', userId), { cards: newCards });
                                   }
                                }} className="text-xs p-2.5 hover:bg-gray-50 dark:hover:bg-white/5 text-gray-700 dark:text-gray-300 border-y border-gray-100 dark:border-white/5 text-left flex items-center gap-2 w-full"><Pencil className="w-3.5 h-3.5" /> Editar</button>
                                <button type="button" onClick={() => {
                                   if (!card) return;
                                   updateDoc(doc(db, 'user_settings', userId), { cards: arrayRemove(card) });
                                   setCard(userSettings.cards.filter(c => c !== card)[0] || '');
                                }} className="text-xs p-2.5 hover:bg-red-50 dark:hover:bg-red-500/10 text-red-500 text-left flex items-center gap-2 w-full"><Trash2 className="w-3.5 h-3.5" /> Remover</button>
                             </div>
                          </div>
                       </div>
                       <select value={card} onChange={e => setCard(e.target.value)} className="w-full bg-gray-50 dark:bg-[#0A0A0B] border border-gray-200 dark:border-white/10 rounded-xl p-3 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-all cursor-pointer">
                           {!userSettings?.cards?.length && <option value="" disabled>Adicione Cartões</option>}
                           {userSettings?.cards?.map(c => <option key={c} value={c}>{c}</option>)}
                       </select>
                    </div>
                )}
             </div>
           )}

           {(!initialData?.id) && !isRecurring && paymentMethod === 'Crédito' && type === 'expense' && (
               <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">Parcelas</label>
                  <input required type="number" min="1" max="48" value={installments} onChange={e => setInstallments(Number(e.target.value))} className="w-full bg-gray-50 dark:bg-[#0A0A0B] border border-gray-200 dark:border-white/10 rounded-xl p-3 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-all" />
                  
                  {installments > 1 && (new Date(date + 'T12:00:00').getMonth() + installments - 1 >= 12) && (
                     <div className="mt-2 p-3 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-xl">
                        <p className="text-xs text-amber-700 dark:text-amber-400 flex items-center gap-2">
                           <span>ℹ️</span>
                           Atenção: As parcelas avançarão para o próximo ano.
                        </p>
                     </div>
                  )}
               </div>
           )}

           {type === 'expense' && (
              <div className="space-y-1.5">
                 <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">Status</label>
                 <div className="grid grid-cols-2 gap-2">
                   <button 
                     type="button" 
                     onClick={() => setStatus('paid')} 
                     className={`py-2.5 text-xs font-semibold rounded-xl border transition-all ${status === 'paid' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 font-bold' : 'bg-gray-50 dark:bg-[#0A0A0B] text-gray-500 dark:text-gray-400 border-gray-200 dark:border-white/10 hover:bg-gray-100 dark:hover:bg-white/5'}`}
                   >
                     Pago
                   </button>
                   <button 
                     type="button" 
                     onClick={() => setStatus('pending')} 
                     className={`py-2.5 text-xs font-semibold rounded-xl border transition-all ${status === 'pending' ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 font-bold' : 'bg-gray-50 dark:bg-[#0A0A0B] text-gray-500 dark:text-gray-400 border-gray-200 dark:border-white/10 hover:bg-gray-100 dark:hover:bg-white/5'}`}
                   >
                     Pendente
                   </button>
                 </div>
              </div>
           )}

           {!initialData?.id && type === 'expense' && (
             <div className="space-y-2 p-3.5 bg-gray-50 dark:bg-[#0A0A0B] border border-gray-200 dark:border-white/10 rounded-xl">
               <label className="flex items-center gap-2.5 cursor-pointer w-max">
                 <input type="checkbox" checked={isRecurring} onChange={e => setIsRecurring(e.target.checked)} className="w-4 h-4 text-emerald-500 rounded border-gray-300 focus:ring-emerald-500" />
                 <span className="text-xs font-medium text-gray-800 dark:text-gray-200">Tornar Recorrente</span>
               </label>
               {isRecurring && (
                 <div className="pt-2 border-t border-gray-200 dark:border-white/10">
                   <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">Periodicidade</label>
                   <select value={recurrencePeriod} onChange={e => setRecurrencePeriod(e.target.value as any)} className="w-full bg-white dark:bg-[#121214] border border-gray-200 dark:border-white/10 rounded-lg p-2 text-xs text-gray-800 dark:text-gray-200 focus:outline-none">
                     <option value="monthly">Mensal (todos os meses)</option>
                     <option value="yearly">Anual (este mês todo ano)</option>
                   </select>
                 </div>
               )}
             </div>
           )}

           <Button 
             type="submit"
             isDisabled={isSubmitting} 
             variant="primary"
             className="w-full mt-6 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl py-3.5 font-semibold text-sm shadow-sm transition-all"
           >
             {isSubmitting ? 'Salvando...' : (initialData?.id ? 'Salvar Alterações' : 'Salvar Registro')}
           </Button>
        </form>
      </div>
    </div>
  );
}
