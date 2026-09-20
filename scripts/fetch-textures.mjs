#!/usr/bin/env node
/**
 * fetch-textures.mjs — mengunduh tekstur planet dari Solar System Scope
 * (lisensi CC BY 4.0) ke public/textures/.
 *
 * Idempoten: berkas yang sudah ada akan dilewati, jadi aman dijalankan ulang.
 *
 *   node scripts/fetch-textures.mjs             # unduh yang belum ada
 *   node scripts/fetch-textures.mjs --force     # paksa unduh ulang
 *   node scripts/fetch-textures.mjs --only 8k   # hanya berkas yang cocok "8k"
 *
 * Strategi resolusi (sesuai kesepakatan): 2K untuk semua, 8K khusus
 * Bumi / Bulan / Matahari sebagai objek "hero" saat close-up.
 */
import { createWriteStream } from 'node:fs';
import { mkdir, rename, rm, stat } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const TEXTURES = join(ROOT, 'public', 'textures');
const BASE = 'https://www.solarsystemscope.com/textures/download';

const argv = process.argv.slice(2);
const FORCE = argv.includes('--force');
const ONLY = argv.includes('--only') ? argv[argv.indexOf('--only') + 1] : null;

export const MANIFEST = [
  // Matahari
  { src: '2k_sun.jpg', dest: 'planets/sun_2k.jpg' },
  { src: '8k_sun.jpg', dest: 'sun/sun_8k.jpg', hero: true },
  // Merkurius
  { src: '2k_mercury.jpg', dest: 'planets/mercury.jpg' },
  // Venus
  { src: '2k_venus_surface.jpg', dest: 'planets/venus_surface.jpg' },
  { src: '2k_venus_atmosphere.jpg', dest: 'planets/venus_atmosphere.jpg' },
  // Bumi
  { src: '2k_earth_daymap.jpg', dest: 'planets/earth_day_2k.jpg' },
  { src: '2k_earth_nightmap.jpg', dest: 'planets/earth_night_2k.jpg' },
  { src: '2k_earth_clouds.jpg', dest: 'planets/earth_clouds_2k.jpg' },
  { src: '8k_earth_daymap.jpg', dest: 'earth/earth_day_8k.jpg', hero: true },
  { src: '8k_earth_nightmap.jpg', dest: 'earth/earth_night_8k.jpg', hero: true },
  { src: '8k_earth_clouds.jpg', dest: 'earth/earth_clouds_8k.jpg', hero: true },
  { src: '8k_earth_normal_map.tif', dest: 'earth/earth_normal.tif', convert: true, hero: true },
  { src: '8k_earth_specular_map.tif', dest: 'earth/earth_specular.tif', convert: true, hero: true },
  // Mars
  { src: '2k_mars.jpg', dest: 'planets/mars.jpg' },
  // Jupiter
  { src: '2k_jupiter.jpg', dest: 'planets/jupiter.jpg' },
  // Saturnus
  { src: '2k_saturn.jpg', dest: 'planets/saturn.jpg' },
  { src: '2k_saturn_ring_alpha.png', dest: 'rings/saturn_ring_alpha.png' },
  // Uranus & Neptunus
  { src: '2k_uranus.jpg', dest: 'planets/uranus.jpg' },
  { src: '2k_neptune.jpg', dest: 'planets/neptune.jpg' },
  // Bulan
  { src: '2k_moon.jpg', dest: 'planets/moon_2k.jpg' },
  { src: '8k_moon.jpg', dest: 'moon/moon_8k.jpg', hero: true },
  // Latar langit
  { src: '2k_stars_milky_way.jpg', dest: 'sky/milkyway_2k.jpg' },
];

const C = {
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  ok: (s) => `\x1b[32m${s}\x1b[0m`,
  err: (s) => `\x1b[31m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
};

const human = (b) => (b > 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.round(b / 1024)} KB`);

/** Ukuran berkas bila ada & tidak kosong, selain itu 0. */
async function exists(p) {
  try {
    const s = await stat(p);
    return s.isFile() && s.size > 0 ? s.size : 0;
  } catch {
    return 0;
  }
}

/** Unduh satu berkas; tolak respons HTML (halaman galat) dan berkas terlalu kecil. */
async function download(src, destPath, retries = 3) {
  const url = `${BASE}/${src}`;
  let lastErr;
  for (let attempt = 1; attempt <= retries; attempt++) {
    const tmp = `${destPath}.part`;
    try {
      const res = await fetch(url, { redirect: 'follow' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const type = res.headers.get('content-type') || '';
      if (type.includes('text/html')) throw new Error(`konten HTML, bukan gambar`);

      await mkdir(dirname(destPath), { recursive: true });
      await pipeline(Readable.fromWeb(res.body), createWriteStream(tmp));

      const size = await exists(tmp);
      if (size < 1024) throw new Error(`berkas terlalu kecil (${size} B)`);
      await rename(tmp, destPath);
      return size;
    } catch (e) {
      lastErr = e;
      await rm(tmp, { force: true });
      if (attempt < retries) await new Promise((r) => setTimeout(r, 700 * attempt));
    }
  }
  throw new Error(`${src}: ${lastErr?.message ?? 'gagal'}`);
}

async function main() {
  const jobs = MANIFEST.filter((m) => !ONLY || m.src.includes(ONLY));
  console.log(C.bold(`\nMengunduh ${jobs.length} tekstur dari Solar System Scope (CC BY 4.0)\n`));

  let total = 0;
  let skipped = 0;
  const failures = [];

  for (const [i, job] of jobs.entries()) {
    const destPath = join(TEXTURES, job.dest);
    const label = `[${String(i + 1).padStart(2)}/${jobs.length}] ${job.src.padEnd(28)}`;
    const already = await exists(destPath);

    if (already && !FORCE) {
      skipped++;
      total += already;
      console.log(`${label} ${C.dim(`sudah ada (${human(already)})`)}`);
      continue;
    }

    process.stdout.write(`${label} mengunduh... `);
    try {
      const size = await download(job.src, destPath);
      total += size;
      console.log(C.ok(human(size)));
    } catch (e) {
      console.log(C.err('GAGAL'));
      failures.push(e.message);
    }
  }

  console.log(
    `\n${C.bold('Ringkasan')}: ${jobs.length - skipped - failures.length} baru, ${skipped} dilewati, ` +
      `${failures.length} gagal — ${human(total)} di disk.`,
  );
  if (failures.length) {
    for (const f of failures) console.log(C.err(`  - ${f}`));
    process.exitCode = 1;
  } else {
    console.log(C.ok('Semua berkas .jpg/.png siap.\n'));
  }
}

main();

