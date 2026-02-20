const fs = require('fs');
const path = require('path');
const monsters = require('../src/renderer/public/data/5e/monsters.json');
const npcs = require('../src/renderer/public/data/5e/npcs.json');
const creatures = require('../src/renderer/public/data/5e/creatures.json');

// All names in our data (lowercase for matching)
const allNames = new Set([
  ...monsters.map(m => m.name.toLowerCase()),
  ...npcs.map(n => n.name.toLowerCase()),
  ...creatures.map(c => c.name.toLowerCase())
]);

// MM 2025 PDF filenames
const bestiaryDir = path.join(__dirname, '..', '5.5e References', 'MM2025', 'Bestiary');
const categories = fs.readdirSync(bestiaryDir);
const mmPdfs = [];
for (const cat of categories) {
  const catPath = path.join(bestiaryDir, cat);
  if (fs.statSync(catPath).isDirectory()) {
    const files = fs.readdirSync(catPath).filter(f => f.endsWith('.pdf'));
    files.forEach(f => mmPdfs.push({ category: cat, name: f.replace('.pdf', '') }));
  }
}

// Check which PDF groups have NO matching entries
const missing = [];
for (const pdf of mmPdfs) {
  const pdfNameLow = pdf.name.toLowerCase();
  // Check if any of our monsters match this name
  const found = [...allNames].some(n => {
    // Exact match or contains
    if (n.includes(pdfNameLow) || pdfNameLow.includes(n)) return true;
    // Word-level matching (at least one significant word matches)
    const pdfWords = pdfNameLow.split(/[\s-]+/).filter(w => w.length > 3);
    return pdfWords.some(w => n.includes(w));
  });
  if (!found) {
    missing.push(pdf.category + '/' + pdf.name);
  }
}

console.log('MM 2025 PDFs with NO matching entries in our data:');
missing.forEach(m => console.log('  MISSING: ' + m));
console.log('\nTotal MM 2025 PDFs:', mmPdfs.length);
console.log('Potentially missing groups:', missing.length);
console.log('\nTotal in our data: monsters=' + monsters.length + ' npcs=' + npcs.length + ' creatures=' + creatures.length + ' total=' + (monsters.length + npcs.length + creatures.length));
