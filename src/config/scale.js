/**
 * scale.js — kurva pemetaan dari angka nyata ke angka tampilan.
 *
 * Masalah: tata surya tidak bisa ditampilkan dalam satu skala tunggal.
 * Neptunus berada di 30 AU = sekitar 4.500 kali jari-jari Bumi, sedangkan
 * Jupiter sendiri 11 kali jari-jari Bumi. Bila dipaksa satu skala, planet
 * pasti bertumpang-tindih dan tidak ada yang terlihat.
 *
 * Solusi (praktik standar visualisasi edukasi): dua kurva kompresi terpisah.
 *   - Ukuran  dikompresi dengan pangkat 0.42
 *   - Jarak   dikompresi dengan pangkat 0.62
 *
 * Kedua kurva ini diuji di test/scale.test.mjs: urutan kedudukan planet tetap
 * benar, planet tidak bertumpang-tindih dengan benda lain, dan tidak ada
 * planet yang berada di dalam Matahari.
 */

/** Jari-jari Bumi (km) — acuan normalisasi. */
export const EARTH_RADIUS_KM = 6371;

/** Skala dasar: Bumi digambar dengan radius 1,35 satuan scene. */
const SIZE_K = 1.35;
const SIZE_POW = 0.42;

/** Skala dasar jarak: orbit Bumi (1 AU) digambar 30 satuan scene. */
const DIST_K = 30;
const DIST_POW = 0.62;

/** Jari-jari tampilan sebuah benda langit dari jari-jari nyatanya (km). */
export function displayRadius(radiusKm, { pow = SIZE_POW, k = SIZE_K } = {}) {
  return k * Math.pow(radiusKm / EARTH_RADIUS_KM, pow);
}

/** Jarak orbit tampilan sebuah benda langit dari sumbu semi-mayor (AU). */
export function displayDistance(semiMajorAu, { pow = DIST_POW, k = DIST_K } = {}) {
  return k * Math.pow(semiMajorAu, pow);
}

/**
 * Batas pandang kamera untuk satu parameter zoom z.
 *
 * z = 0  -> kamera berada tepat di luar permukaan benda yang difokuskan
 * z = 1  -> seluruh tata surya masuk bidang pandang
 *
 * Radius diinterpolasi secara logaritmik (bukan linear), karena rentangnya
 * sangat lebar: dari 2,4 satuan ketika menempel di Bumi sampai 520 satuan
 * ketika melihat seluruh sistem. Interpolasi linear akan membuat hampir
 * seluruh perjalanan zoom terasa "mandek" di ujung jauh.
 */
export const ZOOM = {
  /** Radius minimum = radius benda fokus dikali faktor ini. */
  nearFactor: 1.75,
  /** Radius maksimum (satuan scene) — menyisakan ruang di luar Neptunus. */
  farRadius: 520,
  /** Titik awal kamera saat halaman dibuka (bukan 0, supaya globe utuh terlihat). */
  start: 0.085,
};

/** Radius kamera untuk nilai z tertentu, sebagai kelipatan radius fokus. */
export function zoomRadius(z, focusRadius) {
  const t = clamp01(z);
  const near = focusRadius * ZOOM.nearFactor;
  const far = ZOOM.farRadius;
  // easeInOutCubic: perjalanan terasa halus di awal & akhir
  const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  return Math.exp(Math.log(near) * (1 - e) + Math.log(far) * e);
}

/** Sebagian perjalanan zoom, 0 = dekat permukaan, 1 = seluruh sistem. */
export function clamp01(x) {
  return x < 0 ? 0 : x > 1 ? 1 : x;
}

/** Interpolasi halus antara dua nilai, 0..1 terhadap tepi a..b. */
export function smoothstep(a, b, x) {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

/**
 * Seberapa jauh kamera sudah "lepas" dari benda fokus menuju pusat tata surya.
 * Nilainya 0 selama pemandangan masih dekat planet, lalu naik ke 1 ketika
 * seluruh sistem mulai terlihat — inilah yang membuat zoom terasa seperti
 * menarik kamera mundur, bukan berpindah target secara mendadak.
 */
export function anchorBlend(z) {
  return smoothstep(0.30, 0.86, z);
}
