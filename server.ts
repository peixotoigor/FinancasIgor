import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { GoogleGenAI } from '@google/genai';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, doc, getDoc, getDocs, query, where, setDoc, limit, updateDoc, deleteDoc } from 'firebase/firestore';
import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

// Read config for firebase
import fs from 'fs';
const firebaseConfig = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'firebase-applet-config.json'), 'utf8'));

const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId);

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  const processTelegramPayload = async (update: any, botToken: string) => {
    try {
      if (update.callback_query) {
         const cb = update.callback_query;
         const cbData = cb.data;
         const telegramChatId = cb.message.chat.id;
         const messageId = cb.message.message_id;

         if (cbData.startsWith('undo_')) {
             const txMsgId = Number(cbData.split('_')[1]);
             
             // First acknowledge the callback
             fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ callback_query_id: cb.id, text: 'Desfazendo transação...' })
             });

             const tgDoc = await getDoc(doc(db, 'telegram_users', String(telegramChatId)));
             if (!tgDoc.exists()) return;
             const cbUserId = tgDoc.data().userId;

             // We only delete from 'transactions' where telegramMsgId == txMsgId and userId == cbUserId
             const qTx = query(collection(db, 'transactions'), where('userId', '==', cbUserId), where('telegramMsgId', '==', txMsgId));
             const snaps = await getDocs(qTx);
             let deletedCount = 0;
             let undoReserveMods: any = null;
             let undoReserveMonth: string | null = null;
             
             for (const docSnap of snaps.docs) {
                 const data = docSnap.data();
                 if (data.reserveModifications && data.reserveModificationsMonth) {
                     undoReserveMods = data.reserveModifications;
                     undoReserveMonth = data.reserveModificationsMonth;
                 }
                 await deleteDoc(docSnap.ref);
                 deletedCount++;
             }

             if (undoReserveMods && undoReserveMonth && snaps.docs.length > 0) {
                 const userId = snaps.docs[0].data().userId;
                 const budgetRef = doc(db, 'monthly_budgets', `${userId}_${undoReserveMonth}`);
                 const bSnap = await getDoc(budgetRef);
                 if (bSnap.exists()) {
                    const b = bSnap.data();
                    const undoData: any = { updatedAt: Date.now() };
                    if (undoReserveMods.walletWithdrawals) undoData.walletWithdrawals = (b.walletWithdrawals || 0) - undoReserveMods.walletWithdrawals;
                    if (undoReserveMods.emergencyWithdrawals) undoData.emergencyWithdrawals = (b.emergencyWithdrawals || 0) - undoReserveMods.emergencyWithdrawals;
                    if (undoReserveMods.reserve) undoData.reserve = (b.reserve || 0) + undoReserveMods.reserve;
                    if (undoReserveMods.walletAdd) undoData.wallet = (b.wallet || 0) - undoReserveMods.walletAdd;
                    await updateDoc(budgetRef, undoData);
                 }
             }

             if (deletedCount > 0) {
                 await fetch(`https://api.telegram.org/bot${botToken}/editMessageText`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ chat_id: telegramChatId, message_id: messageId, text: `✅ Transação de origem desfeita com sucesso (${deletedCount} registro(s) apagado(s)).`, reply_markup: { inline_keyboard: [] } })
                 });
             } else {
                 await fetch(`https://api.telegram.org/bot${botToken}/editMessageText`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ chat_id: telegramChatId, message_id: messageId, text: `⚠️ Não consegui encontrar a transação para desfazer (pode já ter sido apagada).`, reply_markup: { inline_keyboard: [] } })
                 });
             }
         }
         return;
      }

      const tgMessage = update.message || update.edited_message;
      if (!tgMessage) return;

      const telegramChatId = tgMessage.chat.id;
      let text = tgMessage.text || tgMessage.caption || '';
      let voiceId = tgMessage.voice?.file_id || tgMessage.audio?.file_id;
      let voiceMimeType = tgMessage.voice?.mime_type || tgMessage.audio?.mime_type || 'audio/ogg';
      let userId = null;

      const sendMessage = async (msgParams: any) => {
         const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: telegramChatId, ...msgParams })
         });
         return res.json();
      };

      const editMessage = async (msgParams: any) => {
         await fetch(`https://api.telegram.org/bot${botToken}/editMessageText`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: telegramChatId, ...msgParams })
         });
      };
      
      const sendAction = async (action: string) => {
         await fetch(`https://api.telegram.org/bot${botToken}/sendChatAction`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: telegramChatId, action })
         });
      };
      
      if (!text && !voiceId) {
         await sendMessage({ text: 'Envie um texto ou áudio para adicionar uma transação.' });
         return;
      }

      if (text) {
         const lowerText = text.trim().toLowerCase();
         if (lowerText === '/start' || lowerText === '/help' || lowerText === '/ajuda') {
             await sendMessage({ text: '👋 Olá! Bem-vindo ao seu Assistente Financeiro.\n\nVocê pode me mandar mensagens de texto ou áudio relatando seus ganhos e gastos, por exemplo:\n🗣️ "Comprei um almoço por 35 reais no crédito"\n🗣️ "Recebi 1500 do freela de design pelo pix"\n\nOutros comandos:\n/saldo - Ver seu resumo financeiro atual\n/extrato - Ver todos os lançamentos do mês\n/status - Checar se o bot está ativo' });
             return;
         }
         if (lowerText === '/ping' || lowerText === '/status' || lowerText === 'está ativo?' || lowerText === 'esta ativo?' || lowerText === 'voce esta ativo?') {
             await sendMessage({ text: '✅ Sim, estou ativo e pronto para registrar suas finanças!' });
             return;
         }
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

      // Indicate processing
      await sendAction('typing');
      let processingMsgId: number | null = null;
      try {
         const processingMsg = await sendMessage({ text: '⏳ Processando e extraindo dados...' });
         if (processingMsg && processingMsg.result) {
            processingMsgId = processingMsg.result.message_id;
         }
      } catch (err) {}

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
      
      let currentMonthBudget: any = null;
      let currentMonthBudgetDocId: string | null = null;

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
          if (b.month === currentMonth + 1) {
              currentMonthBudget = b;
              currentMonthBudgetDocId = docSnap.id;
          }
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
      
      const docs = allSnaps.docs.map(d => ({id: d.id, ...d.data()})).concat(inboxSnaps.docs.map(d => ({id: d.id, ...d.data()})));
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
            id: data.id,
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

      if (text) {
          const lowerText = text.trim().toLowerCase();
          if (lowerText === '/saldo' || lowerText === '/resumo') {
              const bFormat = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
              const saldoMsg = `📊 <b>Seu Resumo Financeiro</b>\n\n` +
                               `🔸 <b>Mês Atual (${currentMonth + 1}/${currentYear}):</b>\n` +
                               `   Receitas: +${bFormat(currentMonthIncome)}\n` +
                               `   Despesas: -${bFormat(currentMonthExpense)}\n` +
                               `   Saldo do Mês: ${bFormat(totalBalance)}\n\n` +
                               `🔸 <b>Suas Reservas (Acumulado):</b>\n` +
                               `   Carteira (Física/Pix): ${bFormat(netAccWallet)}${currentMonthBudget?.walletBank ? ` (${currentMonthBudget.walletBank})` : ''}\n` +
                               `   Reserva (Livre): ${bFormat(netAccReserve)}${currentMonthBudget?.reserveBank ? ` (${currentMonthBudget.reserveBank})` : ''}\n` +
                               `   Reserva de Emergência: ${bFormat(accReserveOfReserve)}${currentMonthBudget?.reserveOfReserveBank ? ` (${currentMonthBudget.reserveOfReserveBank})` : ''}\n` +
                               `   <b>Total Guardado:</b> ${bFormat(totalAcc)}`;
              
              if (processingMsgId) {
                  await editMessage({ message_id: processingMsgId, parse_mode: 'HTML', text: saldoMsg });
              } else {
                  await sendMessage({ parse_mode: 'HTML', text: saldoMsg });
              }
              return;
          }
          if (lowerText === '/extrato' || lowerText === '/lancamentos') {
              const bFormat = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
              
              const currentMonthTx = docs.filter(d => {
                  const dDate = new Date(d.date);
                  return dDate.getMonth() === currentMonth && dDate.getFullYear() === currentYear;
              });

              let extratoMsg = `📋 <b>Lançamentos do Mês (${currentMonth + 1}/${currentYear})</b>\n`;
              extratoMsg += `Total: ${currentMonthTx.length} transações\n\n`;

              if (currentMonthTx.length === 0) {
                  extratoMsg += `<i>Nenhum lançamento registrado neste mês.</i>`;
              } else {
                  currentMonthTx.forEach(tx => {
                      const dStr = new Date(tx.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
                      const icon = tx.type === 'income' ? '🟢' : '🔴';
                      extratoMsg += `${icon} <b>${dStr}</b>: ${tx.description}\n`;
                      extratoMsg += `   💸 ${bFormat(Number(tx.amount))}\n`;
                      extratoMsg += `   🏷️ <i>${tx.category} • ${tx.paymentMethod || 'Espécie'} ${tx.account ? `• ${tx.account}` : ''}</i>\n`;
                      extratoMsg += `   🔖 ID: <code>${tx.id}</code>\n\n`;
                  });
              }
              
              // If message is too long, Telegram rejects it (4096 is the limit).
              if (extratoMsg.length > 4000) {
                  extratoMsg = extratoMsg.substring(0, 3900) + '\n\n... (limite de mensagem atingido. Acesse o aplicativo para ver todos).';
              }

              if (processingMsgId) {
                  await editMessage({ message_id: processingMsgId, parse_mode: 'HTML', text: extratoMsg });
              } else {
                  await sendMessage({ parse_mode: 'HTML', text: extratoMsg });
              }
              return;
          }
      }

      let promptContents: any[] = [];
      const prompt = `
Você é um assistente financeiro inteligente e analítico, especializado em classificar transações a partir de linguagem natural E em responder perguntas sobre as finanças do usuário.

${text ? `CONTEÚDO RECEBIDO (TEXTO): "${text}"\n` : "CONTEÚDO RECEBIDO: [Áudio anexado, extraia a fala com precisão]"}

O usuário pode estar REGISTRANDO UMA TRANSAÇÃO, FAZENDO UMA PERGUNTA ou APAGANDO UMA TRANSAÇÃO sobre suas finanças.

== REGRAS PARA PERGUNTAS (PRIORIDADE ALTA) ==
Se o usuário estiver perguntando algo com intenção de saber dados (ex: "Qual meu saldo?", "Quanto gastei esse mês?", "Quais foram meus gastos?", "resumo"), você DEVE gerar um JSON de pergunta. NUNCA invente ou registre uma transação nestes casos.
O JSON deve ter esta estrutura:
{
  "intent": "QUESTION",
  "answer": "Sua resposta (em markdown) baseada EXCLUSIVAMENTE no RESUMO FINANCEIRO abaixo. Se uma informação não estiver no resumo, informe. Se o usuário quiser ver TODAS as transações do mês, oriente-o a usar o comando /extrato."
}

== REGRAS PARA APAGAR TRANSAÇÕES ==
Se o usuário pedir para apagar, excluir ou desfazer (ex: "apaga a compra do mercado de 20 reais", "desfaz o lançamento da conta de luz"):
1. Identifique a transação no Histórico Recente.
2. Gere um JSON com a seguinte estrutura:
{
  "intent": "DELETE",
  "targetId": "O id EXATO da transação a ser apagada",
  "description": "Uma breve descrição da transação apagada para informar ao usuário"
}

== REGRAS PARA REGISTRO DE TRANSAÇÃO ==
Se, e SOMENTE SE, a intenção do usuário for claramente registrar um gasto ou ganho, e um valor monetário estiver presente ou claramente implícito, extraia as seguintes propriedades para o JSON:
- "intent": "CREATE"
- "description" (string): Nome do serviço/estabelecimento.
- "amount" (number): Valor em formato de número. Se o usuário não informar o valor, RETORNE UM JSON DE PERGUNTA informando que o valor está faltando. NUNCA invente valores.
- "type" (string): "expense" ou "income".
- "category" (string): OBRIGATORIAMENTE UMA DA LISTA "Categorias de Gastos/Ganhos Atuais".
- "account": A conta/banco informado (OBRIGATÓRIO para carteira/reservas).
- "paymentMethod": "Pix", "Crédito", "Débito", "Dinheiro" ou "Boleto".
- "installments": Inteiro numérico. Retorne 1 se não for parcelado.
- "card": Qual cartão foi usado, se "Crédito"/"Débito".
- "modifyWalletTarget": "wallet" (carteira/pix), "reserve" (reserva principal), ou "emergency" (reserva de emergência). Omitir se não tiver uso de reservas.
- "modifyWalletAction": "add" (adicionar valor) ou "subtract" (diminuir valor). Omitir se a transação não envolver carteira/reservas de forma explícita, MAS caso seja dinheiro em espécie físico sem indicar o alvo, considere "wallet".

== REGRAS PARA CARTEIRA, RESERVAS E BANCOS ==
Se houver "modifyWalletAction" ("add" ou "subtract"):
A sua resposta DEVE verificar se a "account" ou o nome do banco/conta foi explicitamente especificado.
Se o banco/conta NÃO FOI MENCIONADO (por exemplo, "guardei 100 na reserva" ou "tirei 50 da carteira"), RETORNE UM JSON DE PERGUNTA informando a falta do banco:
{"intent": "QUESTION", "answer": "De qual banco/conta é esse valor? Por favor, envie novamente informando o banco."}
NÃO retorne as propriedades de transação, retorne APENAS a pergunta!

== CONTEXTO DO USUÁRIO ==
🔹 Categorias de Gastos Atuais: [${(userSettings.categories || []).join(', ')}]
🔹 Categorias de Ganhos Atuais: [${(userSettings.incomeCategories || []).join(', ')}]
🔹 Cartões Disponíveis: [${(userSettings.cards || []).join(', ')}]

== RESUMO FINANCEIRO (Use para responder perguntas) ==
🔹 Saldo Geral (Receitas - Despesas): R$ ${totalBalance.toFixed(2)}
🔹 Despesas deste Mês (${currentMonth + 1}/${currentYear}): R$ ${currentMonthExpense.toFixed(2)}
🔹 Receitas deste Mês (${currentMonth + 1}/${currentYear}): R$ ${currentMonthIncome.toFixed(2)}
🔹 Reservas / Guardados:
- Reserva (Livre): R$ ${netAccReserve.toFixed(2)}${currentMonthBudget?.reserveBank ? ` (${currentMonthBudget.reserveBank})` : ''}
- Carteira Física: R$ ${netAccWallet.toFixed(2)}${currentMonthBudget?.walletBank ? ` (${currentMonthBudget.walletBank})` : ''}
- Reserva de Emergência: R$ ${accReserveOfReserve.toFixed(2)}${currentMonthBudget?.reserveOfReserveBank ? ` (${currentMonthBudget.reserveOfReserveBank})` : ''}
- Total Acumulado Guardado: R$ ${totalAcc.toFixed(2)}
🔹 Saldo por Contas:
${Object.entries(accountBalances).map(([acc, bal]) => `- ${acc}: R$ ${bal.toFixed(2)}`).join('\n') || "Sem contas."}
🔹 Gastos do Mês por Categoria:
${Object.entries(currentMonthExpensesByCategory).map(([cat, amount]) => `- ${cat}: R$ ${amount.toFixed(2)}`).join('\n') || "Sem gastos neste mês."}
🔹 Histórico Recente de Transações:
${recentTransactions.slice(0, 10).map(t => `[ID: ${t.id}] - ${t.desc} | R$ ${t.amount} | Tipo: ${t.type} | Cat: ${t.cat} | Data: ${new Date(t.date).toLocaleDateString('pt-BR')}`).join('\n') || "Nenhuma recente."}

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
           if (processingMsgId) {
               await editMessage({ message_id: processingMsgId, parse_mode: 'HTML', text: errMsg });
           } else {
               await sendMessage({ parse_mode: 'HTML', text: errMsg });
           }
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
         if (processingMsgId) {
             await editMessage({ message_id: processingMsgId, text: errMsg });
         } else {
             await sendMessage({ text: errMsg });
         }
         return;
      }

      if (data.isQuestion || data.intent === 'QUESTION') {
         let ans = data.answer || "Não consegui formular uma resposta.";
         ans = ans.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');
         ans = ans.replace(/\*(.*?)\*/g, '<i>$1</i>');
         if (processingMsgId) {
            await editMessage({ message_id: processingMsgId, parse_mode: 'HTML', text: ans });
         } else {
            await sendMessage({ parse_mode: 'HTML', text: ans });
         }
         return;
      }

      if (data.intent === 'DELETE') {
         if (!data.targetId) {
            const msg = `Nenhuma transação específica pôde ser apagada. Peça o histórico para ver os IDs e tente novamente.`;
            if (processingMsgId) await editMessage({ message_id: processingMsgId, text: msg });
            else await sendMessage({ text: msg });
            return;
         }
         
         try {
            await deleteDoc(doc(db, 'transactions', data.targetId));
            const msg = `✅ Transação <b>${data.description || 'selecionada'}</b> foi excluída do sistema com sucesso.`;
            if (processingMsgId) {
                await editMessage({ message_id: processingMsgId, parse_mode: 'HTML', text: msg });
            } else {
                await sendMessage({ parse_mode: 'HTML', text: msg });
            }
         } catch (e: any) {
            console.error('Delete error', e);
            const msg = 'Erro ao apagar a transação.';
            if (processingMsgId) await editMessage({ message_id: processingMsgId, text: msg });
            else await sendMessage({ text: msg });
         }
         return;
      }

      const isIncome = data.type === 'income';
      const typeLabel = isIncome ? 'Receita' : 'Despesa';
      
      const parsedAmount = data.amount || 0;
      let installments = data.installments || 1;
      installments = typeof installments === 'number' && installments > 0 ? installments : 1;
      let modifyWalletTarget = data.modifyWalletTarget || null;
      let modifyWalletAction = data.modifyWalletAction || null;
      if (!modifyWalletTarget && !modifyWalletAction) {
           const method = data.paymentMethod?.toLowerCase() || '';
           if (method === 'pix' || method === 'dinheiro') {
                modifyWalletTarget = 'wallet';
                modifyWalletAction = isIncome ? 'add' : 'subtract';
           }
      }
      
      let walletModifierText = '';
      let reserveModifications: any = null;

      if (modifyWalletAction === 'subtract' && modifyWalletTarget) {
           let amountFromWallet = 0;
           let amountFromReserve = 0;
           let amountFromEmergency = 0;
           
           const bFormat = (n: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n);
           if (modifyWalletTarget === 'emergency') {
               amountFromEmergency = parsedAmount;
               walletModifierText = `\n<b>🚨 Saque Emergencial${data.account ? ` (${data.account})` : ''}:</b> -${bFormat(amountFromEmergency)}`;
           } else if (modifyWalletTarget === 'reserve') {
               amountFromReserve = parsedAmount;
               walletModifierText = `\n<b>🏦 Saída da Reserva Principal${data.account ? ` (${data.account})` : ''}:</b> -${bFormat(amountFromReserve)}`;
           } else {
               amountFromWallet = parsedAmount;
               walletModifierText = `\n<b>🏧 Saída de Carteira${data.account ? ` (${data.account})` : ''}:</b> -${bFormat(amountFromWallet)}`;
           }

           const newWalletWithdrawals = (currentMonthBudget?.walletWithdrawals || 0) + amountFromWallet;
           const newEmergencyWithdrawals = (currentMonthBudget?.emergencyWithdrawals || 0) + amountFromEmergency;
           const newReserve = (currentMonthBudget?.reserve || 0) - amountFromReserve;
           
           const newPayload: any = { userId, year: currentYear, month: currentMonth + 1, updatedAt: Date.now() };
           
           if (amountFromWallet > 0) {
               newPayload.walletWithdrawals = newWalletWithdrawals;
               newPayload.walletWithdrawalsDetails = [
                   ...(currentMonthBudget?.walletWithdrawalsDetails || []),
                   {
                       id: Date.now().toString() + Math.random().toString(36).substring(2, 7),
                       description: data.description || 'Retirada via Assistente',
                       amount: amountFromWallet,
                       date: Date.now()
                   }
               ];
               if (data.account) {
                   const walletBanks = currentMonthBudget?.walletBanks || {};
                   const newBankAmt = Math.max(0, (walletBanks[data.account] || 0) - amountFromWallet);
                   walletBanks[data.account] = newBankAmt;
                   newPayload.walletBanks = walletBanks;
                   walletModifierText += `\n   ↳ Saldo em ${data.account}: ${bFormat(newBankAmt)}`;
               }
               walletModifierText += `\n   ↳ Total na Carteira (Acumulado): ${bFormat(netAccWallet - amountFromWallet)}`;
           }
           if (amountFromEmergency > 0) {
               newPayload.emergencyWithdrawals = newEmergencyWithdrawals;
               newPayload.emergencyWithdrawalsDetails = [
                   ...(currentMonthBudget?.emergencyWithdrawalsDetails || []),
                   {
                       id: Date.now().toString() + Math.random().toString(36).substring(2, 7),
                       description: data.description || 'Retirada via Assistente',
                       amount: amountFromEmergency,
                       date: Date.now()
                   }
               ];
               if (data.account) {
                   const emergencyBanks = currentMonthBudget?.reserveOfReserveBanks || {};
                   const newBankAmt = Math.max(0, (emergencyBanks[data.account] || 0) - amountFromEmergency);
                   emergencyBanks[data.account] = newBankAmt;
                   newPayload.reserveOfReserveBanks = emergencyBanks;
                   walletModifierText += `\n   ↳ Saldo em ${data.account}: ${bFormat(newBankAmt)}`;
               }
               walletModifierText += `\n   ↳ Total Reserva Emergência (Acumulado): ${bFormat(accReserveOfReserve - amountFromEmergency)}`;
           }
           if (amountFromReserve > 0) {
               newPayload.reserve = newReserve;
               if (data.account) {
                  const reserveBanks = currentMonthBudget?.reserveBanks || {};
                  const newBankAmt = Math.max(0, (reserveBanks[data.account] || 0) - amountFromReserve);
                  reserveBanks[data.account] = newBankAmt;
                  newPayload.reserveBanks = reserveBanks;
                  walletModifierText += `\n   ↳ Saldo em ${data.account}: ${bFormat(newBankAmt)}`;
               }
               walletModifierText += `\n   ↳ Total Reserva Livre (Acumulado): ${bFormat(netAccReserve - amountFromReserve)}`;
           }
           
           reserveModifications = {
               walletWithdrawals: amountFromWallet,
               emergencyWithdrawals: amountFromEmergency,
               reserve: amountFromReserve,
           };

           if (currentMonthBudgetDocId) {
                const updateData: any = { updatedAt: Date.now() };
                Object.assign(updateData, newPayload);
                await updateDoc(doc(db, 'monthly_budgets', currentMonthBudgetDocId), updateData);
           } else {
                await setDoc(doc(db, 'monthly_budgets', `${userId}_${currentYear}_${currentMonth + 1}`), newPayload, { merge: true });
           }
      } else if (modifyWalletAction === 'add' && modifyWalletTarget) {
           const newPayload: any = { userId, year: currentYear, month: currentMonth + 1, updatedAt: Date.now() };
           reserveModifications = {};
           
           const bFormat = (n: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n);
           if (modifyWalletTarget === 'reserve') {
               newPayload.reserve = (currentMonthBudget?.reserve || 0) + parsedAmount;
               walletModifierText = `\n<b>🏦 Adição na Reserva${data.account ? ` (${data.account})` : ''}:</b> +${bFormat(parsedAmount)}`;
               reserveModifications.reserveAdd = parsedAmount;
               if (data.account) {
                   const reserveBanks = currentMonthBudget?.reserveBanks || {};
                   const newBankAmt = (reserveBanks[data.account] || 0) + parsedAmount;
                   reserveBanks[data.account] = newBankAmt;
                   newPayload.reserveBanks = reserveBanks;
                   walletModifierText += `\n   ↳ Saldo em ${data.account}: ${bFormat(newBankAmt)}`;
               }
               walletModifierText += `\n   ↳ Total Reserva Livre (Acumulado): ${bFormat(netAccReserve + parsedAmount)}`;
           } else if (modifyWalletTarget === 'emergency') {
               newPayload.reserveOfReserve = (currentMonthBudget?.reserveOfReserve || 0) + parsedAmount;
               walletModifierText = `\n<b>🚨 Adição na Emergência${data.account ? ` (${data.account})` : ''}:</b> +${bFormat(parsedAmount)}`;
               reserveModifications.emergencyAdd = parsedAmount;
               if (data.account) {
                   const emergencyBanks = currentMonthBudget?.reserveOfReserveBanks || {};
                   const newBankAmt = (emergencyBanks[data.account] || 0) + parsedAmount;
                   emergencyBanks[data.account] = newBankAmt;
                   newPayload.reserveOfReserveBanks = emergencyBanks;
                   walletModifierText += `\n   ↳ Saldo em ${data.account}: ${bFormat(newBankAmt)}`;
               }
               walletModifierText += `\n   ↳ Total Reserva Emergência (Acumulado): ${bFormat(accReserveOfReserve + parsedAmount)}`;
           } else {
               newPayload.wallet = (currentMonthBudget?.wallet || 0) + parsedAmount;
               walletModifierText = `\n<b>🏧 Adição na Carteira${data.account ? ` (${data.account})` : ''}:</b> +${bFormat(parsedAmount)}`;
               reserveModifications.walletAdd = parsedAmount;
               if (data.account) {
                   const walletBanks = currentMonthBudget?.walletBanks || {};
                   const newBankAmt = (walletBanks[data.account] || 0) + parsedAmount;
                   walletBanks[data.account] = newBankAmt;
                   newPayload.walletBanks = walletBanks;
                   walletModifierText += `\n   ↳ Saldo em ${data.account}: ${bFormat(newBankAmt)}`;
               }
               walletModifierText += `\n   ↳ Total na Carteira (Acumulado): ${bFormat(netAccWallet + parsedAmount)}`;
           }
           
           if (currentMonthBudgetDocId) {
                const updateData: any = { updatedAt: Date.now() };
                Object.assign(updateData, newPayload);
                await updateDoc(doc(db, 'monthly_budgets', currentMonthBudgetDocId), updateData);
           } else {
                await setDoc(doc(db, 'monthly_budgets', `${userId}_${currentYear}_${currentMonth + 1}`), newPayload, { merge: true });
           }
      }
      
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
      
      const payloadBase: any = {
        userId,
        description: data.description || text || "Nova Transação",
        amount: parsedAmount,
        type: data.type === 'income' ? 'income' : 'expense',
        category: finalCategory,
        account: data.account || '',
        paymentMethod: data.paymentMethod || 'Pix',
        card: data.card || '',
        date: Date.now(),
        createdAt: Date.now(),
        telegramMsgId: tgMessage.message_id
      };
      
      if (reserveModifications) {
         payloadBase.reserveModifications = reserveModifications;
         payloadBase.reserveModificationsMonth = `${currentYear}_${currentMonth + 1}`;
      }

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

           const docRef = doc(collection(db, 'transactions'));
           await setDoc(docRef, payload);
        }
      } else {
        const docRef = doc(collection(db, 'transactions'));
        await setDoc(docRef, payloadBase);
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
                             walletModifierText +
                             alertMessage;

      const replyMarkup = {
          inline_keyboard: [[
              { text: '❌ Desfazer', callback_data: `undo_${tgMessage.message_id}` }
          ]]
      };

      if (processingMsgId) {
          await editMessage({ message_id: processingMsgId, parse_mode: 'HTML', text: successMessage, reply_markup: replyMarkup });
      } else {
          await sendMessage({ parse_mode: 'HTML', text: successMessage, reply_markup: replyMarkup });
      }
    } catch (error: any) {
      console.error('Webhook processing error:', error);
      const errorMessage = 'Erro interno no servidor ao processar sua requisição. Detalhe: ' + error.message;
      fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({ chat_id: update.message?.chat.id || update.edited_message?.chat.id, text: errorMessage })
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
                await processTelegramPayload(update, token);
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
