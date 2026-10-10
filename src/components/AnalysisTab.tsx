import React, { useMemo, useState } from 'react';
import { Transaction } from '../types';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, ComposedChart, Line, Legend 
} from 'recharts';
import { AlertCircle, TrendingUp, TrendingDown, PieChart as PieChartIcon, BarChart3, Activity, PiggyBank } from 'lucide-react';

export function AnalysisTab({ transactions, currentYear, currentMonth }: { transactions: Transaction[], currentYear: number, currentMonth: number }) {
  const [barchartCategoryFilter, setBarchartCategoryFilter] = useState<string>('all');

  const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  const { 
    currentMonthIncome, 
    currentMonthExpense, 
    topCurrentExpenses,
    pieChartData,
    annualChartData,
    expenseCategoriesSet
  } = useMemo(() => {
     let cIncome = 0;
     let cExpense = 0;
     const cExpensesMap: Record<string, number> = {};
     const currentMonthTrs: Transaction[] = [];

     const monthsStr = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
     
     // Build annual map with basic structure
     const annualMap: Record<string, any>[] = Array.from({ length: 12 }).map((_, i) => ({
        name: monthsStr[i],
        SalarioReceita: 0,
     }));
     
     const categoriesSet = new Set<string>();

     for (let i = 0; i < transactions.length; i++) {
        const t = transactions[i];
        const dateObj = new Date(t.date);
        const y = dateObj.getFullYear();
        const m = dateObj.getMonth();

        if (y === currentYear) {
           if (t.type === 'income') {
              annualMap[m].SalarioReceita += t.amount;
           } else {
              const cat = t.category || 'Outros';
              annualMap[m][cat] = (annualMap[m][cat] || 0) + t.amount;
              categoriesSet.add(cat);
           }
        }

        if (y === currentYear && m === currentMonth - 1) {
           if (t.type === 'income') {
              cIncome += t.amount;
           } else {
              const cat = t.category || 'Outros';
              cExpense += t.amount;
              cExpensesMap[cat] = (cExpensesMap[cat] || 0) + t.amount;
              currentMonthTrs.push(t);
           }
        }
     }

     const pieData = Object.entries(cExpensesMap)
       .map(([name, value]) => ({ name, value }))
       .sort((a, b) => b.value - a.value);

     const topExp = currentMonthTrs.sort((a, b) => b.amount - a.amount).slice(0, 5);

     return {
        currentMonthIncome: cIncome,
        currentMonthExpense: cExpense,
        topCurrentExpenses: topExp,
        pieChartData: pieData,
        annualChartData: annualMap,
        expenseCategoriesSet: Array.from(categoriesSet)
     };
  }, [transactions, currentYear, currentMonth]);

  const COLORS = ['#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#6366f1', '#eab308', '#0ea5e9'];
  const percentageStr = currentMonthIncome > 0 ? ((currentMonthExpense / currentMonthIncome) * 100).toFixed(1) : '0';
  const percentage = parseFloat(percentageStr);
  const isAlert = percentage >= 80;

  return (
    <div className="space-y-6 pb-20 max-w-7xl mx-auto w-full font-sans">
       <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white dark:bg-[#121214] p-5 sm:p-6 rounded-2xl border border-gray-200 dark:border-white/5 shadow-sm">
          <div>
             <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">Gráficos & Análises</h2>
             <p className="text-gray-500 dark:text-gray-400 text-xs sm:text-sm mt-0.5">Visão consolidada de histórico, distribuição de gastos e sazonalidade.</p>
          </div>
       </div>

       {/* Monthly Summary Report */}
       <div className="p-6 rounded-2xl border border-gray-200 dark:border-white/5 bg-white dark:bg-[#121214] shadow-sm">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-6">
             <div className="flex items-center gap-2">
                 <Activity className="w-5 h-5 text-emerald-500" />
                 <h3 className="text-sm sm:text-base font-bold text-gray-900 dark:text-white">
                    Resumo do Mês • {currentMonth}/{currentYear}
                 </h3>
             </div>
             <div className="flex items-center gap-3">
                 <span className="text-sm font-semibold text-gray-500 dark:text-gray-400 font-mono">{percentageStr}% da renda consumida</span>
                 {isAlert && <span className="px-2.5 py-1 bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 text-xs font-semibold rounded-full border border-rose-200 dark:border-rose-500/20">Atenção &gt;80%</span>}
             </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
             <div className="bg-gray-50 dark:bg-[#0A0A0B] p-4 rounded-xl border border-gray-100 dark:border-white/5">
                <div className="text-xs text-gray-500 dark:text-gray-400 mb-1 flex items-center gap-1.5"><TrendingUp className="w-3.5 h-3.5 text-emerald-500" /> Total Receitas</div>
                <div className="text-xl font-bold font-mono text-gray-900 dark:text-white truncate">{formatCurrency(currentMonthIncome)}</div>
             </div>
             <div className="bg-gray-50 dark:bg-[#0A0A0B] p-4 rounded-xl border border-gray-100 dark:border-white/5">
                <div className="text-xs text-gray-500 dark:text-gray-400 mb-1 flex items-center gap-1.5"><TrendingDown className="w-3.5 h-3.5 text-rose-500" /> Total Despesas</div>
                <div className="text-xl font-bold font-mono text-gray-900 dark:text-white truncate">{formatCurrency(currentMonthExpense)}</div>
             </div>
             <div className="bg-gray-50 dark:bg-[#0A0A0B] p-4 rounded-xl border border-gray-100 dark:border-white/5">
                <div className="text-xs text-gray-500 dark:text-gray-400 mb-1 flex items-center gap-1.5"><PiggyBank className="w-3.5 h-3.5 text-indigo-500" /> Economizado / Saldo</div>
                <div className={`text-xl font-bold font-mono truncate ${currentMonthIncome - currentMonthExpense >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>{formatCurrency(currentMonthIncome - currentMonthExpense)}</div>
             </div>
          </div>
          
          <div className="w-full bg-gray-100 dark:bg-white/5 h-3 rounded-full overflow-hidden mb-6">
             <div 
                className={`h-full rounded-full transition-all duration-300 ${isAlert ? 'bg-rose-500' : percentage >= 60 ? 'bg-amber-500' : 'bg-emerald-500'}`} 
                style={{ width: `${Math.min(percentage, 100)}%` }}
             ></div>
          </div>

          {topCurrentExpenses.length > 0 && (
             <div className="bg-gray-50 dark:bg-[#0A0A0B] rounded-xl p-4 border border-gray-100 dark:border-white/5 mt-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-3">Maiores Gastos do Mês</h4>
                <div className="space-y-3">
                   {topCurrentExpenses.map((t, i) => (
                      <div key={i} className="flex flex-col gap-1">
                         <div className="flex justify-between items-center text-xs">
                            <span className="font-medium text-gray-800 dark:text-gray-200 truncate pr-4">{t.description} <span className="text-gray-400 font-normal">({t.category})</span></span>
                            <span className="font-bold font-mono text-gray-900 dark:text-white shrink-0">{formatCurrency(t.amount)}</span>
                         </div>
                         <div className="w-full bg-gray-200 dark:bg-white/10 h-1.5 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-rose-500 rounded-full" 
                              style={{ width: `${Math.min((t.amount / currentMonthExpense) * 100, 100)}%` }}
                            ></div>
                         </div>
                      </div>
                   ))}
                </div>
             </div>
          )}
       </div>

       {/* Annual Mixed Chart */}
       <div className="bg-white dark:bg-[#121214] p-5 sm:p-6 rounded-2xl border border-gray-200 dark:border-white/5 shadow-sm">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-3">
             <div className="flex items-center gap-2">
                 <BarChart3 className="w-5 h-5 text-indigo-500" />
                 <h3 className="text-base font-bold text-gray-900 dark:text-white">Evolução Anual • {currentYear}</h3>
             </div>
             <select 
               value={barchartCategoryFilter}
               onChange={e => setBarchartCategoryFilter(e.target.value)}
               className="bg-gray-50 dark:bg-[#0A0A0B] border border-gray-200 dark:border-white/10 rounded-xl text-xs font-medium text-gray-800 dark:text-gray-200 px-3 py-2 outline-none cursor-pointer w-full sm:w-auto"
             >
               <option value="all">Todas as Categorias</option>
               {expenseCategoriesSet.map(c => <option key={c} value={c}>{c}</option>)}
             </select>
          </div>
          
          <div className="h-[400px] w-full">
             <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={annualChartData} margin={{ top: 20, right: 10, left: -10, bottom: 20 }}>
                   <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(156, 163, 175, 0.15)" />
                   <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#9ca3af' }} dy={10} />
                   <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#9ca3af' }} tickFormatter={(val) => `R$${val >= 1000 ? (val/1000).toFixed(0)+'k' : val}`} />
                   <RechartsTooltip 
                      contentStyle={{ backgroundColor: 'rgba(18, 18, 20, 0.95)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: '12px' }}
                      formatter={(value: number, name: string) => [formatCurrency(value), name]}
                   />
                   <Legend wrapperStyle={{ paddingTop: '15px', fontSize: '12px' }} />
                   
                   {expenseCategoriesSet
                      .filter(cat => barchartCategoryFilter === 'all' || cat === barchartCategoryFilter)
                      .map((cat, idx) => (
                      <Bar key={cat} dataKey={cat} stackId="a" fill={COLORS[expenseCategoriesSet.indexOf(cat) % COLORS.length]} radius={[2, 2, 0, 0]} maxBarSize={45} name={cat} />
                   ))}
                   
                   {barchartCategoryFilter === 'all' && (
                     <Line type="monotone" dataKey="SalarioReceita" name="Receita" stroke="#10b981" strokeWidth={2.5} dot={{ r: 4, strokeWidth: 2, fill: '#fff', stroke: '#10b981' }} />
                   )}
                </ComposedChart>
             </ResponsiveContainer>
          </div>
       </div>

       <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
         <div className="bg-white dark:bg-[#121214] p-5 sm:p-6 rounded-2xl border border-gray-200 dark:border-white/5 shadow-sm flex flex-col">
            <div className="flex items-center gap-2 mb-4">
                <PieChartIcon className="w-5 h-5 text-indigo-500" />
                <h3 className="text-base font-bold text-gray-900 dark:text-white">Distribuição por Categoria</h3>
            </div>
            {pieChartData.length > 0 ? (
              <div className="h-[280px] w-full flex justify-center relative">
                 <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                       <Pie
                          data={pieChartData}
                          cx="50%"
                          cy="50%"
                          innerRadius={65}
                          outerRadius={95}
                          paddingAngle={3}
                          dataKey="value"
                       >
                          {pieChartData.map((entry, index) => (
                             <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                       </Pie>
                       <RechartsTooltip 
                          formatter={(value: number, name: string) => [formatCurrency(value), name]}
                          contentStyle={{ backgroundColor: 'rgba(18, 18, 20, 0.95)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: '12px' }}
                       />
                    </PieChart>
                 </ResponsiveContainer>
                 <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-[11px] text-gray-400 font-medium">Total</span>
                    <span className="text-base font-bold text-gray-900 dark:text-white font-mono">{formatCurrency(currentMonthExpense)}</span>
                 </div>
              </div>
            ) : (
               <div className="h-[280px] flex items-center justify-center text-gray-400 text-xs">
                  Sem dados no mês selecionado
               </div>
            )}
         </div>
         
         <div className="bg-white dark:bg-[#121214] p-5 sm:p-6 rounded-2xl border border-gray-200 dark:border-white/5 shadow-sm flex flex-col">
            <div className="flex items-center gap-2 mb-4">
                <TrendingDown className="w-5 h-5 text-rose-500" />
                <h3 className="text-base font-bold text-gray-900 dark:text-white">Categorias em Destaque</h3>
            </div>
            {pieChartData.length > 0 ? (
               <div className="space-y-3 overflow-y-auto pr-1 flex-1">
                  {pieChartData.map((cat, i) => (
                    <div key={i} className="flex flex-col gap-1.5 p-3 rounded-xl bg-gray-50 dark:bg-[#0A0A0B] border border-gray-100 dark:border-white/5">
                       <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                             <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }}></div>
                             <span className="font-medium text-gray-800 dark:text-gray-200">{cat.name || 'Outras'}</span>
                          </div>
                          <span className="font-bold font-mono text-gray-900 dark:text-white">{formatCurrency(cat.value)}</span>
                       </div>
                       <div className="w-full bg-gray-200 dark:bg-white/10 h-1.5 rounded-full overflow-hidden">
                          <div 
                             className="h-full rounded-full" 
                             style={{ width: `${Math.min((cat.value / currentMonthExpense) * 100, 100)}%`, backgroundColor: COLORS[i % COLORS.length] }}
                          ></div>
                       </div>
                    </div>
                  ))}
               </div>
            ) : (
               <div className="flex-1 flex items-center justify-center text-gray-400 text-xs min-h-[250px]">
                  Nenhum gasto registrado.
               </div>
            )}
         </div>
       </div>
    </div>
  );
}
