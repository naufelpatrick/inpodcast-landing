import { createServer } from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { createServer as createViteServer, loadEnv } from 'vite';
import type { ViteDevServer } from 'vite';
import { documentHtml, pageData } from '../server/seo.js';
import type { Catalog, PageData } from '../src/episodes.js';
import spotify from '../api/spotify.js';
import contact from '../api/contact.js';
const dev = process.argv.includes('--dev');
const portFlag = process.argv.indexOf('--port');
const port = Number(portFlag >= 0 ? process.argv[portFlag + 1] : process.env.PORT || (dev ? 5173 : 4173));
const root = resolve(dev ? 'public' : 'dist');
const env = loadEnv(dev ? 'development' : 'production', process.cwd(), '');
for (const key of ['SPOTIFY_CLIENT_ID', 'SPOTIFY_CLIENT_SECRET', 'RESEND_API_KEY', 'CONTACT_FROM_EMAIL']) {
  if (process.env[key] === undefined && env[key]) process.env[key] = env[key];
}
const vite: ViteDevServer | undefined = dev ? await createViteServer({ server: { middlewareMode: true }, appType: 'custom' }) : undefined;
const mime: Record<string, string> = { '.html': 'text/html; charset=utf-8', '.json': 'application/json; charset=utf-8', '.xml': 'application/xml; charset=utf-8', '.txt': 'text/plain; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg' };
async function api(req: IncomingMessage, res: ServerResponse, pathname: string) {
  let size = 0, body = '';
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 16_384) { res.writeHead(413).end(); return; }
    body += chunk;
  }
  let parsed: Record<string, unknown> = {};
  try { if (body) parsed = JSON.parse(body); }
  catch { res.writeHead(400).end('JSON inválido'); return; }
  const adapter = {
    setHeader(name: string, value: string) { res.setHeader(name, value); },
    status(code: number) { res.statusCode = code; return adapter; },
    json(value: unknown) { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(value)); },
  };
  if (pathname === '/api/spotify') await spotify({ method: req.method }, adapter);
  else await contact({ method: req.method, body: parsed }, adapter);
}
async function handle(req: IncomingMessage, res: ServerResponse) {
  const url = new URL(req.url || '/', 'http://localhost');
  let pathname: string;
  try { pathname = decodeURIComponent(url.pathname); } catch { res.writeHead(400).end(); return; }
  if (pathname === '/api/spotify' || pathname === '/api/contact') { await api(req, res, pathname); return; }
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405, { Allow: 'GET, HEAD' }).end(); return; }
  if (pathname.length > 1 && pathname.endsWith('/')) { res.writeHead(308, { Location: pathname.slice(0, -1) + url.search }).end(); return; }
  if (pathname.endsWith('.html') && pathname !== '/404.html') {
    res.writeHead(308, { Location: pathname === '/index.html' ? '/' : pathname.slice(0, -5) }).end(); return;
  }
  if (vite) {
    await new Promise<void>((done, reject) => {
      res.once('finish', done);
      vite.middlewares(req, res, (error: unknown) => error ? reject(error) : done());
    });
    if (res.writableEnded) return;
    const catalog: Catalog = JSON.parse(await readFile('data/catalog.json', 'utf8'));
    const data = pageData(pathname, catalog.episodes);
    const found = pathname === '/' || pathname === '/episodios' || data.episodes.length > 0;
    const template = await vite.transformIndexHtml(pathname, await readFile('index.html', 'utf8'));
    const { render } = await vite.ssrLoadModule('/src/entry-server.tsx') as { render: (data: PageData) => string };
    res.writeHead(found ? 200 : 404, { 'Content-Type': mime['.html'] }).end(documentHtml(template, data, render(data)));
    return;
  }
  const relative = pathname === '/' ? 'index.html' : pathname.slice(1);
  const candidates = extname(relative) ? [relative] : [`${relative}.html`, relative];
  for (const candidate of candidates) {
    const path = resolve(root, candidate);
    if (!path.startsWith(root + sep)) continue;
    try {
      if (!(await stat(path)).isFile()) continue;
      const data = await readFile(path);
      res.writeHead(200, { 'Content-Type': mime[extname(path)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
      res.end(req.method === 'HEAD' ? undefined : data); return;
    } catch { /* Try the next concrete file, never fall back to the homepage. */ }
  }
  res.writeHead(404, { 'Content-Type': mime['.html'] }).end(await readFile(resolve(root, '404.html')));
}
const server = createServer((req, res) => { void handle(req, res).catch(error => {
  console.error(error instanceof Error ? error.message : 'Falha no servidor local');
  if (!res.headersSent) res.writeHead(500); res.end('Erro interno');
}); });
server.listen(port, '127.0.0.1', () => console.log(`InPodcast ${dev ? 'dev' : 'preview'}: http://127.0.0.1:${port}`));
