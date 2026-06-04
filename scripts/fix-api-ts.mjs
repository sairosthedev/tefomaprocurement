/**
 * Fix incomplete CJS→ESM conversions in api/src.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const API_SRC = path.join(__dirname, '..', 'api', 'src');

function walk(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(full));
    else if (e.name.endsWith('.ts')) out.push(full);
  }
  return out;
}

function fixFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let changed = false;
  const rel = path.relative(API_SRC, filePath);

  if (!content.includes('require(') && !content.includes('module.exports')) {
    return false;
  }

  // const { a, b } = require('...');
  content = content.replace(
    /const\s+\{([^}]+)\}\s*=\s*require\(['"]([^'"]+)['"]\);?/g,
    (_, imports, p) => {
      changed = true;
      return `import { ${imports.trim()} } from '${fixPath(p)}';`;
    }
  );

  content = content.replace(
    /const\s+(\w+)\s*=\s*require\(['"]([^'"]+)['"]\);?/g,
    (_, name, p) => {
      changed = true;
      return `import ${name} from '${fixPath(p)}';`;
    }
  );

  content = content.replace(/module\.exports\s*=\s*(\w+);?\s*$/m, (_, name) => {
    changed = true;
    return `export default ${name};\n`;
  });

  content = content.replace(/module\.exports\s*=\s*\{([\s\S]*?)\};?\s*$/m, (_, body) => {
    changed = true;
    return `export default {${body}};\n`;
  });

  if (rel.includes('controllers/') && rel.endsWith('.controller.ts')) {
    if (!content.includes("from 'express'")) {
      content = `import type { Request, Response } from 'express';\n` + content;
      changed = true;
    }
    content = content.replace(
      /async\s*\(\s*req\s*,\s*res\s*\)\s*(=>|:)/g,
      'async (req: Request, res: Response): Promise<any> $1'
    );
    // callback params
    content = content.replace(/\(\s*(\w+)\s*\)\s*=>/g, (m, p) => {
      if (['req', 'res', 'next'].includes(p)) return m;
      return `(${p}: any) =>`;
    });
    content = content.replace(/\(\s*(\w+)\s*,\s*(\w+)\s*\)\s*=>/g, (m, a, b) => {
      if (a === 'sum' || a === 'acc') return `(${a}: any, ${b}: any) =>`;
      if (b === 'item' || b === 'inv' || b === 'rfq') return `(${a}: any, ${b}: any) =>`;
      return m;
    });
    content = content.replace(/catch\s*\(\s*error\s*\)/g, 'catch (error: any)');
  }

  if (rel.startsWith('routes/') && rel.endsWith('.route.ts')) {
    content = content.replace(
      /const express = require\('express'\);/,
      "import express from 'express';"
    );
    if (!content.includes('export default router')) {
      content = content.replace(/module\.exports = router;?/, 'export default router;');
    }
  }

  if (changed) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('Fixed:', rel);
  }
  return changed;
}

function fixPath(p) {
  if (p === '../../models' || p === '../models') return p.replace('models', 'models/index.js');
  if (p.includes('middleware') && !p.endsWith('.js'))
    return p.includes('../') ? '../../middleware/index.js' : '../middleware/index.js';
  if (p === '../controllers') return '../controllers/index.js';
  if (!p.endsWith('.js') && (p.startsWith('.') || p.startsWith('..'))) {
    if (!p.includes('.')) return `${p}/index.js`;
    if (!p.endsWith('.js')) return `${p}.js`;
  }
  return p.endsWith('.js') ? p : `${p}.js`;
}

let n = 0;
for (const f of walk(API_SRC)) {
  if (fixFile(f)) n++;
}
console.log(`Fixed ${n} files.`);
