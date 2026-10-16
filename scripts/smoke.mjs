#!/usr/bin/env node
/**
 * TempoLens · scripts/smoke.mjs
 * 冒烟测试：在进程内启动静态服务器，请求关键资源并断言状态与内容。
 * Smoke test: boot the static server in-process and assert key resources.
 *
 * 用法 / usage: node scripts/smoke.mjs（需先执行 node scripts/build.mjs）
 * 零依赖 / zero dependencies.
 */
import { createServer } from 'node:http';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createStaticHandler } from './serve.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const failures = [];

function check(name, condition, detail) {
  if (condition) {
    console.log('ok   ' + name);
  } else {
    failures.push(name);
    console.error('FAIL ' + name + (detail ? ' — ' + detail : ''));
  }
}

async function get(base, path) {
  const res = await fetch(base + path);
  const text = await res.text();
  return { status: res.status, text: text };
}

const server = createServer(createStaticHandler(join(root, 'src')));
await new Promise((resolveListen) => server.listen(0, resolveListen));
const port = server.address().port;
const base = 'http://127.0.0.1:' + port;

try {
  const index = await get(base, '/');
  check('GET / returns 200', index.status === 200, 'status=' + index.status);
  check('index references core modules', index.text.includes('core/tempo.js'));
  check('index mounts the visualizer', index.text.includes('id="visualizer"'));
  check('index links the stylesheet', index.text.includes('styles.css'));

  const app = await get(base, '/app.js');
  check('GET /app.js returns 200', app.status === 200, 'status=' + app.status);
  check('app.js bootstraps TempoLens', app.text.includes('window.TempoLens'));

  const css = await get(base, '/styles.css');
  check('GET /styles.css returns 200', css.status === 200, 'status=' + css.status);

  const traversal = await get(base, '/../package.json');
  check('path traversal is blocked', traversal.status === 403 || traversal.status === 404, 'status=' + traversal.status);

  const missing = await get(base, '/does-not-exist.js');
  check('unknown file returns 404', missing.status === 404, 'status=' + missing.status);

  const distPath = join(root, 'dist', 'tempolens.html');
  if (existsSync(distPath)) {
    const distServer = createServer(createStaticHandler(join(root, 'dist')));
    await new Promise((r) => distServer.listen(0, r));
    const dport = distServer.address().port;
    const bundle = await get('http://127.0.0.1:' + dport, '/tempolens.html');
    check('dist bundle returns 200', bundle.status === 200, 'status=' + bundle.status);
    check('dist bundle has no external scripts', !/<script src=/.test(bundle.text));
    check('dist bundle has no external stylesheets', !/<link rel="stylesheet"/.test(bundle.text));
    check('dist bundle contains the engine', bundle.text.includes('createScheduler'));
    distServer.close();
  } else {
    check('dist bundle exists', false, 'run `node scripts/build.mjs` first');
  }
} catch (error) {
  check('smoke test completed without throwing', false, error.message);
} finally {
  server.close();
}

if (failures.length > 0) {
  console.error('\n' + failures.length + ' smoke check(s) failed');
  process.exit(1);
}
console.log('\nall smoke checks passed');
