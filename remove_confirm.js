const fs = require('fs');
let content = fs.readFileSync('src/components/DividasTab.tsx', 'utf-8');
content = content.replace(
  "if (confirm('Tem certeza que deseja desfazer este pagamento? O saldo da dívida voltará a subir.')) {",
  "if (true) {"
);
fs.writeFileSync('src/components/DividasTab.tsx', content, 'utf-8');
