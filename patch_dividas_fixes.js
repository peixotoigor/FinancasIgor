const fs = require('fs');

let content = fs.readFileSync('src/components/DividasTab.tsx', 'utf-8');

// 1. Fix aiProjection undefined crash
content = content.replace(
  "setAiProjection(data.text);",
  "if (!response.ok) throw new Error(data.error || 'Erro na API');\n      setAiProjection(data.text || 'Nenhuma projeção gerada.');"
);

content = content.replace(
  "{aiProjection.split('\\n').map((line, i) => (",
  "{(aiProjection || '').split('\\n').map((line, i) => ("
);

// 2. Fix the undefined fields in Firestore submission
const oldSubmitLogic = `      const debtData: Debt = {
        id: debtId,
        userId,
        name,
        amount: numAmount,
        interestRate: interestRate ? parseFloat(interestRate.replace(',', '.')) : undefined,
        installments: installments ? parseInt(installments, 10) : undefined,
        dueDate: dueDate ? parseInt(dueDate, 10) : undefined,
        createdAt: editingId ? (debts.find(d => d.id === editingId)?.createdAt || Date.now()) : Date.now()
      };`;

const newSubmitLogic = `      const debtData: any = {
        id: debtId,
        userId,
        name,
        amount: numAmount,
        createdAt: editingId ? (debts.find(d => d.id === editingId)?.createdAt || Date.now()) : Date.now()
      };
      
      if (interestRate) debtData.interestRate = parseFloat(interestRate.replace(',', '.'));
      if (installments) debtData.installments = parseInt(installments, 10);
      if (dueDate) debtData.dueDate = parseInt(dueDate, 10);`;

content = content.replace(oldSubmitLogic, newSubmitLogic);

fs.writeFileSync('src/components/DividasTab.tsx', content, 'utf-8');
console.log('Fixed AI crash and undefined fields');
