const fs = require('fs');
const file = 'src/components/AIFinancialForecast.tsx';
let content = fs.readFileSync(file, 'utf8');

const oldMemo = `  // Calculate 6 months aggregated data
  const aggregatedData = useMemo(() => {
    const data: Record<string, Record<string, number>> = {};
    const now = new Date(currentYear, currentMonth - 1, 1);
    
    for (let i = 0; i < 6; i++) {
       const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
       const key = \`\${d.getFullYear()}-\${String(d.getMonth() + 1).padStart(2, '0')}\`;
       data[key] = {};
    }

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

content = content.replace(oldMemo, newMemo);

const oldPrompt = `      const prompt = \`Como um consultor financeiro, analise os gastos dos últimos 6 meses (agregados por mês e categoria) e faça uma previsão para o mês atual. 
Responda EXCLUSIVAMENTE em formato JSON com as seguintes chaves:
"trends": Texto curto resumindo tendências de alta ou baixa.
"forecast": Previsão para o mês atual em uma frase.
"actionPlan": Um array de strings, cada uma com uma dica prática (máximo 2 dicas).

Dados:
\${JSON.stringify(aggregatedData)}
\`;`;

const newPrompt = `      const prompt = \`Como um consultor financeiro, analise os gastos agregados por mês e categoria fornecidos abaixo.
Os dados incluem os últimos 6 meses E também o mesmo mês do ano anterior (se houver histórico).
Use o histórico do ano anterior para identificar padrões sazonais (ex: impostos de janeiro, presentes de dezembro, etc.) e incorpore essa percepção sazonal na sua análise se notar similaridades.

Responda EXCLUSIVAMENTE em formato JSON com as seguintes chaves:
"trends": Texto curto resumindo tendências recentes e padrões sazonais (comparando com o ano passado, se houver dados).
"forecast": Previsão para o mês atual em uma frase, considerando o histórico recente e sazonalidade.
"actionPlan": Um array de strings, cada uma com uma dica prática focada (máximo 2 dicas).

Dados JSON:
\${JSON.stringify(aggregatedData)}
\`;`;

content = content.replace(oldPrompt, newPrompt);

fs.writeFileSync(file, content);
console.log("Patched successfully!");
