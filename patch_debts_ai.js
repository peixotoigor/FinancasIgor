const fs = require('fs');
let content = fs.readFileSync('src/components/DividasTab.tsx', 'utf-8');

// Update imports
if (!content.includes('Bot, Send, X, ArrowRight, BrainCircuit')) {
  content = content.replace("import { Plus, Trash2, TrendingDown, Calendar, Percent, Landmark, PencilLine, X } from 'lucide-react';", "import { Plus, Trash2, TrendingDown, Calendar, Percent, Landmark, PencilLine, X, Bot, Send, ArrowRight, BrainCircuit } from 'lucide-react';\nimport { addDoc } from 'firebase/firestore';");
}

// Ensure addDoc is imported if missing
if (!content.includes('addDoc') && !content.includes('from \'firebase/firestore\'')) {
  // Already handled above ideally
}

const replacementCode = `
  const [debts, setDebts] = useState<Debt[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [averageIncome, setAverageIncome] = useState<number>(0);

  // AI & Payment States
  const [activeDebtAI, setActiveDebtAI] = useState<Debt | null>(null);
  const [aiProjection, setAiProjection] = useState<string>('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [paymentModalDebt, setPaymentModalDebt] = useState<Debt | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  
  useEffect(() => {
    if (!userId) return;

    // Fetch average income for last 6 months
    const fetchIncome = async () => {
      try {
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
        const qIncome = query(
          collection(db, 'transactions'),
          where('userId', '==', userId),
          where('type', '==', 'income'),
          where('date', '>=', sixMonthsAgo.getTime())
        );
        const unsubscribeIncome = onSnapshot(qIncome, (snap) => {
          let total = 0;
          snap.forEach(doc => { total += doc.data().amount; });
          setAverageIncome(total / 6);
        });
        return unsubscribeIncome;
      } catch (e) {
        console.error(e);
      }
    };
    fetchIncome();

    const q = query(
      collection(db, 'debts'),
      where('userId', '==', userId)
    );
`;

content = content.replace(`  const [debts, setDebts] = useState<Debt[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Form states`, replacementCode + `\n  // Form states`);

const aiFunctions = `
  const generateAIProjection = async (debt: Debt) => {
    setActiveDebtAI(debt);
    setIsAiLoading(true);
    setAiProjection('');
    
    try {
      const prompt = \`Aja como um consultor financeiro. O usuário tem uma dívida de R$ \${debt.amount.toFixed(2)} chamada "\${debt.name}"\${debt.interestRate ? \` com juros de \${debt.interestRate}% ao mês\` : ''}. 
      A renda média mensal dele nos últimos 6 meses é de R$ \${averageIncome.toFixed(2)}.
      Responda de forma direta e curta:
      1. Avalie rapidamente se o valor dessa dívida está alto ou tranquilo para essa renda média (máx 2 linhas).
      2. Calcule e sugira projeções exatas de pagamento (valor da parcela mensal) para quitar a dívida em 3x, 6x, 9x e 12x, considerando os juros (se houver).
      Formate com emojis e bullet points limpos.\`;

      const response = await fetch('/api/ai/forecast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt })
      });
      const data = await response.json();
      setAiProjection(data.text);
    } catch (error) {
      console.error(error);
      setAiProjection('Desculpe, não foi possível gerar a projeção no momento.');
    } finally {
      setIsAiLoading(false);
    }
  };

  const handlePostPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentModalDebt || !paymentAmount) return;
    
    const numAmount = parseFloat(paymentAmount.replace(/\\./g, '').replace(',', '.'));
    if (isNaN(numAmount) || numAmount <= 0) return;

    try {
      // 1. Create expense transaction
      await addDoc(collection(db, 'transactions'), {
        userId,
        description: \`Pagamento: \${paymentModalDebt.name}\`,
        amount: numAmount,
        type: 'expense',
        category: 'Dívidas e Empréstimos',
        date: Date.now(),
        createdAt: Date.now()
      });

      // 2. Reduce debt amount
      const newDebtAmount = Math.max(0, paymentModalDebt.amount - numAmount);
      await setDoc(doc(db, 'debts', paymentModalDebt.id), { amount: newDebtAmount }, { merge: true });

      setPaymentModalDebt(null);
      setPaymentAmount('');
    } catch (error) {
      console.error("Error posting payment", error);
    }
  };
`;

content = content.replace("const handleSubmit = async", aiFunctions + "\n  const handleSubmit = async");

// Replace buttons inside the debt mapping
const buttonsMatch = `<button
                      onClick={() => startEdit(debt)}
                      className="p-1.5 text-gray-400 hover:text-indigo-500 transition-colors"
                      title="Editar"
                    >
                      <PencilLine className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(debt.id)}
                      className="p-1.5 text-gray-400 hover:text-rose-500 transition-colors"
                      title="Remover"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>`;
                    
const buttonsReplace = `<button
                      onClick={() => generateAIProjection(debt)}
                      className="p-1.5 text-gray-400 hover:text-emerald-500 transition-colors"
                      title="Análise com IA"
                    >
                      <BrainCircuit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => { setPaymentModalDebt(debt); setPaymentAmount(''); }}
                      className="p-1.5 text-gray-400 hover:text-indigo-500 transition-colors"
                      title="Lançar Pagamento"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => startEdit(debt)}
                      className="p-1.5 text-gray-400 hover:text-indigo-500 transition-colors"
                      title="Editar"
                    >
                      <PencilLine className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(debt.id)}
                      className="p-1.5 text-gray-400 hover:text-rose-500 transition-colors"
                      title="Remover"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>`;

content = content.replace(buttonsMatch, buttonsReplace);

// Add the modals/expandable sections at the bottom
const modalCode = `
      {/* AI Projection Modal */}
      {activeDebtAI && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-[#1A1A1D] w-full max-w-lg rounded-3xl shadow-xl overflow-hidden border border-gray-100 dark:border-white/10 flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-white/5 bg-gradient-to-r from-emerald-500/10 to-transparent">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                  <BrainCircuit className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 dark:text-white">Projeção Inteligente</h3>
                  <p className="text-xs text-gray-500">Baseado na sua renda de {formatCurrency(averageIncome)}</p>
                </div>
              </div>
              <button onClick={() => setActiveDebtAI(null)} className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-full hover:bg-gray-100 dark:hover:bg-white/10 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto custom-scrollbar">
              {isAiLoading ? (
                <div className="flex flex-col items-center justify-center py-8 text-emerald-500">
                  <div className="w-8 h-8 border-4 border-current border-t-transparent rounded-full animate-spin mb-4"></div>
                  <p className="text-sm font-medium animate-pulse">A IA está analisando sua dívida...</p>
                </div>
              ) : (
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  {aiProjection.split('\\n').map((line, i) => (
                    <p key={i} className="mb-2 text-gray-700 dark:text-gray-300 leading-relaxed">{line}</p>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {paymentModalDebt && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-[#1A1A1D] w-full max-w-sm rounded-3xl shadow-xl p-6 border border-gray-100 dark:border-white/10">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Send className="w-5 h-5 text-indigo-500" />
                Lançar Pagamento
              </h3>
              <button onClick={() => setPaymentModalDebt(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Ao lançar este pagamento, uma despesa será criada e o saldo da dívida <strong className="text-gray-900 dark:text-white">{paymentModalDebt.name}</strong> será reduzido.
            </p>

            <form onSubmit={handlePostPayment} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Valor do Pagamento</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm font-medium">R$</span>
                  <input
                    type="text"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(formatAmountInput(e.target.value))}
                    placeholder="0,00"
                    className="w-full bg-gray-50 dark:bg-[#0A0A0B] border border-gray-200 dark:border-white/10 rounded-xl pl-8 pr-3 py-3 text-sm font-mono outline-none focus:border-indigo-500 transition-colors"
                    required
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={!paymentAmount}
                className="w-full flex items-center justify-center gap-2 bg-indigo-500 hover:bg-indigo-600 text-white py-3 rounded-xl transition-colors font-medium disabled:opacity-50"
              >
                Confirmar Lançamento <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      )}
`;

content = content.replace("    </div>\n  );\n}", modalCode + "\n    </div>\n  );\n}");

fs.writeFileSync('src/components/DividasTab.tsx', content, 'utf-8');
console.log('patched');
