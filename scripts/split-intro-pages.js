/**
 * Split Introduction.pdf into individual page PDFs for reading.
 * The 284MB intro file is too large for single reads, so we split
 * it into ~5 pages (57MB each, under 100MB read limit).
 *
 * Usage: node scripts/split-intro-pages.js
 * Output: 5.5e References/MM2025/Introduction/pages/page-N.pdf
 */
const fs = require('fs');
const path = require('path');
const { PDFDocument } = require('pdf-lib');

const SRC = path.join(__dirname, '..', '5.5e References', 'MM2025', 'Introduction', 'Introduction.pdf');
const OUT_DIR = path.join(__dirname, '..', '5.5e References', 'MM2025', 'Introduction', 'pages');

async function main() {
  if (!fs.existsSync(SRC)) {
    console.error('Source PDF not found:', SRC);
    process.exit(1);
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });

  console.log('Loading Introduction.pdf...');
  const srcBytes = fs.readFileSync(SRC);
  const srcDoc = await PDFDocument.load(srcBytes);
  const totalPages = srcDoc.getPageCount();
  console.log(`Source: ${totalPages} pages`);

  for (let i = 0; i < totalPages; i++) {
    const newDoc = await PDFDocument.create();
    const [copiedPage] = await newDoc.copyPages(srcDoc, [i]);
    newDoc.addPage(copiedPage);

    const outPath = path.join(OUT_DIR, `page-${i + 1}.pdf`);
    const pdfBytes = await newDoc.save();
    fs.writeFileSync(outPath, pdfBytes);
    console.log(`  Page ${i + 1} → ${outPath}`);
  }

  console.log(`\nDone! Split ${totalPages} pages.`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
