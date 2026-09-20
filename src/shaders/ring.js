/**
 * ring.js — piringan cincin (Saturnus, Jupiter, Uranus, Neptunus).
 *
 * Tiga hal yang membuat cincin terlihat meyakinkan:
 *
 *  1. Pemetaan radial — peta alpha cincin berbentuk pita mendatar
 *     (mis. 2048x125 untuk Saturnus), jadi koordinat U dihitung dari radius
 *     titik tersebut, bukan dari UV bawaan RingGeometry yang berbentuk kotak.
 *
 *  2. Model pencahayaan partikel (Lommel–Seeliger) — kecerahan bergantung pada
 *     sudut datang sinar dan sudut pandang. Inilah sebabnya cincin Saturnus
 *     tampak jauh lebih terang ketika dilihat hampir sejajar bidangnya.
 *
 *  3. Bayangan planet pada cincin — berkas dari tiap titik cincin ke Matahari
 *     diperiksa apakah terhalang bola planet. Ini menghasilkan lengkung
 *     bayangan planet yang khas pada cincin.
 */
import { Color, DoubleSide, ShaderMaterial, Vector3 } from 'three';

const VERTEX = /* glsl */ `
varying vec3 vWorldPosition;
varying vec3 vRingNormal;
varying float vRadius;

void main() {
  vWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
  vRingNormal = normalize(mat3(modelMatrix) * vec3(0.0, 1.0, 0.0));
  // Geometri cincin sudah diputar ke bidang XZ, jadi radius = panjang (x, z).
  vRadius = length(position.xz);
  gl_Position = projectionMatrix * viewMatrix * vec4(vWorldPosition, 1.0);
}
`;

const FRAGMENT = /* glsl */ `
precision highp float;

varying vec3 vWorldPosition;
varying vec3 vRingNormal;
varying float vRadius;

uniform sampler2D uAlphaMap;
uniform vec3 uColor;
uniform vec3 uSunColor;
uniform vec3 uSunDirection;
uniform float uInner;
uniform float uOuter;
uniform float uOpacity;
uniform float uBrightness;
uniform float uAmbient;
uniform vec3 uPlanetCenter;
uniform float uPlanetRadius;

void main() {
  float u = clamp((vRadius - uInner) / max(uOuter - uInner, 1e-4), 0.0, 1.0);
  float alpha = texture2D(uAlphaMap, vec2(u, 0.5)).r;
  if (alpha <= 0.002) discard;

  vec3 ringNormal = normalize(vRingNormal);
  vec3 viewDirection = normalize(cameraPosition - vWorldPosition);

  // Model partikel: mu0 = kosinus sudut datang, mu = kosinus sudut pandang.
  float mu0 = abs(dot(uSunDirection, ringNormal));
  float mu = abs(dot(viewDirection, ringNormal));
  float phase = 2.0 * mu0 / max(mu0 + mu, 0.02);

  // Bayangan planet pada cincin.
  float shadow = 1.0;
  vec3 toPlanet = uPlanetCenter - vWorldPosition;
  float alongSun = dot(toPlanet, uSunDirection);
  if (alongSun > 0.0) {
    float perpendicular = length(toPlanet - uSunDirection * alongSun);
    float d = perpendicular / max(uPlanetRadius, 1e-5);
    shadow = mix(0.14, 1.0, smoothstep(0.94, 1.12, d));
  }

  vec3 color = uColor * uSunColor * phase * shadow * uBrightness;
  color += uColor * uAmbient;

  gl_FragColor = vec4(color, alpha * uOpacity);

  #include <colorspace_fragment>
}
`;

/**
 * @param {object} config konfigurasi `rings` dari data/bodies.js
 * @param {import('three').Texture} alphaMap pita alpha (mendatar)
 */
export function createRingMaterial(config, alphaMap) {
  return new ShaderMaterial({
    name: `ring:${config.procedural ?? 'textured'}`,
    uniforms: {
      uAlphaMap: { value: alphaMap },
      uColor: { value: new Color(config.color) },
      uSunColor: { value: new Color(0xfff3e0) },
      uSunDirection: { value: new Vector3(1, 0, 0) },
      uInner: { value: 0 },
      uOuter: { value: 1 },
      uOpacity: { value: config.opacity ?? 1 },
      uBrightness: { value: config.brightness ?? 1.05 },
      uAmbient: { value: config.ambient ?? 0.02 },
      uPlanetCenter: { value: new Vector3() },
      uPlanetRadius: { value: 1 },
    },
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    side: DoubleSide,
    transparent: true,
    // depthWrite dimatikan supaya separuh cincin yang lewat di belakang planet
    // maupun di depannya tidak saling menutupi secara keliru; depthTest tetap
    // aktif agar planet menutupi bagian cincin yang berada di belakangnya.
    depthWrite: false,
  });
}
