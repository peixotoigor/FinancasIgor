const fs = require('fs');
const path = require('path');

// 1. Update types.ts
const typesFile = 'src/types.ts';
let typesContent = fs.readFileSync(typesFile, 'utf8');
typesContent = typesContent.replace(
  'forecastList?: { category: string; amount: string; details: string; }[];',
  'forecastList?: { category: string; amount: string; details: string; examples?: { desc: string; val: string }[]; }[];'
);
fs.writeFileSync(typesFile, typesContent);

// 2. Update AIFinancialForecast.tsx
const forecastFile = 'src/components/AIFinancialForecast.tsx';
let forecastContent = fs.readFileSync(forecastFile, 'utf8');

// Add state
const stateSearch = 'const [error, setError] = useState<string | null>(null);';
const stateReplace = `const [error, setError] = useState<string | null>(null);
  const [expandedCats, setExpandedCats] = useState<number[]>([]);
  const toggleCat = (idx: number) => {
    setExpandedCats(prev => prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx]);
  };`;
forecastContent = forecastContent.replace(stateSearch, stateReplace);

// Update Prompt
const promptSearch = `"forecastList": Um array com a previsão para as 3 categorias mais relevantes do mês. Cada item deve ter:
  "category": Nome da categoria.
  "amount": Valor estimado (ex: "R$ 800").
  "details": Texto ultra curto com a frequência e 1 exemplo real (ex: "Aprox. 4 compras. Ex: Mercado X").`;
const promptReplace = `"forecastList": Um array com a previsão para as 3 categorias mais relevantes do mês. Cada item deve ter:
  "category": Nome da categoria.
  "amount": Valor estimado (ex: "R$ 800").
  "details": Texto ultra curto informando apenas a frequência esperada (ex: "Aprox. 4 compras estimadas.").
  "examples": Um array de objetos referenciando compras reais do histórico fornecido que justificam essa previsão. Cada objeto deve ter "desc" (ex: "Mercado X") e "val" (ex: "R$ 250"). Máximo de 5 exemplos por categoria.`;
forecastContent = forecastContent.replace(promptSearch, promptReplace);

// Update UI
const uiSearch = `{forecast.forecastList.map((f: any, idx: number) => (
                             <div key={idx} className="flex items-center justify-between p-3 bg-white dark:bg-[#1A1A1D] border border-gray-100 dark:border-white/5 rounded-xl shadow-sm">
                                <div>
                                   <h5 className="text-sm font-bold text-gray-900 dark:text-white">{f.category}</h5>
                                   <p className="text-[11px] text-gray-500 mt-0.5">{f.details}</p>
                                </div>
                                <span className="text-sm font-bold text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-500/10 px-2 py-1 rounded-lg">{f.amount}</span>
                             </div>
                          ))}`;

const uiReplace = `{forecast.forecastList.map((f: any, idx: number) => {
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
                                           <ChevronDown className={\`w-3.5 h-3.5 text-gray-400 transition-transform \${isCatExpanded ? 'rotate-180' : ''}\`} />
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
                          })}`;
                          
forecastContent = forecastContent.replace(uiSearch, uiReplace);

fs.writeFileSync(forecastFile, forecastContent);
console.log("Expandable categories patched successfully!");
