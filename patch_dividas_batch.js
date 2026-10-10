const fs = require('fs');
let content = fs.readFileSync('src/components/DividasTab.tsx', 'utf-8');

// 1. Ensure writeBatch is imported
if (!content.includes('writeBatch')) {
    content = content.replace("import { collection, query, where, onSnapshot, doc, setDoc, deleteDoc, addDoc } from 'firebase/firestore';", "import { collection, query, where, onSnapshot, doc, setDoc, deleteDoc, addDoc, writeBatch } from 'firebase/firestore';");
}

// 2. Add loading state for payment
content = content.replace(
  "const [paymentAmount, setPaymentAmount] = useState('');",
  "const [paymentAmount, setPaymentAmount] = useState('');\n  const [isProcessingPayment, setIsProcessingPayment] = useState(false);"
);

// 3. Rewrite handlePostPayment to use Batch
const oldHandlePostPayment = `  const handlePostPayment = async (e: React.FormEvent) => {
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
  };`;

const newHandlePostPayment = `  const handlePostPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentModalDebt || !paymentAmount) return;
    
    const numAmount = parseFloat(paymentAmount.replace(/\\./g, '').replace(',', '.'));
    if (isNaN(numAmount) || numAmount <= 0) return;

    setIsProcessingPayment(true);
    try {
      const batch = writeBatch(db);

      // 1. Create expense transaction reference
      const newTransactionRef = doc(collection(db, 'transactions'));
      batch.set(newTransactionRef, {
        userId,
        description: \`Pagamento: \${paymentModalDebt.name}\`,
        amount: numAmount,
        type: 'expense',
        category: 'Dívidas e Empréstimos',
        date: Date.now(),
        createdAt: Date.now()
      });

      // 2. Reduce debt amount
      const debtRef = doc(db, 'debts', paymentModalDebt.id);
      const newDebtAmount = Math.max(0, paymentModalDebt.amount - numAmount);
      batch.set(debtRef, { amount: newDebtAmount }, { merge: true });

      // 3. Commit the batch atomically
      await batch.commit();

      setPaymentModalDebt(null);
      setPaymentAmount('');
    } catch (error) {
      console.error("Error posting payment", error);
      alert("Erro ao processar o pagamento. Tente novamente.");
    } finally {
      setIsProcessingPayment(false);
    }
  };`;

content = content.replace(oldHandlePostPayment, newHandlePostPayment);

// 4. Update the submit button in the modal to reflect isProcessingPayment
const oldButton = `<button
                type="submit"
                disabled={!paymentAmount}
                className="w-full flex items-center justify-center gap-2 bg-indigo-500 hover:bg-indigo-600 text-white py-3 rounded-xl transition-colors font-medium disabled:opacity-50"
              >
                Confirmar Lançamento <ArrowRight className="w-4 h-4" />
              </button>`;

const newButton = `<button
                type="submit"
                disabled={!paymentAmount || isProcessingPayment}
                className="w-full flex items-center justify-center gap-2 bg-indigo-500 hover:bg-indigo-600 text-white py-3 rounded-xl transition-colors font-medium disabled:opacity-50"
              >
                {isProcessingPayment ? (
                  <>Processando... <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /></>
                ) : (
                  <>Confirmar Lançamento <ArrowRight className="w-4 h-4" /></>
                )}
              </button>`;

content = content.replace(oldButton, newButton);

fs.writeFileSync('src/components/DividasTab.tsx', content, 'utf-8');
console.log('Applied batch writes for debt payment');
