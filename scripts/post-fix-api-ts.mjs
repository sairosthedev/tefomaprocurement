/**
 * Post-migration TS fixes: dedupe imports, relax query typing, cast dynamic fields.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const API_SRC = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'api', 'src');

function walk(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(full));
    else if (e.name.endsWith('.ts')) out.push(full);
  }
  return out;
}

for (const f of walk(API_SRC)) {
  let c = fs.readFileSync(f, 'utf8');
  const orig = c;

  // Keep only first express type import
  const expressImport = "import type { Request, Response } from 'express';\n";
  c = c.replace(/import type \{ Request, Response \} from 'express';\n/g, '');
  if (orig.includes("Request, Response") && f.includes('controller')) {
    c = expressImport + c;
  }

  // req.query destructuring → cast
  c = c.replace(
    /const\s+\{([^}]+)\}\s*=\s*req\.query;/g,
    'const {$1} = req.query as Record<string, any>;'
  );

  // statusHistory / approvalHistory pushes - cast document
  c = c.replace(
    /(\w+)\.(statusHistory|approvalHistory)\.push\(/g,
    '($1 as any).$2.push('
  );

  // Dynamic assignments on requisitions in getRequisitions etc
  c = c.replace(/(reqObj|requisition|rfqObj|poObj)\.(\w+)\s*=/g, '($1 as any).$2 =');

  if (c !== orig) fs.writeFileSync(f, c, 'utf8');
}

console.log('Post-fix script done.');
