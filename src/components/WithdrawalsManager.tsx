import React, { useState } from 'react';
import { Withdrawal } from '../types';
import { Plus, Trash2, PencilLine } from 'lucide-react';

interface Props {
  label: string;
  withdrawals: Withdrawal[];
  onChange: (withdrawals: Withdrawal[], total: number) => void;
  accValue?: number;
  bankBreakdown?: Record<string, number>;
  onBankBreakdownChange?: (newMap: Record<string, number>) => void;
}

export function WithdrawalsManager({ label, withdrawals, onChange, accValue, bankBreakdown, onBankBreakdownChange }: Props) {
  const [desc, setDesc] = useState('');
  const [amountStr, setAmountStr] = useState('');
  const [bank, setBank] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);

  const total = withdrawals.reduce((sum, w) => sum + w.amount, 0);

  const updateBreakdown = (oldW?: Withdrawal, newW?: Withdrawal) => {
    if (!bankBreakdown || !onBankBreakdownChange) return;
    const mapToUse = { ...bankBreakdown };
    
    // Revert old
    if (oldW && oldW.bank) {
        const rawBank = oldW.bank.trim();
        const norm = rawBank.charAt(0).toUpperCase() + rawBank.slice(1).toLowerCase();
        mapToUse[norm] = (mapToUse[norm] || 0) + oldW.amount;
    }
    
    // Apply new
    if (newW && newW.bank) {
        const rawBank = newW.bank.trim();
        const norm = rawBank.charAt(0).toUpperCase() + rawBank.slice(1).toLowerCase();
        mapToUse[norm] = Math.max(0, (mapToUse[norm] || 0) - newW.amount);
    }
    
    onBankBreakdownChange(mapToUse);
  };

  const handleSave = () => {
    if (!desc.trim() || !amountStr.trim() || !bank.trim()) return;
    const num = parseFloat(amountStr.replace(',', '.'));
    if (isNaN(num) || num <= 0) return;

    if (editingId) {
      const oldW = withdrawals.find(w => w.id === editingId);
      const newW = { ...(oldW as Withdrawal), description: desc.trim(), amount: num, bank: bank.trim() };
      const updated = withdrawals.map(w => w.id === editingId ? newW : w);
      onChange(updated, updated.reduce((sum, w) => sum + w.amount, 0));
      updateBreakdown(oldW, newW);
      setEditingId(null);
    } else {
      const nw: Withdrawal = {
        id: Date.now().toString() + Math.random().toString(36).substring(2, 7),
        description: desc.trim(),
        amount: num,
        date: Date.now(),
        bank: bank.trim()
      };
      const nwList = [...withdrawals, nw];
      onChange(nwList, nwList.reduce((sum, w) => sum + w.amount, 0));
      updateBreakdown(undefined, nw);
    }
    setDesc('');
    setAmountStr('');
    setBank('');
  };

  return (
    <div className="flex flex-col gap-4 w-full h-full">
        <div className="flex justify-between items-start w-full">
            <div className="flex flex-col gap-1">
               <span className="text-sm font-bold text-gray-900 dark:text-gray-100">{label}</span>
               {accValue !== undefined && (
                   <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                     Total Acumulado: {accValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                   </span>
               )}
            </div>
            <div className="flex flex-col items-end">
               <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-0.5">Total no Mês</span>
               <span className="text-xl font-black text-red-500/90 tracking-tight">
                    {total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
               </span>
            </div>
        </div>
        
        <div className="flex flex-col gap-3 mt-1 bg-gray-50/50 dark:bg-white/[0.01] border border-gray-100 dark:border-white/5 rounded-xl p-4">
            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest flex items-center justify-between">
                {editingId ? 'Editar Retirada' : 'Adicionar Retirada'}
                {editingId && <button onClick={() => { setEditingId(null); setDesc(''); setAmountStr(''); setBank(''); }} className="text-blue-500 hover:text-blue-600 transition-colors">Cancelar</button>}
            </span>
            
            <div className="flex flex-col gap-2">
                <input 
                   type="text" 
                   placeholder="Descrição da retirada (Ex: Lanche, Luz)" 
                   className="w-full bg-white dark:bg-[#121214] border border-gray-200 dark:border-white/10 rounded-lg px-3 py-2 text-sm font-semibold text-gray-700 dark:text-gray-200 outline-none focus:border-red-500/50 transition-colors h-10 shadow-sm"
                   value={desc}
                   onChange={(e) => setDesc(e.target.value)}
                />
                
                <div className="w-full bg-white dark:bg-[#121214] border border-gray-200 dark:border-white/10 rounded-lg px-3 flex items-center focus-within:border-red-500/50 transition-colors h-10 shadow-sm">
                   <span className="text-red-500 text-xs font-black mr-2">R$</span>
                   <input 
                      type="text" 
                      inputMode="decimal"
                      placeholder="0.00" 
                      className="w-full bg-transparent text-sm font-bold text-gray-900 dark:text-white outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none h-full"
                      value={amountStr}
                      onChange={(e) => setAmountStr(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleSave() }}
                   />
                </div>
                
                <div className="flex gap-2 items-center">
                   <input 
                      type="text" 
                      placeholder="De qual banco/conta?" 
                      className="flex-1 min-w-0 bg-white dark:bg-[#121214] border border-gray-200 dark:border-white/10 rounded-lg px-3 py-2 text-sm font-semibold text-gray-700 dark:text-gray-200 outline-none focus:border-red-500/50 transition-colors h-10 shadow-sm"
                      value={bank}
                      onChange={(e) => setBank(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleSave() }}
                   />
                   <button 
                     onClick={handleSave} 
                     disabled={!desc.trim() || !amountStr.trim() || !bank.trim()}
                     className="w-10 h-10 flex-shrink-0 bg-red-500 text-white flex items-center justify-center rounded-lg hover:bg-red-600 disabled:opacity-50 disabled:hover:bg-red-500 transition-colors shadow-sm cursor-pointer"
                   >
                     {editingId ? <PencilLine className="w-4 h-4" /> : <Plus className="w-5 h-5" />}
                   </button>
                </div>
                
                <div className="flex flex-wrap gap-1.5 mt-0.5">
                   {['Nubank', 'C6', 'Inter', 'Itaú', 'XP'].map(b => (
                       <button 
                           key={b} 
                           onClick={() => setBank(b)}
                           className={`text-[10px] font-bold uppercase tracking-wider border rounded px-2.5 py-1 transition-colors shadow-sm ${bank === b ? 'bg-red-50 border-red-200 text-red-600 dark:bg-red-500/10 dark:border-red-500/20 dark:text-red-400' : 'bg-white dark:bg-white/5 border-gray-200 dark:border-white/10 hover:border-red-500 hover:text-red-500 text-gray-500'}`}
                       >
                           {b}
                       </button>
                   ))}
                </div>
            </div>
        </div>
    </div>
  );
}
