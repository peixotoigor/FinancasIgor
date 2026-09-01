const fs = require('fs');
let content = fs.readFileSync('src/components/MonthlyPlanning.tsx', 'utf-8');

const plannedFormMatch = `<form onSubmit={handleAddPlanned} className="flex gap-2 mb-2">
                 <input
                   type="text"
                   placeholder="Ex: Presente Aniversário"
                   value={plannedDesc}
                   onChange={(e) => setPlannedDesc(e.target.value)}
                   className="flex-1 bg-white dark:bg-[#1A1A1D] border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2 text-sm outline-none focus:border-indigo-500 dark:focus:border-indigo-500 transition-colors"
                   required
                 />
                 <div className="relative w-[110px] sm:w-[130px]">
                   <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm font-medium">R$</span>
                   <input
                     type="text"
                     placeholder="0,00"
                     value={plannedAmt}
                     onChange={(e) => setPlannedAmt(formatAmountInput(e.target.value))}
                     className="w-full bg-white dark:bg-[#1A1A1D] border border-gray-200 dark:border-white/10 rounded-xl pl-8 pr-2 py-2 text-sm font-mono outline-none focus:border-indigo-500 dark:focus:border-indigo-500 transition-colors"
                     required
                   />
                 </div>
                 {editingPlannedId && (
                   <button
                     type="button"
                     onClick={cancelEditPlanned}
                     className="bg-gray-100 dark:bg-white/10 hover:bg-gray-200 dark:hover:bg-white/20 text-gray-600 dark:text-gray-400 p-2 rounded-xl transition-colors shrink-0"
                     title="Cancelar Edição"
                   >
                     <X className="w-5 h-5" />
                   </button>
                 )}
                 <button
                   type="submit"
                   disabled={isSaving || !plannedDesc || !plannedAmt}
                   className="bg-indigo-500 hover:bg-indigo-600 text-white p-2 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                   title={editingPlannedId ? "Salvar Edição" : "Adicionar Gasto Previsto"}
                 >
                   {editingPlannedId ? <PencilLine className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
                 </button>  </form>`;

const plannedFormReplace = `<form onSubmit={handleAddPlanned} className="flex flex-col gap-2 mb-2">
                 <div className="flex gap-2">
                   <input
                     type="text"
                     placeholder="Ex: Presente Aniversário"
                     value={plannedDesc}
                     onChange={(e) => setPlannedDesc(e.target.value)}
                     className="flex-1 bg-white dark:bg-[#1A1A1D] border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2 text-sm outline-none focus:border-indigo-500 dark:focus:border-indigo-500 transition-colors"
                     required
                   />
                   <div className="relative w-[110px] sm:w-[130px]">
                     <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm font-medium">R$</span>
                     <input
                       type="text"
                       placeholder="0,00"
                       value={plannedAmt}
                       onChange={(e) => setPlannedAmt(formatAmountInput(e.target.value))}
                       className="w-full bg-white dark:bg-[#1A1A1D] border border-gray-200 dark:border-white/10 rounded-xl pl-8 pr-2 py-2 text-sm font-mono outline-none focus:border-indigo-500 dark:focus:border-indigo-500 transition-colors"
                       required
                     />
                   </div>
                   {editingPlannedId && (
                     <button
                       type="button"
                       onClick={cancelEditPlanned}
                       className="bg-gray-100 dark:bg-white/10 hover:bg-gray-200 dark:hover:bg-white/20 text-gray-600 dark:text-gray-400 p-2 rounded-xl transition-colors shrink-0"
                       title="Cancelar Edição"
                     >
                       <X className="w-5 h-5" />
                     </button>
                   )}
                   <button
                     type="submit"
                     disabled={isSaving || !plannedDesc || !plannedAmt}
                     className="bg-indigo-500 hover:bg-indigo-600 text-white p-2 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                     title={editingPlannedId ? "Salvar Edição" : "Adicionar Gasto Previsto"}
                   >
                     {editingPlannedId ? <PencilLine className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
                   </button>
                 </div>
                 <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                   <select value={plannedCategory} onChange={(e) => setPlannedCategory(e.target.value)} className="bg-white dark:bg-[#1A1A1D] border border-gray-200 dark:border-white/10 rounded-xl px-2 py-1.5 text-[10px] text-gray-700 dark:text-gray-300 outline-none focus:border-indigo-500 transition-colors">
                     <option value="">Sem categoria</option>
                     {userSettings?.categories?.map(c => <option key={c} value={c}>{c}</option>)}
                   </select>
                   <select value={plannedPaymentMethod} onChange={(e) => setPlannedPaymentMethod(e.target.value)} className="bg-white dark:bg-[#1A1A1D] border border-gray-200 dark:border-white/10 rounded-xl px-2 py-1.5 text-[10px] text-gray-700 dark:text-gray-300 outline-none focus:border-indigo-500 transition-colors">
                     <option value="">Sem método</option>
                     <option value="Crédito">Crédito</option>
                     <option value="Pix">Pix</option>
                     <option value="Débito">Débito</option>
                     <option value="Dinheiro">Dinheiro</option>
                   </select>
                   {(plannedPaymentMethod === 'Crédito' || plannedPaymentMethod === 'Débito') && (
                     <select value={plannedCard} onChange={(e) => setPlannedCard(e.target.value)} className="bg-white dark:bg-[#1A1A1D] border border-gray-200 dark:border-white/10 rounded-xl px-2 py-1.5 text-[10px] text-gray-700 dark:text-gray-300 outline-none focus:border-indigo-500 transition-colors">
                       <option value="">Sem cartão</option>
                       {userSettings?.cards?.map(c => <option key={c} value={c}>{c}</option>)}
                     </select>
                   )}
                   <input type="text" placeholder="Conta (ex: Nubank)" value={plannedAccount} onChange={(e) => setPlannedAccount(e.target.value)} className="bg-white dark:bg-[#1A1A1D] border border-gray-200 dark:border-white/10 rounded-xl px-2 py-1.5 text-[10px] text-gray-700 dark:text-gray-300 outline-none focus:border-indigo-500 transition-colors placeholder:text-gray-500" />
                 </div>
               </form>`;

content = content.replace(plannedFormMatch, plannedFormReplace);
fs.writeFileSync('src/components/MonthlyPlanning.tsx', content, 'utf-8');
console.log('patched');
