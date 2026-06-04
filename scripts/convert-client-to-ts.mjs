/**
 * Rename client .jsx → .tsx and .js → .ts (minimal conversion).
 * Run: node scripts/convert-client-to-ts.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLIENT_SRC = path.join(__dirname, '..', 'client', 'src');
const CLIENT_LIB = path.join(__dirname, '..', 'client', 'lib');

function walk(dir, ext) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(full, ext));
    else if (e.name.endsWith(ext)) out.push(full);
  }
  return out;
}

let n = 0;
for (const f of [...walk(CLIENT_SRC, '.jsx'), ...walk(CLIENT_LIB, '.js')]) {
  const target = f.replace(/\.jsx$/, '.tsx').replace(/\.js$/, '.ts');
  if (fs.existsSync(target)) {
    fs.unlinkSync(f);
    console.log('Skip (ts exists):', path.relative(path.join(__dirname, '..'), f));
    continue;
  }
  fs.renameSync(f, target);
  console.log('Renamed:', path.relative(path.join(__dirname, '..'), f), '->', path.basename(target));
  n++;
}
console.log(`Renamed ${n} files.`);
