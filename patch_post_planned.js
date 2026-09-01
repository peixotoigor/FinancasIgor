const fs = require('fs');
let content = fs.readFileSync('src/components/MonthlyPlanning.tsx', 'utf-8');

const postFunction = `
  const handlePostPlanned = async (expense: PlannedExpense) => {
    setIsSaving(true);
    try {
      const batch = writeBatch(db);
      const newTxRef = doc(db, 'transactions', \`auto_var_\${userId}_\${year}_\${month}_\${expense.id}\`);
      
      const now = new Date();
      let txDate = new Date(year, month - 1, 1).getTime();
      if (now.getFullYear() === year && now.getMonth() + 1 === month) {
        txDate = now.getTime();
      }

      const newTx: Transaction = {
        userId,
        description: expense.description,
        amount: expense.amount,
        date: txDate,
        type: 'expense',
        category: expense.category || 'Gastos Variáveis',
        account: expense.account || '',
        paymentMethod: expense.paymentMethod || '',
        card: expense.card || undefined,
        status: 'pending',
        createdAt: Date.now()
      };
      
      batch.set(newTxRef, newTx, { merge: true });
      
      const currentDocId = \`\${userId}_\${year}_\${month}\`;
      const currentDocRef = doc(db, 'monthly_budgets', currentDocId);
      const processed = budget?.processedPlannedExpenses || [];
      batch.set(currentDocRef, { processedPlannedExpenses: [...processed, expense.id] }, { merge: true });
      
      await batch.commit();
    } catch (error) {
      console.error('Failed to post planned expense', error);
    } finally {
      setIsSaving(false);
    }
  };
`;

// Insert the function before handleAddPlanned
content = content.replace('const handleAddPlanned = async (e: React.FormEvent) => {', postFunction + '\n  const handleAddPlanned = async (e: React.FormEvent) => {');

// Render the button in the list of planned expenses
const listMatch = `<button 
                           onClick={() => startEditPlanned(expense)}
                           disabled={isSaving}
                           className="text-gray-400 hover:text-indigo-500 transition-colors px-1"
                           title="Editar"
                         >
                           <PencilLine className="w-4 h-4" />
                         </button>`;

const listReplace = `<button 
                           onClick={() => handlePostPlanned(expense)}
                           disabled={isSaving || (budget?.processedPlannedExpenses || []).includes(expense.id)}
                           className={\`px-1 transition-colors \${(budget?.processedPlannedExpenses || []).includes(expense.id) ? 'text-green-500 opacity-50 cursor-not-allowed' : 'text-gray-400 hover:text-green-500'}\`}
                           title={(budget?.processedPlannedExpenses || []).includes(expense.id) ? "Já lançado no mês" : "Lançar no mês"}
                         >
                           <Plus className="w-4 h-4" />
                         </button>
                         <button 
                           onClick={() => startEditPlanned(expense)}
                           disabled={isSaving}
                           className="text-gray-400 hover:text-indigo-500 transition-colors px-1"
                           title="Editar"
                         >
                           <PencilLine className="w-4 h-4" />
                         </button>`;

content = content.replace(listMatch, listReplace);

fs.writeFileSync('src/components/MonthlyPlanning.tsx', content, 'utf-8');
console.log('patched');
