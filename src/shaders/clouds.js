/**
 * clouds.js — lapisan awan.
 *
 * Dua perilaku dalam satu shader:
 *   USE_ALPHA_FROM_MAP  awan Bumi — tekstur menentukan di mana awan ada
 *                       (hitam = langit cerah, putih = awan tebal).
 *   tanpa define itu    dek awan Venus — menutup seluruh planet, hanya
 *                       ketebalannya yang bervariasi.
 *
 * Awan tidak menerima bayangan planet (bayangan awan ke permukaan dan
 * sebaliknya diabaikan) karena pada skala tampilan ini efeknya tidak terlihat.
 * Yang penting: awan ikut gelap saat melewati terminator, dan tetap redup di
 * sisi malam sehingga tidak muncul sebagai piringan putih di langit malam.
 */
import { Color, FrontSide, ShaderMaterial, Vector3 } from 'three';
import { SUN_LIGHTING } from './lib/noise.glsl.js';

const VERTEX = /* glsl */ `
varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vWorldPosition;

void main() {
  vUv = uv;
  vNormal = normalize(mat3(modelMatrix) * normalize(normal));
  vWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
  gl_Position = projectionMatrix * viewMatrix * vec4(vWorldPosition, 1.0);
}
`;

const FRAGMENT = /* glsl */ `
precision highp float;

varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vWorldPosition;

${SUN_LIGHTING}

uniform sampler2D uMap;
uniform vec3 uTint;
uniform float uOpacity;
uniform float uRimStrength;

void main() {
  vec4 texel = texture2D(uMap, vUv);

  float coverage = 1.0;
  #ifdef USE_ALPHA_FROM_MAP
  // Kecerahan tekstur dipakai sebagai ketebalan awan.
  coverage = dot(texel.rgb, vec3(0.299, 0.587, 0.114));
  coverage = smoothstep(0.04, 0.72, coverage);
  #endif

  if (coverage <= 0.003) discard;

  vec3 normal = normalize(vNormal);
  vec3 viewDirection = normalize(cameraPosition - vWorldPosition);

  float shadowFactor;
  float diffuse = sunDiffuse(normal, shadowFactor);

  // Tepi awan yang menerima cahaya dari belakang tampak lebih terang
  // (silver lining), terutama di dekat terminator.
  float rim = pow(1.0 - max(dot(normal, viewDirection), 0.0), 3.0);
  float terminatorBand = 1.0 - abs(dot(normal, uSunDirection));
  float silverLining = rim * pow(terminatorBand, 1.5) * uRimStrength;

  vec3 color = texel.rgb * uTint * uSunColor * diffuse;
  color += texel.rgb * uTint * fillLight(normal);
  color += uSunColor * silverLining * 0.35;

  gl_FragColor = vec4(color, coverage * uOpacity);

  #include <colorspace_fragment>
}
`;

/**
 * @param {import('three').Texture} map tekstur awan
 * @param {object} config konfigurasi `cloudDeck` dari data/bodies.js
 * @param {boolean} alphaFromMap true untuk awan Bumi, false untuk dek Venus
 */
export function createCloudMaterial(map, config = {}, alphaFromMap = true) {
  const defines = {};
  if (alphaFromMap) defines.USE_ALPHA_FROM_MAP = '';

  return new ShaderMaterial({
    name: 'clouds',
    defines,
    uniforms: {
      uMap: { value: map },
      uTint: { value: new Color(config.tint ?? 0xffffff) },
      uOpacity: { value: config.opacity ?? 0.9 },
      uRimStrength: { value: config.rimStrength ?? 0.6 },
      uSunDirection: { value: new Vector3(1, 0, 0) },
      uSunColor: { value: new Color(0xfff3e0) },
      uTerminator: { value: 0.22 },
      uAmbient: { value: 1.0 },
    },
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    side: FrontSide,
    transparent: true,
    depthWrite: false,
  });
}
