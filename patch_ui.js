const fs = require('fs');
const file = 'src/components/AIFinancialForecast.tsx';
let content = fs.readFileSync(file, 'utf8');

// Update the AI prompt
const promptRegex = /const prompt = `Como um consultor financeiro[\s\S]*?\${JSON.stringify\(aggregatedData\)}\n`;/;

const newPrompt = `const prompt = \`Como um consultor financeiro, analise os dados fornecidos abaixo (incluem histórico dos últimos 6 meses e sazonalidade do ano anterior).
Responda EXCLUSIVAMENTE em formato JSON com as seguintes chaves:
"trends": Texto MUITO CURTO (1 a 2 frases) resumindo a principal tendência.
"forecastList": Um array com a previsão para as 3 categorias mais relevantes do mês. Cada item deve ter:
  "category": Nome da categoria.
  "amount": Valor estimado (ex: "R$ 800").
  "details": Texto ultra curto com a frequência e 1 exemplo real (ex: "Aprox. 4 compras. Ex: Mercado X").
"actionPlan": Um array de strings com até 2 dicas DIRETAS e curtas.

Dados JSON:
\${JSON.stringify(aggregatedData)}
\`;`;

content = content.replace(promptRegex, newPrompt);

// Update parsed extraction
const oldExtract = `      const newForecast = {
         trends: parsed.trends,
         forecast: parsed.forecast,
         actionPlan: parsed.actionPlan,
         generatedAt: Date.now()
      };`;

const newExtract = `      const newForecast = {
         trends: parsed.trends,
         forecast: parsed.forecast || "",
         forecastList: parsed.forecastList || [],
         actionPlan: parsed.actionPlan,
         generatedAt: Date.now()
      };`;

content = content.replace(oldExtract, newExtract);

// Update UI rendering
const oldGrid = `<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-gray-50 dark:bg-[#0A0A0B] p-4 rounded-xl border border-gray-100 dark:border-white/5">
                       <div className="flex items-center gap-2 mb-3">
                          <TrendingUp className="w-4 h-4 text-emerald-500" />
                          <h4 className="text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">Tendências de 6 Meses</h4>
                       </div>
                       <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed whitespace-pre-line">{forecast.trends}</p>
                    </div>

                    <div className="bg-gray-50 dark:bg-[#0A0A0B] p-4 rounded-xl border border-gray-100 dark:border-white/5">
                       <div className="flex items-center gap-2 mb-3">
                          <AlertCircle className="w-4 h-4 text-amber-500" />
                          <h4 className="text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">Previsão do Mês</h4>
                       </div>
                       <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed whitespace-pre-line">{forecast.forecast}</p>
                    </div>
                 </div>`;

const newGrid = `
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
                          {forecast.forecastList.map((f: any, idx: number) => (
                             <div key={idx} className="flex items-center justify-between p-3 bg-white dark:bg-[#1A1A1D] border border-gray-100 dark:border-white/5 rounded-xl shadow-sm">
                                <div>
                                   <h5 className="text-sm font-bold text-gray-900 dark:text-white">{f.category}</h5>
                                   <p className="text-[11px] text-gray-500 mt-0.5">{f.details}</p>
                                </div>
                                <span className="text-sm font-bold text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-500/10 px-2 py-1 rounded-lg">{f.amount}</span>
                             </div>
                          ))}
                       </div>
                    ) : (
                       <div className="bg-gray-50 dark:bg-[#0A0A0B] p-4 rounded-xl border border-gray-100 dark:border-white/5">
                          <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed whitespace-pre-line">{forecast.forecast}</p>
                       </div>
                    )}
                 </div>
`;

content = content.replace(oldGrid, newGrid);

fs.writeFileSync(file, content);
console.log("Patched UI!");
