import React, { useState, useEffect } from 'react';
import { MonthlyBudget } from '../types';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { doc, setDoc, getDoc, updateDoc, query, collection, where, onSnapshot } from 'firebase/firestore';
import { PiggyBank, Briefcase, ArrowDownCircle, ArrowUpCircle, Landmark, Trash2 } from 'lucide-react';
import { WithdrawalsManager } from './WithdrawalsManager';

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
      userId, year, month, salary: 0, reserve: 0, reserveOfReserve: 0, wallet: 0, walletWithdrawals: 0, emergencyWithdrawals: 0, reserveWithdrawals: 0, updatedAt: Date.now()
    };
  };

  const handleUpdate = async (month: number, field: keyof MonthlyBudget, value: any) => {
    const docId = `${userId}_${year}_${month}`;
    try {
      setIsSaving(true);
      const docRef = doc(db, 'monthly_budgets', docId);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
         await updateDoc(docRef, {
           [field]: value,
           updatedAt: Date.now()
         });
      } else {
         await setDoc(docRef, {
           userId,
           year,
           month,
           [field]: value,
           updatedAt: Date.now()
         });
      }
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
  let accReserveWithdrawals = 0;

  for (let i = 1; i <= activeMonth; i++) {
     const b = getBudget(i);
     accReserve += b.reserve || 0;
     accReserveOfReserve += b.reserveOfReserve || 0;
     accWallet += b.wallet || 0;
     accWalletWithdrawals += b.walletWithdrawals || 0;
     accEmergencyWithdrawals += b.emergencyWithdrawals || 0;
     accReserveWithdrawals += b.reserveWithdrawals || 0;
  }

  const netAccReserve = accReserve - accReserveWithdrawals;
  const netAccReserveOfReserve = accReserveOfReserve - accEmergencyWithdrawals;
  const netAccWallet = accWallet - accWalletWithdrawals;
  const totalAcc = netAccReserve + netAccReserveOfReserve + netAccWallet;

  const totalReserved = (curBudget.reserve || 0) + (curBudget.reserveOfReserve || 0) + (curBudget.wallet || 0);
  const totalWithdrawn = (curBudget.walletWithdrawals || 0) + (curBudget.emergencyWithdrawals || 0) + (curBudget.reserveWithdrawals || 0);
  const netReserves = totalReserved - totalWithdrawn;

  // Extract all historical withdrawals
  const allWithdrawals = React.useMemo(() => {
    return budgets.flatMap(b => {
      const w1 = (b.walletWithdrawalsDetails || []).map(w => ({ ...w, type: 'Carteira' as const, month: b.month }));
      const w2 = (b.emergencyWithdrawalsDetails || []).map(w => ({ ...w, type: 'Emergência' as const, month: b.month }));
      const w3 = (b.reserveWithdrawalsDetails || []).map(w => ({ ...w, type: 'Principal' as const, month: b.month }));
      return [...w1, ...w2, ...w3];
    }).sort((a, b) => b.date - a.date);
  }, [budgets]);


  // Calculate aggregated distributions up to activeMonth
  const aggregatedBanks: Record<string, { total: number; reserve: number; reserveOfReserve: number; wallet: number }> = {};
  for (let i = 1; i <= activeMonth; i++) {
     const b = getBudget(i);
     
     const initBank = (bank: string) => {
         if (!aggregatedBanks[bank]) aggregatedBanks[bank] = { total: 0, reserve: 0, reserveOfReserve: 0, wallet: 0 };
     };

     const sumBanks = (banks: Record<string, number> | undefined, singleBank: string | undefined, singleVal: number, key: 'reserve' | 'reserveOfReserve' | 'wallet') => {
         if (banks && Object.keys(banks).length > 0) {
            let explicitlyAllocated = 0;
            Object.entries(banks).forEach(([bank, amt]) => {
               initBank(bank);
               aggregatedBanks[bank].total += amt;
               aggregatedBanks[bank][key] += amt;
               explicitlyAllocated += amt;
            });
            // Handle unallocated reserves
            if (singleVal > explicitlyAllocated) {
               const unallocated = singleVal - explicitlyAllocated;
               initBank('Não Alocado');
               aggregatedBanks['Não Alocado'].total += unallocated;
               aggregatedBanks['Não Alocado'][key] += unallocated;
            }
         } else if (singleBank && singleVal) {
            initBank(singleBank);
            aggregatedBanks[singleBank].total += singleVal;
            aggregatedBanks[singleBank][key] += singleVal;
         } else if (singleVal > 0) {
            initBank('Não Alocado');
            aggregatedBanks['Não Alocado'].total += singleVal;
            aggregatedBanks['Não Alocado'][key] += singleVal;
         }
     };
     
     sumBanks(b.reserveBanks, b.reserveBank, (b.reserve || 0) - (b.reserveWithdrawals || 0), 'reserve');
     sumBanks(b.reserveOfReserveBanks, b.reserveOfReserveBank, (b.reserveOfReserve || 0) - (b.emergencyWithdrawals || 0), 'reserveOfReserve');
     sumBanks(b.walletBanks, b.walletBank, (b.wallet || 0) - (b.walletWithdrawals || 0), 'wallet');
  }

  const distributionData = Object.entries(aggregatedBanks)
    .filter(([_, data]) => data.total > 0)
    .map(([name, data]) => ({ name, ...data }))
    .sort((a, b) => b.total - a.total);

  return (
    <div className="space-y-6">
      {/* Top Header & Month Picker */}
      <div className="bg-white dark:bg-[#121214] border border-gray-200 dark:border-white/5 rounded-2xl p-4 sm:p-6 shadow-sm">
         <div className="flex flex-col lg:flex-row lg:items-center justify-between mb-6 gap-6">
             <div className="flex items-center gap-3">
                 <div className="w-12 h-12 rounded-xl bg-orange-500/10 flex items-center justify-center border border-orange-500/20">
                     <PiggyBank className="w-6 h-6 text-orange-500" />
                 </div>
                 <div>
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white leading-tight">Controle de Reservas</h2>
                    <div className="flex items-center gap-2">
                       <p className="text-sm text-gray-500 font-medium">Gestão de caixa e economias de {year}</p>
                       {isSaving && <span className="text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border border-emerald-500/20">Salvando...</span>}
                    </div>
                 </div>
             </div>
             
             <div className="w-full lg:w-72 mt-2 lg:mt-0 p-3 bg-gray-50 dark:bg-white/[0.02] border border-gray-200 dark:border-white/5 rounded-xl shadow-inner">
                <InputRow 
                    label="Renda Mensal do Mês" 
                    value={curBudget.salary} 
                    onChange={(val) => handleUpdate(activeMonth, 'salary', val)} 
                />
             </div>
         </div>

         <div className="flex overflow-x-auto gap-2 pb-2 hide-scrollbar mt-4 border-t border-gray-100 dark:border-white/5 pt-4">
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

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
         {/* Monthly Inputs */}
         <div className="xl:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Input Group: Saques */}
            <div className="bg-white dark:bg-[#121214] border border-gray-200 dark:border-white/5 rounded-2xl p-5 shadow-sm space-y-5 md:col-span-2">
               <div className="flex items-center gap-2 border-b border-gray-100 dark:border-white/5 pb-3">
                  <ArrowDownCircle className="w-4 h-4 text-red-500" />
                  <h3 className="text-sm font-bold uppercase tracking-wider text-gray-900 dark:text-gray-100">Saques & Retiradas</h3>
               </div>
               
               <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                   <WithdrawalsManager 
                      label="Saque Principal" 
                      withdrawals={curBudget.reserveWithdrawalsDetails || []} 
                      onChange={(withdrawals, total) => {
                          handleUpdate(activeMonth, 'reserveWithdrawalsDetails', withdrawals);
                          handleUpdate(activeMonth, 'reserveWithdrawals', total);
                      }} 
                      accValue={accReserveWithdrawals}
                      bankBreakdown={curBudget.reserveBanks}
                      onBankBreakdownChange={(val) => handleUpdate(activeMonth, 'reserveBanks', val)}
                   />
                   <WithdrawalsManager 
                      label="Saque Emergência" 
                      withdrawals={curBudget.emergencyWithdrawalsDetails || []} 
                      onChange={(withdrawals, total) => {
                          handleUpdate(activeMonth, 'emergencyWithdrawalsDetails', withdrawals);
                          handleUpdate(activeMonth, 'emergencyWithdrawals', total);
                      }} 
                      accValue={accEmergencyWithdrawals}
                      bankBreakdown={curBudget.reserveOfReserveBanks}
                      onBankBreakdownChange={(val) => handleUpdate(activeMonth, 'reserveOfReserveBanks', val)}
                   />
                   <WithdrawalsManager 
                      label="Saque Carteira" 
                      withdrawals={curBudget.walletWithdrawalsDetails || []} 
                      onChange={(withdrawals, total) => {
                          handleUpdate(activeMonth, 'walletWithdrawalsDetails', withdrawals);
                          handleUpdate(activeMonth, 'walletWithdrawals', total);
                      }} 
                      accValue={accWalletWithdrawals}
                      bankBreakdown={curBudget.walletBanks}
                      onBankBreakdownChange={(val) => handleUpdate(activeMonth, 'walletBanks', val)}
                   />
               </div>
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
                    bankValue={curBudget.reserveBank}
                    onBankChange={(val) => handleUpdate(activeMonth, 'reserveBank', val)}
                    bankBreakdown={curBudget.reserveBanks}
                    onBankBreakdownChange={(val) => handleUpdate(activeMonth, 'reserveBanks', val)}
                    activeMonth={activeMonth}
                 />
                 <InputRow 
                    label="Res. da Reserva" 
                    value={curBudget.reserveOfReserve} 
                    onChange={(val) => handleUpdate(activeMonth, 'reserveOfReserve', val)} 
                    accValue={accReserveOfReserve}
                    vertical
                    bankValue={curBudget.reserveOfReserveBank}
                    onBankChange={(val) => handleUpdate(activeMonth, 'reserveOfReserveBank', val)}
                    bankBreakdown={curBudget.reserveOfReserveBanks}
                    onBankBreakdownChange={(val) => handleUpdate(activeMonth, 'reserveOfReserveBanks', val)}
                    activeMonth={activeMonth}
                 />
                 <InputRow 
                    label="Carteira (Livre)" 
                    value={curBudget.wallet} 
                    onChange={(val) => handleUpdate(activeMonth, 'wallet', val)} 
                    accValue={netAccWallet}
                    vertical
                    bankValue={curBudget.walletBank}
                    onBankChange={(val) => handleUpdate(activeMonth, 'walletBank', val)}
                    bankBreakdown={curBudget.walletBanks}
                    onBankBreakdownChange={(val) => handleUpdate(activeMonth, 'walletBanks', val)}
                    activeMonth={activeMonth}
                 />
               </div>
            </div>

         </div>

         {/* Summary & Dashboard */}
         <div className="flex flex-col gap-6 lg:col-span-1 h-full">
             <div className="bg-white dark:bg-[#121214] border border-gray-200 dark:border-white/5 rounded-2xl shadow-sm flex flex-col relative overflow-hidden group h-full">
                 <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-orange-500 to-amber-500 z-10"></div>
                 
                  {/* Top section: Total Accumulation */}
                 <div className="p-6 border-b border-gray-100 dark:border-white/5 bg-gray-50/30 dark:bg-white/[0.01]">
                    <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest block mb-1">Total Acumulado (Até o momento)</span>
                    <span className={`text-4xl font-extrabold tracking-tight ${totalAcc >= 0 ? 'text-gray-900 dark:text-white' : 'text-red-500'}`}>
                       {totalAcc.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </span>
                    <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-gray-200/50 dark:border-white/5">
                        <div className="flex flex-col">
                            <span className="text-[9px] text-gray-500 font-bold uppercase tracking-widest leading-tight mb-0.5">Reserva<br/>Principal</span>
                            <span className="text-xs font-black text-emerald-600 dark:text-emerald-400">
                                {netAccReserve.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </span>
                        </div>
                        <div className="flex flex-col">
                            <span className="text-[9px] text-gray-500 font-bold uppercase tracking-widest leading-tight mb-0.5">Reserva da<br/>Reserva</span>
                            <span className="text-xs font-black text-amber-600 dark:text-amber-400">
                                {netAccReserveOfReserve.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </span>
                        </div>
                        <div className="flex flex-col">
                            <span className="text-[9px] text-gray-500 font-bold uppercase tracking-widest leading-tight mb-0.5">Carteira<br/>(Livre)</span>
                            <span className="text-xs font-black text-blue-600 dark:text-blue-400">
                                {netAccWallet.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </span>
                        </div>
                    </div>

                    {allWithdrawals.length > 0 && (
                        <div className="mt-4 pt-4 border-t border-gray-200/50 dark:border-white/5 flex flex-col gap-2">
                           <div className="flex items-center justify-between">
                              <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Histórico de Saques</span>
                           </div>
                           <div className="space-y-2 max-h-[150px] overflow-y-auto pr-1 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-gray-200 dark:[&::-webkit-scrollbar-thumb]:bg-white/10 group/list">
                               {allWithdrawals.slice(0, 10).map((w, idx) => (
                                   <div key={w.id + idx} className="flex justify-between items-start bg-white dark:bg-[#121214] border border-gray-100 dark:border-white/5 p-2 rounded-lg shadow-sm group/item">
                                      <div className="flex flex-col overflow-hidden min-w-0 pr-2">
                                          <span className="text-xs font-bold text-gray-700 dark:text-gray-300 truncate">{w.description}</span>
                                          <span className="text-[9px] font-medium text-gray-400 mt-0.5 whitespace-nowrap">
                                             <span className="text-red-500 font-bold">{w.type}</span> &bull; {w.bank ? `${w.bank} \u2022 ` : ''}{new Date(w.date).toLocaleDateString()}
                                          </span>
                                      </div>
                                      <div className="flex items-center gap-2">
                                         <span className="text-sm font-black text-red-500/90 whitespace-nowrap">
                                            -{w.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                         </span>
                                         {w.month === activeMonth && (
                                             <button 
                                                onClick={() => {
                                                    const fieldName = w.type === 'Carteira' ? 'walletWithdrawalsDetails' : (w.type === 'Principal' ? 'reserveWithdrawalsDetails' : 'emergencyWithdrawalsDetails');
                                                    const totalName = w.type === 'Carteira' ? 'walletWithdrawals' : (w.type === 'Principal' ? 'reserveWithdrawals' : 'emergencyWithdrawals');
                                                    const bankName = w.type === 'Carteira' ? 'walletBanks' : (w.type === 'Principal' ? 'reserveBanks' : 'reserveOfReserveBanks');
                                                    
                                                    const currentDetails = [...(curBudget[fieldName] || [])];
                                                    const currentTotal = curBudget[totalName] || 0;
                                                    const currentBanks = { ...(curBudget[bankName] || {}) };
                                                    
                                                    const updatedDetails = currentDetails.filter(x => x.id !== w.id);
                                                    const updatedTotal = currentTotal - w.amount;
                                                    
                                                    if (w.bank && currentBanks[w.bank]) {
                                                        currentBanks[w.bank] -= w.amount;
                                                        if (currentBanks[w.bank] <= 0) delete currentBanks[w.bank];
                                                    }
                                                    
                                                    handleUpdate(activeMonth, fieldName, updatedDetails);
                                                    handleUpdate(activeMonth, totalName, updatedTotal);
                                                    handleUpdate(activeMonth, bankName, currentBanks);
                                                }}
                                                className="text-gray-400 hover:text-red-500 opacity-0 group-hover/item:opacity-100 transition-opacity p-1 rounded hover:bg-red-50 dark:hover:bg-red-500/10 cursor-pointer"
                                             >
                                                <Trash2 className="w-3 h-3" />
                                             </button>
                                         )}
                                      </div>
                                   </div>
                               ))}
                           </div>
                        </div>
                    )}
                 </div>

                 {/* Middle section: Asset Allocation */}
                 <div className="flex-1 p-6 border-b border-gray-100 dark:border-white/5 flex flex-col max-h-[350px]">
                    <div className="flex items-center justify-between mb-5">
                        <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Onde está o dinheiro?</span>
                        <Landmark className="w-4 h-4 text-orange-500/80" />
                    </div>
                    
                    {distributionData.length > 0 ? (
                        <div className="space-y-3 overflow-y-auto pr-1 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-gray-200 dark:[&::-webkit-scrollbar-thumb]:bg-white/10 hover:[&::-webkit-scrollbar-thumb]:bg-gray-300 dark:hover:[&::-webkit-scrollbar-thumb]:bg-white/20">
                           {distributionData.map(entry => (
                              <div key={entry.name} className="flex flex-col gap-2 group/item bg-gray-50/80 dark:bg-white/[0.02] border border-gray-100 dark:border-white/5 p-3 rounded-xl hover:bg-gray-100 dark:hover:bg-white/[0.05] transition-colors">
                                  <div className="flex justify-between items-center">
                                      <div className="flex items-center gap-3">
                                          <div className="w-8 h-8 rounded-full bg-white dark:bg-[#121214] border border-gray-200 dark:border-white/10 flex items-center justify-center text-[10px] font-bold text-gray-400 group-hover/item:text-orange-500 transition-colors shadow-sm">
                                              {entry.name.substring(0,2).toUpperCase()}
                                          </div>
                                          <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">{entry.name}</span>
                                      </div>
                                      <span className="text-sm font-bold text-gray-900 dark:text-white">
                                          {entry.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                      </span>
                                  </div>
                                  {(entry.reserve > 0 && entry.reserve < entry.total) || (entry.reserveOfReserve > 0 && entry.reserveOfReserve < entry.total) || (entry.wallet > 0 && entry.wallet < entry.total) ? (
                                      <div className="grid grid-cols-3 gap-1 pt-2 border-t border-gray-200 dark:border-white/5">
                                          {entry.reserve > 0 && (
                                             <div className="flex flex-col">
                                                <span className="text-[8px] text-gray-400 font-bold uppercase tracking-wider mb-0.5">Principal</span>
                                                <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                                                   {entry.reserve.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                                </span>
                                             </div>
                                          )}
                                          {entry.reserveOfReserve > 0 && (
                                             <div className="flex flex-col">
                                                <span className="text-[8px] text-gray-400 font-bold uppercase tracking-wider mb-0.5">Res. Reserva</span>
                                                <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400">
                                                   {entry.reserveOfReserve.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                                </span>
                                             </div>
                                          )}
                                          {entry.wallet > 0 && (
                                             <div className="flex flex-col">
                                                <span className="text-[8px] text-gray-400 font-bold uppercase tracking-wider mb-0.5">Carteira</span>
                                                <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400">
                                                   {entry.wallet.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                                </span>
                                             </div>
                                          )}
                                      </div>
                                  ) : null}
                              </div>
                           ))}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center flex-1 text-center py-6">
                            <span className="text-xs text-gray-400 max-w-[200px]">Nenhum valor associado a bancos até o momento.</span>
                        </div>
                    )}
                 </div>

                 {/* Bottom section: Current Month Summary */}
                 <div className="p-6 bg-gray-50/30 dark:bg-[#121214]">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-4 w-full text-left">Resumo do Mês ({new Date(0, activeMonth - 1).toLocaleString('pt-BR', { month: 'short' }).toUpperCase()})</h3>
                    <div className="space-y-3">
                       <div className="flex justify-between items-center border-b border-gray-100 dark:border-white/5 pb-2">
                          <span className="text-sm text-gray-500 font-medium">Fluxo Adicionado</span>
                          <span className="text-sm font-bold text-blue-500/90">+{totalReserved.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                       </div>
                       <div className="flex justify-between items-center border-b border-gray-100 dark:border-white/5 pb-2">
                          <span className="text-sm text-gray-500 font-medium">Fluxo Utilizado</span>
                          <span className="text-sm font-bold text-red-500/90">-{totalWithdrawn.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                       </div>
                       <div className="pt-1 flex justify-between items-center">
                          <span className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Líquido do Mês</span>
                          <span className={`text-base font-extrabold ${netReserves >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                             {netReserves >= 0 ? '+' : ''}{netReserves.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                          </span>
                       </div>
                       
                       <div className="mt-4 pt-4 border-t border-gray-100 dark:border-white/5 w-full">
                          <div className="bg-white dark:bg-white/[0.02] border border-gray-200 dark:border-white/5 rounded-xl p-3 flex items-center justify-between shadow-sm">
                             <span className="text-[10px] uppercase font-bold text-gray-500 whitespace-nowrap">Taxa de Poupança</span>
                             <span className="text-sm font-bold text-gray-900 dark:text-white">
                                {curBudget.salary > 0 ? ((totalReserved / curBudget.salary) * 100).toFixed(1) + '%' : '0%'}
                             </span>
                          </div>
                       </div>
                    </div>
                 </div>
             </div>
         </div>
      </div>
    </div>
  );
}

function BreakdownInput({ bk, initialAmt, onAmountChange, onRemove }: { bk: string, initialAmt: number, onAmountChange: (bk: string, amt: string) => void, onRemove: (bk: string) => void }) {
  const [val, setVal] = React.useState(initialAmt.toString());
  
  React.useEffect(() => {
     setVal(initialAmt.toString());
  }, [initialAmt]);

  return (
    <div className="flex justify-between items-center bg-white dark:bg-[#121214] border border-gray-100 dark:border-white/5 p-3 rounded-xl group/item hover:border-gray-200 dark:hover:border-white/10 transition-colors shadow-sm">
        <span className="text-xs font-bold text-gray-700 dark:text-gray-300">{bk}</span>
        <div className="flex items-center gap-2">
           <div className="flex items-center gap-1 focus-within:border-b-orange-500 border-b border-transparent transition-colors pb-0.5">
              <span className="text-[10px] font-black text-gray-400">R$</span>
              <input
                 type="text"
                 inputMode="decimal"
                 className="w-20 bg-transparent text-right text-sm font-black text-gray-900 dark:text-white outline-none"
                 value={val}
                 onChange={(e) => setVal(e.target.value)}
                 onBlur={() => onAmountChange(bk, val)}
                 onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
              />
           </div>
           <button 
               onMouseDown={(e) => e.preventDefault()} 
               onClick={() => onRemove(bk)} 
               className="text-[10px] text-gray-400 hover:text-red-500 transition-colors opacity-100 sm:opacity-0 group-hover/item:opacity-100 w-6 h-6 flex items-center justify-center rounded-md hover:bg-red-50 dark:hover:bg-red-500/10"
           >✕</button>
        </div>
    </div>
  );
}

function InputRow({ 
  label, 
  value, 
  onChange, 
  vertical = false, 
  accValue, 
  bankValue, 
  onBankChange, 
  bankBreakdown,
  onBankBreakdownChange,
  activeMonth
}: { 
  label: string; 
  value: number; 
  onChange: (v: number) => void; 
  vertical?: boolean; 
  accValue?: number; 
  bankValue?: string; 
  onBankChange?: (v: string) => void; 
  bankBreakdown?: Record<string, number>;
  onBankBreakdownChange?: (newMap: Record<string, number>) => void;
  activeMonth?: number;
}) {
  const [localVal, setLocalVal] = useState<string>(value?.toString() || '');
  const [localBank, setLocalBank] = useState<string>(bankValue || '');
  const [localBankBreakdown, setLocalBankBreakdown] = useState<Record<string, number>>(bankBreakdown || {});
  const [newBankName, setNewBankName] = useState('');
  const [isAddingBank, setIsAddingBank] = useState(false);
  const [quickAction, setQuickAction] = useState<'add'|'sub'|null>(null);
  const [qaBank, setQaBank] = useState('');
  const [qaAmount, setQaAmount] = useState('');

  useEffect(() => {
     if (!document.activeElement?.className.includes(`input-${label.replace(/\s/g, '')}`)) {
        setLocalVal(value?.toString() || '');
     }
  }, [value, label]);

  useEffect(() => {
     if (!document.activeElement?.className.includes(`bank-${label.replace(/\s/g, '')}`)) {
        setLocalBank(bankValue || '');
     }
  }, [bankValue, label]);

  useEffect(() => {
     setLocalBankBreakdown(bankBreakdown || {});
  }, [bankBreakdown]);

  const handleBlur = () => {
    const num = parseFloat(localVal.replace(',', '.'));
    if (!isNaN(num)) {
       onChange(num);
    } else {
       setLocalVal('0');
       onChange(0);
    }
  };

  const handleBankBlur = () => {
    if (onBankChange) {
       onBankChange(localBank);
    }
  };

  const handleBreakdownAmountChange = (bk: string, amtStr: string) => {
    if (!onBankBreakdownChange) return;
    const num = parseFloat(amtStr.replace(',', '.'));
    const validNum = isNaN(num) ? 0 : num;
    const newMap = { ...localBankBreakdown, [bk]: validNum };
    setLocalBankBreakdown(newMap);
    onBankBreakdownChange(newMap);
    
    // Auto-update total
    const newTotal = Object.values(newMap).reduce((acc, curr) => acc + curr, 0);
    onChange(newTotal);
    setLocalVal(newTotal.toString());
  };

  const handleRemoveBank = (bk: string) => {
    if (!onBankBreakdownChange) return;
    const newMap = { ...localBankBreakdown };
    delete newMap[bk];
    setLocalBankBreakdown(newMap);
    onBankBreakdownChange(newMap);
    
    // Auto-update total
    const newTotal = Object.values(newMap).reduce((acc, curr) => acc + curr, 0);
    onChange(newTotal);
    setLocalVal(newTotal.toString());
  };

  const addNewBank = () => {
    if (!newBankName.trim() || !onBankBreakdownChange) return;
    const mapToUse = localBankBreakdown;
    const newMap = { ...mapToUse, [newBankName.trim()]: 0 };
    setLocalBankBreakdown(newMap);
    onBankBreakdownChange(newMap);
    setNewBankName('');
    setIsAddingBank(false);
    
    if (onBankChange && !Object.keys(mapToUse).length) {
       onBankChange(''); // Clear single bank if migrating to breakdown
    }
  };

  const confirmQuickAction = () => {
     if (!qaBank.trim() || !qaAmount.trim() || !onBankBreakdownChange) return;
     // parse both comma and dot correctly
     const amt = parseFloat(qaAmount.replace(',', '.'));
     if (isNaN(amt) || amt <= 0) return;

     // normalize bank name to title case (e.g. "nubank" -> "Nubank")
     const rawBank = qaBank.trim();
     const normalizedBank = rawBank.charAt(0).toUpperCase() + rawBank.slice(1).toLowerCase();

     const mapToUse = localBankBreakdown;
     const currentAmt = mapToUse[normalizedBank] || 0;
     let finalAmt = currentAmt;
     let currentTotal = parseFloat(localVal) || 0;

     if (quickAction === 'add') {
         finalAmt += amt;
         currentTotal += amt;
     } else if (quickAction === 'sub') {
         finalAmt = Math.max(0, finalAmt - amt);
         currentTotal = Math.max(0, currentTotal - amt);
     }
     
     const newMap = { ...mapToUse, [normalizedBank]: finalAmt };
     if (finalAmt === 0) {
         delete newMap[normalizedBank];
     }
     
     setLocalBankBreakdown(newMap);
     setLocalVal(currentTotal.toString());
     onBankBreakdownChange(newMap);
     onChange(currentTotal);

     setQuickAction(null);
     setQaBank('');
     setQaAmount('');
  };

  if (onBankBreakdownChange) {
      const isMapEmpty = !localBankBreakdown || Object.keys(localBankBreakdown).length === 0;

      return (
        <div className="flex flex-col gap-4 w-full h-full">
            <div className="flex justify-between items-start w-full">
                <div className="flex flex-col gap-1">
                   <span className="text-sm font-bold text-gray-900 dark:text-gray-100">{label}</span>
                   {accValue !== undefined && (
                      <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                        Total: {accValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </span>
                   )}
                </div>
                <div className="flex flex-col items-end">
                   {activeMonth && <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-0.5 mt-1">Ref. {new Date(0, activeMonth - 1).toLocaleString('pt-BR', { month: 'short' })}</span>}
                </div>
            </div>

            <div className="flex justify-between items-end">
                <div className="flex flex-col">
                   <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-1">Adicionado neste mês</span>
                   <span className="text-2xl font-black text-blue-500/90 tracking-tight">
                        {(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                   </span>
                </div>
                {!quickAction && (
                   <button onClick={() => setQuickAction('add')} className="bg-gray-100 dark:bg-white/[0.05] text-gray-700 dark:text-white font-bold text-[10px] uppercase tracking-wider px-3 py-2 rounded-lg hover:bg-orange-500 hover:text-white transition-colors border border-gray-200 dark:border-white/10">
                      + Lançar
                   </button>
                )}
            </div>

            {quickAction && (
               <div className="w-full bg-gray-50/50 dark:bg-white/[0.01] border border-gray-100 dark:border-white/5 rounded-xl p-4 flex flex-col gap-3 mt-1 shadow-sm">
                   <div className="flex justify-between items-center mb-1">
                       <span className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                           Novo Lançamento
                       </span>
                       <button onClick={() => { setQuickAction(null); setQaBank(''); setQaAmount(''); }} className="text-gray-400 hover:text-red-500 transition-colors text-xs font-bold">Cancelar</button>
                   </div>
                   
                   <div className="flex gap-2">
                       <button onClick={() => setQuickAction('add')} className={`flex-1 border border-transparent py-1.5 rounded-lg text-[10px] font-bold tracking-wider transition-colors ${quickAction==='add' ? 'bg-emerald-500 text-white shadow-sm' : 'bg-gray-200 dark:bg-white/10 text-gray-500 dark:text-gray-400 hover:bg-gray-300 dark:hover:bg-white/20'}`}>ENTRADA</button>
                       <button onClick={() => setQuickAction('sub')} className={`flex-1 border border-transparent py-1.5 rounded-lg text-[10px] font-bold tracking-wider transition-colors ${quickAction==='sub' ? 'bg-red-500 text-white shadow-sm' : 'bg-gray-200 dark:bg-white/10 text-gray-500 dark:text-gray-400 hover:bg-gray-300 dark:hover:bg-white/20'}`}>SAÍDA</button>
                   </div>

                   <div className="flex flex-col gap-2 mt-1">
                      <div className={`w-full bg-white dark:bg-[#121214] border border-gray-200 dark:border-white/10 rounded-lg px-3 py-2 flex items-center shadow-sm transition-colors h-10 ${quickAction === 'sub' ? 'focus-within:border-red-500/50' : 'focus-within:border-emerald-500/50'}`}>
                         <span className={`${quickAction === 'sub' ? 'text-red-500' : 'text-emerald-500'} text-xs font-black mr-2`}>R$</span>
                         <input 
                            type="text" 
                            inputMode="decimal"
                            placeholder="0.00" 
                            className="w-full bg-transparent text-sm font-bold text-gray-900 dark:text-white outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none h-full"
                            value={qaAmount}
                            onChange={(e) => setQaAmount(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') confirmQuickAction(); }}
                         />
                      </div>

                      <div className="flex gap-2 items-center">
                         <input 
                            type="text" 
                            placeholder={quickAction === 'sub' ? "Retirar de qual conta/banco?" : "Adicionar a qual conta/banco?"} 
                            className={`flex-1 bg-white dark:bg-[#121214] border border-gray-200 dark:border-white/10 rounded-lg px-3 py-2 text-sm font-semibold text-gray-700 dark:text-gray-200 outline-none shadow-sm transition-colors h-10 ${quickAction === 'sub' ? 'focus:border-red-500/50' : 'focus:border-emerald-500/50'}`}
                            value={qaBank}
                            onChange={(e) => setQaBank(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') confirmQuickAction(); }}
                         />
                         <button onClick={confirmQuickAction} disabled={!qaBank.trim() || !qaAmount.trim()} className={`${quickAction === 'sub' ? 'bg-red-500 hover:bg-red-600 disabled:hover:bg-red-500' : 'bg-emerald-500 hover:bg-emerald-600 disabled:hover:bg-emerald-500'} text-white text-[11px] font-bold px-4 py-0 rounded-lg disabled:opacity-50 shadow-sm transition-colors uppercase tracking-wider h-10 flex-shrink-0`}>Salvar</button>
                      </div>

                       <div className="flex flex-wrap gap-1.5">
                           {['Nubank', 'C6', 'Inter', 'Itaú', 'XP'].map(b => (
                               <button 
                                   key={b} 
                                   onClick={() => setQaBank(b)}
                                   className={`text-[10px] font-bold uppercase tracking-wider border rounded px-2.5 py-1 transition-colors shadow-sm ${qaBank === b ? (quickAction === 'sub' ? 'bg-red-50 border-red-200 text-red-600 dark:bg-red-500/10 dark:border-red-500/20 dark:text-red-400' : 'bg-emerald-50 border-emerald-200 text-emerald-600 dark:bg-emerald-500/10 dark:border-emerald-500/20 dark:text-emerald-400') : `bg-white dark:bg-white/5 border-gray-200 dark:border-white/10 text-gray-500 ${quickAction === 'sub' ? 'hover:border-red-500 hover:text-red-500' : 'hover:border-emerald-500 hover:text-emerald-500'}`}`}
                               >
                                   {b}
                               </button>
                           ))}
                       </div>
                   </div>
               </div>
            )}

            {!isMapEmpty && (
                <div className="mt-2 w-full flex flex-col gap-2">
                   <span className="text-[10px] text-gray-400 uppercase tracking-widest font-bold mb-1">Divisão no mês</span>
                   <div className="space-y-2">
                   {Object.entries(localBankBreakdown).map(([bk, amt]) => (
                       <BreakdownInput 
                          key={bk} 
                          bk={bk} 
                          initialAmt={amt} 
                          onAmountChange={handleBreakdownAmountChange} 
                          onRemove={handleRemoveBank} 
                       />
                   ))}
                   </div>
                </div>
            )}
        </div>
      );
  }

  // Simple Mode (for Salary)
  return (
    <div className="flex flex-col gap-2 w-full">
        <div className="flex justify-between items-center">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">{label}</span>
        </div>
        <div className="flex items-center gap-2 bg-white dark:bg-[#121214] border border-gray-200 dark:border-white/10 rounded-xl px-4 py-2.5 transition-colors focus-within:border-emerald-500/50 focus-within:bg-emerald-500/5 w-full shadow-sm">
            <span className="text-emerald-500 text-sm font-bold">R$</span>
            <input 
               type="text"
               inputMode="decimal"
               className={`input-${label.replace(/\s/g, '')} bg-transparent w-full text-right text-lg font-bold text-gray-900 dark:text-white outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`}
               value={localVal}
               onChange={(e) => setLocalVal(e.target.value)}
               onBlur={handleBlur}
               onKeyDown={(e) => {
                  if (e.key === 'Enter') e.currentTarget.blur();
               }}
               placeholder="0.00"
            />
        </div>
    </div>
  );
}



