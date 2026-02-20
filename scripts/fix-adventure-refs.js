const fs = require('fs');
const fp = './src/renderer/public/data/adventures/adventures.json';
let text = fs.readFileSync(fp, 'utf8');

const replacements = [
  ['"statBlockId": "veteran"', '"statBlockId": "warrior-veteran"'],
  ['"statBlockId": "bugbear"', '"statBlockId": "bugbear-warrior"'],
  ['"monsterId": "bugbear"', '"monsterId": "bugbear-warrior"'],
  ['"monsterId": "cult-fanatic"', '"monsterId": "cultist-fanatic"'],
  ['"monsterId": "flying-sword"', '"monsterId": "animated-flying-sword"'],
  ['"monsterId": "goblin"', '"monsterId": "goblin-warrior"'],
];

for (const [oldStr, newStr] of replacements) {
  let count = 0;
  while (text.includes(oldStr)) {
    text = text.replace(oldStr, newStr);
    count++;
  }
  if (count > 0) console.log(`Replaced ${count}x: ${oldStr} -> ${newStr}`);
}

fs.writeFileSync(fp, text);
console.log('Done!');
