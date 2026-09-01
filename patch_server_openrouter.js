const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf-8');

const oldOpenRouter = `            body: JSON.stringify({
               model: openRouterModel || "google/gemini-2.5-flash",
               messages: [{ role: "user", content: prompt }]
            })`;

const newOpenRouter = `            body: JSON.stringify({
               model: openRouterModel || "google/gemini-2.5-flash",
               temperature: 0.2,
               messages: [
                 { role: "system", content: "Você é um consultor financeiro sênior especializado em planejamento e quitação de dívidas para brasileiros. Forneça respostas exatas, realistas e financeiramente matemáticas e diretas, estruturadas com bullet points limpos." },
                 { role: "user", content: prompt }
               ]
            })`;

content = content.replace(oldOpenRouter, newOpenRouter);
fs.writeFileSync('server.ts', content, 'utf-8');
console.log('Patched OpenRouter call');
