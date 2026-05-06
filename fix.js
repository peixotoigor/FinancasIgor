const fs = require('fs');
['src/components/TransactionsTab.tsx', 'src/components/ReservesTab.tsx', 'src/App.tsx'].forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(/bg-\[#0a0a0b\]\/50/g, 'bg-gray-100 dark:bg-[#0a0a0b]/50');
  content = content.replace(/bg-\[#0a0a0b\]/g, 'bg-gray-100 dark:bg-[#0a0a0b]');
  content = content.replace(/bg-white\/\\\[0\.02\\\]/g, 'bg-gray-100 dark:hover:bg-white/[0.02]');
  content = content.replace(/text-gray-200/g, 'text-gray-900 dark:text-gray-200');
  content = content.replace(/text-gray-300/g, 'text-gray-800 dark:text-gray-300');
  content = content.replace(/text-white/g, 'text-gray-900 dark:text-white');
  
  // also fix table row hover on TransactionsTab and ReservesTab
  content = content.replace(/hover:bg-white\/\[0\.02\]/g, 'hover:bg-gray-100 dark:hover:bg-white/[0.02]');
  content = content.replace(/bg-white\/\[0\.02\]/g, 'bg-gray-50 dark:bg-white/[0.02]');
  fs.writeFileSync(file, content);
});
