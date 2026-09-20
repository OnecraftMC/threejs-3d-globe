/**
 * sun.js — permukaan Matahari dan koronanya.
 *
 * Permukaan: tekstur asli sebagai dasar, dimodulasi oleh fbm yang beranimasi
 * sehingga granula permukaan tampak mendidih. Ditambah penggelapan tepi
 * (limb darkening) dan lapisan kromosfer yang lebih terang tepat di tepi.
 *
 * Korona: cangkang aditif di luar piringan dengan pendar Fresnel, sehingga
 * Matahari tidak pernah terlihat sebagai bola dengan tepi terpotong tajam.
 *
 * Nilai warna sengaja melewati 1.0 (HDR). Composer dirender ke target
 * half-float, jadi UnrealBloomPass bisa memanen kelebihannya.
 */
import { AdditiveBlending, BackSide, Color, FrontSide, ShaderMaterial, Vector3 } from 'three';
import { NOISE } from './lib/noise.glsl.js';

const SURFACE_VERTEX = /* glsl */ `
varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vObjectPosition;
varying vec3 vWorldPosition;

void main() {
  vUv = uv;
  vNormal = normalize(mat3(modelMatrix) * normalize(normal));
  vObjectPosition = normalize(position);
  vWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
  gl_Position = projectionMatrix * viewMatrix * vec4(vWorldPosition, 1.0);
}
`;

const SURFACE_FRAGMENT = /* glsl */ `
precision highp float;

varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vObjectPosition;
varying vec3 vWorldPosition;

${NOISE}

uniform sampler2D uMap;
uniform float uTime;
uniform float uNoiseScale;
uniform vec3 uHotColor;
uniform vec3 uRimColor;
uniform float uRimStrength;
uniform float uExposure;
uniform float uOpacity;

void main() {
  // Granula: dua lapis fbm yang bergerak berlawanan arah membuat permukaan
  // tampak mendidih, bukan sekadar tekstur yang berputar.
  vec3 p = vObjectPosition * uNoiseScale;
  float g1 = fbm(p + vec3(0.0, uTime * 0.030, 0.0), 4);
  float g2 = fbm(p * 3.4 - vec3(uTime * 0.045, 0.0, uTime * 0.02), 3);
  float boil = 0.80 + 0.30 * g1 + 0.16 * g2;

  vec3 base = texture2D(uMap, vUv).rgb;
  vec3 color = base * uHotColor * boil;

  vec3 normal = normalize(vNormal);
  vec3 viewDirection = normalize(cameraPosition - vWorldPosition);
  float facing = max(dot(normal, viewDirection), 0.0);

  // Penggelapan tepi: bagian tepi piringan Matahari tampak lebih gelap karena
  // kita melihat lapisan fotosfer yang lebih dingin.
  color *= mix(0.62, 1.12, pow(facing, 0.45));

  // Kromosfer: semburat merah di tepi, dihitung dari sudut datang sinar.
  color += uRimColor * pow(1.0 - facing, 3.2) * uRimStrength;

  gl_FragColor = vec4(color * uExposure, uOpacity);

  #include <colorspace_fragment>
}
`;

const CORONA_VERTEX = SURFACE_VERTEX;

const CORONA_FRAGMENT = /* glsl */ `
precision highp float;

varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vObjectPosition;
varying vec3 vWorldPosition;

${NOISE}

uniform float uTime;
uniform vec3 uColorInner;
uniform vec3 uColorOuter;
uniform float uIntensity;
uniform float uPower;

void main() {
  vec3 normal = normalize(vNormal);
  vec3 viewDirection = normalize(cameraPosition - vWorldPosition);

  // Fresnel -> hanya tepi luar cangkang yang menyala (cangkang dirender dari
  // sisi belakang, jadi nilainya nol di tengah piringan dan satu di tepi).
  float fresnel = pow(1.0 - abs(dot(viewDirection, normal)), uPower);

  float flicker = fbm(vObjectPosition * 3.1 + vec3(0.0, uTime * 0.05, 0.0), 4);
  float glow = fresnel * (0.5 + 0.9 * flicker) * uIntensity;

  vec3 color = mix(uColorInner, uColorOuter, clamp(1.0 - fresnel, 0.0, 1.0)) * glow;
  gl_FragColor = vec4(color, 1.0);

  #include <colorspace_fragment>
}
`;

/** Material permukaan Matahari. */
export function createSunSurfaceMaterial(map) {
  return new ShaderMaterial({
    name: 'sun:surface',
    uniforms: {
      uMap: { value: map },
      uTime: { value: 0 },
      uNoiseScale: { value: 3.2 },
      uHotColor: { value: new Color(0xffd9a0) },
      uRimColor: { value: new Color(0xff8a3c) },
      uRimStrength: { value: 0.55 },
      uExposure: { value: 1.75 },
      uOpacity: { value: 1 },
      uSunDirection: { value: new Vector3(1, 0, 0) },
    },
    vertexShader: SURFACE_VERTEX,
    fragmentShader: SURFACE_FRAGMENT,
    side: FrontSide,
  });
}

/** Material korona Matahari (cangkang aditif di luar piringan). */
export function createSunCoronaMaterial() {
  return new ShaderMaterial({
    name: 'sun:corona',
    uniforms: {
      uTime: { value: 0 },
      uColorInner: { value: new Color(0xffcf8a) },
      uColorOuter: { value: new Color(0xff7a2a) },
      uIntensity: { value: 0.95 },
      uPower: { value: 2.4 },
      uSunDirection: { value: new Vector3(1, 0, 0) },
    },
    vertexShader: CORONA_VERTEX,
    fragmentShader: CORONA_FRAGMENT,
    side: BackSide,
    blending: AdditiveBlending,
    transparent: true,
    depthWrite: false,
  });
}
