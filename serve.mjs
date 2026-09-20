#!/usr/bin/env node
/**
 * serve.mjs — server statis tanpa dependensi untuk pratinjau lokal.
 *
 * Menayangkan folder `dist/` (hasil `npm run build`) atau folder proyek bila
 * `dist` belum ada. Modul ES dan WebGL butuh skema http(s), jadi file HTML
 * tidak bisa dibuka langsung lewat file:// — karena itu skrip ini ada.
 *
 *   node serve.mjs [--port 8080]
 */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname, normalize, resolve } from 'node:path';

const args = process.argv.slice(2);
const portIndex = args.indexOf('--port');
const PORT = Number(portIndex >= 0 ? args[portIndex + 1] : process.env.PORT) || 8080;

const HERE = resolve(new URL('.', import.meta.url).pathname);
const CANDIDATES = ['dist', '.'];

// Pilih dist bila ada index.html-nya, kalau tidak pakai folder proyek.
const existing = await (async () => {
  for (const dir of CANDIDATES) {
    const full = join(HERE, dir, 'index.html');
    try {
      const s = await stat(full);
      if (s.isFile()) return { dir, full };
    } catch {
      /* coba berikutnya */
    }
  }
  return null;
})();

if (!existing) {
  console.error('index.html tidak ditemukan di dist/ maupun di folder proyek.');
  process.exit(1);
}

const ROOT = join(HERE, existing.dir);

const MIME = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.mjs', 'text/javascript; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.svg', 'image/svg+xml'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.webp', 'image/webp'],
  ['.ico', 'image/x-icon'],
  ['.wasm', 'application/wasm'],
  ['.txt', 'text/plain; charset=utf-8'],
  ['.map', 'application/json; charset=utf-8'],
]);

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    let path = decodeURIComponent(url.pathname);
    if (path.endsWith('/')) path += 'index.html';

    const full = normalize(join(ROOT, path));
    if (!full.startsWith(ROOT)) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }

    let file = full;
    try {
      const s = await stat(file);
      if (s.isDirectory()) file = join(file, 'index.html');
    } catch {
      // Single-page fallback: biarkan index.html yang menanganinya.
      file = join(ROOT, 'index.html');
    }

    const body = await readFile(file);
    res.writeHead(200, {
      'Content-Type': MIME.get(extname(file).toLowerCase()) ?? 'application/octet-stream',
      'Content-Length': body.length,
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cache-Control': 'no-cache',
    });
    res.end(body);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found');
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Menayangkan ${existing.dir === 'dist' ? 'hasil build' : 'folder proyek'}: http://localhost:${PORT}/`);
  console.log('Tekan Ctrl+C untuk berhenti.');
});
