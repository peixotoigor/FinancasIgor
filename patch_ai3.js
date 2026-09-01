const fs = require('fs');
const file = 'src/components/AIFinancialForecast.tsx';
let content = fs.readFileSync(file, 'utf8');

const oldMemo = `  // Calculate 6 months aggregated data + same month last year
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

const newMemo = `  // Calculate 6 months aggregated data + same month last year
  const aggregatedData = useMemo(() => {
    const data: Record<string, Record<string, { amount: number; count: number; items: { desc: string; val: number }[] }>> = {};
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
             data[key][t.category] = { amount: 0, count: 0, items: [] };
          }
          data[key][t.category].amount += t.amount;
          data[key][t.category].count += 1;
          // Keep top items or all (usually fine for last few months)
          data[key][t.category].items.push({ desc: t.description, val: t.amount });
       }
    });
    
    return data;
  }, [transactions, currentYear, currentMonth]);`;

content = content.replace(oldMemo, newMemo);

const promptRegex = /const prompt = `Como um consultor financeiro[\s\S]*?\${JSON.stringify\(aggregatedData\)}\n`;/;

const newPrompt = `const prompt = \`Como um consultor financeiro, analise os gastos agregados por mês e categoria fornecidos abaixo.
Os dados incluem os últimos 6 meses E também o mesmo mês do ano anterior (se houver histórico).
Eles também incluem as descrições e valores exatos das compras.

Use o histórico do ano anterior para identificar padrões sazonais.

Responda EXCLUSIVAMENTE em formato JSON com as seguintes chaves:
"trends": Texto resumindo tendências e padrões sazonais.
"forecast": Previsão detalhada para o mês atual em formato de LISTA DE TÓPICOS. Para cada tópico, cite a categoria, o valor total estimado (em R$), a frequência (ex: 4 compras), e FORNEÇA EXEMPLOS REAIS citando as descrições (desc) e valores (val) das compras anteriores que embasam a sua estimativa (ex: "- Mercado: Estimado R$ 800 (aprox. 4 compras). Baseado em compras passadas como 'Carrefour' (R$ 250) e 'Padaria' (R$ 50)."). Não use formatação markdown como asteriscos duplos, use apenas texto simples com hífens para os tópicos.
"actionPlan": Um array de strings, cada uma com uma dica prática (máximo 2 dicas).

Dados JSON:
\${JSON.stringify(aggregatedData)}
\`;`;

content = content.replace(promptRegex, newPrompt);

fs.writeFileSync(file, content);
console.log("Patched successfully!");
