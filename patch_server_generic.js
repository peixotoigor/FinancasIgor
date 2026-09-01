const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf-8');

const oldServer = `  app.post("/api/ai/forecast", async (req, res) => {
    try {
      const { prompt, openRouterKey, openRouterModel } = req.body;
      if (openRouterKey) {
         const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
               "Content-Type": "application/json",
               "Authorization": \`Bearer \${openRouterKey}\`,
               "HTTP-Referer": "https://aistudio.google.com",
               "X-Title": "AI Studio Finance"
            },
            body: JSON.stringify({
               model: openRouterModel || "google/gemini-2.5-flash",
               temperature: 0.2,
               messages: [
                 { role: "system", content: "Você é um consultor financeiro sênior especializado em planejamento e quitação de dívidas para brasileiros. Forneça respostas exatas, realistas e financeiramente matemáticas e diretas, estruturadas com bullet points limpos." },
                 { role: "user", content: prompt }
               ]
            })
         });
         const data = await response.json();
         if (!data.choices || !data.choices[0]) throw new Error("Invalid response from OpenRouter: " + JSON.stringify(data));
         res.json({ text: data.choices[0].message.content });
      } else {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                systemInstruction: "Você é um consultor financeiro sênior especializado em planejamento e quitação de dívidas para brasileiros. Forneça respostas exatas, realistas e financeiramente matemáticas e diretas, estruturadas com bullet points limpos.",
                temperature: 0.2
            }
        });
        res.json({ text: response.text });
      }
    } catch (e: any) {`;

const newServer = `  app.post("/api/ai/forecast", async (req, res) => {
    try {
      const { prompt, openRouterKey, openRouterModel, systemInstruction } = req.body;
      const defaultSysInfo = "Você é um consultor financeiro sênior e matemático. Forneça respostas diretas e precisas.";
      const sysInstruction = systemInstruction || defaultSysInfo;
      
      if (openRouterKey) {
         const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
               "Content-Type": "application/json",
               "Authorization": \`Bearer \${openRouterKey}\`,
               "HTTP-Referer": "https://aistudio.google.com",
               "X-Title": "AI Studio Finance"
            },
            body: JSON.stringify({
               model: openRouterModel || "google/gemini-2.5-flash",
               temperature: 0.2,
               messages: [
                 { role: "system", content: sysInstruction },
                 { role: "user", content: prompt }
               ]
            })
         });
         const data = await response.json();
         if (!data.choices || !data.choices[0]) throw new Error(data.error ? JSON.stringify(data.error) : "Invalid response from OpenRouter");
         res.json({ text: data.choices[0].message.content });
      } else {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                systemInstruction: sysInstruction,
                temperature: 0.2
            }
        });
        res.json({ text: response.text });
      }
    } catch (e: any) {`;

content = content.replace(oldServer, newServer);
fs.writeFileSync('server.ts', content, 'utf-8');
console.log('Patched server generic instruction');
