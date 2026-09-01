const fs = require('fs');
let content = fs.readFileSync('src/types.ts', 'utf-8');

if (!content.includes('export interface Debt')) {
  content += `\n
export interface Debt {
  id: string;
  userId: string;
  name: string;
  amount: number;
  interestRate?: number;
  installments?: number;
  dueDate?: number;
  createdAt: number;
}
`;
  fs.writeFileSync('src/types.ts', content, 'utf-8');
  console.log('Debt type added.');
} else {
  console.log('Debt type already exists.');
}
