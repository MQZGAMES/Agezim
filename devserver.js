// Servidor estático de desenvolvimento (porta 8123).
// Também aceita POST /save?name=arquivo.png para gravar capturas do canvas (usado só em testes).
const http = require('http');
const fs = require('fs');
const path = require('path');

const root = __dirname;
const outDir = process.argv[2] || process.env.AGEZIM_SNAP_DIR || path.join(root, '.snaps');
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.json': 'application/json', '.md': 'text/plain; charset=utf-8' };

http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (req.method === 'POST' && url.pathname === '/save') {
    const name = path.basename(url.searchParams.get('name') || 'snap.png');
    fs.mkdirSync(outDir, { recursive: true });
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => { fs.writeFileSync(path.join(outDir, name), Buffer.concat(chunks)); res.writeHead(200); res.end('ok'); });
    return;
  }
  let p = decodeURIComponent(url.pathname);
  if (p === '/') p = '/index.html';
  const file = path.join(root, p);
  if (!file.startsWith(root)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(data);
  });
}).listen(8123, '127.0.0.1', () => console.log('Agezim em http://127.0.0.1:8123'));
