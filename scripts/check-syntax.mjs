#!/usr/bin/env node
/**
 * TempoLens · scripts/check-syntax.mjs
 * 语法校验：对 src/、scripts/、test/ 下所有 .js/.mjs 执行 `node --check`。
 * Syntax check: runs `node --check` on every .js/.mjs under src/, scripts/, test/.
 *
 * 零依赖：不安装任何包，仅使用 Node 内置模块。
 * Zero dependencies: Node built-ins only.
 */
import { execFileSync } from 'node:child_process';
import { readdirSync, statSync } from 'node:fs';
import { join, extname, relative, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const targets = ['src', 'scripts', 'test'];
const extensions = ['.js', '.mjs'];

function walk(dir, out) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      walk(full, out);
    } else if (extensions.includes(extname(entry))) {
      out.push(full);
    }
  }
  return out;
}

const files = [];
for (const target of targets) {
  const dir = join(root, target);
  try {
    if (statSync(dir).isDirectory()) { walk(dir, files); }
  } catch {
    // 目标目录不存在时跳过 / skip missing directories
  }
}
files.sort();

let failed = 0;
for (const file of files) {
  try {
    execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' });
    console.log('ok   ' + relative(root, file));
  } catch (error) {
    failed += 1;
    console.error('FAIL ' + relative(root, file));
    console.error(String(error.stderr || error.message));
  }
}

console.log('\n' + (files.length - failed) + '/' + files.length + ' files passed node --check');
if (failed > 0) {
  console.error(failed + ' file(s) failed the syntax check');
  process.exit(1);
}
