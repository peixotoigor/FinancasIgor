import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { GoogleGenAI } from '@google/genai';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, doc, getDoc, getDocs, query, where, setDoc, limit } from 'firebase/firestore';
import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

// Read config for firebase
import fs from 'fs';
const firebaseConfig = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'firebase-applet-config.json'), 'utf8'));

const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId);

const ai = new GoogleGenAI({ apiKey: 'AIzaSyAEh9nDKoNx3PXgzHB3yGUZVzC_S1Sp8zo' });

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  const processTelegramPayload = async (tgMessage: any, botToken: string) => {
    try {
      const telegramChatId = tgMessage.chat.id;
      let text = tgMessage.text || tgMessage.caption || '';
      let voiceId = tgMessage.voice?.file_id || tgMessage.audio?.file_id;
      let voiceMimeType = tgMessage.voice?.mime_type || tgMessage.audio?.mime_type || 'audio/ogg';
      let userId = null;

      const sendMessage = async (msgParams: any) => {
         await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: telegramChatId, ...msgParams })
         });
      };
      
      if (!text && !voiceId) {
         await sendMessage({ text: 'Envie um texto ou áudio para adicionar uma transação.' });
         return;
      }

      // Look up existing telegram mapping
      const tgDoc = await getDoc(doc(db, 'telegram_users', String(telegramChatId)));
      
      if (!tgDoc.exists()) {
         let putativeToken = text.trim();
         if (putativeToken.startsWith('/start ')) {
            putativeToken = putativeToken.replace('/start ', '').trim();
         }
         
         if (putativeToken.length >= 20) {
            await setDoc(doc(db, 'telegram_users', String(telegramChatId)), { userId: putativeToken, createdAt: Date.now() });
            await sendMessage({ text: '✅ Conta vinculada com sucesso! Agora você pode adicionar uma transação enviando um texto ou áudio. Exemplo: "Comprei um açaí em dinheiro por 15 reais".' });
            return;
         }
         await sendMessage({ text: 'Olá! Você ainda não vinculou sua conta.\n\nPara começar, copie o seu "Token de Integração" dentro de Integrações no aplicativo e me envie aqui (apenas texto).' });
         return;
      } else {
          const tgData = tgDoc.data();
          userId = tgData.userId;
      }

      // Fetch Context (Settings & Recent Transactions)
      let userSettings: any = {};
      let recentTransactions: any[] = [];
      let totalBalance = 0;
      let currentMonthExpense = 0;
      let currentMonthIncome = 0;
      let currentMonthTransport = 0;
      let currentMonthExpensesByCategory: Record<string, number> = {};
      let accountBalances: Record<string, number> = {};
      
      let netAccReserve = 0;
      let netAccWallet = 0;
      let accReserveOfReserve = 0;
      let totalAcc = 0;

      const now = new Date();
      const currentMonth = now.getMonth();
      const currentYear = now.getFullYear();

      try {
         const settingsDoc = await getDoc(doc(db, 'user_settings', userId));
         if (settingsDoc.exists()) {
            userSettings = settingsDoc.data();
         }

      const qAll = query(
         collection(db, 'transactions'),
         where('userId', '==', userId)
      );
      const allSnaps = await getDocs(qAll);

      const qBudgets = query(
         collection(db, 'monthly_budgets'),
         where('userId', '==', userId),
         where('year', '==', currentYear)
      );
      const budgetSnaps = await getDocs(qBudgets);
      
      const qInbox = query(
         collection(db, 'inbox'),
         where('userId', '==', userId)
      );
      const inboxSnaps = await getDocs(qInbox);
      
      let accReserve = 0;
      let accWallet = 0;
      let accWalletWithdrawals = 0;
      let accEmergencyWithdrawals = 0;
      
      budgetSnaps.forEach(docSnap => {
          const b = docSnap.data();
          if (b.month <= currentMonth + 1) { // month is 1-indexed in DB
             accReserve += Number(b.reserve || 0);
             accReserveOfReserve += Number(b.reserveOfReserve || 0);
             accWallet += Number(b.wallet || 0);
             accWalletWithdrawals += Number(b.walletWithdrawals || 0);
             accEmergencyWithdrawals += Number(b.emergencyWithdrawals || 0);
          }
      });
      
      netAccReserve = accReserve - accEmergencyWithdrawals;
      netAccWallet = accWallet - accWalletWithdrawals;
      totalAcc = accReserve + accReserveOfReserve + accWallet - accWalletWithdrawals - accEmergencyWithdrawals;
      
      const docs = allSnaps.docs.map(d => d.data()).concat(inboxSnaps.docs.map(d => d.data()));
      docs.sort((a, b) => (b.date || 0) - (a.date || 0));

      docs.forEach(data => {
         const txDate = new Date(data.date);
         const amt = Number(data.amount || 0);
         
         const acc = data.account || 'Sem Conta';
         if (!accountBalances[acc]) accountBalances[acc] = 0;

         if (data.type === 'income') {
            totalBalance += amt;
            accountBalances[acc] += amt;
         } else {
            totalBalance -= amt;
            accountBalances[acc] -= amt;
         }

         if (txDate.getMonth() === currentMonth && txDate.getFullYear() === currentYear) {
             if (data.type === 'income') currentMonthIncome += amt;
             else {
                 currentMonthExpense += amt;
                 const cat = data.category || 'Outros';
                 currentMonthExpensesByCategory[cat] = (currentMonthExpensesByCategory[cat] || 0) + amt;
             }
         }
      });
      
      docs.slice(0, 15).forEach(data => {
         recentTransactions.push({
            desc: data.description, 
            cat: data.category, 
            acc: data.account, 
            method: data.paymentMethod, 
            card: data.card,
            type: data.type,
            amount: data.amount,
            date: data.date
         });
      });
      } catch (e) {
         console.error('Error fetching context', e);
      }

      let promptContents: any[] = [];
      const prompt = `
Você é um assistente financeiro inteligente e analítico, especializado em classificar transações a partir de linguagem natural E em responder perguntas sobre as finanças do usuário.

${text ? `CONTEÚDO RECEBIDO (TEXTO): "${text}"\n` : "CONTEÚDO RECEBIDO: [Áudio anexado, extraia a fala com precisão]"}

O usuário pode estar REGISTRANDO UMA TRANSAÇÃO ou FAZENDO UMA PERGUNTA sobre suas finanças.

== REGRAS PARA PERGUNTAS (PRIORIDADE ALTA) ==
Se o usuário estiver perguntando algo com intenção de saber dados (ex: "Qual meu saldo?", "Quanto gastei esse mês?", "Quais foram meus gastos?", "resumo"), você DEVE gerar um JSON de pergunta. NUNCA invente ou registre uma transação nestes casos.
O JSON deve ter esta estrutura:
{
  "isQuestion": true,
  "answer": "Sua resposta (em markdown) baseada EXCLUSIVAMENTE no RESUMO FINANCEIRO abaixo. Se uma informação (como limite ou total em crédito) não estiver no resumo, informe que a informação não está disponível."
}

== REGRAS PARA REGISTRO DE TRANSAÇÃO ==
Se, e SOMENTE SE, a intenção do usuário for claramente registrar um gasto ou ganho, e um valor monetário estiver presente ou claramente implícito, extraia as seguintes propriedades para o JSON, omitindo o "isQuestion":
- "description" (string): Nome do serviço/estabelecimento.
- "amount" (number): Valor em formato de número. Se o usuário não informar o valor, RETORNE UM JSON DE PERGUNTA informando que o valor está faltando. NUNCA invente valores (como R$ 300,00).
- "type" (string): "expense" ou "income".
- "category" (string): OBRIGATORIAMENTE UMA DA LISTA "Categorias de Gastos/Ganhos Atuais".
- "account": A conta usada.
- "paymentMethod": "Pix", "Crédito", "Débito", "Dinheiro" ou "Boleto".
- "installments": Inteiro numérico. Retorne 1 se não for parcelado.
- "card": Qual cartão foi usado, se "Crédito"/"Débito".

== CONTEXTO DO USUÁRIO ==
🔹 Categorias de Gastos Atuais: [${(userSettings.categories || []).join(', ')}]
🔹 Categorias de Ganhos Atuais: [${(userSettings.incomeCategories || []).join(', ')}]
🔹 Cartões Disponíveis: [${(userSettings.cards || []).join(', ')}]

== RESUMO FINANCEIRO (Use para responder perguntas) ==
🔹 Saldo Geral (Receitas - Despesas): R$ ${totalBalance.toFixed(2)}
🔹 Despesas deste Mês (${currentMonth + 1}/${currentYear}): R$ ${currentMonthExpense.toFixed(2)}
🔹 Receitas deste Mês (${currentMonth + 1}/${currentYear}): R$ ${currentMonthIncome.toFixed(2)}
🔹 Reservas / Guardados:
- Reserva (Livre): R$ ${netAccReserve.toFixed(2)}
- Carteira Física: R$ ${netAccWallet.toFixed(2)}
- Reserva de Emergência: R$ ${accReserveOfReserve.toFixed(2)}
- Total Acumulado Guardado: R$ ${totalAcc.toFixed(2)}
🔹 Saldo por Contas:
${Object.entries(accountBalances).map(([acc, bal]) => `- ${acc}: R$ ${bal.toFixed(2)}`).join('\n') || "Sem contas."}
🔹 Gastos do Mês por Categoria:
${Object.entries(currentMonthExpensesByCategory).map(([cat, amount]) => `- ${cat}: R$ ${amount.toFixed(2)}`).join('\n') || "Sem gastos neste mês."}
🔹 Histórico Recente de Transações:
${recentTransactions.slice(0, 5).map(t => `- ${t.desc} | R$ ${t.amount} | Tipo: ${t.type} | Cat: ${t.cat} | Data: ${new Date(t.date).toLocaleDateString('pt-BR')}`).join('\n') || "Nenhuma recente."}

== REGRAS CRÍTICAS ==
1. Se a entrada principal for um áudio longo ou falado informalmente ("pô, acabei de gastar 20 conto na padoca"), traduza o sentido corretamente (20 reais, Padaria, Alimentação).
2. Retorne APENAS o JSON válido. Nenhum texto adicional. Nenhuma formatação de bloco de código (não use \`\`\`json).
      `.trim();
      let base64Audio: string | null = null;

      if (voiceId) {
         try {
            await sendMessage({ text: 'Processando seu áudio... 🎙' });
            
            const fileRes = await fetch(`https://api.telegram.org/bot${botToken}/getFile?file_id=${voiceId}`);
            const fileData = await fileRes.json();
            
            if (fileData.ok && fileData.result.file_path) {
               const downloadUrl = `https://api.telegram.org/file/bot${botToken}/${fileData.result.file_path}`;
               const audioRes = await fetch(downloadUrl);
               const arrayBuffer = await audioRes.arrayBuffer();
               base64Audio = Buffer.from(arrayBuffer).toString('base64');
            }
         } catch (e: any) {
            console.error('Audio processing error', e);
            await sendMessage({ text: 'Erro ao processar o áudio. ' + e.message });
            return;
         }
      }
      
      let jsonStr = "{}";

      if (userSettings.aiProvider === 'openrouter') {
         const openRouterModel = userSettings.openRouterModel || 'openai/gpt-4o-mini';
         const openRouterApiKey = userSettings.openRouterApiKey || '';
         
         if (voiceId && !openRouterModel.includes('gemini') && !openRouterModel.includes('gpt-4o') && !openRouterModel.includes('claude')) {
             await sendMessage({ text: `Aviso: O modelo OpenRouter selecionado ("${openRouterModel}") pode não suportar áudio. Sugerimos "google/gemini-2.5-flash-free" se você precisa de áudio de forma gratuita.` });
         }

         const headers: Record<string, string> = { 
             'Content-Type': 'application/json',
             'HTTP-Referer': 'https://aistudio.google.com', 
             'X-Title': 'AI Studio Applet'
         };
         
         if (openRouterApiKey) {
            headers['Authorization'] = `Bearer ${openRouterApiKey}`;
         }

         try {
            console.log(`Processing via OpenRouter - model: ${openRouterModel}`);
            
            // Build content array for multimodal support
            const contentArray: any[] = [{ type: 'text', text: prompt }];

            if (base64Audio) {
               // OpenRouter handles multimodal content (including audio/video) via image_url natively or via object syntax
               contentArray.push({
                  type: 'image_url',
                  image_url: {
                     url: `data:${voiceMimeType};base64,${base64Audio}`
                  }
               });
            }

            const orRes = await fetch(`https://openrouter.ai/api/v1/chat/completions`, {
               method: 'POST',
               headers,
               body: JSON.stringify({
                  model: openRouterModel,
                  messages: [{ role: 'user', content: contentArray }],
                  response_format: { type: 'json_object' }
               })
            });

            if (!orRes.ok) {
               if (orRes.status === 429) {
                  throw new Error(`OpenRouter respondeu com status HTTP 429 Too Many Requests.\n\nIsto indica que as cotas gratuitas do modelo (${openRouterModel}) ou da requisição esgotaram momentaneamente no OpenRouter. Aguarde alguns minutos ou instantes e tente novamente.`);
               }
               throw new Error(`OpenRouter respondeu com status HTTP ${orRes.status} ${orRes.statusText}`);
            }

            const orData = await orRes.json();
            jsonStr = orData.choices?.[0]?.message?.content || "{}";

         } catch (err: any) {
            console.error('OpenRouter API Error:', err);
            await sendMessage({ parse_mode: 'HTML', text: `Ops, o provedor de IA (OpenRouter) falhou.\n\n<b>Motivo:</b> ${err.message}` });
            return;
         }
      } else {
         console.log(`Processing via Gemini for userId ${userId} (hasAudio: ${!!voiceId})`);

         let promptContents: any[] = [prompt];
         
         if (base64Audio) {
            promptContents.push({
               inlineData: {
                  data: base64Audio,
                  mimeType: voiceMimeType
               }
            });
         }

         let aiRes;
         try {
           aiRes = await ai.models.generateContent({
              model: 'gemini-2.5-flash',
              contents: promptContents
           });
           jsonStr = aiRes.text || "{}";
         } catch (err: any) {
           console.error('Gemini API Error:', err);
           
           let detail = err.message || '';
           try {
              // Try to extract JSON from error message if it's stringified
              const jsonMatch = detail.match(/\{.*_*\}/s);
              const parsedErr = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(detail);
              if (parsedErr?.error?.status === 'UNAVAILABLE' || parsedErr?.error?.code === 503) {
                detail = "O serviço de IA está temporariamente sobrecarregado (Alta demanda). Tente novamente em instantes.";
              } else if (parsedErr?.error?.message?.includes('API key not valid') || parsedErr?.error?.status === 'INVALID_ARGUMENT') {
                detail = "Problema com a sua Chave de API. Por favor, verifique se ela é válida.";
              } else if (parsedErr?.error?.message) {
                detail = parsedErr.error.message;
              }
           } catch(e) {
              if (detail.includes('API key')) detail = "Problema com a Chave de API. Verifique a validade da chave.";
              else if (detail.includes('demand') || detail.includes('503') || detail.includes('overloaded')) detail = "O serviço de IA está sob alta demanda. Tente novamente em alguns segundos.";
           }
           
           const errMsg = `Ops, a inteligência artificial enfrentou um problema técnico e não pôde processar a mensagem.\n\n<b>Motivo:</b> ${detail}`;
           await sendMessage({ parse_mode: 'HTML', text: errMsg });
           return;
         }
      }


      jsonStr = jsonStr.replace(/^```json/gi, '').replace(/^```/gi, '').replace(/```$/g, '').trim();
      
      let data;
      try {
        data = JSON.parse(jsonStr);
      } catch (err: any) {
         console.error('JSON Parse Error. String was:\n', jsonStr);
         const errMsg = `Não consegui entender a requisição perfeitamente. Diga algo como "Gastei 25 reais em mercado" ou pergunte seu saldo.`;
         await sendMessage({ text: errMsg });
         return;
      }

      if (data.isQuestion) {
         await sendMessage({ parse_mode: 'Markdown', text: data.answer || "Não consegui formular uma resposta." });
         return;
      }

      const isIncome = data.type === 'income';
      const typeLabel = isIncome ? 'Receita' : 'Despesa';
      
      const parsedAmount = data.amount || 0;
      let installments = data.installments || 1;
      installments = typeof installments === 'number' && installments > 0 ? installments : 1;
      
      let finalCategory = data.category || 'Outros';
      const allowedCategories = isIncome ? (userSettings.incomeCategories || []) : (userSettings.categories || []);
      
      // Enforce category strictly from user settings
      if (allowedCategories.length > 0) {
         // Exact match (case insensitive)
         const exactMatch = allowedCategories.find((c: string) => c.toLowerCase() === finalCategory.toLowerCase());
         if (exactMatch) {
            finalCategory = exactMatch;
         } else {
            // Partial match: checking words (e.g. "Mercado" in "Alimentação e Mercado")
            const finalWords = finalCategory.toLowerCase().split(/\s+/);
            const partialMatch = allowedCategories.find((c: string) => {
               const catWords = c.toLowerCase().split(/\s+/);
               return finalWords.some(fw => fw.length > 2 && c.toLowerCase().includes(fw)) || 
                      catWords.some(cw => cw.length > 2 && finalCategory.toLowerCase().includes(cw));
            });
            
            if (partialMatch) finalCategory = partialMatch;
            else finalCategory = allowedCategories.includes('Outros') ? 'Outros' : allowedCategories[0];
         }
      }
      
      const payloadBase = {
        userId,
        description: data.description || text || "Nova Transação",
        amount: parsedAmount,
        type: data.type === 'income' ? 'income' : 'expense',
        category: finalCategory,
        account: data.account || '',
        paymentMethod: data.paymentMethod || 'Pix',
        card: data.card || '',
        date: Date.now(),
        createdAt: Date.now()
      };

      if (installments > 1) {
        const groupId = crypto.randomUUID();
        const perInstallmentAmount = Number((parsedAmount / installments).toFixed(2));
        let remainingAmount = parsedAmount;
        const now = new Date();

        for (let i = 1; i <= installments; i++) {
           let currentAmount = perInstallmentAmount;
           if (i === installments) {
              currentAmount = remainingAmount;
           } else {
              remainingAmount -= currentAmount;
           }

           const txDate = new Date(now);
           if (i > 1) txDate.setMonth(txDate.getMonth() + (i - 1));

           const payload = {
              ...payloadBase,
              description: `${payloadBase.description} (${i}/${installments})`,
              amount: currentAmount,
              date: txDate.getTime(),
              installments,
              installmentNumber: i,
              groupId,
           };

           await addDoc(collection(db, 'inbox'), payload);
        }
      } else {
        await addDoc(collection(db, 'inbox'), payloadBase);
      }

      const amountFormatted = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(parsedAmount);
      const installmentText = installments > 1 ? ` (em ${installments}x de ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(parsedAmount / installments)})` : '';
      
      let alertMessage = '';
      alertMessage += '\n\n💡 _Dica: Você pode verificar seus limites diretamente no aplicativo._';

      const successMessage = `✅ <b>${typeLabel} Registrada!</b>\n\n` +
                             `<b>📄 Descrição:</b> ${payloadBase.description}\n` +
                             `<b>💰 Valor:</b> ${amountFormatted}${installmentText}\n` +
                             `<b>🏷 Categoria:</b> ${payloadBase.category}\n` +
                             `<b>💳 Método:</b> ${payloadBase.paymentMethod}` + 
                             (payloadBase.card ? ` (${payloadBase.card})` : '') +
                             alertMessage;

      await sendMessage({ parse_mode: 'HTML', text: successMessage });
    } catch (error: any) {
      console.error('Webhook processing error:', error);
      fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({ chat_id: tgMessage.chat.id, text: 'Erro interno no servidor ao processar sua requisição. Detalhe: ' + error.message })
      }).catch(() => {});
    }
  };

  const startTelegramPolling = async () => {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) return;

    try {
       await fetch(`https://api.telegram.org/bot${token}/deleteWebhook`);
    } catch(err) {}

    let lastUpdateId = 0;
    try {
       if (fs.existsSync('.telegram_offset')) {
          lastUpdateId = parseInt(fs.readFileSync('.telegram_offset', 'utf-8') || '0', 10);
       }
    } catch(e) {}

    const poll = async () => {
       try {
          const res = await fetch(`https://api.telegram.org/bot${token}/getUpdates?offset=${lastUpdateId + 1}&timeout=30`);
          const data = await res.json();
          if (data.ok && data.result) {
             for (const update of data.result) {
                lastUpdateId = update.update_id;
                try { fs.writeFileSync('.telegram_offset', String(lastUpdateId)); } catch(e) {}
                const tgMessage = update.message || update.edited_message;
                if (tgMessage) {
                   await processTelegramPayload(tgMessage, token);
                }
             }
          }
       } catch(err) {
         console.error('Polling error', err);
       }
       setTimeout(poll, 2000);
    };
    poll();
  };
  
  startTelegramPolling();

  // Vite middleware setup
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
