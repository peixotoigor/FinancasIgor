import React, { useState, useEffect } from 'react';
import { MonthlyBudget } from '../types';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { doc, setDoc, query, collection, where, onSnapshot } from 'firebase/firestore';
import { PiggyBank, Briefcase, ArrowDownCircle, ArrowUpCircle } from 'lucide-react';

export function ReservesTab({ userId, year }: { userId: string, year: number }) {
  const [budgets, setBudgets] = useState<MonthlyBudget[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [activeMonth, setActiveMonth] = useState(new Date().getMonth() + 1);

  useEffect(() => {
    const q = query(
      collection(db, 'monthly_budgets'),
      where('userId', '==', userId),
      where('year', '==', year)
    );
    const unsub = onSnapshot(q, (snap) => {
      const b = snap.docs.map(d => ({ id: d.id, ...d.data() } as MonthlyBudget));
      setBudgets(b);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'monthly_budgets'));
    return unsub;
  }, [userId, year]);

  const getBudget = (month: number): MonthlyBudget => {
    return budgets.find(b => b.month === month) || {
      userId, year, month, salary: 0, reserve: 0, reserveOfReserve: 0, wallet: 0, walletWithdrawals: 0, emergencyWithdrawals: 0, updatedAt: Date.now()
    };
  };

  const handleUpdate = async (month: number, field: keyof MonthlyBudget, value: any) => {
    const budget = getBudget(month);
    const updated = { ...budget, [field]: value, updatedAt: Date.now() };
    const docId = budget.id || `${userId}_${year}_${month}`;
    try {
      setIsSaving(true);
      await setDoc(doc(db, 'monthly_budgets', docId), updated);
    } catch(e) {
      handleFirestoreError(e, OperationType.UPDATE, 'monthly_budgets');
    } finally {
      setIsSaving(false);
    }
  };

  const months = Array.from({ length: 12 }, (_, i) => i + 1);
  const curBudget = getBudget(activeMonth);

  // Calculate cumulative values up to activeMonth
  let accReserve = 0;
  let accReserveOfReserve = 0;
  let accWallet = 0;
  let accWalletWithdrawals = 0;
  let accEmergencyWithdrawals = 0;

  for (let i = 1; i <= activeMonth; i++) {
     const b = getBudget(i);
     accReserve += b.reserve || 0;
     accReserveOfReserve += b.reserveOfReserve || 0;
     accWallet += b.wallet || 0;
     accWalletWithdrawals += b.walletWithdrawals || 0;
     accEmergencyWithdrawals += b.emergencyWithdrawals || 0;
  }

  const netAccReserve = accReserve - accEmergencyWithdrawals;
  const netAccWallet = accWallet - accWalletWithdrawals;
  const totalAcc = accReserve + accReserveOfReserve + accWallet - accWalletWithdrawals - accEmergencyWithdrawals;

  const totalReserved = (curBudget.reserve || 0) + (curBudget.reserveOfReserve || 0) + (curBudget.wallet || 0);
  const totalWithdrawn = (curBudget.walletWithdrawals || 0) + (curBudget.emergencyWithdrawals || 0);
  const netReserves = totalReserved - totalWithdrawn;

  return (
    <div className="space-y-6">
      {/* Top Header & Month Picker */}
      <div className="bg-white dark:bg-[#121214] border border-gray-200 dark:border-white/5 rounded-2xl p-4 sm:p-6 shadow-sm">
         <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
             <div className="flex items-center gap-3">
                 <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center border border-orange-500/20">
                     <PiggyBank className="w-5 h-5 text-orange-500" />
                 </div>
                 <div>
                    <h2 className="text-lg font-bold text-gray-900 dark:text-white leading-tight">Controle de Reservas</h2>
                    <p className="text-sm text-gray-500 font-medium">Gestão de caixa e economias de {year}</p>
                 </div>
             </div>
             {isSaving && <span className="text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold uppercase tracking-widest px-3 py-1.5 rounded-full border border-emerald-500/20">Salvando...</span>}
         </div>

         <div className="flex overflow-x-auto gap-2 pb-2 hide-scrollbar">
            {months.map(m => (
               <button 
                  key={m}
                  onClick={() => setActiveMonth(m)} 
                  className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition-all whitespace-nowrap min-w-[100px] flex-1 sm:flex-none text-center border ${
                    activeMonth === m 
                     ? 'bg-orange-500 text-white dark:text-black border-orange-500 shadow-lg shadow-orange-500/20' 
                     : 'bg-gray-50 dark:bg-white/[0.02] text-gray-600 dark:text-gray-400 border-gray-200 dark:border-white/5 hover:bg-gray-100 dark:hover:bg-white/[0.05] hover:text-gray-900 dark:hover:text-white'
                  }`}
               >
                  {new Date(0, m - 1).toLocaleString('pt-BR', { month: 'long' }).charAt(0).toUpperCase() + new Date(0, m - 1).toLocaleString('pt-BR', { month: 'long' }).slice(1)}
               </button>
            ))}
         </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
         {/* Monthly Inputs */}
         <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Input Group: Entradas */}
            <div className="bg-white dark:bg-[#121214] border border-gray-200 dark:border-white/5 rounded-2xl p-5 shadow-sm space-y-5">
               <div className="flex items-center gap-2 border-b border-gray-100 dark:border-white/5 pb-3">
                  <Briefcase className="w-4 h-4 text-emerald-500" />
                  <h3 className="text-sm font-bold uppercase tracking-wider text-gray-900 dark:text-gray-100">Renda Mensal</h3>
               </div>
               
               <InputRow 
                  label="Salário / Renda" 
                  value={curBudget.salary} 
                  onChange={(val) => handleUpdate(activeMonth, 'salary', val)} 
               />
            </div>

            {/* Input Group: Saques */}
            <div className="bg-white dark:bg-[#121214] border border-gray-200 dark:border-white/5 rounded-2xl p-5 shadow-sm space-y-5">
               <div className="flex items-center gap-2 border-b border-gray-100 dark:border-white/5 pb-3">
                  <ArrowDownCircle className="w-4 h-4 text-red-500" />
                  <h3 className="text-sm font-bold uppercase tracking-wider text-gray-900 dark:text-gray-100">Saques & Retiradas</h3>
               </div>
               
               <InputRow 
                  label="Saque Carteira" 
                  value={curBudget.walletWithdrawals} 
                  onChange={(val) => handleUpdate(activeMonth, 'walletWithdrawals', val)} 
                  accValue={accWalletWithdrawals}
               />
               <InputRow 
                  label="Saque Emergência" 
                  value={curBudget.emergencyWithdrawals} 
                  onChange={(val) => handleUpdate(activeMonth, 'emergencyWithdrawals', val)} 
                  accValue={accEmergencyWithdrawals}
               />
            </div>

            {/* Input Group: Reservas */}
            <div className="bg-white dark:bg-[#121214] border border-gray-200 dark:border-white/5 rounded-2xl p-5 shadow-sm space-y-5 md:col-span-2">
               <div className="flex items-center gap-2 border-b border-gray-100 dark:border-white/5 pb-3">
                  <ArrowUpCircle className="w-4 h-4 text-blue-500" />
                  <h3 className="text-sm font-bold uppercase tracking-wider text-gray-900 dark:text-gray-100">Alocação de Reservas</h3>
               </div>
               
               <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                 <InputRow 
                    label="Reserva Principal" 
                    value={curBudget.reserve} 
                    onChange={(val) => handleUpdate(activeMonth, 'reserve', val)} 
                    accValue={netAccReserve}
                    vertical
                 />
                 <InputRow 
                    label="Res. da Reserva" 
                    value={curBudget.reserveOfReserve} 
                    onChange={(val) => handleUpdate(activeMonth, 'reserveOfReserve', val)} 
                    accValue={accReserveOfReserve}
                    vertical
                 />
                 <InputRow 
                    label="Carteira (Livre)" 
                    value={curBudget.wallet} 
                    onChange={(val) => handleUpdate(activeMonth, 'wallet', val)} 
                    accValue={netAccWallet}
                    vertical
                 />
               </div>
            </div>

         </div>

         {/* Summary Panel */}
         <div className="bg-white dark:bg-[#121214] border border-gray-200 dark:border-white/5 rounded-2xl p-6 shadow-sm flex flex-col items-center relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-br from-orange-500/5 to-transparent pointer-events-none"></div>
            
            <h3 className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-8 w-full text-left">Resumo do Mês</h3>

            <div className="space-y-6 w-full relative z-10 flex-col flex-1 pl-1">
               <div className="flex justify-between items-center border-b border-gray-100 dark:border-white/5 pb-4">
                  <span className="text-sm text-gray-500 font-medium">Total Guardado</span>
                  <span className="text-lg font-bold text-blue-500/90">+{totalReserved.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
               </div>
               
               <div className="flex justify-between items-center border-b border-gray-100 dark:border-white/5 pb-4">
                  <span className="text-sm text-gray-500 font-medium">Total Utilizado</span>
                  <span className="text-lg font-bold text-red-500/90">-{totalWithdrawn.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
               </div>

               <div className="pt-2">
                  <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest block mb-1">Saldo Líquido de Reservas no Mês</span>
                  <span className={`text-3xl font-extrabold tracking-tight ${netReserves >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                     {netReserves >= 0 ? '+' : ''}{netReserves.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </span>
               </div>

               <div className="pt-6 mt-4 border-t border-gray-100 dark:border-white/5">
                  <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest block mb-1">Saldo Total Acumulado (Até o Mês)</span>
                  <span className={`text-xl font-bold tracking-tight ${totalAcc >= 0 ? 'text-blue-500' : 'text-red-500'}`}>
                     {totalAcc.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </span>
               </div>
            </div>

            <div className="mt-auto pt-8 w-full relative z-10">
               <div className="bg-gray-50 dark:bg-white/[0.02] border border-gray-200 dark:border-white/5 rounded-xl p-4 flex items-center justify-between">
                  <span className="text-xs text-gray-500 font-medium whitespace-nowrap mr-4">Taxa de Poupança</span>
                  <span className="text-sm font-bold text-gray-900 dark:text-white">
                     {curBudget.salary > 0 ? ((totalReserved / curBudget.salary) * 100).toFixed(1) + '%' : '0%'}
                  </span>
               </div>
            </div>
         </div>
      </div>
    </div>
  );
}

function InputRow({ label, value, onChange, vertical = false, accValue }: { label: string; value: number; onChange: (v: number) => void; vertical?: boolean; accValue?: number }) {
  const [localVal, setLocalVal] = useState<string>(value?.toString() || '');

  useEffect(() => {
     if (!document.activeElement?.className.includes(`input-${label.replace(/\s/g, '')}`)) {
        setLocalVal(value?.toString() || '');
     }
  }, [value, label]);

  const handleBlur = () => {
    const num = parseFloat(localVal);
    if (!isNaN(num)) {
       onChange(num);
    } else {
       setLocalVal('0');
       onChange(0);
    }
  };

  return (
    <div className={`flex ${vertical ? 'flex-col items-start gap-2' : 'justify-between items-center'} w-full group relative`}>
       <label className="text-sm font-medium text-gray-600 dark:text-gray-400 whitespace-nowrap">{label}</label>
       <div className={`${vertical ? 'w-full' : 'flex flex-col items-end gap-1 w-32 sm:w-40'} relative`}>
          <div className={`flex items-center gap-2 bg-gray-50 dark:bg-white/[0.02] border border-gray-200 dark:border-white/5 rounded-xl px-3 py-2 transition-colors focus-within:border-orange-500/50 focus-within:bg-orange-500/5 ${vertical ? 'w-full' : 'w-full'}`}>
              <span className="text-gray-400 text-xs font-semibold">R$</span>
              <input 
                 type="number"
                 className={`input-${label.replace(/\s/g, '')} bg-transparent w-full text-right font-bold text-gray-900 dark:text-white outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`}
                 value={localVal}
                 onChange={(e) => setLocalVal(e.target.value)}
                 onBlur={handleBlur}
                 onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                       e.currentTarget.blur();
                    }
                 }}
                 placeholder="0"
              />
          </div>
          {accValue !== undefined && (
             <div className="text-[10px] text-gray-400 dark:text-gray-500 font-medium px-1 mt-1 text-right w-full">
                Saldo: <span className={accValue >= 0 ? 'text-emerald-500/80' : 'text-red-500/80'}>R$ {accValue.toFixed(2)}</span>
             </div>
          )}
       </div>
    </div>
  )
}



