/**
 * quality.js — tingkat kualitas grafis dan deteksi otomatisnya.
 *
 * Karena halaman ini bisa dibuka di perangkat mana pun (dari laptop kantor
 * sampai PC ber-GPU), pengaturan berat diletakkan di satu tempat. Tingkat
 * `auto` memilih preset berdasarkan petunjuk perangkat, lalu menurunkannya
 * bila laju gambar terukur terlalu rendah.
 */

/** Resolusi tekstur hero (Bumi, Bulan, Matahari) membutuhkan VRAM besar. */
export const QUALITY_PRESETS = {
  low: {
    label: 'Rendah',
    pixelRatio: 1,
    sphereSegments: { planet: 64, moon: 32, sun: 64 },
    anisotropy: 2,
    starCount: 1800,
    asteroids: 700,
    kuiper: 400,
    bloom: false,
    heroTextures: false,
    atmosphereLayers: 1,
    shadows: false,
  },
  medium: {
    label: 'Sedang',
    pixelRatio: 1.35,
    sphereSegments: { planet: 96, moon: 40, sun: 96 },
    anisotropy: 4,
    starCount: 3200,
    asteroids: 1800,
    kuiper: 900,
    bloom: true,
    heroTextures: false,
    atmosphereLayers: 2,
    shadows: true,
  },
  high: {
    label: 'Tinggi',
    pixelRatio: 1.75,
    sphereSegments: { planet: 160, moon: 56, sun: 128 },
    anisotropy: 8,
    starCount: 4500,
    asteroids: 3600,
    kuiper: 2200,
    bloom: true,
    // Tekstur 8K hanya pada perangkat yang sanggup menanganinya.
    heroTextures: true,
    atmosphereLayers: 2,
    shadows: true,
  },
};

/**
 * Tebak tingkat awal yang aman.
 * @param {import('three').WebGLRenderer} renderer
 * @returns {'low'|'medium'|'high'}
 */
export function detectQuality(renderer) {
  if (typeof navigator === 'undefined') return 'medium';

  const mobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
  const cores = navigator.hardwareConcurrency ?? 4;
  const memory = navigator.deviceMemory ?? 4;
  const maxTexture = renderer?.capabilities?.maxTextureSize ?? 4096;

  if (mobile || cores <= 2 || memory <= 2) return 'low';
  if (cores <= 4 || maxTexture < 8192) return 'medium';
  return 'high';
}

/**
 * Tingkat kualitas efektif: pakai preset rendah begitu laju gambar turun
 * di bawah ambang. Hanya boleh melangkah satu tingkat ke bawah sekali agar
 * tidak terjadi osilasi saat adegan sesekali berat.
 *
 * @param {'low'|'medium'|'high'} current
 * @param {number} fps laju gambar terukur
 */
export function degradeQuality(current, fps) {
  const order = ['low', 'medium', 'high'];
  const index = order.indexOf(current);
  if (fps < 26 && index > 0) return order[index - 1];
  return current;
}

/** Apakah perangkat boleh memakai tekstur 8K? Butuh maxTextureSize >= 8192. */
export function canUseHeroTextures(renderer, preset) {
  if (!preset.heroTextures) return false;
  return (renderer?.capabilities?.maxTextureSize ?? 0) >= 8192;
}
