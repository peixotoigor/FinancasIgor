const fs = require('fs');
let content = fs.readFileSync('src/components/DividasTab.tsx', 'utf-8');

const oldTryCatch = `      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Erro na API');
      setAiProjection(data.text || 'Nenhuma projeção gerada.');
    } catch (error) {
      console.error(error);
      setAiProjection('Desculpe, não foi possível gerar a projeção no momento.');
    }`;

const newTryCatch = `      const data = await response.json();
      if (!response.ok) {
         const errMsg = typeof data.error === 'string' ? data.error : (data.error?.message || 'Erro na API');
         if (errMsg.toLowerCase().includes('api key')) {
             throw new Error('⚠️ Ops! Sua Chave de API do Gemini não está configurada ou é inválida. Vá em Configurações (Settings) e adicione uma chave válida para usar a IA.');
         }
         throw new Error(errMsg);
      }
      setAiProjection(data.text || 'Nenhuma projeção gerada.');
    } catch (error: any) {
      console.error(error);
      setAiProjection(error.message || 'Desculpe, não foi possível gerar a projeção no momento.');
    }`;

content = content.replace(oldTryCatch, newTryCatch);
fs.writeFileSync('src/components/DividasTab.tsx', content, 'utf-8');
console.log('Patched error handling');
