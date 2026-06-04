/**
 * Mechanical CJS → ESM TypeScript converter for api/src controllers & routes.
 * Run from repo root: node scripts/convert-api-to-ts.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const API_SRC = path.join(__dirname, '..', 'api', 'src');

const CONTROLLER_DIRS = [
  'controllers/procurement',
  'controllers/supplier',
  'controllers/stores'
];

const ROUTE_FILES = [
  'routes/procurement.route.js',
  'routes/supplier.route.js',
  'routes/stores.route.js',
  'routes/index.js',
  'controllers/index.js'
];

function isControllerFile(filePath) {
  return filePath.includes('controllers/') && filePath.endsWith('.controller.js');
}

function isIndexFile(filePath) {
  return filePath.endsWith('index.js');
}

function convertRequires(content, fileDir) {
  const depth = fileDir.split(/[/\\]/).filter(Boolean).length;
  const up = (n) => '../'.repeat(n);

  // const { a, b } = require('path');
  content = content.replace(
    /const\s+\{([^}]+)\}\s*=\s*require\(['"]([^'"]+)['"]\);?/g,
    (_, imports, reqPath) => {
      const esmPath = toEsmPath(reqPath, fileDir);
      return `import { ${imports.trim()} } from '${esmPath}';`;
    }
  );

  // const x = require('path');
  content = content.replace(
    /const\s+(\w+)\s*=\s*require\(['"]([^'"]+)['"]\);?/g,
    (_, name, reqPath) => {
      const esmPath = toEsmPath(reqPath, fileDir);
      return `import ${name} from '${esmPath}';`;
    }
  );

  return content;
}

function toEsmPath(reqPath, fileDir) {
  let p = reqPath;
  if (p.startsWith('../') || p.startsWith('./')) {
    if (!p.endsWith('.js') && !p.endsWith('.json')) {
      if (p.includes('models') && !p.includes('.model')) {
        p = p.replace(/\/?models$/, '/models/index.js');
      } else if (p.includes('middleware') && !p.includes('.middleware')) {
        p = p.replace(/\/?middleware$/, '/middleware/index.js');
      } else if (p.endsWith('/auth') || p.endsWith('/admin') || p.endsWith('/procurement') ||
                 p.endsWith('/supplier') || p.endsWith('/department') || p.endsWith('/finance') ||
                 p.endsWith('/coo') || p.endsWith('/stores') || p.endsWith('/notifications') ||
                 p.endsWith('/sites') || p.endsWith('/dashboard')) {
        p = `${p}/index.js`;
      } else if (!p.includes('.')) {
        p = `${p}.js`;
      } else if (!p.endsWith('.js')) {
        p = `${p}.js`;
      }
    }
    if (p.endsWith('.controller')) p += '.js';
    if (p.endsWith('.route')) p += '.js';
    if (p.endsWith('.service')) p += '.js';
    return p;
  }
  return p;
}

function convertExports(content, isIndex) {
  // module.exports = { ... };
  const objMatch = content.match(/module\.exports\s*=\s*\{([\s\S]*?)\};?\s*$/);
  if (objMatch) {
    const body = objMatch[1];
    content = content.replace(/module\.exports\s*=\s*\{[\s\S]*?\};?\s*$/, '');
    content = content.trimEnd() + `\n\nexport default {${body}};\n`;
    return content;
  }

  // module.exports = identifier;
  const idMatch = content.match(/module\.exports\s*=\s*(\w+);?\s*$/);
  if (idMatch) {
    content = content.replace(/module\.exports\s*=\s*\w+;?\s*$/, '');
    content = content.trimEnd() + `\n\nexport default ${idMatch[1]};\n`;
    return content;
  }

  return content;
}

function addControllerTypes(content) {
  if (!content.includes("from 'express'") && !content.includes('from "express"')) {
    if (content.includes('express')) {
      content = `import type { Request, Response } from 'express';\n` + content;
    }
  } else if (!content.includes('Request') || !content.includes('Response')) {
    content = `import type { Request, Response } from 'express';\n` + content;
  }

  // async (req, res) => or async (req, res) {
  content = content.replace(
    /async\s*\(\s*req\s*,\s*res\s*\)\s*(=>|:)/g,
    'async (req: Request, res: Response): Promise<any> $1'
  );

  return content;
}

function convertRouteFile(content) {
  content = content.replace(
    /const express = require\('express'\);/,
    "import express from 'express';"
  );
  content = convertRequires(content, 'routes');
  content = content.replace(/module\.exports = router;?/, 'export default router;');
  return content;
}

function processFile(absPath) {
  const rel = path.relative(API_SRC, absPath);
  const fileDir = path.dirname(rel);
  let content = fs.readFileSync(absPath, 'utf8');

  if (rel.startsWith('routes/') && rel.endsWith('.route.js')) {
    content = convertRouteFile(content);
  } else if (rel === 'routes/index.js') {
    content = content.replace(/const express = require\('express'\);/, "import express from 'express';");
    content = convertRequires(content, 'routes');
    for (const r of ['auth', 'admin', 'procurement', 'supplier', 'department', 'finance', 'coo', 'stores', 'dashboard', 'notifications', 'sites']) {
      content = content.replace(
        new RegExp(`require\\('./${r}\\.route'\\)`, 'g'),
        `require('./${r}.route.js')`
      );
    }
    content = content.replace(
      /const\s+(\w+)\s*=\s*require\('\.\/([^'"]+)\.route\.js'\);?/g,
      "import $1 from './$2.route.js';"
    );
    content = content.replace(/module\.exports = router;?/, 'export default router;');
  } else if (rel === 'controllers/index.js') {
    content = convertRequires(content, 'controllers');
    for (const d of ['auth', 'admin', 'procurement', 'supplier', 'department', 'finance', 'coo', 'stores', 'notifications', 'sites']) {
      content = content.replace(
        new RegExp(`require\\('./${d}'\\)`, 'g'),
        `require('./${d}/index.js')`
      );
    }
    content = content.replace(
      /const\s+(\w+)\s*=\s*require\('\.\/([^'"]+)\/index\.js'\);?/g,
      "import $1 from './$2/index.js';"
    );
    content = content.replace(
      /module\.exports\s*=\s*\{([\s\S]*?)\};?\s*$/,
      (_, body) => {
        const lines = body.split('\n').map(l => l.trim()).filter(Boolean);
        const entries = lines.map(l => {
          const m = l.match(/(\w+):\s*(\w+)/);
          return m ? `  ${m[1]}: ${m[2]}` : l;
        });
        return `export default {\n${entries.join(',\n')}\n};\n`;
      }
    );
  } else if (isControllerFile(absPath)) {
    content = convertRequires(content, fileDir);
    content = convertExports(content, false);
    content = addControllerTypes(content);
  } else if (isIndexFile(absPath)) {
    content = convertRequires(content, fileDir);
    // index in controller folder: require('./foo.controller') -> import
    content = content.replace(
      /const\s+(\w+)\s*=\s*require\('\.\/([^'"]+)\.controller'\);?/g,
      "import $1 from './$2.controller.js';"
    );
    content = convertExports(content, true);
  }

  // Fix models/middleware paths that weren't caught
  content = content.replace(/from '\.\.\/\.\.\/models';/g, "from '../../models/index.js';");
  content = content.replace(/from '\.\.\/models';/g, "from '../models/index.js';");
  content = content.replace(/from '\.\.\/\.\.\/middleware';/g, "from '../../middleware/index.js';");
  content = content.replace(/from '\.\.\/middleware';/g, "from '../middleware/index.js';");
  content = content.replace(/from '\.\.\/\.\.\/services\/([^']+)';/g, "from '../../services/$1.js';");
  content = content.replace(/from '\.\.\/\.\.\/lib\/([^']+)';/g, "from '../../lib/$1.js';");
  content = content.replace(/from '\.\.\/controllers';/g, "from '../controllers/index.js';");
  content = content.replace(/from '\.\.\/controllers\/([^']+)';/g, "from '../controllers/$1.js';");

  // Remove 'use strict';
  content = content.replace(/^'use strict';\s*\n/m, '');

  const outPath = absPath.replace(/\.js$/, '.ts');
  fs.writeFileSync(outPath, content, 'utf8');
  fs.unlinkSync(absPath);
  console.log('Converted:', rel, '->', path.relative(API_SRC, outPath));
}

function collectJsFiles(dir) {
  const results = [];
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) results.push(...collectJsFiles(full));
    else if (entry.name.endsWith('.js')) results.push(full);
  }
  return results;
}

let converted = 0;

for (const dir of CONTROLLER_DIRS) {
  const fullDir = path.join(API_SRC, dir);
  for (const f of collectJsFiles(fullDir)) {
    processFile(f);
    converted++;
  }
}

for (const rf of ROUTE_FILES) {
  const full = path.join(API_SRC, rf);
  if (fs.existsSync(full)) {
    processFile(full);
    converted++;
  }
}

console.log(`\nDone. Converted ${converted} files.`);
