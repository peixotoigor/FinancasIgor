import React, { useState, useEffect, useRef } from 'react';
import { User } from 'firebase/auth';
import { UserSettings } from '../types';
import { Bot, BellRing, Upload, Terminal, MessageSquare, Key, ArrowRight, Check, Database, Sparkles, Loader2, Copy } from 'lucide-react';
import { db } from '../lib/firebase';
import { updateDoc, doc, collection, addDoc } from 'firebase/firestore';

export function IntegrationTab({ user, userSettings }: { user: User, userSettings: UserSettings }) {
  const [overallLimit, setOverallLimit] = useState<string>(userSettings.spendingLimits?.overall?.toString() || '');
  const [catLimits, setCatLimits] = useState<Record<string, string>>(
    Object.fromEntries(Object.entries(userSettings.spendingLimits?.categories || {}).map(([k,v]) => [k, v.toString()]))
  );
  const [aiProvider, setAiProvider] = useState<'gemini' | 'openrouter'>(userSettings.aiProvider === 'openrouter' ? 'openrouter' : 'gemini');
  const [openRouterApiKey, setOpenRouterApiKey] = useState(userSettings.openRouterApiKey || '');
  const [openRouterModel, setOpenRouterModel] = useState(userSettings.openRouterModel || 'openai/gpt-4o-mini');

  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const initialRender = useRef(true);

  const [copiedToken, setCopiedToken] = useState(false);
  const [csvText, setCsvText] = useState('');
  const [isImporting, setIsImporting] = useState(false);

  const [availableModels, setAvailableModels] = useState<string[] | null>(null);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);

  // Auto-save logic
  useEffect(() => {
    if (initialRender.current) {
      initialRender.current = false;
      return;
    }

    const timer = setTimeout(async () => {
      setSaveStatus('saving');
      try {
        const categories: Record<string, number> = {};
        for (const [k, v] of Object.entries(catLimits)) {
           const num = parseFloat(v);
           if (!isNaN(num) && num > 0) {
              categories[k] = num;
           }
        }
        
        await updateDoc(doc(db, 'user_settings', user.uid), {
           spendingLimits: {
              overall: overallLimit ? parseFloat(overallLimit) : null,
              categories
           },
           aiProvider,
           openRouterApiKey,
           openRouterModel
        });
        setSaveStatus('saved');
        setTimeout(() => {
          setSaveStatus(prev => prev === 'saved' ? 'idle' : prev);
        }, 3000);
      } catch (e) {
        console.error("Save error:", e);
        setSaveStatus('error');
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [overallLimit, catLimits, aiProvider, openRouterApiKey, openRouterModel, user.uid]);

  const fetchOpenRouterModels = async () => {
    setIsLoadingModels(true);
    try {
      const res = await fetch('https://openrouter.ai/api/v1/models');
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const data = await res.json();
      
      if (data && data.data) {
        setAvailableModels(data.data.map((m: any) => m.id));
      } else {
         setAvailableModels([]);
      }
    } catch (e) {
      console.error("Falha ao buscar modelos OpenRouter:", e);
      alert(`Não foi possível carregar os modelos.`);
    } finally {
      setIsLoadingModels(false);
    }
  };

  const copyToken = () => {
      navigator.clipboard.writeText(user.uid);
      setCopiedToken(true);
      setTimeout(() => setCopiedToken(false), 2000);
  }

  const handleImportCSV = async () => {
      if (!csvText.trim()) return;
      setIsImporting(true);
      try {
          const lines = csvText.trim().split('\n');
          let startIdx = 0;
          if (lines[0].toLowerCase().includes('mês')) startIdx = 1;
          
          let imported = 0;
          for (let i = startIdx; i < lines.length; i++) {
              let line = lines[i].trim();
              if (!line) continue;
              
              if (line.startsWith('"') && line.endsWith('"')) {
                  line = line.substring(1, line.length - 1).replace(/""/g, '"');
              }
              
              const cols: string[] = [];
              let inQuotes = false;
              let currentStr = '';
              for (let c = 0; c < line.length; c++) {
                 if (line[c] === '"') {
                    inQuotes = !inQuotes;
                 } else if (line[c] === ',' && !inQuotes) {
                    cols.push(currentStr.trim());
                    currentStr = '';
                 } else {
                    currentStr += line[c];
                 }
              }
              cols.push(currentStr.trim());
              
              if (cols.length >= 10) {
                 const rawMes = cols[0];
                 const descricao = cols[1];
                 const data = cols[2];
                 let valorRaw = cols[3];
                 const rawDia = cols[4];
                 const rawMesNum = cols[5];
                 const rawAno = cols[6];
                 const categoria = cols[7];
                 const cartao = cols[8];
                 const pagamento = cols[9];
                 
                 if (!data || !descricao) continue;
                 
                 valorRaw = valorRaw.replace('R$', '').trim().replace(/\./g, '').replace(',', '.');
                 const amount = parseFloat(valorRaw);
                 
                 if (isNaN(amount) || amount === 0) continue;
                 
                 const isIncome = (categoria.toLowerCase() === 'salário' || pagamento.toLowerCase() === 'pagamento' || descricao.toLowerCase() === 'salário');
                 const type = isIncome ? 'income' : 'expense';
                 
                 let matchedCategory = (categoria || 'Outros').trim();
                 if (userSettings) {
                    const listToMatch = isIncome ? (userSettings.incomeCategories || []) : (userSettings.categories || []);
                    const matched = listToMatch.find(c => c.toLowerCase() === matchedCategory.toLowerCase());
                    if (matched) matchedCategory = matched;
                 }

                 let timestamp = Date.now();
                 if (data.includes('-') || data.includes('/')) {
                     const sep = data.includes('-') ? '-' : '/';
                     const parts = data.split(sep);
                     if (parts.length === 3) {
                         const d = parseInt(parts[0], 10);
                         const m = parseInt(parts[1], 10) - 1;
                         const y = parseInt(parts[2], 10);
                         timestamp = new Date(y, m, d, 12, 0, 0).getTime();
                     }
                 }
                 
                 const txPayload: any = {
                     userId: user.uid,
                     description: descricao,
                     date: timestamp,
                     amount,
                     type,
                     category: matchedCategory,
                     account: 'Default',
                     paymentMethod: pagamento || (cartao ? 'Crédito' : 'Outros'),
                     createdAt: Date.now()
                 };
                 if (cartao) txPayload.card = cartao;
                 
                 await addDoc(collection(db, 'transactions'), txPayload);
                 imported++;
              }
          }
          alert(`${imported} transações importadas com sucesso!`);
          setCsvText('');
      } catch (e) {
          console.error(typeof e === 'object' && e !== null && 'message' in e ? e.message : String(e));
          alert('Erro ao importar CSV.');
      } finally {
          setIsImporting(false);
      }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-24 animate-in fade-in slide-in-from-bottom-4 duration-500">
       
       <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 py-4 border-b border-gray-100 dark:border-white/5 mb-6">
         <div>
           <h2 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">Configurações</h2>
           <p className="text-gray-500 text-sm font-medium mt-1">Gerencie limites, provedores de IA e importações.</p>
         </div>
         
         <div className="flex items-center gap-2 text-sm font-medium fixed sm:static bottom-20 sm:bottom-0 right-4 sm:right-0 bg-white/90 sm:bg-transparent dark:bg-[#121214]/90 sm:dark:bg-transparent shadow-lg sm:shadow-none p-3 sm:p-0 rounded-full sm:rounded-none z-50 backdrop-blur-md">
            {saveStatus === "saving" && <span className="text-orange-500 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> <span className="hidden sm:inline">Salvando...</span></span>}
            {saveStatus === "saved" && <span className="text-emerald-500 flex items-center gap-2"><Check className="w-4 h-4" /> <span className="hidden sm:inline">Salvo automaticamente</span></span>}
            {saveStatus === "error" && <span className="text-red-500 flex items-center gap-2"><Check className="w-4 h-4" /> <span className="hidden sm:inline">Erro ao salvar</span></span>}
            {saveStatus === "idle" && <span className="text-gray-400 dark:text-gray-500 flex items-center gap-2"><Check className="w-4 h-4 opacity-50" /> <span className="hidden sm:inline">Sincronizado</span></span>}
         </div>
       </div>

       {/* Orçamento e Alertas */}
       <section className="bg-white dark:bg-[#121214] border border-gray-200 dark:border-white/5 shadow-sm rounded-2xl p-6 sm:p-8">
          <div className="flex items-center gap-3 mb-6">
             <div className="w-10 h-10 bg-orange-50 dark:bg-orange-500/10 text-orange-500 rounded-xl flex items-center justify-center">
                <BellRing className="w-5 h-5" />
             </div>
             <div>
               <h3 className="text-lg font-bold text-gray-900 dark:text-white">Orçamento e Alertas</h3>
               <p className="text-xs text-gray-500">Defina limites para receber alertas no Telegram.</p>
             </div>
          </div>

          <div className="space-y-8">
             <div>
                <label className="text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 block mb-2">Limite Global Mensal</label>
                <div className="flex items-center gap-3 max-w-sm">
                   <div className="relative flex-1 group">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-medium z-10">R$</span>
                      <input 
                         type="number" 
                         placeholder="0,00"
                         value={overallLimit}
                         onChange={e => setOverallLimit(e.target.value)}
                         className="bg-gray-50 dark:bg-black/30 border border-gray-200 dark:border-white/10 w-full pl-12 pr-4 py-3 rounded-xl text-gray-900 dark:text-white font-semibold outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 transition-all"
                      />
                   </div>
                </div>
             </div>

             <div>
                <label className="text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 block mb-3">Limites por Categoria</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                   {userSettings.categories?.map(cat => (
                      <div key={cat} className="bg-gray-50 dark:bg-white/[0.02] border border-gray-200 dark:border-white/5 rounded-xl p-3 flex flex-col gap-2 relative group focus-within:border-orange-500/50 transition-colors">
                         <span className="text-xs font-semibold text-gray-600 dark:text-gray-400 truncate pr-2 uppercase" title={cat}>{cat}</span>
                         <div className="relative flex items-center">
                            <span className="text-gray-400 text-xs font-medium absolute left-2">R$</span>
                            <input 
                               type="number" 
                               placeholder="-"
                               value={catLimits[cat] || ''}
                               onChange={e => setCatLimits(prev => ({...prev, [cat]: e.target.value}))}
                               className="bg-transparent text-sm w-full font-bold text-gray-900 dark:text-white outline-none pl-7 py-1 text-right"
                            />
                         </div>
                      </div>
                   ))}
                   {(!userSettings.categories || userSettings.categories.length === 0) && (
                      <p className="text-sm font-medium text-gray-500 col-span-full">Nenhuma categoria cadastrada.</p>
                   )}
                </div>
             </div>
          </div>
       </section>

       {/* Assistente & IA */}
       <section className="bg-white dark:bg-[#121214] border border-gray-200 dark:border-white/5 shadow-sm rounded-2xl p-6 sm:p-8">
          <div className="flex items-center gap-3 mb-8">
             <div className="w-10 h-10 bg-blue-50 dark:bg-blue-500/10 text-blue-500 rounded-xl flex items-center justify-center">
                <Sparkles className="w-5 h-5" />
             </div>
             <div>
               <h3 className="text-lg font-bold text-gray-900 dark:text-white">Assistente Inteligente & IA</h3>
               <p className="text-xs text-gray-500">Integração do Telegram e processamento de linguagem.</p>
             </div>
          </div>

          <div className="space-y-10">
             
             {/* Model Provider Config */}
             <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-4">Provedor de IA</h4>
                <div className="flex flex-col sm:flex-row gap-4 mb-4">
                   <label className={`flex-1 flex items-center gap-3 p-4 border rounded-xl cursor-pointer transition-colors ${aiProvider === 'gemini' ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-500/10' : 'border-gray-200 dark:border-white/10 hover:border-blue-300 dark:hover:border-blue-500/30'}`}>
                      <input type="radio" value="gemini" checked={aiProvider === 'gemini'} onChange={(e) => setAiProvider(e.target.value as 'gemini' | 'openrouter')} className="accent-blue-500 w-4 h-4" />
                      <span className="font-bold text-sm text-gray-900 dark:text-white mt-0.5">Google Gemini API</span>
                   </label>
                   <label className={`flex-1 flex items-center gap-3 p-4 border rounded-xl cursor-pointer transition-colors ${aiProvider === 'openrouter' ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-500/10' : 'border-gray-200 dark:border-white/10 hover:border-blue-300 dark:hover:border-blue-500/30'}`}>
                      <input type="radio" value="openrouter" checked={aiProvider === 'openrouter'} onChange={(e) => setAiProvider(e.target.value as 'openrouter' | 'gemini')} className="accent-blue-500 w-4 h-4" />
                      <span className="font-bold text-sm text-gray-900 dark:text-white mt-0.5">OpenRouter</span>
                   </label>
                </div>

                {aiProvider === 'openrouter' && (
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2 mt-4">
                      <div className="bg-gray-50 dark:bg-black/30 border border-gray-200 dark:border-white/10 rounded-xl p-4">
                         <label className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-2 block">OpenRouter API Key</label>
                         <input 
                            type="password" 
                            value={openRouterApiKey}
                            onChange={e => setOpenRouterApiKey(e.target.value)}
                            placeholder="sk-or-v1-..."
                            className="bg-transparent border-none w-full text-sm font-mono text-gray-900 dark:text-white outline-none"
                         />
                      </div>
                      <div className="bg-gray-50 dark:bg-black/30 border border-gray-200 dark:border-white/10 rounded-xl p-4 relative">
                         <div className="flex items-center justify-between mb-2">
                            <label className="text-[10px] font-bold uppercase tracking-wider text-gray-500 block">Modelo OpenRouter</label>
                            <button 
                               onClick={fetchOpenRouterModels}
                               disabled={isLoadingModels}
                               className="text-[10px] font-bold uppercase tracking-wider text-blue-500 hover:text-blue-600 disabled:opacity-50 transition-colors"
                            >
                               {isLoadingModels ? 'Buscando...' : 'Carregar'}
                            </button>
                         </div>
                         <input 
                            type="text" 
                            value={openRouterModel}
                            onChange={e => { setOpenRouterModel(e.target.value); setIsModelDropdownOpen(true); }}
                            onFocus={() => setIsModelDropdownOpen(true)}
                            onBlur={() => setTimeout(() => setIsModelDropdownOpen(false), 200)}
                            placeholder="openai/gpt-4o-mini"
                            className="bg-transparent border-none w-full text-sm font-mono text-gray-900 dark:text-white outline-none"
                         />
                         
                         {isModelDropdownOpen && availableModels && availableModels.length > 0 && (
                            <div className="absolute z-20 left-0 right-0 top-full mt-2 bg-white dark:bg-zinc-800 border border-gray-200 dark:border-white/10 rounded-xl shadow-xl max-h-60 overflow-y-auto">
                               {availableModels
                                  .filter(model => model.toLowerCase().includes(openRouterModel.toLowerCase()))
                                  .map(model => (
                                  <div 
                                     key={model}
                                     onMouseDown={() => {
                                        setOpenRouterModel(model);
                                        setIsModelDropdownOpen(false);
                                     }}
                                     className="px-4 py-3  text-sm cursor-pointer border-b border-gray-100 dark:border-white/5 last:border-0 hover:bg-gray-50 dark:hover:bg-white/5 text-gray-900 dark:text-white transition-colors"
                                  >
                                     {model}
                                  </div>
                               ))}
                            </div>
                         )}
                      </div>
                   </div>
                )}
             </div>

             {/* Telegram Config */}
             <div className="pt-8 border-t border-gray-100 dark:border-white/5">
                <h4 className="text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-4">Integração Externa (Telegram / API)</h4>
                
                <div className="flex flex-col md:flex-row gap-6">
                   <div className="flex-1 space-y-4">
                      <div>
                         <label className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1 block">Seu Token de Usuário</label>
                         <div className="flex items-center gap-2 w-full max-w-sm">
                            <input readOnly value={user.uid} className="bg-gray-50 dark:bg-black/30 border border-gray-200 dark:border-white/10 px-3 py-2.5 rounded-lg w-full text-gray-600 dark:text-gray-400 font-mono text-xs outline-none" />
                            <button onClick={copyToken} className="shrink-0 flex items-center justify-center p-3 bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white rounded-lg transition-colors border border-gray-200 dark:border-white/10">
                               {copiedToken ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                            </button>
                         </div>
                      </div>

                      <div className="bg-gray-50 dark:bg-white/[0.02] border border-gray-200 dark:border-white/5 rounded-xl p-4 text-sm text-gray-600 dark:text-gray-400">
                         <ol className="list-decimal pl-4 space-y-2">
                             <li>Crie um Bot no <a href="https://t.me/BotFather" target="_blank" className="text-blue-500 hover:underline">@BotFather</a></li>
                             <li>Vá em <b>Settings &rarr; API Keys & Secrets</b> do AI Studio</li>
                             <li>Adicione a variável <code className="bg-gray-200 dark:bg-white/10 px-1 py-0.5 rounded font-mono text-[10px]">TELEGRAM_BOT_TOKEN</code></li>
                             <li>Recarregue a página!</li>
                         </ol>
                      </div>
                   </div>

                   <div className="flex-1">
                       <label className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-2 block">Requisição via API Genérica</label>
                       <div className="bg-gray-900 rounded-xl p-4 overflow-x-auto shadow-inner border border-gray-800">
                           <pre className="text-xs font-mono text-gray-300 leading-relaxed">
{`POST /api/telegram-webhook
Content-Type: application/json

{
  "userId": "${user.uid}",
  "text": "Uber 25,00 no cartão Nubank"
}`}
                           </pre>
                       </div>
                   </div>
                </div>

             </div>
          </div>
       </section>

       {/* CSV Import */}
       <section className="bg-white dark:bg-[#121214] border border-gray-200 dark:border-white/5 shadow-sm rounded-2xl p-6 sm:p-8">
          <div className="flex items-center gap-3 mb-6">
             <div className="w-10 h-10 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-500 rounded-xl flex items-center justify-center">
                <Database className="w-5 h-5" />
             </div>
             <div>
               <h3 className="text-lg font-bold text-gray-900 dark:text-white">Fonte de Dados</h3>
               <p className="text-xs text-gray-500">Importação em lote de registros via CSV.</p>
             </div>
          </div>

          <div className="space-y-4">
             <div className="bg-gray-50 dark:bg-white/[0.02] border border-gray-200 dark:border-white/5 rounded-xl p-4">
               <p className="text-[10px] text-gray-500 uppercase tracking-wider font-bold mb-2 flex items-center gap-2">Formato das Colunas (Ordem Estrita):</p>
               <div className="flex flex-wrap gap-1.5 mt-1">
                 {["Mês", "Descrição", "Data", "Valor", "Dia", "Mês Num.", "Ano", "Categoria", "Cartão/Conta", "Natureza Pag."].map(col => (
                   <span key={col} className="text-[10px] bg-white dark:bg-black/30 border border-gray-200 dark:border-white/10 px-2 py-1 rounded text-gray-600 dark:text-gray-400 font-mono inline-block shadow-sm">{col}</span>
                 ))}
               </div>
             </div>

             <textarea 
                value={csvText}
                onChange={e => setCsvText(e.target.value)}
                placeholder="12/2026, Uber Viagem, 12/12/2026, 25.00..."
                className="w-full h-32 bg-gray-50 dark:bg-black/30 border border-gray-200 dark:border-white/10 p-4 rounded-xl text-gray-900 dark:text-gray-300 text-sm font-mono focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all shadow-inner custom-scrollbar"
                disabled={isImporting}
             ></textarea>
             
             <div className="flex justify-end pt-2">
                <button 
                   onClick={handleImportCSV} 
                   disabled={isImporting || !csvText.trim()}
                   className="bg-gray-900 dark:bg-white text-white dark:text-black px-6 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider hover:bg-gray-800 dark:hover:bg-gray-100 transition-all shadow-sm shadow-gray-900/10 dark:shadow-white/10 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                   {isImporting ? <div className="w-4 h-4 border-2 border-current border-r-transparent rounded-full animate-spin"></div> : <Upload className="w-4 h-4" />} 
                   {isImporting ? 'Processando...' : 'Importar Lote'}
                </button>
             </div>
          </div>
       </section>
    </div>
  );
}
