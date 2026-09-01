const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf-8');

const oldGeminiCall = `      } else {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
        });
        res.json({ text: response.text });
      }`;

const newGeminiCall = `      } else {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                systemInstruction: "Você é um consultor financeiro sênior especializado em planejamento e quitação de dívidas para brasileiros. Forneça respostas exatas, realistas e financeiramente matemáticas e diretas, estruturadas com bullet points limpos.",
                temperature: 0.2
            }
        });
        res.json({ text: response.text });
      }`;

content = content.replace(oldGeminiCall, newGeminiCall);
fs.writeFileSync('server.ts', content, 'utf-8');
console.log('Server updated');
