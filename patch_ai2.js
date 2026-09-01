const fs = require('fs');
const file = 'src/components/AIFinancialForecast.tsx';
let content = fs.readFileSync(file, 'utf8');

const oldMemo = `  // Calculate 6 months aggregated data + same month last year
  const aggregatedData = useMemo(() => {
    const data: Record<string, Record<string, number>> = {};
    const now = new Date(currentYear, currentMonth - 1, 1);
    
    // Add last 6 months
    for (let i = 0; i < 6; i++) {
       const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
       const key = \`\${d.getFullYear()}-\${String(d.getMonth() + 1).padStart(2, '0')}\`;
       data[key] = {};
    }
    
    // Add same month last year
    const lastYearDate = new Date(currentYear - 1, currentMonth - 1, 1);
    const lastYearKey = \`\${lastYearDate.getFullYear()}-\${String(lastYearDate.getMonth() + 1).padStart(2, '0')}\`;
    data[lastYearKey] = {};

    transactions.forEach(t => {
       if (t.type !== 'expense') return;
       const tDate = new Date(t.date);
       const key = \`\${tDate.getFullYear()}-\${String(tDate.getMonth() + 1).padStart(2, '0')}\`;
       
       if (data[key]) {
          data[key][t.category] = (data[key][t.category] || 0) + t.amount;
       }
    });
    
    return data;
  }, [transactions, currentYear, currentMonth]);`;

const newMemo = `  // Calculate 6 months aggregated data + same month last year
  const aggregatedData = useMemo(() => {
    const data: Record<string, Record<string, { amount: number; count: number }>> = {};
    const now = new Date(currentYear, currentMonth - 1, 1);
    
    // Add last 6 months
    for (let i = 0; i < 6; i++) {
       const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
       const key = \`\${d.getFullYear()}-\${String(d.getMonth() + 1).padStart(2, '0')}\`;
       data[key] = {};
    }
    
    // Add same month last year
    const lastYearDate = new Date(currentYear - 1, currentMonth - 1, 1);
    const lastYearKey = \`\${lastYearDate.getFullYear()}-\${String(lastYearDate.getMonth() + 1).padStart(2, '0')}\`;
    data[lastYearKey] = {};

    transactions.forEach(t => {
       if (t.type !== 'expense') return;
       const tDate = new Date(t.date);
       const key = \`\${tDate.getFullYear()}-\${String(tDate.getMonth() + 1).padStart(2, '0')}\`;
       
       if (data[key]) {
          if (!data[key][t.category]) {
             data[key][t.category] = { amount: 0, count: 0 };
          }
          data[key][t.category].amount += t.amount;
          data[key][t.category].count += 1;
       }
    });
    
    return data;
  }, [transactions, currentYear, currentMonth]);`;

content = content.replace(oldMemo, newMemo);

const oldPrompt = `"forecast": Previsão para o mês atual em uma frase, considerando o histórico recente e sazonalidade.`;
const newPrompt = `"forecast": Previsão detalhada para o mês atual. Você DEVE incluir os valores estimados (em R$), citar as principais categorias e informar a frequência (quantas vezes as despesas costumam aparecer). Ex: "Mercado deve consumir R$ 800 em aprox. 4 compras."`;

content = content.replace(oldPrompt, newPrompt);

content = content.replace(
  '<p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">{forecast.forecast}</p>',
  '<p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed whitespace-pre-line">{forecast.forecast}</p>'
);

content = content.replace(
  '<p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">{forecast.trends}</p>',
  '<p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed whitespace-pre-line">{forecast.trends}</p>'
);

fs.writeFileSync(file, content);
console.log("Patched successfully!");
