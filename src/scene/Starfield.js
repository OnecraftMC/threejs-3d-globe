/**
 * Starfield.js — latar langit: sabuk Bima Sakti + bintang-bintang terang.
 *
 * Dua lapis, keduanya mengelilingi scene:
 *   1. Kubah Bima Sakti — bola besar bertekstur, dirender dari sisi dalam
 *      dengan depthTest dimatikan dan renderOrder negatif, sehingga selalu
 *      berada di belakang segala sesuatu tanpa perlu jarak kamera yang besar.
 *   2. Bintang terang — THREE.Points dengan warna berdasarkan suhu bintang
 *      (biru-panas sampai merah-dingin), plus kelip halus.
 *
 * Karena latar langit tidak ikut berputar saat zoom, ia berfungsi sebagai
 * jangkar visual yang membuat pergerakan kamera terasa punya arah.
 */
import {
  AdditiveBlending,
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  Group,
  Mesh,
  Points,
  ShaderMaterial,
  SphereGeometry,
  BackSide,
} from 'three';

const STAR_VERTEX = /* glsl */ `
attribute float aSize;
attribute float aPhase;
attribute vec3 color;

varying vec3 vColor;
varying float vTwinkle;

uniform float uTime;
uniform float uPixelRatio;

void main() {
  vColor = color;
  // Kelip lembut: bintang nyaris tidak berkedip, hanya "bernafas" perlahan.
  vTwinkle = 0.86 + 0.14 * sin(uTime * 1.7 + aPhase);

  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = aSize * uPixelRatio * vTwinkle;
  gl_Position = projectionMatrix * mvPosition;
}
`;

const STAR_FRAGMENT = /* glsl */ `
precision highp float;

varying vec3 vColor;
varying float vTwinkle;

uniform float uBrightness;

void main() {
  // Cakram bintang dengan inti terang dan tepi yang meluruh: jauh lebih
  // meyakinkan daripada titik kotak bawaan gl_PointSize.
  vec2 offset = gl_PointCoord - vec2(0.5);
  float dist = length(offset);
  if (dist > 0.5) discard;

  float core = smoothstep(0.5, 0.05, dist);
  float halo = pow(smoothstep(0.5, 0.0, dist), 2.4);
  float intensity = core * 0.85 + halo * 0.5;

  gl_FragColor = vec4(vColor * intensity * vTwinkle * uBrightness, 1.0);
}
`;

/** Sebaran suhu bintang (kelas O–M) beserta bobot kemunculannya. */
const STAR_CLASSES = [
  { color: 0x9bb0ff, weight: 0.03, size: 2.8 }, // O/B  biru
  { color: 0xaabfff, weight: 0.07, size: 2.4 }, // A    putih-biru
  { color: 0xf8f7ff, weight: 0.16, size: 2.0 }, // F    putih
  { color: 0xfff4ea, weight: 0.28, size: 1.8 }, // G    kuning-putih
  { color: 0xffd9b4, weight: 0.32, size: 1.6 }, // K    jingga
  { color: 0xffb07a, weight: 0.14, size: 1.4 }, // M    merah
];

/** RNG deterministik supaya susunan bintang sama pada setiap pemuatan. */
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const DOME_VERTEX = /* glsl */ `
varying vec2 vUv;
varying vec3 vDirection;

void main() {
  vUv = uv;
  vDirection = normalize(position);
  gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0);
}
`;

const DOME_FRAGMENT = /* glsl */ `
precision highp float;

varying vec2 vUv;
varying vec3 vDirection;

uniform sampler2D uMap;
uniform float uIntensity;
uniform float uContrast;
uniform vec3 uTint;

void main() {
  vec3 texel = texture2D(uMap, vUv).rgb;

  // Peta Bima Sakti asli cukup terang untuk latar langit; peredupan pangkat
  // membuat awan galaksi tetap terlihat sebagai kabut tipis, bukan pita tebal.
  vec3 color = pow(texel, vec3(uContrast)) * uIntensity * uTint;

  gl_FragColor = vec4(color, 1.0);

  #include <colorspace_fragment>
}
`;

export class Starfield {
  /**
   * @param {import('three').Texture} milkywayTexture
   * @param {{ starCount?: number, radius?: number, intensity?: number, starBrightness?: number }} [options]
   */
  constructor(milkywayTexture, options = {}) {
    const radius = options.radius ?? 4000;
    this.group = new Group();
    this.group.name = 'starfield';

    // --- 1. Kubah Bima Sakti ------------------------------------------------
    this.domeMaterial = new ShaderMaterial({
      name: 'starfield:dome',
      uniforms: {
        uMap: { value: milkywayTexture },
        uIntensity: { value: options.intensity ?? 0.62 },
        uContrast: { value: options.contrast ?? 1.35 },
        uTint: { value: new Color(0xbfd0ff) },
      },
      vertexShader: DOME_VERTEX,
      fragmentShader: DOME_FRAGMENT,
      side: BackSide,
      // depthTest dimatikan + renderOrder -1000: kubah selalu dilukis paling
      // awal, jadi ia tidak pernah menutupi planet dan kamera tidak perlu
      // benar-benar menjauh sampai radius 4000.
      depthTest: false,
      depthWrite: false,
    });

    this.dome = new Mesh(new SphereGeometry(radius, 48, 32), this.domeMaterial);
    this.dome.name = 'milkyway';
    this.dome.renderOrder = -1000;
    this.dome.frustumCulled = false;
    this.group.add(this.dome);

    // --- 2. Bintang-bintang terang ------------------------------------------
    const starCount = options.starCount ?? 4500;
    this.starMaterial = new ShaderMaterial({
      name: 'starfield:stars',
      uniforms: {
        uTime: { value: 0 },
        uBrightness: { value: options.starBrightness ?? 1.0 },
        uPixelRatio: { value: 1 },
      },
      vertexShader: STAR_VERTEX,
      fragmentShader: STAR_FRAGMENT,
      transparent: true,
      blending: AdditiveBlending,
      depthTest: false,
      depthWrite: false,
    });

    this.stars = new Points(this.#buildStarGeometry(starCount, radius * 0.9), this.starMaterial);
    this.stars.name = 'stars';
    this.stars.renderOrder = -900;
    this.stars.frustumCulled = false;
    this.group.add(this.stars);
  }

  /** Sebar bintang pada bola dengan warna sesuai kelas spektralnya. */
  #buildStarGeometry(count, radius) {
    const random = mulberry32(20260920);
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const phases = new Float32Array(count);
    const color = new Color();

    // Tabel kumulatif untuk memilih kelas bintang sesuai bobot.
    const total = STAR_CLASSES.reduce((sum, c) => sum + c.weight, 0);
    const cumulative = STAR_CLASSES.map(((sum) => (c) => (sum += c.weight / total))(0));

    for (let i = 0; i < count; i++) {
      // Sebaran merata pada permukaan bola (bukan menggerombol di kutub).
      const u = random() * 2 - 1;
      const theta = random() * Math.PI * 2;
      const s = Math.sqrt(1 - u * u);
      positions[i * 3 + 0] = radius * s * Math.cos(theta);
      positions[i * 3 + 1] = radius * u;
      positions[i * 3 + 2] = radius * s * Math.sin(theta);

      const roll = random();
      const cls = STAR_CLASSES[cumulative.findIndex((c) => roll <= c)] ?? STAR_CLASSES[3];
      color.set(cls.color);
      // Variasi kecerahan: sebagian besar bintang redup, segelintir menonjol.
      const magnitude = 0.45 + Math.pow(random(), 3.2) * 0.85;
      colors[i * 3 + 0] = color.r * magnitude;
      colors[i * 3 + 1] = color.g * magnitude;
      colors[i * 3 + 2] = color.b * magnitude;

      sizes[i] = cls.size * (0.7 + random() * 0.9);
      phases[i] = random() * Math.PI * 2;
    }

    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
    geometry.setAttribute('aSize', new Float32BufferAttribute(sizes, 1));
    geometry.setAttribute('aPhase', new Float32BufferAttribute(phases, 1));
    geometry.computeBoundingSphere();
    return geometry;
  }

  /** @param {number} elapsed waktu (detik) untuk kelip bintang */
  update(elapsed, pixelRatio = 1) {
    this.starMaterial.uniforms.uTime.value = elapsed;
    this.starMaterial.uniforms.uPixelRatio.value = pixelRatio;
  }

  dispose() {
    this.dome.geometry.dispose();
    this.domeMaterial.dispose();
    this.stars.geometry.dispose();
    this.starMaterial.dispose();
  }
}
