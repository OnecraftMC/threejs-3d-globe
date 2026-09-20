/**
 * noise.glsl.js — potongan GLSL yang dipakai bersama oleh beberapa shader.
 *
 * Semua fungsi di sini sengaja bebas dari dependensi three.js: shader planet,
 * atmosfer, Matahari, cincin, dan awan semuanya menyusun programnya sendiri
 * dari potongan-potongan string ini.
 */

/** Hash & value noise 3D. Dipakai untuk korona Matahari dan detail awan. */
export const NOISE = /* glsl */ `
float hash13(vec3 p) {
  p = fract(p * 0.3183099 + vec3(0.1, 0.2, 0.3));
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}

float valueNoise(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(hash13(i + vec3(0, 0, 0)), hash13(i + vec3(1, 0, 0)), f.x),
        mix(hash13(i + vec3(0, 1, 0)), hash13(i + vec3(1, 1, 0)), f.x), f.y),
    mix(mix(hash13(i + vec3(0, 0, 1)), hash13(i + vec3(1, 0, 1)), f.x),
        mix(hash13(i + vec3(0, 1, 1)), hash13(i + vec3(1, 1, 1)), f.x), f.y),
    f.z);
}

float fbm(vec3 p, int octaves) {
  float sum = 0.0;
  float amp = 0.5;
  float norm = 0.0;
  for (int i = 0; i < 8; i++) {
    if (i >= octaves) break;
    sum += valueNoise(p) * amp;
    norm += amp;
    p *= 2.03;
    amp *= 0.5;
  }
  return sum / max(norm, 0.0001);
}
`;

/**
 * Pencahayaan Matahari untuk semua benda langit.
 *
 * Scene ini tidak memakai THREE.Light untuk permukaan planet. Semua benda
 * diberi uniform arah Matahari, sehingga:
 *   - terminator dan fase planet otomatis benar (Merkurius dan Neptunus pun
 *     punya fase yang tepat, sesuai posisinya yang sesungguhnya);
 *   - kecerahan tidak menyusut karena jarak, jadi Neptunus tidak menjadi hitam.
 */
export const SUN_LIGHTING = /* glsl */ `
uniform vec3 uSunDirection;   // arah ternormalisasi dari permukaan menuju Matahari
uniform vec3 uSunColor;
uniform float uTerminator;    // 0 = batas tajam (tanpa atmosfer), 1 = sangat lembut
uniform float uAmbient;       // cahaya isian agar sisi malam masih terbaca

/** Difusi dengan tepi terminator yang bisa dilembutkan. */
float sunDiffuse(vec3 normal, out float shadowFactor) {
  float ndl = dot(normal, uSunDirection);
  float soft = mix(0.008, 0.34, uTerminator);
  float lit = smoothstep(-soft, soft, ndl);
  shadowFactor = lit;
  return lit * max(ndl, 0.0);
}

/** Cahaya isian (hemisphere sederhana) supaya sisi gelap tidak hitam total. */
vec3 fillLight(vec3 normal) {
  float up = normal.y * 0.5 + 0.5;
  return mix(vec3(0.045, 0.052, 0.075), vec3(0.075, 0.085, 0.115), up) * uAmbient;
}
`;

/**
 * Pemetaan ulang UV untuk bola.
 *
 * three.js SphereGeometry menempatkan jahitan tekstur (seam) menghadap sumbu
 * -Z, sedangkan model planet standar (dan peta Bulan/Bumi) menganggap bujur 0°
 * berada di sumbu +Z. Fungsi ini juga menerima pergeseran bujur untuk rotasi.
 */
export const SPHERE_UV = /* glsl */ `
vec2 sphereUv(vec3 p, float lonShift) {
  float lon = atan(p.x, p.z) + lonShift;
  float v = 1.0 - (p.y * 0.5 + 0.5);
  return vec2(lon * 0.15915494309 + 0.5, v);
}
`;
