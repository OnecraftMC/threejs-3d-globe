/**
 * atmosphere.js — pendar atmosfer (fresnel) untuk planet dan bulan.
 *
 * Dua lapis dipakai bersama-sama:
 *   - sisi belakang (BackSide, additive)  -> halo di sekeliling tepi planet
 *   - sisi depan  (FrontSide, additive)   -> kabut tipis di atas permukaan
 *
 * Kecerahan mengikuti dua hal:
 *   1. Fresnel — pendar paling kuat ketika permukaan dilihat dari samping,
 *      sehingga membentuk cincin cahaya tepat di tepi piringan planet.
 *   2. Hamburan ke depan — atmosfer menyala lebih terang ketika Matahari
 *      berada di belakang planet (efek sabit biru yang khas di Bumi).
 */
import { AdditiveBlending, BackSide, Color, FrontSide, ShaderMaterial, Vector3 } from 'three';

const VERTEX = /* glsl */ `
varying vec3 vNormal;
varying vec3 vWorldPosition;

void main() {
  vNormal = normalize(mat3(modelMatrix) * normalize(normal));
  vWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
  gl_Position = projectionMatrix * viewMatrix * vec4(vWorldPosition, 1.0);
}
`;

const FRAGMENT = /* glsl */ `
precision highp float;

varying vec3 vNormal;
varying vec3 vWorldPosition;

uniform vec3 uSunDirection;
uniform vec3 uSunColor;
uniform vec3 uColor;
uniform float uIntensity;
uniform float uPower;
uniform float uForwardScatter;
/** 0 = hanya sisi siang, 1 = atmosfer tetap menyala di sisi malam. */
uniform float uNightFalloff;

void main() {
  vec3 normal = normalize(vNormal);
  vec3 viewDirection = normalize(cameraPosition - vWorldPosition);

  // Fresnel: 0 ketika menghadap kamera, 1 tepat di tepi piringan.
  float fresnel = pow(1.0 - abs(dot(viewDirection, normal)), uPower);

  // Bagian atmosfer yang menghadap Matahari.
  float sunFacing = dot(normal, uSunDirection);
  float lit = smoothstep(-uNightFalloff, 0.35, sunFacing);

  // Hamburan ke depan: paling kuat saat Matahari di belakang planet.
  float forward = pow(max(dot(-viewDirection, uSunDirection), 0.0), 3.0);

  float glow = fresnel * lit * (1.0 + forward * uForwardScatter);

  vec3 color = uColor * uSunColor * glow * uIntensity;
  gl_FragColor = vec4(color, 1.0);

  #include <colorspace_fragment>
}
`;

/**
 * @param {object} config konfigurasi `atmosphere` dari data/bodies.js
 * @param {'back'|'front'} layer lapisan mana yang sedang dibuat
 */
export function createAtmosphereMaterial(config, layer = 'back') {
  const isBack = layer === 'back';
  return new ShaderMaterial({
    name: `atmosphere:${layer}`,
    uniforms: {
      uSunDirection: { value: new Vector3(1, 0, 0) },
      uSunColor: { value: new Color(0xfff3e0) },
      uColor: { value: new Color(config.color) },
      uIntensity: { value: config.intensity * (isBack ? 1.0 : 0.30) },
      uPower: { value: config.power },
      uForwardScatter: { value: isBack ? 1.6 : 0.5 },
      // Atmosfer sisi malam tetap sedikit menyala: batas kota senja di Venus
      // dan aurora di Bumi tidak pernah benar-benar gelap.
      uNightFalloff: { value: config.nightFalloff ?? 0.55 },
    },
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    side: isBack ? BackSide : FrontSide,
    blending: AdditiveBlending,
    transparent: true,
    depthWrite: false,
  });
}
