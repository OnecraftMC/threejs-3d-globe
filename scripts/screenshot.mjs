#!/usr/bin/env node
/**
 * screenshot.mjs — validasi render headless.
 *
 * Mengunduh Chrome headless bila belum ada (sekali saja), menayangkan folder
 * dist/, lalu mengambil tangkapan layar pada empat tingkat zoom yang mewakili
 * seluruh perjalanan pengguna:
 *
 *   z = 0,0   globe Bumi close-up (detail tekstur, awan, atmosfer, lampu kota)
 *   z = 0,35  Bumi mengecil, Bulan dan orbitnya terlihat
 *   z = 0,65  planet dalam menampakkan diri
 *   z = 1,0   seluruh tata surya + cincin Saturnus + sabuk asteroid
 *
 * Skrip menuntut NOL galat konsol dan NOL permintaan berkas yang gagal selama
 * sesi berlangsung. Tangkapan disimpan di .tmp/shots/ untuk diperiksa manual.
 *
 *   node scripts/screenshot.mjs [--keep] [--port 8901]
 */
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SHOTS = join(ROOT, '.tmp', 'shots');
const argv = process.argv.slice(2);
const PORT = Number(argv.includes('--port') ? argv[argv.indexOf('--port') + 1] : 8901);
const KEEP = argv.includes('--keep');

const LEVELS = [
  { name: 'z0-earth', zoom: 0 },
  { name: 'z35-moon', zoom: 0.35 },
  { name: 'z65-inner', zoom: 0.65 },
  { name: 'z100-system', zoom: 1 },
];

async function ensurePuppeteer() {
  try {
    return (await import('puppeteer')).default;
  } catch {
    console.log('Memasang puppeteer (sekali saja, mengunduh Chrome)…');
    const npm = spawn('npm', ['install', '--no-save', 'puppeteer'], {
      cwd: ROOT,
      stdio: 'inherit',
      shell: process.platform === 'win32',
    });
    await new Promise((resolvePromise, reject) => {
      npm.on('close', (code) => (code === 0 ? resolvePromise() : reject(new Error(`npm exit ${code}`))));
    });
    return (await import('puppeteer')).default;
  }
}

function startServer() {
  return new Promise((resolvePromise, reject) => {
    const server = spawn('node', ['serve.mjs', '--port', String(PORT)], {
      cwd: ROOT,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let output = '';
    const onData = (data) => {
      output += String(data);
      if (output.includes(`:${PORT}/`)) {
        server.stdout.off('data', onData);
        resolvePromise(server);
      }
    };
    server.stdout.on('data', onData);
    server.stderr.on('data', onData);
    server.on('error', reject);
    setTimeout(() => reject(new Error(`server tidak merespons dalam 20 dtk:\n${output}`)), 20000);
  });
}

async function main() {
  const puppeteer = await ensurePuppeteer();
  const server = await startServer();
  await mkdir(SHOTS, { recursive: true });

  const consoleErrors = [];
  const failedRequests = [];

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--use-angle=swiftshader',
        '--enable-unsafe-swiftshader',
        '--disable-gpu-sandbox',
        '--window-size=1280,800',
      ],
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 1 });

    // Diagnostik: catat alur hidup halaman agar kegagalan bisa dilacak.
    const progressLog = [];
    const mark = (message) => {
      progressLog.push(message);
      console.log(`  … ${message}`);
    };
    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(message.text());
      else if (message.text().startsWith('[hermes]')) mark(`konsol: ${message.text()}`);
    });
    page.on('pageerror', (error) => consoleErrors.push(String(error?.message ?? error)));
    page.on('requestfailed', (request) => failedRequests.push(`${request.url()} :: ${request.failure()?.errorText}`));
    page.on('response', (response) => {
      if (response.status() >= 400) failedRequests.push(`${response.url()} :: HTTP ${response.status()}`);
    });

    mark('membuka halaman');
    await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    mark('DOM siap, menunggu modul & WebGL');

    // Tunggu pelan-pelan: modul -> WebGL -> tekstur -> globe. Batas total 3 menit.
    const deadline = Date.now() + 180000;
    let lastState = '';
    while (Date.now() < deadline) {
      const state = await page.evaluate(() => ({
        hasDebug: !!window.__hermesDebug,
        loaderGone: !document.querySelector('#loader') || !!document.querySelector('#loader.is-hidden'),
        errorText: document.querySelector('.loader__label')?.textContent ?? '',
        bodyCount: document.querySelectorAll('canvas').length,
      }));
      const signature = JSON.stringify(state);
      if (signature !== lastState) {
        lastState = signature;
        mark(`status: ${signature}`);
      }
      if (state.hasDebug && state.loaderGone) break;
      if (/gagal|gagal|error|tidak/i.test(state.errorText) && state.errorText.length > 10) break;
      await new Promise((resolvePromise) => setTimeout(resolvePromise, 2000));
    }
    mark('tahap pemuatan selesai, menunggu stabil 4 detik');
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 4000));

    for (const level of LEVELS) {
      await page.evaluate((zoom) => {
        window.__hermesDebug?.setZoom?.(zoom);
      }, level.zoom);
      // Beri waktu kamera tiba di tujuannya (peredaman ~1 dtk) + tekstur fase dua.
      await new Promise((resolvePromise) => setTimeout(resolvePromise, 6000));
      const path = join(SHOTS, `${level.name}.png`);
      await page.screenshot({ path });
      console.log(`  tersimpan ${level.name}.png`);
    }
  } finally {
    await browser?.close();
    server.kill();
  }

  console.log('\n--- Hasil validasi ---');
  const ok = consoleErrors.length === 0 && failedRequests.length === 0;
  if (consoleErrors.length > 0) {
    console.log(`GALAT KONSOL (${consoleErrors.length}):`);
    for (const error of consoleErrors.slice(0, 20)) console.log(`  - ${error}`);
  } else {
    console.log('Nol galat konsol.');
  }
  if (failedRequests.length > 0) {
    console.log(`PERMINTAAN GAGAL (${failedRequests.length}):`);
    for (const failure of failedRequests.slice(0, 20)) console.log(`  - ${failure}`);
  } else {
    console.log('Nol permintaan berkas yang gagal.');
  }
  console.log(ok ? 'LULUS' : 'GAGAL');
  process.exitCode = ok ? 0 : 1;
  void KEEP;
}

main().catch((error) => {
  console.error('screenshot gagal:', error?.message ?? error);
  process.exitCode = 2;
});
