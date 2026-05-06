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
    <div className="space-y-6 pb-20 fade-in max-w-7xl mx-auto w-full">
       <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white dark:bg-[#121214] p-6 rounded-2xl border border-gray-200 dark:border-white/5 shadow-sm">
          <div>
             <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2 tracking-tight">Gráficos & Análises</h2>
             <p className="text-gray-500 text-sm font-medium">Veja o detalhamento visual do seu histórico de despesas e receitas.</p>
          </div>
       </div>

       {/* Monthly Summary Report */}
       <div className={`p-6 rounded-2xl shadow-sm border transition-colors ${isAlert ? 'bg-red-50 dark:bg-red-500/5 border-red-500/20' : 'bg-white dark:bg-[#121214] border-gray-200 dark:border-white/5'}`}>
          <div className="flex justify-between items-center mb-6">
             <div className="flex items-center gap-2">
                 <Activity className={`w-5 h-5 ${isAlert ? 'text-red-500' : 'text-gray-400'}`} />
                 <h3 className={`text-sm font-bold uppercase tracking-wider ${isAlert ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'}`}>
                    Resumo do Mês ({currentMonth}/{currentYear})
                 </h3>
             </div>
             <div className="flex items-center gap-3">
                 <span className={`text-xl font-bold ${isAlert ? 'text-red-600 dark:text-red-500' : 'text-gray-900 dark:text-white'}`}>{percentageStr}% Gasto</span>
                 {isAlert && <span className="px-3 py-1 bg-red-500/10 text-red-600 dark:text-red-400 text-[10px] uppercase font-bold rounded-lg tracking-wider border border-red-500/20 shadow-sm whitespace-nowrap">Alerta de Gastos</span>}
             </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
             <div className="bg-white dark:bg-black/20 p-4 rounded-xl border border-gray-200 dark:border-white/5 w-full flex flex-col justify-center">
                <div className="text-[10px] text-gray-500 uppercase font-bold tracking-wider mb-2 flex items-center gap-1.5"><TrendingUp className="w-3.5 h-3.5 text-emerald-500" /> Renda Total</div>
                <div className="text-3xl font-bold text-gray-900 dark:text-white">{formatCurrency(currentMonthIncome)}</div>
             </div>
             <div className="bg-white dark:bg-black/20 p-4 rounded-xl border border-gray-200 dark:border-white/5 w-full flex flex-col justify-center">
                <div className="text-[10px] text-gray-500 uppercase font-bold tracking-wider mb-2 flex items-center gap-1.5"><TrendingDown className="w-3.5 h-3.5 text-red-500" /> Gastos Totais</div>
                <div className="text-3xl font-bold text-gray-900 dark:text-white">{formatCurrency(currentMonthExpense)}</div>
             </div>
             <div className="bg-white dark:bg-black/20 p-4 rounded-xl border border-gray-200 dark:border-white/5 w-full flex flex-col justify-center">
                <div className="text-[10px] text-gray-500 uppercase font-bold tracking-wider mb-2 flex items-center gap-1.5"><PiggyBank className="w-3.5 h-3.5 text-blue-500" /> Economizado (Livre)</div>
                <div className={`text-3xl font-bold ${currentMonthIncome - currentMonthExpense >= 0 ? 'text-blue-500 dark:text-blue-400' : 'text-red-500'}`}>{formatCurrency(currentMonthIncome - currentMonthExpense)}</div>
             </div>
          </div>
          
          <div className="w-full bg-gray-200 dark:bg-white/10 h-3 rounded-full overflow-hidden shadow-inner mb-6">
             <div 
                className={`h-full rounded-full transition-all duration-1000 ${isAlert ? 'bg-red-500' : 'bg-emerald-500'}`} 
                style={{ width: `${Math.min(percentage, 100)}%` }}
             ></div>
          </div>

          {topCurrentExpenses.length > 0 && (
             <div className="bg-white dark:bg-black/20 rounded-xl border border-gray-200 dark:border-white/5 p-4 mt-6">
                <h4 className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-3">Maiores Gastos do Mês</h4>
                <div className="space-y-3">
                   {topCurrentExpenses.map((t, i) => (
                      <div key={i} className="flex flex-col gap-1.5">
                         <div className="flex justify-between items-center text-sm">
                            <span className="text-gray-700 dark:text-gray-300 font-medium truncate pr-4 leading-tight">{t.description} <span className="text-[10px] text-gray-400 ml-1">({t.category})</span></span>
                            <span className={`font-bold shrink-0 ${isAlert ? 'text-red-500' : 'text-gray-900 dark:text-white'}`}>{formatCurrency(t.amount)}</span>
                         </div>
                         <div className="w-full bg-gray-100 dark:bg-white/5 h-1.5 rounded-full overflow-hidden">
                            <div 
                              className={`h-full rounded-full opacity-50 ${isAlert ? 'bg-red-500' : 'bg-gray-400 dark:bg-white/40'}`} 
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
       <div className="bg-white dark:bg-[#121214] p-6 rounded-2xl border border-gray-200 dark:border-white/5 shadow-sm mt-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4">
             <div className="flex items-center gap-2">
                 <BarChart3 className="w-5 h-5 text-gray-400" />
                 <h3 className="text-sm font-bold uppercase tracking-wider text-gray-900 dark:text-white">Evolução Anual ({currentYear})</h3>
             </div>
             <select 
               value={barchartCategoryFilter}
               onChange={e => setBarchartCategoryFilter(e.target.value)}
               className="bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white font-medium text-xs rounded-lg px-3 py-2 outline-none focus:border-emerald-500 transition-colors w-full sm:w-auto"
             >
               <option value="all">Todas as Categorias</option>
               {expenseCategoriesSet.map(c => <option key={c} value={c}>{c}</option>)}
             </select>
          </div>
          
          <div className="h-[450px] w-full">
             <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={annualChartData} margin={{ top: 20, right: 10, left: -20, bottom: 20 }}>
                   <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(150,150,150,0.1)" />
                   <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 13, fill: '#6b7280', fontWeight: 500 }} dy={15} />
                   <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 13, fill: '#6b7280' }} tickFormatter={(val) => `R$${val >= 1000 ? (val/1000).toFixed(0)+'k' : val}`} />
                   <RechartsTooltip 
                      cursor={{ fill: 'rgba(150,150,150,0.05)' }}
                      contentStyle={{ backgroundColor: '#18181B', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.5)', padding: '12px' }}
                      itemStyle={{ color: '#fff', fontSize: '13px', fontWeight: 'bold' }}
                      labelStyle={{ color: '#9ca3af', marginBottom: '8px', fontWeight: 'bold', textTransform: 'uppercase', fontSize: '11px', letterSpacing: '0.05em' }}
                      formatter={(value: number, name: string) => [formatCurrency(value), name]}
                   />
                   <Legend 
                      wrapperStyle={{ paddingTop: '20px', fontSize: '13px', fontWeight: 500 }} 
                      iconType="circle"
                   />
                   
                   {expenseCategoriesSet
                      .filter(cat => barchartCategoryFilter === 'all' || cat === barchartCategoryFilter)
                      .map((cat, idx) => (
                      <Bar key={cat} dataKey={cat} stackId="a" fill={COLORS[expenseCategoriesSet.indexOf(cat) % COLORS.length]} maxBarSize={60} name={cat} radius={barchartCategoryFilter === 'all' ? [0, 0, 0, 0] : [4, 4, 0, 0]} />
                   ))}
                   
                   {barchartCategoryFilter === 'all' && (
                     <Line type="monotone" dataKey="SalarioReceita" name="Salário / Receita" stroke="#10b981" strokeWidth={3} dot={{ r: 5, strokeWidth: 2, fill: '#121214' }} activeDot={{ r: 7, strokeWidth: 0, fill: '#10b981' }} />
                   )}
                </ComposedChart>
             </ResponsiveContainer>
          </div>
       </div>

       <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
         <div className="bg-white dark:bg-[#121214] p-6 rounded-2xl border border-gray-200 dark:border-white/5 flex flex-col shadow-sm">
            <div className="flex items-center gap-2 mb-6">
                <PieChartIcon className="w-5 h-5 text-gray-400" />
                <h3 className="text-sm font-bold uppercase tracking-wider text-gray-900 dark:text-white">Distribuição por Categoria ({currentMonth}/{currentYear})</h3>
            </div>
            {pieChartData.length > 0 ? (
              <div className="h-[300px] w-full flex justify-center relative">
                 <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                       <Pie
                          data={pieChartData}
                          cx="50%"
                          cy="50%"
                          innerRadius={80}
                          outerRadius={105}
                          paddingAngle={4}
                          dataKey="value"
                          stroke="none"
                       >
                          {pieChartData.map((entry, index) => (
                             <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                       </Pie>
                       <RechartsTooltip 
                          formatter={(value: number, name: string) => [formatCurrency(value), name]}
                          contentStyle={{ backgroundColor: '#18181B', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)', color: '#fff', fontSize: '14px', fontWeight: 'bold' }}
                          itemStyle={{ color: '#fff' }}
                       />
                    </PieChart>
                 </ResponsiveContainer>
                 <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none mt-4">
                    <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Gasto Total</span>
                    <span className="text-xl font-bold text-gray-900 dark:text-white">{formatCurrency(currentMonthExpense)}</span>
                 </div>
              </div>
            ) : (
               <div className="h-[300px] flex items-center justify-center border-2 border-dashed border-gray-200 dark:border-white/10 rounded-xl mt-4">
                  <p className="text-gray-500 text-sm font-medium">Sem dados no mês selecionado</p>
               </div>
            )}
         </div>
         
         <div className="bg-white dark:bg-[#121214] p-6 rounded-2xl border border-gray-200 dark:border-white/5 shadow-sm flex flex-col">
            <div className="flex items-center gap-2 mb-6">
                <TrendingDown className="w-5 h-5 text-gray-400" />
                <h3 className="text-sm font-bold uppercase tracking-wider text-gray-900 dark:text-white">Top Categorias ({currentMonth}/{currentYear})</h3>
            </div>
            {pieChartData.length > 0 ? (
               <div className="space-y-4 overflow-y-auto pr-2 custom-scrollbar flex-1">
                  {pieChartData.map((cat, i) => (
                    <div key={i} className="flex flex-col gap-2 p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors group">
                       <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                             <div className="w-4 h-4 rounded shadow-sm" style={{ backgroundColor: COLORS[i % COLORS.length] }}></div>
                             <span className="text-sm font-bold text-gray-800 dark:text-gray-200">{cat.name || 'Outras'}</span>
                          </div>
                          <span className="text-sm font-bold text-gray-900 dark:text-white">{formatCurrency(cat.value)}</span>
                       </div>
                       <div className="w-full bg-gray-100 dark:bg-white/5 h-1.5 rounded-full overflow-hidden pl-7">
                          <div 
                             className="h-full rounded-full transition-all duration-500" 
                             style={{ width: `${Math.min((cat.value / currentMonthExpense) * 100, 100)}%`, backgroundColor: COLORS[i % COLORS.length] }}
                          ></div>
                       </div>
                    </div>
                  ))}
               </div>
            ) : (
               <div className="flex-1 flex items-center justify-center border-2 border-dashed border-gray-200 dark:border-white/10 rounded-xl min-h-[300px]">
                  <p className="text-gray-500 text-sm font-medium">Nenhum gasto registrado.</p>
               </div>
            )}
         </div>
       </div>
    </div>
  );
}
