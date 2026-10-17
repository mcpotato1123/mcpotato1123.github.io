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
import { createReadStream } from 'node:fs';
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
  /* 视频：类型必须写对。用 application/octet-stream 时部分浏览器会拒绝播放
     （尤其 Safari），因为它按 MIME 判断能不能解。 */
  '.mp4': 'video/mp4',
  '.m4v': 'video/mp4',
  '.webm': 'video/webm',
  '.ogv': 'video/ogg',
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
    const info = await stat(target);
    const type = MIME[extname(target).toLowerCase()] || 'application/octet-stream';

    /* ---- Range 支持 ----
       MP4 播放器（尤其 Safari）要求服务器支持分段请求，否则可能：
       不播、只能播一次、或拖动进度条就断。GitHub Pages 原生支持，
       但这个验收服务器原来只会整文件返回，导致本地测不出视频的真实表现。
       这里实现最小的单区间 206 响应。 */
    const range = req.headers.range;
    if (range) {
      const m = /^bytes=(\d*)-(\d*)$/.exec(range.trim());
      if (m) {
        const size = info.size;
        let start = m[1] === '' ? null : parseInt(m[1], 10);
        let end = m[2] === '' ? null : parseInt(m[2], 10);
        if (start === null && end !== null) {          /* bytes=-N 取末尾 N 字节 */
          start = Math.max(0, size - end); end = size - 1;
        } else {
          if (end === null || end >= size) end = size - 1;
        }
        if (start > end || start >= size) {
          res.writeHead(416, { 'content-range': `bytes */${size}`, ...NO_STORE }).end();
          return;
        }
        res.writeHead(206, {
          'content-type': type,
          'content-length': end - start + 1,
          'content-range': `bytes ${start}-${end}/${size}`,
          'accept-ranges': 'bytes',
          ...NO_STORE,
        });
        createReadStream(target, { start, end }).pipe(res);
        return;
      }
    }

    res.writeHead(200, {
      'content-type': type,
      'content-length': info.size,
      'accept-ranges': 'bytes',
      ...NO_STORE,
    });
    res.end(await readFile(target));
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('404 ' + rel);
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`preview  -> http://127.0.0.1:${PORT}/`);
  console.log(`reference-> http://127.0.0.1:${PORT}/__ref/`);
});
