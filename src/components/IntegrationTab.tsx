import React, { useState } from 'react';
import { User } from 'firebase/auth';
import { UserSettings } from '../types';
import { Bot, BellRing, Save, Upload, Terminal, MessageSquare, Key, ArrowRight, Check } from 'lucide-react';
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

  const [isSaving, setIsSaving] = useState(false);
  const [showSaveSuccess, setShowSaveSuccess] = useState(false);
  const [isSavingAI, setIsSavingAI] = useState(false);
  const [showSaveSuccessAI, setShowSaveSuccessAI] = useState(false);
  const [copiedToken, setCopiedToken] = useState(false);
  
  const [csvText, setCsvText] = useState('');
  const [isImporting, setIsImporting] = useState(false);

  const [availableModels, setAvailableModels] = useState<string[] | null>(null);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);

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
      alert(`Não foi possível carregar os modelos. Detalhe: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setIsLoadingModels(false);
    }
  };

  const handleSaveLimits = async () => {
     setIsSaving(true);
     setShowSaveSuccess(false);
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
           }
        });
        setShowSaveSuccess(true);
        setTimeout(() => setShowSaveSuccess(false), 3000);
     } catch (e) {
        console.error(e instanceof Error ? e.message : String(e));
        alert('Erro ao salvar os limites. Verifique a conexão.');
     } finally {
        setIsSaving(false);
     }
  };

  const handleSaveAI = async () => {
      setIsSavingAI(true);
      setShowSaveSuccessAI(false);
      try {
         await updateDoc(doc(db, 'user_settings', user.uid), {
            aiProvider,
            openRouterApiKey,
            openRouterModel
         });
         setShowSaveSuccessAI(true);
         setTimeout(() => setShowSaveSuccessAI(false), 3000);
      } catch (e) {
         console.error(e instanceof Error ? e.message : String(e));
         alert('Erro ao salvar configurações de IA. Verifique a conexão.');
      } finally {
         setIsSavingAI(false);
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
// ... keep import logic inside ...
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
    <div className="max-w-6xl mx-auto space-y-8 pb-20 fade-in">
       {/* Header section */}
       <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white dark:bg-[#121214] p-6 rounded-2xl border border-gray-200 dark:border-white/5 shadow-sm">
         <div>
           <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2 tracking-tight">Integrações & Ferramentas</h2>
           <p className="text-gray-500 text-sm font-medium">Conecte IA, gerencie alertas e importe dados em lote para sua base.</p>
         </div>
       </div>

       <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
           <div className="flex flex-col gap-8">
               {/* Open Claw AI Integration */}
               <div className="bg-white dark:bg-[#121214] border border-blue-500/20 text-gray-900 dark:text-white p-8 rounded-2xl relative overflow-hidden shadow-sm flex flex-col hover:border-blue-500/40 transition-colors group">
              <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 dark:bg-blue-500/10 blur-3xl rounded-full pointer-events-none transition-transform group-hover:scale-110"></div>
              
              <div className="flex items-center gap-3 mb-6 relative z-10">
                 <div className="w-12 h-12 bg-blue-500/10 border border-blue-500/20 rounded-xl flex items-center justify-center">
                    <Bot className="w-6 h-6 text-blue-500" />
                 </div>
                 <div>
                   <h3 className="text-lg font-bold text-gray-900 dark:text-white">Integração Open Claw AI</h3>
                   <p className="text-[10px] text-blue-500 uppercase tracking-widest font-bold mt-1 inline-block bg-blue-500/10 px-2 py-0.5 rounded">Via Webhook</p>
                 </div>
              </div>
              
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-8 relative z-10 leading-relaxed font-medium">
                 Automatize o lançamento das suas finanças através de conversas. Conecte o bot Open Claw no seu WhatsApp ou Telegram e envie comandos naturais de texto ou áudio.
              </p>
              
              <div className="space-y-6 relative z-10 flex-1">
                 <div className="bg-gray-50 dark:bg-white/[0.02] border border-gray-200 dark:border-white/5 rounded-xl p-5">
                    <div className="flex items-center gap-2 mb-3">
                       <Key className="w-4 h-4 text-gray-400" />
                       <label className="text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">1. Seu Token de Integração</label>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2">
                       <input readOnly value={user.uid} className="bg-white dark:bg-black/40 border text-sm border-gray-300 dark:border-white/10 p-3 rounded-xl w-full text-gray-700 dark:text-gray-300 font-mono outline-none shadow-inner" />
                       <button onClick={copyToken} className="shrink-0 flex items-center justify-center gap-2 bg-white dark:bg-white/5 text-gray-900 dark:text-white font-bold px-6 py-3 border border-gray-300 dark:border-white/10 rounded-xl text-sm hover:bg-gray-50 dark:hover:bg-white/10 transition-colors">
                          {copiedToken ? <Check className="w-4 h-4 text-emerald-500" /> : 'Copiar'}
                       </button>
                    </div>
                    <p className="text-xs text-gray-500 mt-3 font-medium">Este token é sua chave única. Nunca compartilhe ele publicamente.</p>
                 </div>

                 <div className="bg-gray-50 dark:bg-white/[0.02] border border-gray-200 dark:border-white/5 rounded-xl p-5">
                    <div className="flex items-center gap-2 mb-3">
                       <Terminal className="w-4 h-4 text-gray-400" />
                       <label className="text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">2. Configuração do Telegram</label>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed mb-4">
                       <b>Para conectar no Telegram 🚀:</b><br/>
                       1. Crie um Bot no <a href="https://t.me/BotFather" target="_blank" className="text-blue-500 hover:underline">@BotFather</a> e copie o Token fornecido.<br/>
                       2. Como você está no Google AI Studio, vá no menu esquerdo em <b>Settings</b> &rarr; <b>API Keys & Secrets</b>.<br/>
                       3. Adicione uma variável chamada <code className="bg-gray-200 dark:bg-white/10 px-1 py-0.5 rounded">TELEGRAM_BOT_TOKEN</code> e insira o seu token.<br/>
                       4. Recarregue a página. O aplicativo se conectará automaticamente (usando Polling) com o Telegram!
                    </p>
                    
                    <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed mb-4 mt-6">
                       <b>Ou via API Customizada (ex: Open Claw):</b> Envie um POST para a rota abaixo com o seu <code className="bg-gray-200 dark:bg-white/10 px-1.5 py-0.5 rounded text-gray-800 dark:text-gray-200">userId</code>.
                    </p>
                    <div className="bg-gray-900 dark:bg-black/60 rounded-lg p-4 overflow-x-auto shadow-inner border border-gray-800 dark:border-white/5">
<pre className="text-xs font-mono text-gray-300">
{`POST /api/telegram-webhook
Content-Type: application/json

{
  "userId": "${user.uid}",
  "text": "Uber 25,00 no cartão Nubank"
}`}
</pre>
                    </div>
                 </div>

                 <div className="bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 rounded-xl p-5">
                    <div className="flex items-center gap-2 mb-2">
                       <MessageSquare className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                       <label className="text-xs font-bold uppercase tracking-wider text-blue-700 dark:text-blue-400">Exemplos de Comandos</label>
                    </div>
                    <ul className="text-sm text-blue-800 dark:text-blue-300 space-y-2 mt-3 list-none pl-0 font-medium">
                       <li className="flex items-start gap-2"><ArrowRight className="w-4 h-4 mt-0.5 opacity-50 shrink-0" /> "Almoço 45 reais no VR"</li>
                       <li className="flex items-start gap-2"><ArrowRight className="w-4 h-4 mt-0.5 opacity-50 shrink-0" /> "Salario de 5000"</li>
                       <li className="flex items-start gap-2"><ArrowRight className="w-4 h-4 mt-0.5 opacity-50 shrink-0" /> "Comprei um livro por 89,90 no Credito ontem"</li>
                    </ul>
                 </div>
              </div>
           </div>
            {/* AI Configuration */}
            <div className="bg-white dark:bg-[#121214] border border-emerald-500/20 text-gray-900 dark:text-white p-8 rounded-2xl relative overflow-hidden shadow-sm flex flex-col hover:border-emerald-500/40 transition-colors group">
               <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 dark:bg-emerald-500/10 blur-3xl rounded-full pointer-events-none transition-transform group-hover:scale-110"></div>
               
               <div className="flex items-center justify-between gap-3 mb-6 relative z-10 w-full">
                  <div className="flex items-center gap-3">
                     <div className="w-12 h-12 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center justify-center">
                        <Bot className="w-6 h-6 text-emerald-500" />
                     </div>
                     <div>
                       <h3 className="text-lg font-bold text-gray-900 dark:text-white">Motor de Inteligência Artificial</h3>
                       <p className="text-[10px] text-emerald-500 uppercase tracking-widest font-bold mt-1 inline-block bg-emerald-500/10 px-2 py-0.5 rounded">Processamento Local/Nuvem</p>
                     </div>
                  </div>
                  <button 
                      onClick={handleSaveAI} 
                      disabled={isSavingAI}
                      className="shrink-0 bg-white dark:bg-[#121214] border border-emerald-200 dark:border-emerald-900/50 text-emerald-600 dark:text-emerald-500 px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider hover:bg-emerald-50 dark:hover:bg-emerald-900/30 transition shadow-sm flex items-center gap-2 disabled:opacity-50"
                   >
                      {isSavingAI ? <div className="w-4 h-4 border-2 border-emerald-500 border-r-transparent rounded-full animate-spin"></div> : showSaveSuccessAI ? <Check className="w-4 h-4 text-emerald-500" /> : <Save className="w-4 h-4" />} 
                      <span className="hidden sm:inline">{isSavingAI ? 'Salvando...' : showSaveSuccessAI ? 'Salvo' : 'Salvar IA'}</span>
                   </button>
               </div>
               
               <p className="text-sm text-gray-600 dark:text-gray-400 mb-8 relative z-10 leading-relaxed font-medium">
                  Escolha o provedor de IA utilizado para classificar transações que chegam via Telegram.
               </p>
               
               <div className="space-y-6 relative z-10 flex-1">
                  <div className="bg-gray-50 dark:bg-white/[0.02] border border-gray-200 dark:border-white/5 rounded-xl p-5">
                     <label className="text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-3 block">Provedor Principal</label>
                     <div className="flex flex-col sm:flex-row gap-4 mb-4">
                        <label className={`flex-1 flex items-center gap-3 p-4 border rounded-xl cursor-pointer transition-colors ${aiProvider === 'gemini' ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-500/10' : 'border-gray-200 dark:border-white/10 hover:border-emerald-300 dark:hover:border-emerald-500/30'}`}>
                           <input type="radio" value="gemini" checked={aiProvider === 'gemini'} onChange={(e) => setAiProvider(e.target.value as 'gemini' | 'openrouter')} className="accent-emerald-500 w-4 h-4" />
                           <span className="font-bold text-sm text-gray-900 dark:text-white mt-0.5">Google Gemini API</span>
                        </label>
                        <label className={`flex-1 flex items-center gap-3 p-4 border rounded-xl cursor-pointer transition-colors ${aiProvider === 'openrouter' ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-500/10' : 'border-gray-200 dark:border-white/10 hover:border-emerald-300 dark:hover:border-emerald-500/30'}`}>
                           <input type="radio" value="openrouter" checked={aiProvider === 'openrouter'} onChange={(e) => setAiProvider(e.target.value as 'gemini' | 'openrouter')} className="accent-emerald-500 w-4 h-4" />
                           <span className="font-bold text-sm text-gray-900 dark:text-white mt-0.5">OpenRouter</span>
                        </label>
                     </div>

                     {aiProvider === 'openrouter' && (
                        <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                           <div className="bg-white dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-4 shadow-inner">
                              <label className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-2 block">OpenRouter API Key</label>
                              <input 
                                 type="password" 
                                 value={openRouterApiKey}
                                 onChange={e => setOpenRouterApiKey(e.target.value)}
                                 placeholder="sk-or-v1-..."
                                 className="bg-transparent border-none w-full text-sm font-mono text-gray-900 dark:text-white outline-none"
                              />
                           </div>
                           <div className="bg-white dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-4 shadow-inner">
                              <div className="flex items-center justify-between mb-2">
                                 <label className="text-[10px] font-bold uppercase tracking-wider text-gray-500 block">Modelo OpenRouter</label>
                                 <button 
                                    onClick={fetchOpenRouterModels}
                                    disabled={isLoadingModels}
                                    className="text-[10px] font-bold uppercase tracking-wider text-emerald-500 hover:text-emerald-600 disabled:opacity-50"
                                 >
                                    {isLoadingModels ? 'Buscando...' : 'Carregar Modelos'}
                                 </button>
                              </div>
                              <div className="relative">
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
                                    <div className="absolute z-10 w-full mt-2 bg-white dark:bg-zinc-800 border border-gray-200 dark:border-white/10 rounded-xl shadow-lg max-h-60 overflow-y-auto">
                                       {availableModels
                                          .filter(model => model.toLowerCase().includes(openRouterModel.toLowerCase()))
                                          .map(model => (
                                          <div 
                                             key={model}
                                             onClick={() => {
                                                setOpenRouterModel(model);
                                                setIsModelDropdownOpen(false);
                                             }}
                                             className="px-4 py-2 text-sm cursor-pointer hover:bg-gray-100 dark:hover:bg-white/5 text-gray-900 dark:text-white transition-colors"
                                          >
                                             {model}
                                          </div>
                                       ))}
                                       {openRouterModel && !availableModels.some(model => model.toLowerCase() === openRouterModel.toLowerCase()) && (
                                          <div 
                                             onClick={() => setIsModelDropdownOpen(false)}
                                             className="px-4 py-2 text-sm text-emerald-600 dark:text-emerald-400 italic cursor-pointer"
                                          >
                                             Usar modelo personalizado: <b>{openRouterModel}</b>
                                          </div>
                                       )}
                                       {availableModels.filter(model => model.toLowerCase().includes(openRouterModel.toLowerCase())).length === 0 && !openRouterModel && (
                                         <div className="px-4 py-2 text-sm text-gray-500">Nenhum modelo encontrado.</div>
                                       )}
                                    </div>
                                 )}
                              </div>
                           </div>
                        </div>
                     )}
                     
                     {aiProvider === 'gemini' && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 font-medium pb-2">O Gemini utilizará a API Key configurada globalmente em seu Google AI Studio.</p>
                     )}
                  </div>
               </div>
            </div>
           </div>

           <div className="flex flex-col gap-8">
               {/* Spending Alerts */}
               <div className="bg-white dark:bg-[#121214] border border-orange-500/20 p-8 rounded-2xl relative overflow-hidden shadow-sm flex flex-col hover:border-orange-500/40 transition-colors group">
                  <div className="absolute top-0 right-0 w-48 h-48 bg-orange-500/5 blur-3xl rounded-full pointer-events-none transition-transform group-hover:scale-110"></div>
                  
                  <div className="flex items-center justify-between mb-8 relative z-10 gap-4">
                     <div className="flex items-center gap-3">
                         <div className="w-12 h-12 bg-orange-50 dark:bg-orange-500/10 border border-orange-200 dark:border-orange-500/20 rounded-xl flex items-center justify-center text-orange-500">
                            <BellRing className="w-6 h-6" />
                         </div>
                         <div>
                           <h3 className="text-lg font-bold text-gray-900 dark:text-white">Alertas de Controle</h3>
                           <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold mt-1">Gatilhos do Telegram</p>
                         </div>
                     </div>
                     <button 
                         onClick={handleSaveLimits} 
                         disabled={isSaving}
                         className="shrink-0 bg-white dark:bg-[#121214] border border-orange-200 dark:border-orange-900/50 text-orange-600 dark:text-orange-500 px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider hover:bg-orange-50 dark:hover:bg-orange-900/30 transition shadow-sm flex items-center gap-2 disabled:opacity-50"
                      >
                         {isSaving ? <div className="w-4 h-4 border-2 border-orange-500 border-r-transparent rounded-full animate-spin"></div> : showSaveSuccess ? <Check className="w-4 h-4 text-emerald-500" /> : <Save className="w-4 h-4" />} 
                         <span className="hidden sm:inline">{isSaving ? 'Salvando...' : showSaveSuccess ? 'Salvo' : 'Salvar Alertas'}</span>
                      </button>
                  </div>

                  <div className="space-y-6 relative z-10 flex-1">
                     <div className="bg-orange-50/50 dark:bg-orange-950/20 p-5 rounded-xl border border-orange-100 dark:border-orange-900/30">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-orange-800 dark:text-orange-400 block mb-2">Limite Mensal Global</label>
                        <p className="text-xs text-orange-700/70 dark:text-orange-400/70 mb-4 font-medium">Alerta disparado ao ultrapassar os limites da carteira</p>
                        <div className="flex items-center gap-3 max-w-sm">
                           <span className="text-orange-600 dark:text-orange-500 font-bold bg-white dark:bg-black/40 px-4 py-3 rounded-xl border border-orange-200 dark:border-orange-900/50 shadow-inner">R$</span>
                           <input 
                              type="number" 
                              placeholder="0,00"
                              value={overallLimit}
                              onChange={e => setOverallLimit(e.target.value)}
                              className="bg-white dark:bg-black/40 border text-base font-semibold border-orange-200 dark:border-orange-900/50 p-3 rounded-xl w-full text-gray-900 dark:text-white outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 transition-all shadow-inner"
                           />
                        </div>
                     </div>

                     <div>
                        <label className="text-[10px] font-bold uppercase tracking-wider text-gray-500 block mb-4">Orçamento Específico por Categoria</label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                           {userSettings.categories?.map(cat => (
                              <div key={cat} className="flex items-center justify-between gap-3 p-3 rounded-xl bg-gray-50 dark:bg-white/[0.02] border border-gray-200 dark:border-white/5 hover:border-orange-300 dark:hover:border-orange-500/30 transition-colors group">
                                 <span className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate" title={cat}>{cat}</span>
                                 <div className="flex items-center gap-2 w-28 shrink-0 relative bg-white dark:bg-black/40 rounded-lg border border-gray-200 dark:border-white/10 px-2 py-1.5 focus-within:border-orange-500 focus-within:ring-1 focus-within:ring-orange-500/20">
                                    <span className="text-gray-400 text-xs font-medium">R$</span>
                                    <input 
                                       type="number" 
                                       placeholder="-"
                                       value={catLimits[cat] || ''}
                                       onChange={e => setCatLimits(prev => ({...prev, [cat]: e.target.value}))}
                                       className="bg-transparent text-sm w-full font-semibold text-gray-900 dark:text-white outline-none text-right"
                                    />
                                 </div>
                              </div>
                           ))}
                           {(!userSettings.categories || userSettings.categories.length === 0) && (
                              <p className="text-sm font-medium text-gray-500">Nenhuma categoria cadastrada. Adicione em Parametrização.</p>
                           )}
                        </div>
                     </div>
                  </div>
               </div>

               {/* CSV Import */}
               <div className="bg-white dark:bg-[#121214] border border-gray-200 dark:border-white/5 p-8 rounded-2xl relative overflow-hidden shadow-sm flex flex-col group hover:border-gray-300 dark:hover:border-white/10 transition-colors">
                   <div className="flex items-center gap-3 mb-6 relative z-10">
                      <div className="w-12 h-12 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl flex items-center justify-center text-gray-600 dark:text-gray-400 group-hover:text-emerald-500 group-hover:bg-emerald-500/10 group-hover:border-emerald-500/20 transition-colors">
                         <Upload className="w-6 h-6" />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white">Importação em Lote</h3>
                        <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold mt-1">Colar CSV Bruto</p>
                      </div>
                   </div>

                   <div className="space-y-4">
                      <div className="bg-gray-50 dark:bg-white/[0.02] border border-gray-200 dark:border-white/5 rounded-xl p-4">
                        <p className="text-[10px] text-gray-500 uppercase tracking-wider font-bold mb-2 flex items-center gap-2"><ArrowRight className="w-3 h-3 text-emerald-500" /> Colunas Esperadas, Em Ordem:</p>
                        <div className="flex flex-wrap gap-1.5 mt-1">
                          {["Mês", "Descrição", "Data", "Valor", "Dia", "Mês Num.", "Ano", "Categoria", "Cartão/Conta", "Natureza Pag."].map(col => (
                            <span key={col} className="text-[10px] bg-white dark:bg-black/40 border border-gray-200 dark:border-white/10 px-2 py-1 rounded text-gray-600 dark:text-gray-400 font-mono inline-block">{col}</span>
                          ))}
                        </div>
                      </div>

                      <textarea 
                         value={csvText}
                         onChange={e => setCsvText(e.target.value)}
                         placeholder="12/2026, Uber Viagem, 12/12/2026, 25.00..."
                         className="w-full h-40 bg-white dark:bg-black/40 border border-gray-300 dark:border-white/10 p-4 rounded-xl text-gray-900 dark:text-gray-300 text-sm font-mono focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all shadow-inner custom-scrollbar"
                         disabled={isImporting}
                      ></textarea>
                      <div className="flex justify-end pt-2">
                         <button 
                            onClick={handleImportCSV} 
                            disabled={isImporting || !csvText.trim()}
                            className="bg-emerald-500 text-black px-6 py-3 rounded-xl font-bold text-xs uppercase tracking-wider hover:bg-emerald-400 transition-all shadow-lg shadow-emerald-500/20 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-emerald-500/40"
                         >
                            {isImporting ? <div className="w-4 h-4 border-2 border-black border-r-transparent rounded-full animate-spin"></div> : <Upload className="w-4 h-4" />} 
                            {isImporting ? 'Processando...' : 'Importar Transações'}
                         </button>
                      </div>
                   </div>
                </div>
           </div>
       </div>
    </div>
  );
}

