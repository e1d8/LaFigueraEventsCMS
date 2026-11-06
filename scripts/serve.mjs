import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, sep, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const publicRoot = resolve(root, '../LAFIGUERAEVENTS');
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
const port = Number(process.env.PORT || 4174);
createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    const isPublic = pathname === '/LAFIGUERAEVENTS' || pathname.startsWith('/LAFIGUERAEVENTS/');
    const directory = isPublic ? publicRoot : root;
    const relative = isPublic ? pathname.slice('/LAFIGUERAEVENTS'.length) : pathname;
    const file = resolve(directory, `.${relative || '/'}`);
    if (file !== resolve(directory) && !file.startsWith(resolve(directory) + sep) || relative.split('/').some(part => part.startsWith('.') && part !== '.')) { response.writeHead(403).end(); return; }
    const directoryEntry = (await stat(file)).isDirectory();
    // Match GitHub Pages: resolve directory entry resources after a trailing-slash redirect.
    if (directoryEntry && !pathname.endsWith('/')) {
      response.writeHead(301, { Location: `${pathname}/${new URL(request.url, 'http://localhost').search}` }).end(); return;
    }
    const target = directoryEntry ? resolve(file, 'index.html') : file;
    const body = await readFile(target);
    response.writeHead(200, { 'Content-Type': types[extname(target)] || 'application/octet-stream', 'Cache-Control': 'no-store' }); response.end(body);
  } catch { response.writeHead(404).end('No trobat'); }
}).listen(port, '127.0.0.1', () => console.log(`CMS: http://127.0.0.1:${port}\nWeb: http://127.0.0.1:${port}/LAFIGUERAEVENTS/`));
