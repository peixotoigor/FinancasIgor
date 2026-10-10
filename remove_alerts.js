const fs = require('fs');
let content = fs.readFileSync('src/components/DividasTab.tsx', 'utf-8');
content = content.replace(/alert\("Erro ao desfazer pagamento\."\);/g, "console.error('Erro ao desfazer pagamento');");
content = content.replace(/alert\("Erro ao editar pagamento\."\);/g, "console.error('Erro ao editar pagamento');");
content = content.replace(/alert\("Erro ao processar o pagamento\. Tente novamente\."\);/g, "console.error('Erro ao processar pagamento');");
fs.writeFileSync('src/components/DividasTab.tsx', content, 'utf-8');
