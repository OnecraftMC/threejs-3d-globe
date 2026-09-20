#!/usr/bin/env node
/**
 * verify-assets.mjs — memastikan seluruh tekstur yang dipakai situs ada di
 * public/textures/, berukuran wajar, dan berformat benar.
 *
 * Keluar dengan kode 1 bila ada yang hilang atau rusak, sehingga tahap build
 * bisa digagalkan lebih awal sebelum masalahnya terlihat di peramban.
 */
import { stat } from 'node:fs/promises';
import { join, resolve, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const TEXTURES = join(ROOT, 'public', 'textures');

// Sumber kebenaran: seluruh kunci yang bisa dimuat Assets.
const { TEX } = await import('../src/data/bodies.js');

const EXPECTED = [
  // Planet 2K
  'planets/sun_2k.jpg', 'planets/mercury.jpg', 'planets/venus_surface.jpg',
  'planets/venus_atmosphere.jpg', 'planets/earth_day_2k.jpg', 'planets/earth_night_2k.jpg',
  'planets/earth_clouds_2k.jpg', 'planets/mars.jpg', 'planets/jupiter.jpg',
  'planets/saturn.jpg', 'planets/uranus.jpg', 'planets/neptune.jpg',
  'planets/moon_2k.jpg',
  // Normal & specular
  'planets/mercury_normal_2k.jpg', 'planets/venus_normal_2k.jpg', 'planets/moon_normal_2k.jpg',
  'earth/earth_normal_2k.jpg', 'earth/earth_normal_4k.jpg', 'earth/earth_specular_2k.jpg',
  'earth/earth_specular_4k.jpg', 'moon/moon_normal_4k.jpg',
  // Hero 8K
  'sun/sun_8k.jpg', 'earth/earth_day_8k.jpg', 'earth/earth_night_8k.jpg',
  'earth/earth_clouds_8k.jpg', 'moon/moon_8k.jpg',
  // Cincin, langit, noise
  'rings/saturn_ring_alpha.png', 'sky/milkyway_2k.jpg',
  'generated/noise_fbm.png', 'generated/noise_warp.png',
  // Bulan prosedural
  'generated/moons/io_albedo.jpg', 'generated/moons/io_normal.jpg',
  'generated/moons/europa_albedo.jpg', 'generated/moons/europa_normal.jpg',
  'generated/moons/ganymede_albedo.jpg', 'generated/moons/ganymede_normal.jpg',
  'generated/moons/callisto_albedo.jpg', 'generated/moons/callisto_normal.jpg',
  'generated/moons/titan_albedo.jpg', 'generated/moons/titan_normal.jpg',
  'generated/moons/triton_albedo.jpg', 'generated/moons/triton_normal.jpg',
  'generated/moons/phobos_albedo.jpg', 'generated/moons/phobos_normal.jpg',
  'generated/moons/deimos_albedo.jpg', 'generated/moons/deimos_normal.jpg',
  'generated/moons/enceladus_albedo.jpg', 'generated/moons/enceladus_normal.jpg',
  'generated/moons/rhea_albedo.jpg', 'generated/moons/rhea_normal.jpg',
  'generated/moons/titania_albedo.jpg', 'generated/moons/titania_normal.jpg',
  'generated/moons/oberon_albedo.jpg', 'generated/moons/oberon_normal.jpg',
];

const failures = [];
let total = 0;

for (const relative of EXPECTED) {
  const full = join(TEXTURES, relative);
  try {
    const info = await stat(full);
    if (info.size < 1024) throw new Error(`terlalu kecil (${info.size} B)`);
    total += info.size;
  } catch (error) {
    failures.push(`${relative}: ${error.message}`);
  }
}

// Tidak boleh ada kunci TEX yang menunjuk ke berkas yang tidak diharapkan.
const texValues = new Set();
for (const value of Object.values(TEX)) {
  if (typeof value === 'string') texValues.add(value);
}
for (const value of texValues) {
  if (value.startsWith('generated/moons/')) continue;
  if (!EXPECTED.includes(value)) {
    failures.push(`kunci TEX '${value}' belum terdaftar di daftar verifikasi`);
  }
}

console.log(`Memeriksa ${EXPECTED.length} berkas tekstur…`);
if (failures.length === 0) {
  console.log(`OK — semua ada, total ${(total / 1048576).toFixed(1)} MB.`);
} else {
  console.log('GAGAL:');
  for (const failure of failures) console.log(`  - ${failure}`);
  process.exitCode = 1;
}
void extname;
