const fs = require('fs');
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
  
  content = content.replace(/dark:bg-gray-100 dark:bg-\[#0a0a0b\]\/50/g, 'dark:bg-[#0a0a0b]/50');
  content = content.replace(/dark:text-gray-900 dark:text-gray-200/g, 'dark:text-gray-200');
  content = content.replace(/dark:text-gray-900 dark:text-white/g, 'dark:text-white');
  content = content.replace(/hover:bg-gray-100 dark:hover:bg-gray-50 dark:bg-white\/\[0\.02\]/g, 'hover:bg-gray-50 dark:hover:bg-white/[0.02]');
  
  if (content !== originalContent) {
    fs.writeFileSync(file, content);
    console.log(`Updated ${file}`);
  }
});
