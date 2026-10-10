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
  const [csvMessage, setCsvMessage] = useState<string | null>(null);
  const [modelError, setModelError] = useState<string | null>(null);

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
      setModelError('Não foi possível carregar os modelos.');
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
          setCsvMessage(`✅ ${imported} transação(ões) importada(s) com sucesso!`);
          setCsvText('');
      } catch (e: any) {
          console.error(typeof e === 'object' && e !== null && 'message' in e ? e.message : String(e));
          setCsvMessage('❌ Erro ao importar CSV.');
      } finally {
          setIsImporting(false);
      }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-24 font-sans text-gray-900 dark:text-white">
       
       <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 py-4 border-b border-gray-100 dark:border-white/5 mb-6">
         <div>
           <div className="flex items-center gap-2 mb-1">
             <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Parâmetros Globais</span>
           </div>
           <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900 dark:text-white">Integração & Alertas</h2>
           <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Gerencie limites de consumo, provedores de IA e importações de dados.</p>
         </div>
         
         <div className="flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-full bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-300">
            {saveStatus === "saving" && <span className="flex items-center gap-2"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Salvando...</span>}
            {saveStatus === "saved" && <span className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400"><Check className="w-3.5 h-3.5" /> Salvo automaticamente</span>}
            {saveStatus === "error" && <span className="flex items-center gap-2 text-rose-500">Erro ao salvar</span>}
            {saveStatus === "idle" && <span className="flex items-center gap-2"><Check className="w-3.5 h-3.5" /> Sincronizado</span>}
         </div>
       </div>

       {/* Orçamento e Alertas */}
       <section className="bg-white dark:bg-[#121214] border border-gray-100 dark:border-white/5 rounded-3xl p-6 sm:p-8 shadow-sm">
          <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-100 dark:border-white/5">
             <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
                <BellRing className="w-5 h-5" />
             </div>
             <div>
               <h3 className="text-base font-bold text-gray-900 dark:text-white">Orçamento e Alertas</h3>
               <p className="text-xs text-gray-500 dark:text-gray-400">Defina tetos operacionais para notificações no Telegram.</p>
             </div>
          </div>

          <div className="space-y-6">
             <div>
                <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 block mb-2">Limite Global Mensal</label>
                <div className="flex items-center gap-3 max-w-sm">
                   <div className="relative flex-1 flex items-center bg-gray-50 dark:bg-white/[0.03] border border-gray-200 dark:border-white/10 rounded-2xl overflow-hidden focus-within:ring-2 focus-within:ring-emerald-500/20 focus-within:border-emerald-500 transition-all">
                      <span className="text-xs font-medium text-gray-400 dark:text-gray-500 pl-3.5">R$</span>
                      <input 
                         type="number" 
                         placeholder="0,00"
                         value={overallLimit}
                         onChange={e => setOverallLimit(e.target.value)}
                         className="bg-transparent w-full pl-2 pr-3.5 py-2.5 text-gray-900 dark:text-white font-semibold text-sm outline-none"
                      />
                   </div>
                </div>
             </div>

             <div>
                <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 block mb-3">Limites por Categoria</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                   {userSettings.categories?.map(cat => (
                      <div key={cat} className="bg-gray-50 dark:bg-white/[0.02] border border-gray-200/80 dark:border-white/5 rounded-2xl p-3 flex flex-col gap-2">
                         <span className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate" title={cat}>{cat}</span>
                         <div className="relative flex items-center bg-white dark:bg-[#18181B] border border-gray-200 dark:border-white/10 rounded-xl px-2.5 py-1.5 focus-within:border-emerald-500 transition-colors">
                            <span className="text-[11px] text-gray-400 font-medium">R$</span>
                            <input 
                               type="number" 
                               placeholder="-"
                               value={catLimits[cat] || ''}
                               onChange={e => setCatLimits(prev => ({...prev, [cat]: e.target.value}))}
                               className="bg-transparent text-sm w-full font-semibold text-gray-900 dark:text-white outline-none pl-1.5 text-right"
                            />
                         </div>
                      </div>
                   ))}
                   {(!userSettings.categories || userSettings.categories.length === 0) && (
                      <p className="text-xs text-gray-400 col-span-full">Nenhuma categoria cadastrada.</p>
                   )}
                </div>
             </div>
          </div>
       </section>

       {/* Assistente & IA */}
       <section className="bg-white dark:bg-[#121214] border border-gray-100 dark:border-white/5 rounded-3xl p-6 sm:p-8 shadow-sm">
          <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-100 dark:border-white/5">
             <div className="w-9 h-9 rounded-xl bg-purple-500/10 text-purple-500 flex items-center justify-center">
                <Sparkles className="w-5 h-5" />
             </div>
             <div>
               <h3 className="text-base font-bold text-gray-900 dark:text-white">Assistente Inteligente & IA</h3>
               <p className="text-xs text-gray-500 dark:text-gray-400">Integração do Telegram e auditoria preditiva.</p>
             </div>
          </div>

          <div className="space-y-6">
             
             {/* Model Provider Config */}
             <div>
                <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-3">Provedor de IA</h4>
                <div className="flex flex-col sm:flex-row gap-3 mb-4">
                   <label className={`flex-1 flex items-center gap-3 p-4 rounded-2xl border cursor-pointer transition-all ${aiProvider === 'gemini' ? 'border-emerald-500/50 bg-emerald-50/50 dark:bg-emerald-500/10 text-gray-900 dark:text-white' : 'border-gray-200 dark:border-white/5 bg-gray-50/50 dark:bg-white/[0.02] text-gray-700 dark:text-gray-300 hover:border-gray-300'}`}>
                      <input type="radio" value="gemini" checked={aiProvider === 'gemini'} onChange={(e) => setAiProvider(e.target.value as 'gemini' | 'openrouter')} className="w-4 h-4 accent-emerald-500 cursor-pointer" />
                      <div>
                        <span className="font-semibold text-sm block">Google Gemini API</span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">Padrão inteligente de alta performance</span>
                      </div>
                   </label>
                   <label className={`flex-1 flex items-center gap-3 p-4 rounded-2xl border cursor-pointer transition-all ${aiProvider === 'openrouter' ? 'border-purple-500/50 bg-purple-50/50 dark:bg-purple-500/10 text-gray-900 dark:text-white' : 'border-gray-200 dark:border-white/5 bg-gray-50/50 dark:bg-white/[0.02] text-gray-700 dark:text-gray-300 hover:border-gray-300'}`}>
                      <input type="radio" value="openrouter" checked={aiProvider === 'openrouter'} onChange={(e) => setAiProvider(e.target.value as 'openrouter' | 'gemini')} className="w-4 h-4 accent-purple-500 cursor-pointer" />
                      <div>
                        <span className="font-semibold text-sm block">OpenRouter API</span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">Modelos flexíveis como Claude, GPT-4, etc.</span>
                      </div>
                   </label>
                </div>

                {aiProvider === 'openrouter' && (
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                      <div className="bg-gray-50 dark:bg-white/[0.02] border border-gray-200 dark:border-white/10 rounded-2xl p-4">
                         <label className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 block">OpenRouter API Key</label>
                         <input 
                            type="password" 
                            value={openRouterApiKey}
                            onChange={e => setOpenRouterApiKey(e.target.value)}
                            placeholder="sk-or-v1-..."
                            className="bg-white dark:bg-[#18181B] border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2 w-full text-xs font-mono text-gray-900 dark:text-white outline-none focus:border-purple-500 transition-colors"
                         />
                      </div>
                      <div className="bg-gray-50 dark:bg-white/[0.02] border border-gray-200 dark:border-white/10 rounded-2xl p-4 relative">
                         <div className="flex items-center justify-between mb-2">
                            <label className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider block">Modelo OpenRouter</label>
                            <button 
                               onClick={fetchOpenRouterModels}
                               disabled={isLoadingModels}
                               className="text-xs font-semibold text-purple-600 dark:text-purple-400 hover:underline disabled:opacity-50 cursor-pointer"
                            >
                               {isLoadingModels ? 'Buscando...' : 'Carregar Modelos'}
                            </button>
                         </div>
                         <input 
                            type="text" 
                            value={openRouterModel}
                            onChange={e => { setOpenRouterModel(e.target.value); setIsModelDropdownOpen(true); }}
                            onFocus={() => setIsModelDropdownOpen(true)}
                            onBlur={() => setTimeout(() => setIsModelDropdownOpen(false), 200)}
                            placeholder="openai/gpt-4o-mini"
                            className="bg-white dark:bg-[#18181B] border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2 w-full text-xs font-mono text-gray-900 dark:text-white outline-none focus:border-purple-500 transition-colors"
                         />
                         
                         {isModelDropdownOpen && availableModels && availableModels.length > 0 && (
                            <div className="absolute z-20 left-4 right-4 top-full mt-2 bg-white dark:bg-[#18181B] border border-gray-200 dark:border-white/10 rounded-xl shadow-xl max-h-60 overflow-y-auto">
                               {availableModels
                                  .filter(model => model.toLowerCase().includes(openRouterModel.toLowerCase()))
                                  .map(model => (
                                  <div 
                                     key={model}
                                     onMouseDown={() => {
                                        setOpenRouterModel(model);
                                        setIsModelDropdownOpen(false);
                                     }}
                                     className="px-4 py-2.5 text-xs font-mono cursor-pointer border-b border-gray-100 dark:border-white/5 last:border-0 hover:bg-gray-100 dark:hover:bg-white/5 text-gray-800 dark:text-gray-200"
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
             <div className="pt-6 border-t border-gray-100 dark:border-white/5">
                <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-4">Integração Externa &bull; Telegram / API</h4>
                
                <div className="flex flex-col md:flex-row gap-6">
                   <div className="flex-1 space-y-4">
                      <div>
                         <label className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5 block">Seu Token de Usuário</label>
                         <div className="flex items-center gap-2 w-full max-w-sm">
                            <input readOnly value={user.uid} className="bg-gray-50 dark:bg-white/[0.03] border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2 w-full text-gray-700 dark:text-gray-300 font-mono text-xs outline-none" />
                            <button onClick={copyToken} className="shrink-0 flex items-center justify-center p-2 rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-white/10 dark:hover:bg-white/20 text-gray-700 dark:text-gray-300 transition-colors cursor-pointer" title="Copiar Token">
                               {copiedToken ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                            </button>
                         </div>
                      </div>

                      <div className="bg-gray-50 dark:bg-white/[0.02] border border-gray-200 dark:border-white/5 rounded-2xl p-4 text-xs leading-relaxed text-gray-600 dark:text-gray-400">
                         <ol className="list-decimal pl-4 space-y-1.5">
                             <li>Crie um Bot no <a href="https://t.me/BotFather" target="_blank" rel="noreferrer" className="text-emerald-600 dark:text-emerald-400 hover:underline font-semibold">@BotFather</a></li>
                             <li>Vá em <b>Settings &rarr; API Keys & Secrets</b> do AI Studio</li>
                             <li>Adicione a variável <code className="bg-gray-200 dark:bg-white/10 px-1.5 py-0.5 rounded text-[11px] font-mono text-gray-900 dark:text-white">TELEGRAM_BOT_TOKEN</code></li>
                             <li>Recarregue a página!</li>
                         </ol>
                      </div>
                   </div>

                   <div className="flex-1">
                       <label className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5 block">Requisição via API Genérica</label>
                       <div className="bg-gray-900 text-gray-200 p-4 rounded-2xl border border-gray-800 overflow-x-auto">
                           <pre className="text-xs font-mono leading-relaxed">
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
       <section className="bg-white dark:bg-[#121214] border border-gray-100 dark:border-white/5 rounded-3xl p-6 sm:p-8 shadow-sm">
          <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-100 dark:border-white/5">
             <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center">
                <Database className="w-5 h-5" />
             </div>
             <div>
               <h3 className="text-base font-bold text-gray-900 dark:text-white">Fonte de Dados</h3>
               <p className="text-xs text-gray-500 dark:text-gray-400">Importação em lote de registros via CSV.</p>
             </div>
          </div>

          <div className="space-y-4">
             <div className="bg-gray-50 dark:bg-white/[0.02] border border-gray-200 dark:border-white/5 rounded-2xl p-4">
               <p className="text-[11px] text-gray-500 dark:text-gray-400 uppercase tracking-wider font-semibold mb-2">Formato das Colunas (ordem estrita):</p>
               <div className="flex flex-wrap gap-1.5 mt-1">
                 {["Mês", "Descrição", "Data", "Valor", "Dia", "Mês Num.", "Ano", "Categoria", "Cartão/Conta", "Natureza Pag."].map(col => (
                   <span key={col} className="text-[11px] font-medium bg-gray-100 dark:bg-white/5 px-2.5 py-1 rounded-lg text-gray-700 dark:text-gray-300">{col}</span>
                 ))}
               </div>
             </div>

             <textarea 
                value={csvText}
                onChange={e => setCsvText(e.target.value)}
                placeholder="12/2026, Uber Viagem, 12/12/2026, 25.00..."
                className="w-full h-32 bg-gray-50 dark:bg-white/[0.02] border border-gray-200 dark:border-white/10 rounded-2xl p-4 text-gray-900 dark:text-white text-xs font-mono outline-none placeholder:text-gray-400 focus:border-blue-500 transition-colors"
                disabled={isImporting}
             ></textarea>
             
             {csvMessage && <div className="p-3.5 bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-xs font-medium text-gray-900 dark:text-white">{csvMessage}</div>}
              <div className="flex justify-end pt-2">
                <button 
                   onClick={handleImportCSV} 
                   disabled={isImporting || !csvText.trim()}
                   className="bg-gray-900 dark:bg-white text-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-100 px-6 py-2.5 rounded-xl font-medium text-xs tracking-wider transition-colors flex items-center gap-2 disabled:opacity-40 cursor-pointer shadow-sm"
                >
                   {isImporting ? <div className="w-3.5 h-3.5 border-2 border-current border-r-transparent animate-spin rounded-full"></div> : <Upload className="w-3.5 h-3.5" />} 
                   {isImporting ? 'Processando...' : 'Importar Lote'}
                </button>
             </div>
          </div>
       </section>
    </div>
  );
}