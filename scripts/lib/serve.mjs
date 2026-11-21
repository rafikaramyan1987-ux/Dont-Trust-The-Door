// A static server like a portal's file host: the build's files under /game/, and at / a host page that shows the game
// in an iframe (?w=&h= iframe size, ?q= query string for the game).
import { readFileSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.woff': 'font/woff', '.mp3': 'audio/mpeg' };

export async function serve(dir) {
  const server = createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    if (u.pathname === '/') {
      const w = +u.searchParams.get('w') || 960, h = +u.searchParams.get('h') || 540;
      res.writeHead(200, { 'content-type': 'text/html' });
      return res.end(`<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;background:#333}iframe{display:block;border:0;margin:20px}</style></head>
<body><iframe id="f" width="${w}" height="${h}" src="/game/index.html${u.searchParams.get('q') ?? ''}" allow="fullscreen; autoplay; gamepad" allowfullscreen></iframe></body></html>`);
    }
    const p = normalize(decodeURIComponent(u.pathname.replace(/^\/game\//, '')));
    if (!u.pathname.startsWith('/game/') || p.startsWith('..')) return res.writeHead(404).end();
    try {
      let f = join(dir, p);
      if (statSync(f).isDirectory()) f = join(f, 'index.html');
      const body = readFileSync(f);
      res.writeHead(200, { 'content-type': TYPES[extname(f).toLowerCase()] ?? 'application/octet-stream' });
      res.end(body);
    } catch {
      res.writeHead(404).end();
    }
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  server.origin = `http://127.0.0.1:${server.address().port}`;
  return server;
}
