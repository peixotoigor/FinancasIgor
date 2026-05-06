const fs = require('fs');
const path = require('path');

const replacements = {
  'bg-\\[#0A0A0B\\]': 'bg-gray-50 dark:bg-[#0A0A0B]',
  'bg-\\[#121214\\]': 'bg-white dark:bg-[#121214]',
  'bg-\\[#18181B\\]': 'bg-white dark:bg-[#18181B]',
  'text-white': 'text-gray-900 dark:text-white',
  'text-gray-200': 'text-gray-800 dark:text-gray-200',
  'text-gray-300': 'text-gray-700 dark:text-gray-300',
  'border-white/5': 'border-gray-200 dark:border-white/5',
  'border-white/10': 'border-gray-300 dark:border-white/10',
  'bg-white/5': 'bg-gray-100 dark:bg-white/5',
  'hover:bg-white/5': 'hover:bg-gray-100 dark:hover:bg-white/5',
  'bg-white/10': 'bg-gray-200 dark:bg-white/10',
  'bg-white/\\\\\[0\\.02\\\\\]': 'bg-gray-50 dark:bg-white/[0.02]',
  'border-transparent': 'border-transparent',
  'shadow-black': 'shadow-gray-200 dark:shadow-black'
};

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(function(file) {
    file = dir + '/' + file;
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) { 
      results = results.concat(walk(file));
    } else { 
      if (file.endsWith('.tsx') || file.endsWith('.ts')) {
        results.push(file);
      }
    }
  });
  return results;
}

const files = walk('./src');
files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let originalContent = content;
  
  for (const [key, value] of Object.entries(replacements)) {
    // Avoid double replacing if it's already there
    // Actually, simple regex with boundary where applicable.
    const regex = new RegExp(`(?<!dark:)${key}(?![A-Za-z0-9/_-])`, 'g');
    content = content.replace(regex, value);
  }
  
  if (content !== originalContent) {
    fs.writeFileSync(file, content);
    console.log(`Updated ${file}`);
  }
});
