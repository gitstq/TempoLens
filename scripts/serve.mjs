#!/usr/bin/env node
/**
 * TempoLens · scripts/serve.mjs
 * 零依赖静态开发服务器 / zero-dependency static dev server.
 *
 * 用法 / usage:
 *   node scripts/serve.mjs [--port 8080] [--root src]
 *
 * TempoLens 本身无需服务器（普通脚本 + file:// 即可运行），
 * 此脚本仅为偏好本地服务器或需要精确 HTTP 语义的开发者提供便利。
 * TempoLens runs from file:// directly; this server is a convenience only.
 */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, dirname, join, normalize, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.md': 'text/markdown; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8'
};

/**
 * 创建静态文件处理器 / create a static file handler.
 * @param {string} rootDir 被服务的根目录 / root directory to serve
 */
export function createStaticHandler(rootDir) {
  const base = normalize(resolve(rootDir));
  return async function handler(req, res) {
    try {
      const url = new URL(req.url, 'http://localhost');
      let pathname = decodeURIComponent(url.pathname);
      if (pathname.endsWith('/')) { pathname += 'index.html'; }
      const filePath = normalize(join(base, pathname));
      if (!filePath.startsWith(base)) {
        res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('403 Forbidden');
        return;
      }
      const st = await stat(filePath).catch(() => null);
      const finalPath = st && st.isDirectory() ? join(filePath, 'index.html') : filePath;
      const body = await readFile(finalPath);
      res.writeHead(200, {
        'Content-Type': MIME[extname(finalPath).toLowerCase()] || 'application/octet-stream',
        'Cache-Control': 'no-cache'
      });
      res.end(body);
    } catch {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404 Not Found');
    }
  };
}

const invokedDirectly = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  const argv = process.argv.slice(2);
  const portIdx = argv.indexOf('--port');
  const rootIdx = argv.indexOf('--root');
  const port = portIdx >= 0 ? Number(argv[portIdx + 1]) : 8080;
  const root = rootIdx >= 0
    ? resolve(argv[rootIdx + 1])
    : resolve(dirname(fileURLToPath(import.meta.url)), '..', 'src');
  createServer(createStaticHandler(root)).listen(port, () => {
    console.log('TempoLens dev server → http://localhost:' + port + '/');
    console.log('Press Ctrl+C to stop.');
  });
}
