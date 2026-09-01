const fs = require('fs');
let content = fs.readFileSync('src/components/DividasTab.tsx', 'utf-8');

const oldPromptStr = 'const prompt = `Aja como um consultor financeiro. O usuário tem uma dívida de R$ \\${debt.amount.toFixed(2)} chamada "\\${debt.name}"\\${debt.interestRate ? ` com juros de \\${debt.interestRate}% ao mês` : \'\'}. \\n      A renda média mensal dele nos últimos 6 meses é de R$ \\${averageIncome.toFixed(2)}.\\n      Responda de forma direta e curta:\\n      1. Avalie rapidamente se o valor dessa dívida está alto ou tranquilo para essa renda média (máx 2 linhas).\\n      2. Calcule e sugira projeções exatas de pagamento (valor da parcela mensal) para quitar a dívida em 3x, 6x, 9x e 12x, considerando os juros (se houver).\\n      Formate com emojis e bullet points limpos.`;';

const newPromptStr = 'const prompt = `Aja como um consultor financeiro. O usuário tem uma dívida de R$ ${debt.amount.toFixed(2)} chamada "${debt.name}"${debt.interestRate ? ` com juros de ${debt.interestRate}% ao mês` : \'\'}. \\n      A renda média mensal dele nos últimos 6 meses é de R$ ${averageIncome.toFixed(2)}.\\n      Responda de forma direta e curta:\\n      1. Avalie rapidamente se o valor dessa dívida está alto ou tranquilo para essa renda média (máx 2 linhas).\\n      2. Calcule e sugira projeções exatas de pagamento (valor da parcela mensal) para quitar a dívida em 3x, 6x, 9x e 12x, considerando os juros (se houver).\\n      Formate com emojis e bullet points limpos.`;';

// Let's just fix line 118 directly using string replacement without regex to be safe
const lines = content.split('\\n');
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('const prompt = `Aja como um consultor financeiro')) {
    lines[i] = "      const prompt = `Aja como um consultor financeiro. O usuário tem uma dívida de R$ ${debt.amount.toFixed(2)} chamada \"${debt.name}\"${debt.interestRate ? ' com juros de ' + debt.interestRate + '% ao mês' : ''}. A renda média mensal dele nos últimos 6 meses é de R$ ${averageIncome.toFixed(2)}. Responda de forma direta e curta: 1. Avalie rapidamente se o valor dessa dívida está alto ou tranquilo para essa renda média (máx 2 linhas). 2. Calcule e sugira projeções exatas de pagamento (valor da parcela mensal) para quitar a dívida em 3x, 6x, 9x e 12x, considerando os juros (se houver). Formate com emojis e bullet points limpos.`;";
  }
}

fs.writeFileSync('src/components/DividasTab.tsx', lines.join('\\n'), 'utf-8');
console.log('Syntax fixed');
