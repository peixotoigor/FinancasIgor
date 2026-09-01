const fs = require('fs');

const content = fs.readFileSync('src/components/DividasTab.tsx', 'utf-8');

// The syntax error is definitely in the DividasTab.tsx, not server.ts. Let's see what is on line 118 exactly.
// It seems the issue was the backslash escaping that `cat << 'EOF'` resolves natively, meaning the backslashes are removed before writing.
// We must make sure the prompt string is correct.

const oldPromptStr = 'const prompt = "Aja como um consultor financeiro. O usuário tem uma dívida de R$ " + debt.amount.toFixed(2) + " chamada \\"" + debt.name + "\\"" + (debt.interestRate ? " com juros de " + debt.interestRate + "% ao mês" : "") + ". A renda média mensal dele nos últimos 6 meses é de R$ " + averageIncome.toFixed(2) + ". Responda de forma direta e curta: 1. Avalie rapidamente se o valor dessa dívida está alto ou tranquilo para essa renda média (máx 2 linhas). 2. Calcule e sugira projeções exatas de pagamento (valor da parcela mensal) para quitar a dívida em 3x, 6x, 9x e 12x, considerando os juros (se houver). Formate com emojis e bullet points limpos.";';

const newPromptStr = "      const prompt = `Aja como um consultor financeiro. O usuário tem uma dívida de R$ ${debt.amount.toFixed(2)} chamada \"${debt.name}\"${debt.interestRate ? ` com juros de ${debt.interestRate}% ao mês` : ''}.\\nA renda média mensal dele nos últimos 6 meses é de R$ ${averageIncome.toFixed(2)}.\\nResponda de forma direta e curta:\\n1. Avalie rapidamente se o valor dessa dívida está alto ou tranquilo para essa renda média (máx 2 linhas).\\n2. Calcule e sugira projeções exatas de pagamento (valor da parcela mensal) para quitar a dívida em 3x, 6x, 9x e 12x, considerando os juros (se houver).\\nFormate com emojis e bullet points limpos.`;";

let newContent = content.replace(oldPromptStr, newPromptStr);

fs.writeFileSync('src/components/DividasTab.tsx', newContent, 'utf-8');
console.log('Fixed again');
