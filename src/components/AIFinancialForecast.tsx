import React, { useState, useMemo } from 'react';
import { Transaction, MonthlyBudget, UserSettings } from '../types';
import { Sparkles, ChevronDown, ChevronUp, RefreshCw, TrendingUp, AlertCircle, Lightbulb } from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { doc, updateDoc, setDoc } from 'firebase/firestore';

interface Props {
  userId: string;
  transactions: Transaction[];
  currentMonthBudget: MonthlyBudget | null;
  currentYear: number;
  currentMonth: number;
  userSettings: UserSettings | null;
}

export function AIFinancialForecast({ userId, transactions, currentMonthBudget, currentYear, currentMonth, userSettings }: Props) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedCats, setExpandedCats] = useState<number[]>([]);
  const toggleCat = (idx: number) => {
    setExpandedCats(prev => prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx]);
  };

  const forecast = currentMonthBudget?.aiForecast;

  // Calculate 6 months aggregated data + same month last year
  const aggregatedData = useMemo(() => {
    const data: Record<string, Record<string, { amount: number; count: number; items: { desc: string; val: number }[] }>> = {};
    const now = new Date(currentYear, currentMonth - 1, 1);
    
    // Add last 6 months
    for (let i = 0; i < 6; i++) {
       const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
       const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
       data[key] = {};
    }
    
    // Add same month last year
    const lastYearDate = new Date(currentYear - 1, currentMonth - 1, 1);
    const lastYearKey = `${lastYearDate.getFullYear()}-${String(lastYearDate.getMonth() + 1).padStart(2, '0')}`;
    data[lastYearKey] = {};

    transactions.forEach(t => {
       if (t.type !== 'expense') return;
       const tDate = new Date(t.date);
       const key = `${tDate.getFullYear()}-${String(tDate.getMonth() + 1).padStart(2, '0')}`;
       
       if (data[key]) {
          if (!data[key][t.category]) {
             data[key][t.category] = { amount: 0, count: 0, items: [] };
          }
          data[key][t.category].amount += t.amount;
          data[key][t.category].count += 1;
          // Keep top items or all (usually fine for last few months)
          data[key][t.category].items.push({ desc: t.description, val: t.amount });
       }
    });
    
    return data;
  }, [transactions, currentYear, currentMonth]);

  const generateForecast = async () => {
    setIsGenerating(true);
    setError(null);
    try {
      const prompt = `Como um consultor financeiro, analise os dados fornecidos abaixo (incluem histórico dos últimos 6 meses e sazonalidade do ano anterior).
Responda EXCLUSIVAMENTE em formato JSON com as seguintes chaves:
"trends": Texto MUITO CURTO (1 a 2 frases) resumindo a principal tendência.
"forecastList": Um array com a previsão para as 3 categorias mais relevantes do mês. Cada item deve ter:
  "category": Nome da categoria.
  "amount": Valor estimado (ex: "R$ 800").
  "details": Texto ultra curto informando apenas a frequência esperada (ex: "Aprox. 4 compras estimadas.").
  "examples": Um array de objetos referenciando compras reais do histórico fornecido que justificam essa previsão. Cada objeto deve ter "desc" (ex: "Mercado X") e "val" (ex: "R$ 250"). Máximo de 5 exemplos por categoria.
"actionPlan": Um array de strings com até 2 dicas DIRETAS e curtas.

Dados JSON:
${JSON.stringify(aggregatedData)}
`;

      const res = await fetch('/api/ai/forecast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
           prompt,
           openRouterKey: userSettings?.openRouterApiKey,
           openRouterModel: userSettings?.openRouterModel
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao gerar análise');
      
      let parsed;
      try {
         // Clean markdown blocks if present
         let cleanJson = data.text.replace(/```json/g, '').replace(/```/g, '').trim();
         parsed = JSON.parse(cleanJson);
      } catch (e) {
         throw new Error('A IA não retornou um formato válido.');
      }

      const newForecast = {
         trends: parsed.trends,
         forecast: parsed.forecast || "",
         forecastList: parsed.forecastList || [],
         actionPlan: parsed.actionPlan,
         generatedAt: Date.now()
      };

      const docId = `${userId}_${currentYear}_${currentMonth}`;
      if (currentMonthBudget?.id || currentMonthBudget?.updatedAt) {
          await updateDoc(doc(db, 'monthly_budgets', docId), {
             aiForecast: newForecast,
             updatedAt: Date.now()
          });
      } else {
          await setDoc(doc(db, 'monthly_budgets', docId), {
             userId, year: currentYear, month: currentMonth,
             aiForecast: newForecast,
             salary: 0, reserve: 0, reserveOfReserve: 0, wallet: 0,
             walletWithdrawals: 0, emergencyWithdrawals: 0, reserveWithdrawals: 0,
             updatedAt: Date.now()
          });
      }
      
      if (!isExpanded) setIsExpanded(true);

    } catch (err: any) {
      console.error(err);
      setError(err.message);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="bg-white dark:bg-[#121214] border border-gray-100 dark:border-white/5 rounded-2xl shadow-sm mb-6 overflow-hidden">
      <div 
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-500/10 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div>
            <h3 className="font-bold text-gray-900 dark:text-white">Análise e Previsão (IA)</h3>
            <p className="text-xs text-gray-500">Tendências e dicas personalizadas</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
           {!forecast && !isExpanded && (
              <span className="hidden sm:inline-block text-[10px] font-semibold uppercase tracking-wider bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-400 px-2 py-1 rounded">Novo</span>
           )}
           {isExpanded ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
        </div>
      </div>

      {isExpanded && (
        <div className="p-4 pt-0 border-t border-gray-100 dark:border-white/5">
           {!forecast ? (
              <div className="py-8 flex flex-col items-center justify-center text-center">
                 <div className="w-16 h-16 bg-indigo-50 dark:bg-indigo-500/5 rounded-full flex items-center justify-center mb-4">
                    <Sparkles className="w-8 h-8 text-indigo-400" />
                 </div>
                 <h4 className="font-medium text-gray-900 dark:text-white mb-2">Gere sua primeira análise</h4>
                 <p className="text-sm text-gray-500 max-w-sm mb-6">
                    A IA vai analisar seus últimos 6 meses de gastos e identificar tendências, criando uma previsão para te ajudar a economizar.
                 </p>
                 <button 
                    onClick={generateForecast}
                    disabled={isGenerating}
                    className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
                 >
                    {isGenerating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                    {isGenerating ? 'Analisando dados...' : 'Gerar Análise'}
                 </button>
                 {error && <p className="text-red-500 text-xs mt-4">{error}</p>}
              </div>
           ) : (
              <div className="pt-4 space-y-6">
                 {/* Sparklines / Charts could be inserted here later, for now we keep it clean */}
                 
                 {/* Tendências (Curto) */}
                 <div className="bg-gray-50 dark:bg-[#0A0A0B] p-4 rounded-xl border border-gray-100 dark:border-white/5">
                    <div className="flex items-center gap-2 mb-2">
                       <TrendingUp className="w-4 h-4 text-indigo-500" />
                       <h4 className="text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">Resumo & Tendência</h4>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">{forecast.trends}</p>
                 </div>

                 {/* Previsão Visual */}
                 <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-3 ml-1">Previsão por Categoria</h4>
                    {forecast.forecastList && forecast.forecastList.length > 0 ? (
                       <div className="space-y-2">
                          {forecast.forecastList.map((f: any, idx: number) => {
                             const isCatExpanded = expandedCats.includes(idx);
                             return (
                               <div key={idx} className="bg-white dark:bg-[#1A1A1D] border border-gray-100 dark:border-white/5 rounded-xl shadow-sm overflow-hidden transition-all">
                                  <div 
                                     onClick={() => toggleCat(idx)}
                                     className="flex items-center justify-between p-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors"
                                  >
                                     <div>
                                        <h5 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                                           {f.category}
                                           <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform ${isCatExpanded ? 'rotate-180' : ''}`} />
                                        </h5>
                                        <p className="text-[11px] text-gray-500 mt-0.5">{f.details}</p>
                                     </div>
                                     <span className="text-sm font-bold text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-500/10 px-2 py-1 rounded-lg">{f.amount}</span>
                                  </div>
                                  
                                  {isCatExpanded && f.examples && f.examples.length > 0 && (
                                     <div className="border-t border-gray-100 dark:border-white/5 bg-gray-50/50 dark:bg-[#0A0A0B] p-3">
                                        <h6 className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-2">Compras Baseadas no Histórico</h6>
                                        <ul className="space-y-1.5">
                                           {f.examples.map((ex: any, eIdx: number) => (
                                              <li key={eIdx} className="flex justify-between items-center text-xs">
                                                 <span className="text-gray-600 dark:text-gray-400 truncate pr-2">• {ex.desc}</span>
                                                 <span className="font-medium text-gray-900 dark:text-gray-300 whitespace-nowrap">{ex.val}</span>
                                              </li>
                                           ))}
                                        </ul>
                                     </div>
                                  )}
                               </div>
                             );
                          })}
                       </div>
                    ) : (
                       <div className="bg-gray-50 dark:bg-[#0A0A0B] p-4 rounded-xl border border-gray-100 dark:border-white/5">
                          <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed whitespace-pre-line">{forecast.forecast}</p>
                       </div>
                    )}
                 </div>


                 <div className="bg-indigo-50 dark:bg-indigo-500/5 p-5 rounded-xl border border-indigo-100 dark:border-indigo-500/10">
                    <div className="flex items-center gap-2 mb-4">
                       <Lightbulb className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                       <h4 className="font-bold text-indigo-900 dark:text-indigo-200">Plano de Ação</h4>
                    </div>
                    <ul className="space-y-3">
                       {forecast.actionPlan.map((plan: string, idx: number) => (
                          <li key={idx} className="flex gap-3 text-sm text-indigo-800 dark:text-indigo-300">
                             <span className="font-bold opacity-50 mt-0.5">{idx + 1}.</span>
                             <span className="leading-relaxed">{plan}</span>
                          </li>
                       ))}
                    </ul>
                 </div>

                 <div className="flex items-center justify-between pt-2">
                    <span className="text-[10px] text-gray-400">
                       Gerado em {new Date(forecast.generatedAt).toLocaleString('pt-BR')}
                    </span>
                    <button 
                       onClick={generateForecast}
                       disabled={isGenerating}
                       className="flex items-center gap-1.5 text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors disabled:opacity-50"
                    >
                       <RefreshCw className={`w-3.5 h-3.5 ${isGenerating ? 'animate-spin' : ''}`} />
                       Atualizar Análise
                    </button>
                 </div>
                 {error && <p className="text-red-500 text-xs text-right mt-1">{error}</p>}
              </div>
           )}
        </div>
      )}
    </div>
  );
}
