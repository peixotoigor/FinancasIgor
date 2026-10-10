const fs = require('fs');

let content = fs.readFileSync('src/components/DividasTab.tsx', 'utf-8');

// 1. Update imports
content = content.replace(
  "import { collection, query, where, onSnapshot, doc, setDoc, deleteDoc, addDoc, writeBatch } from 'firebase/firestore';",
  "import { collection, query, where, onSnapshot, doc, setDoc, deleteDoc, addDoc, writeBatch, getDocs } from 'firebase/firestore';"
);
content = content.replace(
  "import { Plus, Trash2, TrendingDown, Calendar, Percent, Landmark, PencilLine, X, Bot, Send, ArrowRight, BrainCircuit } from 'lucide-react';",
  "import { Plus, Trash2, TrendingDown, Calendar, Percent, Landmark, PencilLine, X, Bot, Send, ArrowRight, BrainCircuit, History, Undo2, Save } from 'lucide-react';"
);
content = content.replace(
  "import type { Debt, UserSettings } from '../types';",
  "import type { Debt, UserSettings, Transaction } from '../types';"
);

// 2. Add History States
const stateAnchor = "const [isProcessingPayment, setIsProcessingPayment] = useState(false);";
const newStates = `
  const [historyModalDebt, setHistoryModalDebt] = useState<Debt | null>(null);
  const [debtPayments, setDebtPayments] = useState<Transaction[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [isProcessingHistory, setIsProcessingHistory] = useState(false);
  const [editingPaymentId, setEditingPaymentId] = useState<string | null>(null);
  const [editingPaymentAmount, setEditingPaymentAmount] = useState('');
`;
if (!content.includes("historyModalDebt")) {
    content = content.replace(stateAnchor, stateAnchor + newStates);
}

// 3. Add linkedDebtId to handlePostPayment
const postPaymentRegex = /createdAt: Date\.now\(\)\n\s*\}\);/g;
if (!content.includes("linkedDebtId: paymentModalDebt.id")) {
    content = content.replace(postPaymentRegex, "createdAt: Date.now(),\n        linkedDebtId: paymentModalDebt.id\n      });");
}

// 4. Add History Handlers
const handlersAnchor = "const handlePostPayment = async (e: React.FormEvent) => {";
const historyHandlers = `
  const openHistoryModal = async (debt: Debt) => {
    setHistoryModalDebt(debt);
    setIsLoadingHistory(true);
    try {
      const q = query(collection(db, 'transactions'), where('linkedDebtId', '==', debt.id));
      const snapshot = await getDocs(q);
      const payments = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Transaction));
      payments.sort((a, b) => b.date - a.date);
      setDebtPayments(payments);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const undoPayment = async (payment: Transaction) => {
    if (!historyModalDebt) return;
    setIsProcessingHistory(true);
    try {
      const batch = writeBatch(db);
      
      // Delete transaction
      batch.delete(doc(db, 'transactions', payment.id));
      
      // Restore debt amount
      const debtRef = doc(db, 'debts', historyModalDebt.id);
      const newDebtAmount = historyModalDebt.amount + payment.amount;
      batch.set(debtRef, { amount: newDebtAmount }, { merge: true });
      
      await batch.commit();
      
      // Update local state
      setDebtPayments(prev => prev.filter(p => p.id !== payment.id));
      setHistoryModalDebt({ ...historyModalDebt, amount: newDebtAmount });
      
    } catch (err) {
      console.error(err);
      alert("Erro ao desfazer pagamento.");
    } finally {
      setIsProcessingHistory(false);
    }
  };

  const saveEditedPayment = async (payment: Transaction) => {
    if (!historyModalDebt || !editingPaymentAmount) return;
    
    const newAmount = parseFloat(editingPaymentAmount.replace(/\\./g, '').replace(',', '.'));
    if (isNaN(newAmount) || newAmount <= 0) return;
    
    setIsProcessingHistory(true);
    try {
      const diff = newAmount - payment.amount;
      const batch = writeBatch(db);
      
      // Update transaction
      batch.set(doc(db, 'transactions', payment.id), { amount: newAmount }, { merge: true });
      
      // Update debt amount (if payment increased, debt decreases. newDebt = oldDebt - diff)
      const newDebtAmount = Math.max(0, historyModalDebt.amount - diff);
      batch.set(doc(db, 'debts', historyModalDebt.id), { amount: newDebtAmount }, { merge: true });
      
      await batch.commit();
      
      // Update local state
      setDebtPayments(prev => prev.map(p => p.id === payment.id ? { ...p, amount: newAmount } : p));
      setHistoryModalDebt({ ...historyModalDebt, amount: newDebtAmount });
      setEditingPaymentId(null);
      setEditingPaymentAmount('');
      
    } catch (err) {
      console.error(err);
      alert("Erro ao editar pagamento.");
    } finally {
      setIsProcessingHistory(false);
    }
  };

`;

if (!content.includes("openHistoryModal")) {
    content = content.replace(handlersAnchor, historyHandlers + handlersAnchor);
}

// 5. Add History Button
const paymentBtnAnchor = `<button
                      onClick={() => { setPaymentModalDebt(debt); setPaymentAmount(''); }}
                      className="p-1.5 text-gray-400 hover:text-indigo-500 transition-colors"
                      title="Lançar Pagamento"
                    >
                      <Send className="w-4 h-4" />
                    </button>`;
const historyBtn = `<button
                      onClick={() => openHistoryModal(debt)}
                      className="p-1.5 text-gray-400 hover:text-blue-500 transition-colors"
                      title="Histórico de Pagamentos"
                    >
                      <History className="w-4 h-4" />
                    </button>`;
if (!content.includes("Histórico de Pagamentos")) {
    content = content.replace(paymentBtnAnchor, historyBtn + "\n                    " + paymentBtnAnchor);
}

// 6. Add History Modal
const modalAnchor = `{paymentModalDebt && (`;
const historyModal = `
      {historyModalDebt && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-[#1A1A1D] w-full max-w-md rounded-3xl shadow-xl p-6 border border-gray-100 dark:border-white/10 flex flex-col max-h-[80vh]">
            <div className="flex justify-between items-center mb-6 shrink-0">
              <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <History className="w-5 h-5 text-blue-500" />
                Histórico de Pagamentos
              </h3>
              <button onClick={() => setHistoryModalDebt(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-4">
              {isLoadingHistory ? (
                <div className="flex justify-center py-8">
                  <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                </div>
              ) : debtPayments.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-8">Nenhum pagamento registrado para esta dívida.</p>
              ) : (
                debtPayments.map(payment => (
                  <div key={payment.id} className="bg-gray-50 dark:bg-[#0A0A0B] p-4 rounded-2xl border border-gray-100 dark:border-white/5">
                    {editingPaymentId === payment.id ? (
                      <div className="flex items-center gap-2">
                        <div className="relative flex-1">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm font-medium">R$</span>
                          <input
                            type="text"
                            value={editingPaymentAmount}
                            onChange={(e) => {
                               const val = e.target.value.replace(/[^0-9,.]/g, '');
                               setEditingPaymentAmount(val);
                            }}
                            className="w-full bg-white dark:bg-[#1A1A1D] border border-gray-200 dark:border-white/10 rounded-xl pl-8 pr-3 py-2 text-sm font-mono outline-none focus:border-blue-500 transition-colors"
                          />
                        </div>
                        <button
                          onClick={() => saveEditedPayment(payment)}
                          disabled={isProcessingHistory}
                          className="p-2 text-white bg-green-500 hover:bg-green-600 rounded-xl transition-colors disabled:opacity-50"
                          title="Salvar Alteração"
                        >
                          <Save className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setEditingPaymentId(null)}
                          className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 bg-gray-100 dark:bg-white/10 hover:bg-gray-200 dark:hover:bg-white/20 rounded-xl transition-colors"
                          title="Cancelar"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-bold text-gray-900 dark:text-white">R$ {payment.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                          <p className="text-xs text-gray-500">{new Date(payment.date).toLocaleDateString('pt-BR')}</p>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => {
                              setEditingPaymentId(payment.id);
                              setEditingPaymentAmount(payment.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 }));
                            }}
                            disabled={isProcessingHistory}
                            className="p-1.5 text-gray-400 hover:text-blue-500 transition-colors disabled:opacity-50"
                            title="Editar Pagamento"
                          >
                            <PencilLine className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => {
                              if (confirm('Tem certeza que deseja desfazer este pagamento? O saldo da dívida voltará a subir.')) {
                                undoPayment(payment);
                              }
                            }}
                            disabled={isProcessingHistory}
                            className="p-1.5 text-gray-400 hover:text-red-500 transition-colors disabled:opacity-50"
                            title="Desfazer Pagamento (Excluir)"
                          >
                            <Undo2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
`;

if (!content.includes("Histórico de Pagamentos</h3>")) {
    content = content.replace(modalAnchor, historyModal + "\n" + modalAnchor);
}

fs.writeFileSync('src/components/DividasTab.tsx', content, 'utf-8');
console.log('Successfully patched DividasTab for payment history');
