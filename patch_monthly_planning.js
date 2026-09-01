const fs = require('fs');
let content = fs.readFileSync('src/components/MonthlyPlanning.tsx', 'utf-8');

// Add state variables for planned expenses
const stateMatch = "const [plannedAmt, setPlannedAmt] = useState('');";
const stateAdd = `const [plannedAmt, setPlannedAmt] = useState('');
  const [plannedCategory, setPlannedCategory] = useState('');
  const [plannedAccount, setPlannedAccount] = useState('');
  const [plannedPaymentMethod, setPlannedPaymentMethod] = useState('');
  const [plannedCard, setPlannedCard] = useState('');`;
content = content.replace(stateMatch, stateAdd);

// Add to handleAddPlanned
const handleAddPlannedMatch = `       updatedExpenses = plannedExpenses.map(exp => 
          exp.id === editingPlannedId ? { ...exp, description: plannedDesc, amount: val } : exp
       );`;
const handleAddPlannedReplace = `       updatedExpenses = plannedExpenses.map(exp => 
          exp.id === editingPlannedId ? { 
            ...exp, 
            description: plannedDesc, 
            amount: val,
            category: plannedCategory,
            account: plannedAccount,
            paymentMethod: plannedPaymentMethod,
            card: plannedPaymentMethod === 'Crédito' || plannedPaymentMethod === 'Débito' ? plannedCard : undefined
          } : exp
       );`;
content = content.replace(handleAddPlannedMatch, handleAddPlannedReplace);

const handleAddPlannedMatch2 = `       updatedExpenses = [...plannedExpenses, {
          id: crypto.randomUUID(),
          description: plannedDesc,
          amount: val
       }];`;
const handleAddPlannedReplace2 = `       updatedExpenses = [...plannedExpenses, {
          id: crypto.randomUUID(),
          description: plannedDesc,
          amount: val,
          category: plannedCategory,
          account: plannedAccount,
          paymentMethod: plannedPaymentMethod,
          card: plannedPaymentMethod === 'Crédito' || plannedPaymentMethod === 'Débito' ? plannedCard : undefined
       }];`;
content = content.replace(handleAddPlannedMatch2, handleAddPlannedReplace2);

const handleAddPlannedMatch3 = `    setPlannedDesc('');
    setPlannedAmt('');`;
const handleAddPlannedReplace3 = `    setPlannedDesc('');
    setPlannedAmt('');
    setPlannedCategory('');
    setPlannedAccount('');
    setPlannedPaymentMethod('');
    setPlannedCard('');`;
content = content.replace(handleAddPlannedMatch3, handleAddPlannedReplace3);

// startEditPlanned
const startEditPlannedMatch = `  const startEditPlanned = (expense: PlannedExpense) => {
    setEditingPlannedId(expense.id);
    setPlannedDesc(expense.description);
    setPlannedAmt(expense.amount.toFixed(2).replace('.', ','));
  };`;
const startEditPlannedReplace = `  const startEditPlanned = (expense: PlannedExpense) => {
    setEditingPlannedId(expense.id);
    setPlannedDesc(expense.description);
    setPlannedAmt(expense.amount.toFixed(2).replace('.', ','));
    setPlannedCategory(expense.category || '');
    setPlannedAccount(expense.account || '');
    setPlannedPaymentMethod(expense.paymentMethod || '');
    setPlannedCard(expense.card || '');
  };`;
content = content.replace(startEditPlannedMatch, startEditPlannedReplace);

// cancelEditPlanned
const cancelEditPlannedMatch = `  const cancelEditPlanned = () => {
    setEditingPlannedId(null);
    setPlannedDesc('');
    setPlannedAmt('');
  };`;
const cancelEditPlannedReplace = `  const cancelEditPlanned = () => {
    setEditingPlannedId(null);
    setPlannedDesc('');
    setPlannedAmt('');
    setPlannedCategory('');
    setPlannedAccount('');
    setPlannedPaymentMethod('');
    setPlannedCard('');
  };`;
content = content.replace(cancelEditPlannedMatch, cancelEditPlannedReplace);

fs.writeFileSync('src/components/MonthlyPlanning.tsx', content, 'utf-8');
console.log('patched');
