/* ==========================================================================
   本地预览服务器（仅用于设计验收，不属于站点文件，不要上传到仓库）
   用法： node _preview.mjs [port]
   它同时做两件事：
     1. 把工作目录当作静态站点根目录，用正确的 MIME 类型提供文件；
     2. 在 /__ref 路径下反代参考站 miband.qihe0507.top，
        并强制返回 text/css 给 .css 请求，方便本地对比两套设计语言。
   ========================================================================== */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';

const ROOT = resolve(process.cwd());
const PORT = Number(process.argv[2] || 8800);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
};

const REF_ORIGIN = 'https://miband.qihe0507.top';

/* 一律禁缓存。
   之前只有 HTML 带了 no-store，CSS/JS 没带 —— 浏览器会拿旧样式表继续用，
   于是「改了样式但页面没变」这种假象会白白浪费一整轮排查。
   验收用的服务器，宁可每次都重新下载。 */
const NO_STORE = {
  'cache-control': 'no-store, no-cache, must-revalidate, max-age=0',
  'pragma': 'no-cache',
  'expires': '0',
};

async function proxyReference(url, res, forceType) {
  try {
    const r = await fetch(REF_ORIGIN + url, {
      headers: { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/124 Safari/537.36' },
    });
    const buf = Buffer.from(await r.arrayBuffer());
    const type = forceType || r.headers.get('content-type') || 'application/octet-stream';
    res.writeHead(r.status, { 'content-type': type, ...NO_STORE });
    res.end(buf);
  } catch (e) {
    res.writeHead(502, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('proxy error: ' + e.message);
  }
}

const server = createServer(async (req, res) => {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  } catch {
    res.writeHead(400).end('bad request');
    return;
  }

  /* ---- 参考站反代 ---- */
  if (pathname === '/__ref' || pathname.startsWith('/__ref/')) {
    const rest = pathname.slice('/__ref'.length) || '/';
    const isCss = rest.endsWith('.css') || rest === '/styles.css';
    if (isCss) {
      /* 参考站的 styles.css 由站点自己按 <link> 引入；这里统一兜底成 text/css，
         这样直接访问 /__ref/styles.css 也能在浏览器里当样式表用。 */
      return proxyReference(rest, res, 'text/css; charset=utf-8');
    }
    return proxyReference(rest, res);
  }

  /* ---- 本地静态文件 ---- */
  let rel = pathname === '/' ? '/index.html' : pathname;
  let target = join(ROOT, normalize(rel).replace(/^(\.\.[/\\])+/, ''));
  if (!target.startsWith(ROOT)) {
    res.writeHead(403).end('forbidden');
    return;
  }

  /* GitHub Pages 会把 /edit 这种无扩展名路径映射到 edit.html。
     验收服务器也照做，否则站内那些 /edit、/trans 之类的链接本地点不通。 */
  try {
    const info = await stat(target);
    if (info.isDirectory()) target = join(target, 'index.html');
  } catch {
    if (!extname(target)) target += '.html';
  }

  try {
    /* 目录在上面的 stat 里已经换成 index.html，这里只可能是文件 */
    const body = await readFile(target);
    res.writeHead(200, {
      'content-type': MIME[extname(target).toLowerCase()] || 'application/octet-stream',
      ...NO_STORE,
    });
    res.end(body);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('404 ' + rel);
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`preview  -> http://127.0.0.1:${PORT}/`);
  console.log(`reference-> http://127.0.0.1:${PORT}/__ref/`);
});
