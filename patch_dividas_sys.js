const fs = require('fs');
let content = fs.readFileSync('src/components/DividasTab.tsx', 'utf-8');

const oldFetch = `      const response = await fetch('/api/ai/forecast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          prompt,
          openRouterKey: userSettings?.openRouterApiKey,
          openRouterModel: userSettings?.openRouterModel
        })
      });`;

const newFetch = `      const response = await fetch('/api/ai/forecast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          prompt,
          systemInstruction: "Você é um consultor financeiro sênior especializado em planejamento e quitação de dívidas para brasileiros. Forneça respostas exatas, realistas e financeiramente matemáticas e diretas, estruturadas com bullet points limpos.",
          openRouterKey: userSettings?.openRouterApiKey,
          openRouterModel: userSettings?.openRouterModel
        })
      });`;

content = content.replace(oldFetch, newFetch);
fs.writeFileSync('src/components/DividasTab.tsx', content, 'utf-8');
console.log('Patched DividasTab instruction');
