#!/usr/bin/env node
/**
 * TempoLens · scripts/build.mjs
 * 单文件打包：把 index.html、styles.css 与全部脚本内联成
 * dist/tempolens.html —— 一个可通过 file:// 直接打开、可邮件发送的便携文件。
 * Single-file bundle: inline CSS and all scripts into dist/tempolens.html —
 * one portable file that works over file:// and can be shared anywhere.
 *
 * 用法 / usage: node scripts/build.mjs [--out <path>]
 * 零依赖 / zero dependencies.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const srcDir = join(root, 'src');

function parseArgs(argv) {
  const args = { out: null };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--out') { args.out = argv[i + 1]; i += 1; }
  }
  return args;
}

const args = parseArgs(process.argv);
const outPath = args.out ? resolve(args.out) : join(root, 'dist', 'tempolens.html');

let html = readFileSync(join(srcDir, 'index.html'), 'utf8');
const inlined = { css: 0, js: 0 };

// 1) 内联样式表 / inline the stylesheet
html = html.replace('<link rel="stylesheet" href="styles.css">', () => {
  const css = readFileSync(join(srcDir, 'styles.css'), 'utf8');
  inlined.css += 1;
  return '<style>\n' + css.trim() + '\n</style>';
});

// 2) 按文档顺序内联脚本 / inline scripts in document order
let scriptIndex = 0;
html = html.replace(/<script src="([^"]+)"><\/script>/g, (_match, src) => {
  const code = readFileSync(join(srcDir, src), 'utf8');
  inlined.js += 1;
  scriptIndex += 1;
  return '<!-- ' + src + ' -->\n<script>\n' + code.trim() + '\n</script>';
});

if (inlined.css !== 1) {
  console.error('build: expected exactly one stylesheet link, found ' + inlined.css);
  process.exit(1);
}
if (scriptIndex === 0) {
  console.error('build: no scripts found to inline');
  process.exit(1);
}

if (/<script src=/.test(html) || /<link rel="stylesheet"/.test(html)) {
  console.error('build: external references remain after bundling');
  process.exit(1);
}

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, html, 'utf8');

const kb = (Buffer.byteLength(html, 'utf8') / 1024).toFixed(1);
console.log('build: ' + outPath.replace(root + '/', '') + ' (' + kb + ' KB, ' +
  inlined.css + ' stylesheet, ' + inlined.js + ' scripts inlined)');
