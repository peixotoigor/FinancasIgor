const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf-8');

content = content.replace(
  "<DividasTab userId={user.uid} />",
  "<DividasTab userId={user.uid} userSettings={userSettings} />"
);

fs.writeFileSync('src/App.tsx', content, 'utf-8');
