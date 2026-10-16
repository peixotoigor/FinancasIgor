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
           openRouterKey: userSettings?.aiProvider === 'openrouter' ? userSettings?.openRouterApiKey : undefined,
           openRouterModel: userSettings?.aiProvider === 'openrouter' ? userSettings?.openRouterModel : undefined
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
    <div className="glass-card bg-white dark:bg-[#121214] border border-gray-100 dark:border-white/5 rounded-2xl shadow-sm mb-6 overflow-hidden transition-all">
      <div 
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50/50 dark:hover:bg-white/[0.02] transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center font-bold text-xs">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-sm text-gray-900 dark:text-white">Análise e Previsão Inteligente</h3>
              <span className="text-[10px] bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-semibold px-1.5 py-0.5 rounded-full">IA</span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Tendências e projeções com base no seu histórico</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
           {!forecast && !isExpanded && (
              <span className="text-xs bg-emerald-500/10 text-emerald-500 font-medium px-2 py-0.5 rounded-full">Novo</span>
           )}
           {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </div>
      </div>

      {isExpanded && (
        <div className="p-4 pt-0 border-t border-gray-100 dark:border-white/5">
           {!forecast ? (
              <div className="py-8 flex flex-col items-center justify-center text-center">
                 <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center mb-3">
                    <Sparkles className="w-6 h-6" />
                 </div>
                 <h4 className="font-bold text-base text-gray-900 dark:text-white mb-1">Previsão Financeira com IA</h4>
                 <p className="text-xs text-gray-500 dark:text-gray-400 max-w-sm mb-4 leading-relaxed">
                    Nossa IA analisa os padrões dos últimos 6 meses para sugerir previsões para suas principais categorias e dicas personalizadas.
                 </p>
                 <button 
                    onClick={generateForecast}
                    disabled={isGenerating}
                    className="flex items-center gap-2 bg-indigo-500 hover:bg-indigo-600 text-white px-4 py-2.5 rounded-xl font-medium text-xs shadow-sm shadow-indigo-500/20 transition-all disabled:opacity-50"
                 >
                    {isGenerating ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                    {isGenerating ? 'Analisando Histórico...' : 'Gerar Análise Agora'}
                 </button>
                 {error && <p className="text-xs text-red-500 mt-3">{error}</p>}
              </div>
           ) : (
              <div className="pt-4 space-y-4">
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
                                     <span className="text-sm font-bold text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-500/10 px-2.5 py-1 rounded-lg">{f.amount}</span>
                                  </div>
                                  
                                  {isCatExpanded && f.examples && f.examples.length > 0 && (
                                     <div className="border-t border-gray-100 dark:border-white/5 bg-gray-50/50 dark:bg-white/[0.01] p-3 text-xs">
                                        <h6 className="font-semibold text-gray-600 dark:text-gray-400 mb-2 text-[11px]">Compras Consideradas:</h6>
                                        <ul className="space-y-1.5">
                                           {f.examples.map((ex: any, eIdx: number) => (
                                              <li key={eIdx} className="flex justify-between items-center text-gray-500 dark:text-gray-400">
                                                 <span className="truncate pr-2">&bull; {ex.desc}</span>
                                                 <span className="font-medium text-gray-700 dark:text-gray-300">{ex.val}</span>
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

                 {/* Plano de Ação */}
                 <div className="bg-indigo-50/50 dark:bg-indigo-500/5 p-4 rounded-xl border border-indigo-100/50 dark:border-indigo-500/10">
                    <div className="flex items-center gap-2 mb-2">
                       <Lightbulb className="w-4 h-4 text-indigo-500" />
                       <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-900 dark:text-indigo-400">Plano de Ação Sugerido</h4>
                    </div>
                    <ul className="space-y-2">
                       {(Array.isArray(forecast.actionPlan) 
                          ? forecast.actionPlan 
                          : typeof forecast.actionPlan === 'string' && forecast.actionPlan 
                            ? [forecast.actionPlan] 
                            : []
                        ).map((plan: string, idx: number) => (
                          <li key={idx} className="text-xs text-indigo-950 dark:text-gray-300 flex items-start gap-2 leading-relaxed">
                             <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-1.5 shrink-0" />
                             <span>{plan}</span>
                          </li>
                       ))}
                    </ul>
                 </div>

                 <div className="flex items-center justify-between pt-2">
                    <span className="text-[10px] text-gray-400">
                       Atualizado em {new Date(forecast.generatedAt).toLocaleDateString()} às {new Date(forecast.generatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <button 
                       onClick={generateForecast}
                       disabled={isGenerating}
                       className="text-xs text-indigo-500 hover:text-indigo-600 font-medium flex items-center gap-1"
                    >
                       <RefreshCw className={`w-3 h-3 ${isGenerating ? 'animate-spin' : ''}`} />
                       Atualizar Análise
                    </button>
                 </div>
                 {error && <p className="text-xs text-red-500 text-right mt-1">{error}</p>}
              </div>
           )}
        </div>
      )}
    </div>
  );
}
