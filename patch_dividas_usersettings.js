const fs = require('fs');
let content = fs.readFileSync('src/components/DividasTab.tsx', 'utf-8');

content = content.replace("import type { Debt } from '../types';", "import type { Debt, UserSettings } from '../types';");
content = content.replace(
  "interface DividasTabProps {\n  userId: string;\n}",
  "interface DividasTabProps {\n  userId: string;\n  userSettings: UserSettings | null;\n}"
);
content = content.replace(
  "export function DividasTab({ userId }: DividasTabProps) {",
  "export function DividasTab({ userId, userSettings }: DividasTabProps) {"
);

const oldFetch = `      const response = await fetch('/api/ai/forecast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt })
      });`;

const newFetch = `      const response = await fetch('/api/ai/forecast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          prompt,
          openRouterKey: userSettings?.openRouterApiKey,
          openRouterModel: userSettings?.openRouterModel
        })
      });`;

content = content.replace(oldFetch, newFetch);
fs.writeFileSync('src/components/DividasTab.tsx', content, 'utf-8');
