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
    <div className="flex flex-col gap-3 w-full h-full font-sans">
        <div className="flex justify-between items-start w-full border-b border-gray-100 dark:border-white/5 pb-2">
            <div className="flex flex-col gap-0.5">
               <span className="text-xs font-bold text-gray-800 dark:text-gray-200">{label}</span>
               {accValue !== undefined && (
                   <span className="text-[10px] text-gray-500 dark:text-gray-400">
                     Acumulado: {accValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                   </span>
               )}
            </div>
            <div className="flex flex-col items-end">
               <span className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">No Mês</span>
               <span className="text-sm font-bold font-mono text-gray-900 dark:text-white">
                    {total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
               </span>
            </div>
        </div>
        
        <div className="flex flex-col gap-2.5 bg-gray-50 dark:bg-[#0A0A0B] border border-gray-100 dark:border-white/5 rounded-xl p-3">
            <span className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 flex items-center justify-between">
                {editingId ? 'Editar Retirada' : 'Adicionar Retirada'}
                {editingId && <button onClick={() => { setEditingId(null); setDesc(''); setAmountStr(''); setBank(''); }} className="text-indigo-500 hover:underline">Cancelar</button>}
            </span>
            
            <div className="flex flex-col gap-2">
                <input 
                   type="text" 
                   placeholder="Descrição da retirada (Ex: Manutenção)" 
                   className="w-full bg-white dark:bg-[#121214] border border-gray-200 dark:border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-gray-900 dark:text-white outline-none focus:border-indigo-500 transition-colors h-8"
                   value={desc}
                   onChange={(e) => setDesc(e.target.value)}
                />
                
                <div className="w-full bg-white dark:bg-[#121214] border border-gray-200 dark:border-white/10 rounded-lg px-2.5 flex items-center h-8">
                   <span className="text-gray-400 text-xs font-mono font-medium mr-1.5">R$</span>
                   <input 
                      type="text" 
                      inputMode="decimal" 
                      placeholder="0.00" 
                      className="w-full bg-transparent text-xs font-mono font-bold text-gray-900 dark:text-white outline-none h-full"
                      value={amountStr}
                      onChange={(e) => setAmountStr(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleSave() }}
                   />
                </div>
                
                <div className="flex gap-1.5 items-center">
                   <input 
                      type="text" 
                      placeholder="Banco / Instituição" 
                      className="flex-1 min-w-0 bg-white dark:bg-[#121214] border border-gray-200 dark:border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-gray-900 dark:text-white outline-none focus:border-indigo-500 transition-colors h-8"
                      value={bank}
                      onChange={(e) => setBank(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleSave() }}
                   />
                   <button 
                     onClick={handleSave} 
                     disabled={!desc.trim() || !amountStr.trim() || !bank.trim()}
                     className="h-8 px-2.5 flex-shrink-0 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg flex items-center justify-center disabled:opacity-40 transition-colors cursor-pointer text-xs font-medium gap-1"
                   >
                     {editingId ? <PencilLine className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                     <span>{editingId ? 'Salvar' : 'Adicionar'}</span>
                   </button>
                </div>
                
                <div className="flex flex-wrap gap-1 mt-0.5">
                   {['Nubank', 'C6', 'Inter', 'Itaú', 'XP'].map(b => (
                       <button 
                           key={b} 
                           onClick={() => setBank(b)}
                           className={`text-[10px] font-medium px-2 py-0.5 rounded-md transition-colors ${bank === b ? 'bg-indigo-500 text-white' : 'bg-gray-200/60 dark:bg-white/5 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-white/10'}`}
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
