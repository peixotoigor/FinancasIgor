import React, { useState, useEffect } from 'react';
import { Transaction, UserSettings } from '../types';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { doc, setDoc, collection, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { X, Plus, Trash2, Pencil, MoreVertical } from 'lucide-react';

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
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Set defaults when modal opens
  useEffect(() => {
     if (isOpen) {
        if (initialData) {
            setType(initialData.type);
            setDescription(initialData.description);
            setAmount(initialData.amount.toString());
            
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
            setInstallments(1); // Only edit single installment
        } else {
            setType(initialType || 'expense');
            setDescription('');
            setAmount('');
            setDate(new Date().toISOString().split('T')[0]);
            setAccount('');
            setPaymentMethod('Crédito');
            setInstallments(1);
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
          const actualInstallments = type === 'expense' && paymentMethod === 'Crédito' ? installments : 1;
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
              createdAt: Date.now()
            };

            const docRef = doc(collection(db, 'transactions'));
            await setDoc(docRef, payload);
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-[#121214] border border-gray-300 dark:border-white/10 rounded-2xl w-full max-w-md shadow-2xl p-6 relative max-h-[95vh] overflow-y-auto">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-500 hover:text-gray-900 dark:text-white transition">
           <X className="w-5 h-5" />
        </button>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">{initialData?.id ? 'Editar Transação' : 'Nova Transação'}</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
           <div className="flex gap-2 p-1 bg-gray-50 dark:bg-[#0A0A0B] rounded-lg border border-gray-200 dark:border-white/5">
              <button type="button" onClick={() => { setType('expense'); setCategory(userSettings?.categories?.[0] || ''); }} className={`flex-1 py-2 text-xs font-semibold uppercase tracking-wider rounded-md transition ${type === 'expense' ? 'bg-white dark:bg-[#18181B] text-red-400 border border-gray-300 dark:border-white/10 shadow-sm' : 'text-gray-500 hover:text-gray-900 dark:text-white'}`}>Despesa</button>
              <button type="button" onClick={() => { setType('income'); setCategory((userSettings?.incomeCategories || ['Salário', 'Investimentos', 'Outros'])[0] || ''); }} className={`flex-1 py-2 text-xs font-semibold uppercase tracking-wider rounded-md transition ${type === 'income' ? 'bg-white dark:bg-[#18181B] text-emerald-400 border border-gray-300 dark:border-white/10 shadow-sm' : 'text-gray-500 hover:text-gray-900 dark:text-white'}`}>Receita</button>
           </div>
           
           <div className="space-y-1">
              <label className="text-[10px] text-gray-400 uppercase font-semibold">Descrição</label>
              <input required value={description} onChange={e => setDescription(e.target.value)} className="w-full bg-gray-50 dark:bg-[#0A0A0B] border border-gray-300 dark:border-white/10 rounded-lg p-3 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-emerald-500/50 transition placeholder:text-gray-600" placeholder="Ex: Mercado" />
           </div>

           <div className="grid grid-cols-2 gap-4">
               <div className="space-y-1">
                  <label className="text-[10px] text-gray-400 uppercase font-semibold">Valor (R$)</label>
                  <input required value={amount} onChange={e => setAmount(e.target.value)} type="number" step="0.01" className="w-full bg-gray-50 dark:bg-[#0A0A0B] border border-gray-300 dark:border-white/10 rounded-lg p-3 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-emerald-500/50 transition" placeholder="0.00" />
               </div>
               <div className="space-y-1">
                  <label className="text-[10px] text-gray-400 uppercase font-semibold">Data</label>
                  <input required value={date} onChange={e => setDate(e.target.value)} type="date" className="w-full bg-gray-50 dark:bg-[#0A0A0B] border border-gray-300 dark:border-white/10 rounded-lg p-3 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-emerald-500/50 transition dark:[&::-webkit-calendar-picker-indicator]:invert" />
               </div>
           </div>

           <div className={`grid ${type === 'income' ? 'grid-cols-1' : 'grid-cols-2'} gap-4`}>
              <div className="space-y-1 relative">
                 <div className="flex justify-between items-center mb-1">
                    <label className="text-[10px] text-gray-400 uppercase font-semibold">Categoria</label>
                    <div className="relative group">
                       <button type="button" className="text-gray-500 hover:text-gray-900 dark:text-white transition cursor-pointer p-1" title="Opções"><MoreVertical className="w-3.5 h-3.5" /></button>
                       <div className="absolute right-0 top-full mt-1 bg-white dark:bg-[#18181B] border border-gray-300 dark:border-white/10 rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-[100] w-36 flex flex-col overflow-hidden text-left origin-top-right">
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
                          }} className="text-[11px] p-2 hover:bg-gray-100 dark:bg-white/5 text-gray-700 dark:text-gray-300 hover:text-emerald-400 text-left flex items-center gap-2 w-full"><Plus className="w-3 h-3" /> Adicionar</button>
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
                          }} className="text-[11px] p-2 hover:bg-gray-100 dark:bg-white/5 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:text-white border-y border-gray-200 dark:border-white/5 text-left flex items-center gap-2 w-full"><Pencil className="w-3 h-3" /> Editar Seleção</button>
                          <button type="button" onClick={() => {
                             if (!category) return;
                             if (window.confirm(`Remover categoria ${category}?`)) {
                                 const targetList = type === 'expense' ? userSettings?.categories : (userSettings?.incomeCategories || ['Salário', 'Investimentos', 'Outros']);
                                 if (type === 'expense') {
                                    updateDoc(doc(db, 'user_settings', userId), { categories: arrayRemove(category) });
                                    setCategory((userSettings?.categories || []).filter(c => c !== category)[0] || '');
                                 } else {
                                    updateDoc(doc(db, 'user_settings', userId), { incomeCategories: arrayRemove(category) });
                                    setCategory((userSettings?.incomeCategories || ['Salário']).filter(c => c !== category)[0] || '');
                                 }
                             }
                          }} className="text-[11px] p-2 hover:bg-gray-100 dark:bg-white/5 text-gray-700 dark:text-gray-300 hover:text-red-400 text-left flex items-center gap-2 w-full"><Trash2 className="w-3 h-3" /> Remover Seleção</button>
                       </div>
                    </div>
                 </div>
                 <select required value={category} onChange={e => setCategory(e.target.value)} className="w-full bg-gray-50 dark:bg-[#0A0A0B] border border-gray-300 dark:border-white/10 rounded-lg p-3 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-emerald-500/50 transition truncate">
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
                 <div className="space-y-1">
                    <label className="text-[10px] text-gray-400 uppercase font-semibold">Conta (Banco)</label>
                    <input value={account} onChange={e => setAccount(e.target.value)} placeholder="Ex: Nubank" className="w-full bg-gray-50 dark:bg-[#0A0A0B] border border-gray-300 dark:border-white/10 rounded-lg p-3 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-emerald-500/50 transition placeholder:text-gray-600" />
                 </div>
              )}
           </div>

           {type === 'expense' && (
             <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                   <label className="text-[10px] text-gray-400 uppercase font-semibold">Método</label>
                   <select required value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)} className="w-full bg-gray-50 dark:bg-[#0A0A0B] border border-gray-300 dark:border-white/10 rounded-lg p-3 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-emerald-500/50 transition">
                      <option value="Crédito">Crédito</option>
                      <option value="Pix">Pix</option>
                      <option value="Débito">Débito</option>
                      <option value="Dinheiro">Dinheiro</option>
                   </select>
                </div>
                {(paymentMethod === 'Crédito' || paymentMethod === 'Débito') && (
                    <div className="space-y-1">
                       <div className="flex justify-between items-center">
                          <label className="text-[10px] text-gray-400 uppercase font-semibold">Cartão</label>
                          <div className="relative group">
                             <button type="button" className="text-gray-500 hover:text-gray-900 dark:text-white transition cursor-pointer p-1" title="Opções"><MoreVertical className="w-3.5 h-3.5" /></button>
                             <div className="absolute right-0 top-full mt-1 bg-white dark:bg-[#18181B] border border-gray-300 dark:border-white/10 rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-[100] w-36 flex flex-col overflow-hidden text-left origin-top-right">
                                <button type="button" onClick={() => {
                                   const c = window.prompt('Novo Cartão:');
                                   if (c && (!userSettings?.cards || !userSettings.cards.includes(c))) {
                                       setCard(c);
                                       updateDoc(doc(db, 'user_settings', userId), { cards: arrayUnion(c) });
                                   }
                                }} className="text-[11px] p-2 hover:bg-gray-100 dark:bg-white/5 text-gray-700 dark:text-gray-300 hover:text-emerald-400 text-left flex items-center gap-2 w-full"><Plus className="w-3 h-3" /> Adicionar</button>
                                <button type="button" onClick={() => {
                                   if (!card) return;
                                   const newC = window.prompt(`Renomear ${card} para:`, card);
                                   if (newC && newC !== card) {
                                       setCard(newC);
                                       const newCards = userSettings.cards.map(x => x === card ? newC : x);
                                       updateDoc(doc(db, 'user_settings', userId), { cards: newCards });
                                   }
                                }} className="text-[11px] p-2 hover:bg-gray-100 dark:bg-white/5 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:text-white border-y border-gray-200 dark:border-white/5 text-left flex items-center gap-2 w-full"><Pencil className="w-3 h-3" /> Editar Seleção</button>
                                <button type="button" onClick={() => {
                                   if (!card) return;
                                   if (window.confirm(`Remover cartão ${card}?`)) {
                                       updateDoc(doc(db, 'user_settings', userId), { cards: arrayRemove(card) });
                                       setCard(userSettings.cards.filter(c => c !== card)[0] || '');
                                   }
                                }} className="text-[11px] p-2 hover:bg-gray-100 dark:bg-white/5 text-gray-700 dark:text-gray-300 hover:text-red-400 text-left flex items-center gap-2 w-full"><Trash2 className="w-3 h-3" /> Remover Seleção</button>
                             </div>
                          </div>
                       </div>
                       <select value={card} onChange={e => setCard(e.target.value)} className="w-full bg-gray-50 dark:bg-[#0A0A0B] border border-gray-300 dark:border-white/10 rounded-lg p-3 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-emerald-500/50 transition">
                           {!userSettings?.cards?.length && <option value="" disabled>Adicione Cartões</option>}
                           {userSettings?.cards?.map(c => <option key={c} value={c}>{c}</option>)}
                       </select>
                    </div>
                )}
             </div>
           )}

           {(!initialData?.id) && paymentMethod === 'Crédito' && type === 'expense' && (
               <div className="space-y-1">
                  <label className="text-[10px] text-gray-400 uppercase font-semibold">Parcelas</label>
                  <input required type="number" min="1" max="48" value={installments} onChange={e => setInstallments(Number(e.target.value))} className="w-full bg-gray-50 dark:bg-[#0A0A0B] border border-gray-300 dark:border-white/10 rounded-lg p-3 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-emerald-500/50 transition" />
                  
                  {installments > 1 && (new Date(date + 'T12:00:00').getMonth() + installments - 1 >= 12) && (
                     <div className="mt-2 p-3 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-lg">
                        <p className="text-xs text-amber-700 dark:text-amber-400 flex items-center gap-2 font-medium">
                           <span className="w-4 h-4 flex items-center justify-center rounded-full bg-amber-100 dark:bg-amber-500/20">!</span>
                           Atenção: As parcelas irão avançar para o próximo ano.
                        </p>
                     </div>
                  )}
               </div>
           )}

           <button disabled={isSubmitting} className="w-full mt-4 bg-emerald-500 text-black py-4 rounded-xl font-bold uppercase tracking-wider text-xs shadow-lg shadow-emerald-500/20 hover:bg-emerald-400 transition hover:shadow-emerald-500/40 disabled:opacity-50">
             {isSubmitting ? 'Salvando...' : (initialData?.id ? 'Salvar Alterações' : 'Adicionar Transação')}
           </button>
        </form>
      </div>
    </div>
  );
}
