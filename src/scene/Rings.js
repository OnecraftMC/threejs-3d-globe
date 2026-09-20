/**
 * Rings.js — sistem cincin planet.
 *
 * Saturnus memakai peta alpha sungguhan (2048x125) yang memuat celah Cassini
 * dan struktur halusnya. Jupiter, Uranus, dan Neptunus tidak punya citra
 * berlisensi bebas, jadi profil cincinnya dibangkitkan di atas canvas:
 *   'narrow' — beberapa cincin tipis dan tajam (Uranus)
 *   'faint'  — pita lebar dan samar (Jupiter, Neptunus)
 *
 * Semua cincin memakai pemetaan radial: koordinat U tekstur dihitung dari
 * radius titik, bukan dari UV bawaan RingGeometry yang berbentuk kotak.
 */
import {
  CanvasTexture,
  ClampToEdgeWrapping,
  LinearFilter,
  Mesh,
  RingGeometry,
  SRGBColorSpace,
} from 'three';
import { createRingMaterial } from '../shaders/ring.js';

/** RNG deterministik agar profil cincin selalu sama. */
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const PROCEDURAL_WIDTH = 1024;
const PROCEDURAL_HEIGHT = 4;

/**
 * Bangun tekstur pita alpha secara prosedural.
 * @param {'narrow'|'faint'} kind
 * @param {number} seed
 */
function createProceduralRingTexture(kind, seed = 4242) {
  const canvas = document.createElement('canvas');
  canvas.width = PROCEDURAL_WIDTH;
  canvas.height = PROCEDURAL_HEIGHT;
  const ctx = canvas.getContext('2d');

  // Latar gelap: alpha 0 berarti tidak ada partikel.
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, PROCEDURAL_WIDTH, PROCEDURAL_HEIGHT);

  const random = mulberry32(seed);
  const gradient = ctx.createLinearGradient(0, 0, PROCEDURAL_WIDTH, 0);

  if (kind === 'narrow') {
    // Cincin Uranus sangat sempit dan gelap; beberapa di antaranya menonjol.
    const stops = [
      [0.0, 0.0],
      [0.16, 0.0],
      [0.18, 0.55],
      [0.2, 0.08],
      [0.34, 0.06],
      [0.36, 0.72],
      [0.38, 0.1],
      [0.55, 0.05],
      [0.57, 0.9], // cincin epsilon, yang paling terang
      [0.63, 0.35],
      [0.65, 0.07],
      [0.78, 0.06],
      [0.8, 0.3],
      [0.83, 0.05],
      [1.0, 0.0],
    ];
    for (const [offset, alpha] of stops) gradient.addColorStop(offset, `rgba(255,255,255,${alpha})`);
  } else {
    // Cincin tipis dan berdebu: pita lebar dengan variasi acak halus.
    for (let i = 0; i <= 64; i++) {
      const t = i / 64;
      const envelope = Math.sin(Math.min(t, 0.92) * Math.PI * 0.85);
      const noise = 0.55 + 0.45 * random();
      const alpha = Math.max(0, envelope * noise * (1 - Math.pow(t, 3.2)));
      gradient.addColorStop(t, `rgba(255,255,255,${alpha.toFixed(3)})`);
    }
  }

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, PROCEDURAL_WIDTH, PROCEDURAL_HEIGHT);

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.wrapS = ClampToEdgeWrapping;
  texture.wrapT = ClampToEdgeWrapping;
  texture.minFilter = LinearFilter;
  texture.magFilter = LinearFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
}

/**
 * Buat mesh cincin untuk sebuah planet.
 * @param {object} body definisi planet (harus punya `rings`)
 * @param {Map<string, import('three').Texture>} textures tekstur yang sudah dimuat
 * @param {{ segments?: number }} [options]
 * @returns {Mesh|null}
 */
export function createRingSystem(body, textures, options = {}) {
  const config = body.rings;
  if (!config) return null;

  const inner = body.displayRadius * config.inner;
  const outer = body.displayRadius * config.outer;

  const alphaMap = config.texture
    ? textures.get(config.texture)
    : createProceduralRingTexture(config.procedural ?? 'faint', body.id.length * 7919);

  if (!alphaMap) return null;

  // RingGeometry dibuat di bidang XY lalu direbahkan ke bidang ekuator (XZ),
  // sehingga cincin berbagi kerangka dengan bola planet dan sumbu putarnya.
  const geometry = new RingGeometry(inner, outer, options.segments ?? 256, 1);
  geometry.rotateX(-Math.PI / 2);

  const material = createRingMaterial(config, alphaMap);
  material.uniforms.uInner.value = inner;
  material.uniforms.uOuter.value = outer;

  const mesh = new Mesh(geometry, material);
  mesh.name = `rings:${body.id}`;
  // Digambar sebelum atmosfer dan awan: cincin secara fisik berada di sekitar
  // planet, bukan di atas permukaannya.
  mesh.renderOrder = 2;
  mesh.userData.body = body;
  return mesh;
}

export { createProceduralRingTexture };
