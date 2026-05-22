import React, { useState, useEffect, useRef } from 'react';
import { UserSettings } from '../types';
import { User } from 'firebase/auth';
import { db } from '../lib/firebase';
import { doc, setDoc, collection, query, where, getDocs, writeBatch } from 'firebase/firestore';
import { Trash2, Plus, Wrench, ArrowDownRight, ArrowUpRight, CreditCard, Database, ShieldAlert, Check, Loader2, ChevronUp, ChevronDown, GripVertical } from 'lucide-react';

interface Props {
  user: User;
  userSettings: UserSettings;
}

const PRESET_COLORS = [
  '#fecaca', '#fed7aa', '#fef08a', '#d9f99d', '#bbf7d0', '#a7f3d0', 
  '#99f6e4', '#bae6fd', '#bfdbfe', '#c7d2fe', '#ddd6fe', '#fbcfe8', '#fecdd3',
  '#ef4444', '#f97316', '#eab308', '#22c55e', '#0ea5e9', '#3b82f6', '#a855f7', '#ec4899', '#737373', '#9ca3af'
];

const ColorPicker = ({ value, onChange }: { value: string, onChange: (val: string) => void }) => {
  return (
    <div className="relative group shrink-0">
      <label className="cursor-pointer w-6 h-6 rounded-full border border-gray-300 dark:border-white/20 shadow-sm block overflow-hidden transition-transform group-hover:scale-110" style={{ backgroundColor: value }}>
        <input type="color" value={value} onChange={e => onChange(e.target.value)} className="opacity-0 w-full h-full cursor-pointer" />
      </label>
    </div>
  );
};

const SortableConfigList = ({
  title, 
  icon,
  items, 
  setItems
}: {
  title: string, 
  icon: React.ReactNode,
  items: {name: string, color: string}[], 
  setItems: React.Dispatch<React.SetStateAction<{name: string, color: string}[]>>
}) => {
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  // Focus ref so we can keep focus if needed, but standard uncontrolled/controlled should be fine if not remounting
  return (
    <div className="bg-white dark:bg-[#121214] border border-gray-200 dark:border-white/5 p-6 rounded-2xl relative overflow-hidden flex flex-col h-full shadow-sm hover:border-gray-300 dark:hover:border-white/10 transition-colors">
       <div className="flex justify-between items-start mb-6">
         <div className="flex items-center gap-3">
           <div className="p-2.5 rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/5 text-gray-900 dark:text-gray-100">
             {icon}
           </div>
           <h3 className="text-sm font-bold uppercase tracking-wider text-gray-900 dark:text-white">{title}</h3>
         </div>
       </div>

       <div className="flex-1 flex flex-col gap-3">
          {items.map((item, idx) => (
            <div 
              key={idx} 
              draggable="true"
              onDragStart={(e) => {
                e.dataTransfer.effectAllowed = 'move';
                setDraggedIdx(idx);
              }}
              onDragOver={(e) => {
                e.preventDefault();
                if (draggedIdx === null || draggedIdx === idx) return;
                setDragOverIdx(idx);
              }}
              onDragLeave={() => {
                if (dragOverIdx === idx) setDragOverIdx(null);
              }}
              onDrop={(e) => {
                e.preventDefault();
                if (draggedIdx === null || draggedIdx === idx) return;
                const newItems = [...items];
                const temp = newItems[draggedIdx];
                newItems.splice(draggedIdx, 1);
                newItems.splice(idx, 0, temp);
                setItems(newItems);
                setDraggedIdx(null);
                setDragOverIdx(null);
              }}
              onDragEnd={() => {
                setDraggedIdx(null);
                setDragOverIdx(null);
              }}
              className={`flex items-center gap-3 bg-white dark:bg-[#18181b] border rounded-xl p-1.5 group transition-all shadow-sm
                ${draggedIdx === idx ? 'opacity-40 border-emerald-500/50 scale-95 shadow-none' : ''}
                ${dragOverIdx === idx ? 'border-emerald-500 scale-[1.02] bg-emerald-50 dark:bg-emerald-500/10 shadow-md' : 'border-gray-200 dark:border-white/10 hover:border-gray-300 dark:hover:border-white/20 hover:shadow-md'}`}
            >
               <div className="flex flex-col opacity-20 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing px-1 text-gray-400 hover:text-gray-900 dark:hover:text-white touch-none">
                  <GripVertical className="w-4 h-4" />
               </div>
               <div className="shrink-0">
                  <ColorPicker value={item.color} onChange={val => {
                     const newItems = [...items];
                     newItems[idx].color = val;
                     setItems(newItems);
                  }} />
               </div>
               <input 
                  value={item.name} 
                  onChange={e => {
                     const newItems = [...items];
                     newItems[idx].name = e.target.value;
                     setItems(newItems);
                  }}
                  placeholder="Nome do item..."
                  className="flex-1 bg-transparent border-none py-2 text-sm font-medium text-gray-900 dark:text-white focus:outline-none focus:ring-0 placeholder-gray-400 dark:placeholder-gray-600 w-full min-w-0"
               />
               <button 
                 onClick={() => setItems(items.filter((_, i) => i !== idx))}
                 className="text-gray-400 hover:text-red-500 p-2.5 opacity-0 group-hover:opacity-100 transition-all rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 focus:opacity-100 focus:outline-none shrink-0"
                 title="Remover"
               >
                 <Trash2 className="w-4 h-4" />
               </button>
            </div>
          ))}
          <button 
             onClick={() => setItems([...items, { name: '', color: PRESET_COLORS[Math.floor(Math.random() * PRESET_COLORS.length)] }])}
             className="mt-2 flex items-center justify-center gap-2 h-11 border-2 border-dashed border-gray-200 dark:border-white/10 rounded-xl text-emerald-600 dark:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-500/5 hover:border-emerald-200 dark:hover:border-emerald-500/20 transition-all font-medium text-sm"
          >
             <Plus className="w-4 h-4" />
             Adicionar Item
          </button>
       </div>
     </div>
  );
};

export function SettingsTab({ user, userSettings }: Props) {
  const [categories, setCategories] = useState<{name: string, color: string}[]>(() => {
    return userSettings.categories.map(c => ({
      name: c,
      color: userSettings.categoryColors?.[c] || PRESET_COLORS[Math.floor(Math.random() * PRESET_COLORS.length)]
    }));
  });

  const [incomeCategories, setIncomeCategories] = useState<{name: string, color: string}[]>(() => {
    return (userSettings.incomeCategories || ['Salário', 'Investimentos', 'Outros']).map(c => ({
      name: c,
      color: userSettings.categoryColors?.[c] || PRESET_COLORS[Math.floor(Math.random() * PRESET_COLORS.length)]
    }));
  });

  const [cards, setCards] = useState<{name: string, color: string}[]>(() => {
    return userSettings.cards.map(c => ({
      name: c,
      color: userSettings.cardColors?.[c] || PRESET_COLORS[Math.floor(Math.random() * PRESET_COLORS.length)]
    }));
  });

  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const initialRender = useRef(true);

  const [isFixing, setIsFixing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteStatusMsg, setDeleteStatusMsg] = useState("");
  const [fixStatusMsg, setFixStatusMsg] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmFix, setConfirmFix] = useState(false);

  // Auto-save logic
  useEffect(() => {
    if (initialRender.current) {
      initialRender.current = false;
      return;
    }

    const timer = setTimeout(async () => {
      setSaveStatus('saving');
      const catNames = categories.map(c => c.name).filter(Boolean);
      const inCatNames = incomeCategories.map(c => c.name).filter(Boolean);
      const cardNames = cards.map(c => c.name).filter(Boolean);
      
      const catColors = [...categories, ...incomeCategories].reduce((acc, c) => ({ ...acc, [c.name]: c.color }), {});
      const crdColors = cards.reduce((acc, c) => ({ ...acc, [c.name]: c.color }), {});

      try {
        await setDoc(doc(db, 'user_settings', user.uid), {
          categories: catNames,
          incomeCategories: inCatNames,
          cards: cardNames,
          categoryColors: catColors,
          cardColors: crdColors,
        }, { merge: true });
        
        setSaveStatus('saved');
        setTimeout(() => {
          setSaveStatus(prev => prev === 'saved' ? 'idle' : prev);
        }, 3000);
      } catch (e) {
        console.error("Save error:", e);
        setSaveStatus('error');
      }
    }, 1500);

    return () => clearTimeout(timer);
  }, [categories, incomeCategories, cards, user.uid]);

  const handleDeleteOldTransactions = async () => {
    setIsDeleting(true);
    setDeleteStatusMsg("");
    try {
      // Find all transactions
      const q = query(collection(db, 'transactions'), where('userId', '==', user.uid));
      const snap = await getDocs(q);
      
      const may2026Date = new Date(2026, 4, 1); // Month is 0-indexed, so 4 is May
      const may2026 = may2026Date.getTime();
      let deletedCount = 0;
      let batch = writeBatch(db);
      let opCount = 0;
      
      for (const d of snap.docs) {
        const t = d.data();
        let tDateNum = t.date;
        
        // Handle case where date was accidentally stored as a string or Timestamp
        if (typeof t.date === 'string') {
           if (t.date.match(/^\d{4}-\d{2}$/)) {
               tDateNum = new Date(`${t.date}-01T12:00:00`).getTime();
           } else {
               const parsedDate = new Date(t.date).getTime();
               if (!isNaN(parsedDate)) {
                 tDateNum = parsedDate;
               }
           }
        } else if (t.date && typeof t.date.toMillis === 'function') {
           tDateNum = t.date.toMillis();
        } else if (t.date instanceof Date) {
           tDateNum = t.date.getTime();
        }

        if (tDateNum && tDateNum < may2026) {
          batch.delete(d.ref);
          deletedCount++;
          opCount++;
          
          if (opCount >= 450) {
            await batch.commit();
            batch = writeBatch(db);
            opCount = 0;
          }
        }
      }
      
      if (opCount > 0) {
        await batch.commit();
      }
      
      setDeleteStatusMsg(`Operação concluída. ${deletedCount} transação(ões) removida(s).`);
    } catch (e: any) {
      console.error(e.message || String(e));
      setDeleteStatusMsg('Erro ao apagar: ' + e.message);
    } finally {
      setIsDeleting(false);
      setConfirmDelete(false);
    }
  };

  const handleFixDatabase = async () => {
    setIsFixing(true);
    setFixStatusMsg("");
    
    // Normalize string for robust searching
    const normalize = (val: string) => {
       if (!val) return "";
       return val.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\w\s]/gi, '').replace(/\s+/g, '').toLowerCase();
    };

    // Helper to fix UTF-8 encoded as ISO-8859-1
    const fixString = (s: string) => {
      if (!s) return s;
      let fixed = s;

      try {
        const uriFixed = decodeURIComponent(escape(s));
        if (uriFixed && uriFixed !== s && !uriFixed.includes('\uFFFD')) {
          fixed = uriFixed;
        }
      } catch (e) {}

      const manualChecks: Record<string, string> = {
        'alimentaã§ã£o': 'Alimentação',
        'alimentação': 'Alimentação',
        'alimentacao': 'Alimentação',
        'saãºde': 'Saúde',
        'saúde': 'Saúde',
        'saude': 'Saúde',
        'educaã§ã£o': 'Educação',
        'educação': 'Educação',
        'salã¡rio': 'Salário',
        'salário': 'Salário',
        'transporte': 'Transporte',
        'lazer': 'Lazer',
        'moradia': 'Moradia'
      };
      
      const lowerFixed = fixed.toLowerCase().trim();
      if (manualChecks[lowerFixed]) {
        return manualChecks[lowerFixed];
      }

      const replacePairs: Record<string, string> = {
        'Ã©': 'é',
        'Ã¡': 'á',
        'Ã£': 'ã',
        'Ã§': 'ç',
        'Ã\xAD': 'í',
        'Ã³': 'ó',
        'Ãº': 'ú',
        'Ãµ': 'õ',
        'Ã¢': 'â',
        'Ãª': 'ê',
        'Ã®': 'î',
        'Ã´': 'ô',
        'Ã»': 'û',
        'Ã\x80': 'À',
        'Ã\x81': 'Á',
        'Ã\x89': 'É'
      };

      let stringReplaced = fixed;
      for (const [k, v] of Object.entries(replacePairs)) {
        stringReplaced = stringReplaced.split(k).join(v);
      }
      
      try {
        const fallbackDec = decodeURIComponent(escape(stringReplaced));
        if (fallbackDec && fallbackDec !== stringReplaced && !fallbackDec.includes('\uFFFD')) {
           return fallbackDec.trim();
        }
      } catch(e) {}
      
      return stringReplaced.trim();
    };

    try {
      // 1. Fix user settings first
      const fixedCategories = categories.map(c => ({...c, name: fixString(c.name)}));
      const fixedIncomeCategories = incomeCategories.map(c => ({...c, name: fixString(c.name)}));
      const fixedCards = cards.map(c => ({...c, name: fixString(c.name)}));
      
      setCategories(fixedCategories);
      setIncomeCategories(fixedIncomeCategories);
      setCards(fixedCards);

      const catNames = fixedCategories.map(c => c.name).filter(Boolean);
      const inCatNames = fixedIncomeCategories.map(c => c.name).filter(Boolean);
      const cardNames = fixedCards.map(c => c.name).filter(Boolean);
      const catColors = [...fixedCategories, ...fixedIncomeCategories].reduce((acc, c) => ({ ...acc, [c.name]: c.color }), {});
      const crdColors = fixedCards.reduce((acc, c) => ({ ...acc, [c.name]: c.color }), {});

      await setDoc(doc(db, 'user_settings', user.uid), {
        categories: catNames,
        incomeCategories: inCatNames,
        cards: cardNames,
        categoryColors: catColors,
        cardColors: crdColors
      }, { merge: true });

      // 2. Fix transactions
      const q = query(collection(db, 'transactions'), where('userId', '==', user.uid));
      const snap = await getDocs(q);
      
      let updatedCount = 0;
      let batch = writeBatch(db);
      let opCount = 0;

      for (const d of snap.docs) {
        const t = d.data();
        let needsUpdate = false;
        const updates: any = {};

        // Fix encoding for all string fields
        ['description', 'category', 'account', 'paymentMethod', 'card', 'type'].forEach(field => {
          if (t[field] && typeof t[field] === 'string') {
            const fixed = fixString(t[field]);
            if (fixed !== t[field]) {
              console.log(`Fixing encoding for ${field}: "${t[field]}" -> "${fixed}"`);
              updates[field] = fixed;
              needsUpdate = true;
            }
          }
        });

        const currentCat = (updates.category || t.category || '').trim();
        const listToMatchNames = (updates.type || t.type) === 'expense' ? fixedCategories.map(c => c.name) : fixedIncomeCategories.map(c => c.name);
        
        // Make sure date is a number
        if (t.date && typeof t.date.toMillis === 'function') {
           updates.date = t.date.toMillis();
           needsUpdate = true;
           t.date = updates.date;
        } else if (t.date instanceof Date) {
           updates.date = t.date.getTime();
           needsUpdate = true;
           t.date = updates.date;
        } else if (typeof t.date === 'string') {
          let tDateNum = new Date(t.date).getTime();
          if (t.date.match(/^\d{4}-\d{2}$/)) {
            tDateNum = new Date(`${t.date}-01T12:00:00`).getTime();
          }
          if (!isNaN(tDateNum)) {
            updates.date = tDateNum;
            needsUpdate = true;
            t.date = tDateNum;
          }
        }
        
        if (typeof t.amount === 'string') {
          updates.amount = parseFloat(t.amount) || 0;
          needsUpdate = true;
          t.amount = updates.amount;
        }
        
        if (typeof t.createdAt === 'string') {
          updates.createdAt = new Date(t.createdAt).getTime() || Date.now();
          needsUpdate = true;
          t.createdAt = updates.createdAt;
        }

        // Ensure required fields exist to satisfy Firestore rules
        if (t.userId === undefined) { updates.userId = user.uid; needsUpdate = true; }
        if (t.description === undefined) { updates.description = "Transação"; needsUpdate = true; }
        if (t.date === undefined) { updates.date = Date.now(); needsUpdate = true; }
        if (t.amount === undefined || isNaN(t.amount)) { updates.amount = 0; needsUpdate = true; }
        if (t.type === undefined) { updates.type = "expense"; needsUpdate = true; }
        if (t.createdAt === undefined) { updates.createdAt = t.date || Date.now(); needsUpdate = true; }
        if (!currentCat) { updates.category = "Outros"; needsUpdate = true; }

        let matchedCat = updates.category || currentCat;
        
        if (currentCat) {
            let found = listToMatchNames.find(c => c.toLowerCase() === currentCat.toLowerCase());
            
            if (!found) {
                const normCurrent = normalize(currentCat);
                if (normCurrent) {
                    found = listToMatchNames.find(c => normalize(c) === normCurrent);
                }
            }
            
            if (!found) {
                const normCurrent = normalize(currentCat);
                if (normCurrent) {
                    found = listToMatchNames.find(c => normalize(c).includes(normCurrent) || normCurrent.includes(normalize(c)));
                }
            }
    
            if (found && found !== currentCat) {
              matchedCat = found;
            } else if (!found) {
                // Hardcode fallbacks if somehow still missing
                if (normalize(currentCat).includes("alimenta")) {
                    matchedCat = "Alimentação";
                }
                if (normalize(currentCat).includes("saude")) {
                    matchedCat = "Saúde";
                }
            }
        }

        if (matchedCat !== (updates.category || t.category)) {
          console.log(`Fixing casing/matching for category: "${updates.category || t.category}" -> "${matchedCat}"`);
          updates.category = matchedCat;
          needsUpdate = true;
        }

        if (needsUpdate) {
          console.log(`Scheduling update for transaction ${d.id}:`, updates);
          batch.update(d.ref, updates);
          updatedCount++;
          opCount++;

          if (opCount >= 450) {
            await batch.commit();
            batch = writeBatch(db);
            opCount = 0;
          }
        }
      }

      if (opCount > 0) {
        await batch.commit();
      }

      setFixStatusMsg(`Correção concluída. ${updatedCount} transação(ões) atualizada(s).`);
    } catch (e: any) {
      console.error(e.message || String(e));
      setFixStatusMsg('Erro ao corrigir: ' + e.message);
    } finally {
      setIsFixing(false);
      setConfirmFix(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-24 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* Header section */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 py-4 border-b border-gray-100 dark:border-white/5 mb-6">
         <div>
           <h2 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">Parametrização</h2>
           <p className="text-gray-500 text-sm font-medium mt-1">Personalize suas categorias, contas e opções globais.</p>
         </div>
         
         <div className="flex items-center gap-2 text-sm font-medium fixed sm:static bottom-20 sm:bottom-0 right-4 sm:right-0 bg-white/90 sm:bg-transparent dark:bg-[#121214]/90 sm:dark:bg-transparent shadow-lg sm:shadow-none p-3 sm:p-0 rounded-full sm:rounded-none z-50 backdrop-blur-md">
            {saveStatus === "saving" && <span className="text-orange-500 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> <span className="hidden sm:inline">Salvando...</span></span>}
            {saveStatus === "saved" && <span className="text-emerald-500 flex items-center gap-2"><Check className="w-4 h-4" /> <span className="hidden sm:inline">Salvo automaticamente</span></span>}
            {saveStatus === "error" && <span className="text-red-500 flex items-center gap-2"><Check className="w-4 h-4" /> <span className="hidden sm:inline">Erro ao salvar</span></span>}
            {saveStatus === "idle" && <span className="text-gray-400 dark:text-gray-500 flex items-center gap-2"><Check className="w-4 h-4 opacity-50" /> <span className="hidden sm:inline">Sincronizado</span></span>}
         </div>
       </div>
      
      {/* Configuration Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <SortableConfigList title="Categorias de Gastos" icon={<ArrowDownRight className="w-5 h-5 text-red-500" />} items={categories} setItems={setCategories} />
        <SortableConfigList title="Categorias de Receitas" icon={<ArrowUpRight className="w-5 h-5 text-emerald-500" />} items={incomeCategories} setItems={setIncomeCategories} />
        <SortableConfigList title="Cartões & Contas" icon={<CreditCard className="w-5 h-5 text-indigo-500" />} items={cards} setItems={setCards} />
      </div>

      {/* Advanced / Maintenance Section */}
      <section className="bg-white dark:bg-[#121214] border border-gray-200 dark:border-white/5 shadow-sm rounded-2xl p-6 sm:p-8 mt-8">
        <div className="flex items-center gap-3 mb-6">
           <div className="w-10 h-10 bg-gray-50 dark:bg-white/5 text-gray-500 rounded-xl flex items-center justify-center border border-gray-200 dark:border-white/10">
              <Database className="w-5 h-5" />
           </div>
           <div>
             <h2 className="text-lg font-bold text-gray-900 dark:text-white tracking-tight">Avançado & Manutenção</h2>
             <p className="text-xs text-gray-500">Ações perigosas e scripts estruturais no banco de dados.</p>
           </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-900/50 p-6 rounded-2xl relative flex flex-col group transition-colors">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-orange-100 dark:bg-orange-900/50 text-orange-600 dark:text-orange-400">
                <Wrench className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold tracking-tight text-orange-700 dark:text-orange-500">Reparo de Dados</h3>
            </div>
            
            <p className="text-orange-800/80 dark:text-orange-200/70 text-sm mb-6 flex-grow leading-relaxed font-medium">
              Utilitário de correção de acentuação e vínculos. Use isso caso note desagregação nos relatórios causada por grafias inconsistentes nas categorias.
            </p>
            
            {fixStatusMsg && (
              <div className="p-3 bg-white/50 dark:bg-black/20 rounded-xl border border-orange-200/50 dark:border-orange-900/30 mb-4">
                 <p className="text-sm font-medium text-orange-800 dark:text-orange-300">{fixStatusMsg}</p>
              </div>
            )}

            {confirmFix ? (
                <div className="flex flex-col xl:flex-row items-stretch gap-2 mt-auto">
                  <button 
                    disabled={isFixing}
                    onClick={handleFixDatabase}
                    className="flex-1 bg-orange-600 hover:bg-orange-700 text-white px-4 py-2.5 rounded-xl font-semibold text-xs flex items-center justify-center gap-2 transition disabled:opacity-50"
                  >
                    {isFixing ? <div className="w-4 h-4 border-2 border-white border-r-transparent rounded-full animate-spin"></div> : <Check className="w-4 h-4" />}
                    {isFixing ? 'Aplicando...' : 'Confirmar Reparo'}
                  </button>
                  <button 
                    disabled={isFixing}
                    onClick={() => setConfirmFix(false)}
                    className="flex-[0.5] bg-white dark:bg-black/40 border border-orange-200 dark:border-orange-900/50 hover:bg-orange-100 dark:hover:bg-orange-900/30 text-orange-800 dark:text-orange-300 px-4 py-2.5 rounded-xl font-semibold text-xs transition"
                  >
                    Cancelar
                  </button>
                </div>
            ) : (
              <button 
                disabled={isFixing || isDeleting}
                onClick={() => setConfirmFix(true)}
                className="w-full bg-white dark:bg-black/40 border border-orange-200 dark:border-orange-900/50 hover:bg-orange-100 dark:hover:bg-orange-900/40 text-orange-700 dark:text-orange-400 px-4 py-2.5 rounded-xl font-semibold text-xs flex items-center justify-center gap-2 transition disabled:opacity-50 mt-auto"
              >
                Iniciar Análise e Reparo
              </button>
            )}
          </div>

          <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50 p-6 rounded-2xl relative flex flex-col group transition-colors">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold tracking-tight text-red-700 dark:text-red-500">Limpeza Destrutiva</h3>
            </div>
            
            <p className="text-red-800/80 dark:text-red-200/70 text-sm mb-6 flex-grow leading-relaxed font-medium">
              Exclui permanentemente todo o histórico de transações registradas antes de 1º de Maio de 2026. Esta operação não possui rollback.
            </p>
            
            {deleteStatusMsg && (
              <div className="p-3 bg-white/50 dark:bg-black/20 rounded-xl border border-red-200/50 dark:border-red-900/30 mb-4">
                 <p className="text-sm font-medium text-red-800 dark:text-red-300">{deleteStatusMsg}</p>
              </div>
            )}

            {confirmDelete ? (
              <div className="flex flex-col xl:flex-row items-stretch gap-2 mt-auto">
                <button 
                  disabled={isDeleting}
                  onClick={handleDeleteOldTransactions}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white px-4 py-2.5 rounded-xl font-semibold text-xs flex items-center justify-center gap-2 transition disabled:opacity-50"
                >
                  {isDeleting ? <div className="w-4 h-4 border-2 border-white border-r-transparent rounded-full animate-spin"></div> : <Trash2 className="w-4 h-4" />}
                  {isDeleting ? 'Apagando...' : 'Confirmar Exclusão'}
                </button>
                <button 
                  disabled={isDeleting}
                  onClick={() => setConfirmDelete(false)}
                  className="flex-[0.5] bg-white dark:bg-black/40 border border-red-200 dark:border-red-900/50 hover:bg-red-100 dark:hover:bg-red-900/30 text-red-800 dark:text-red-300 px-4 py-2.5 rounded-xl font-semibold text-xs transition"
                >
                  Cancelar
                </button>
              </div>
            ) : (
              <button 
                disabled={isDeleting || isFixing}
                onClick={() => setConfirmDelete(true)}
                className="w-full bg-white dark:bg-black/40 border border-red-200 dark:border-red-900/50 hover:bg-red-100 dark:hover:bg-red-900/40 text-red-700 dark:text-red-400 px-4 py-2.5 rounded-xl font-semibold text-xs flex items-center justify-center gap-2 transition disabled:opacity-50 mt-auto"
              >
                Inativar Registros Antigos
              </button>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

