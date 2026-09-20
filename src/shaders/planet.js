/**
 * planet.js — material permukaan untuk planet, bulan, dan Matahari.
 *
 * Scene ini sengaja TIDAK memakai THREE.Light untuk permukaan planet.
 * Sebagai gantinya setiap material menerima uniform arah Matahari. Konsekuensinya:
 *   - terminator (garis siang-malam) dan fase planet otomatis benar, karena
 *     Matahari benar-benar berada di posisinya di dalam scene;
 *   - kecerahan tidak menyusut oleh jarak, jadi Neptunus tetap terlihat
 *     sementara Merkurius tidak terbakar.
 *
 * Fitur yang bisa dinyalakan per benda langit lewat `defines`:
 *   USE_MAP          peta albedo
 *   USE_NORMAL_MAP   peta normal (relief permukaan)
 *   USE_SPECULAR     peta specular — dipakai Bumi untuk kilau samudra
 *   USE_NIGHT        peta malam — lampu kota Bumi
 *   USE_TURBULENCE   pita awan digeser oleh noise beranimasi (gas raksasa)
 *   USE_RING_SHADOW  bayangan cincin jatuh ke permukaan planet
 *
 * Catatan geometri: oblateness (pemepatan kutub) dibakar ke dalam geometri
 * bola, bukan lewat mesh.scale. Dengan begitu matriks rotasi biasa tetap
 * mentransformasi normal dengan benar dan tidak perlu matriks normal khusus.
 */
import {
  AdditiveBlending,
  BackSide,
  Color,
  FrontSide,
  ShaderMaterial,
  Texture,
  Vector2,
  Vector3,
} from 'three';
import { NOISE, SUN_LIGHTING, SPHERE_UV } from './lib/noise.glsl.js';

const VERTEX = /* glsl */ `
varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vTangent;
varying vec3 vBitangent;
varying vec3 vWorldPosition;

${SPHERE_UV}

void main() {
  vUv = uv;

  // Sumbu tangen untuk bola: arah pertambahan bujur tekstur.
  vec3 tangent = vec3(position.z, 0.0, -position.x);
  tangent = length(tangent) > 1e-5 ? normalize(tangent) : vec3(1.0, 0.0, 0.0);

  // Normal di ruang objek; geometri sudah dipipihkan (oblateness) sehingga
  // normal atribut sudah benar dan rotasi model bekerja apa adanya.
  vec3 objectNormal = normalize(normal);

  vNormal = normalize(mat3(modelMatrix) * objectNormal);
  vWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;

  // Kerangka tangen kirim ke fragment: T searah +u, B = N x T searah +v.
  vTangent = normalize(mat3(modelMatrix) * tangent);
  vBitangent = normalize(cross(vNormal, vTangent));

  gl_Position = projectionMatrix * viewMatrix * vec4(vWorldPosition, 1.0);
}
`;

const FRAGMENT_HEAD = /* glsl */ `
precision highp float;

varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vTangent;
varying vec3 vBitangent;
varying vec3 vWorldPosition;

${NOISE}
${SUN_LIGHTING}

uniform vec3 uTint;
uniform float uOpacity;

#ifdef USE_MAP
uniform sampler2D uMap;
#endif
#ifdef USE_NORMAL_MAP
uniform sampler2D uNormalMap;
uniform vec2 uNormalScale;    // x untuk X tangen, y untuk Y tangen (boleh negatif)
#endif
#ifdef USE_SPECULAR
uniform sampler2D uSpecularMap;
uniform float uSpecularStrength;
uniform float uShininess;
#endif
#ifdef USE_NIGHT
uniform sampler2D uNightMap;
uniform float uNightIntensity;
#endif
#ifdef USE_TURBULENCE
uniform sampler2D uWarpMap;
uniform float uWarpAmount;
uniform float uWarpTime;
uniform float uWarpScale;
#endif
#ifdef USE_RING_SHADOW
uniform vec3 uRingCenter;
uniform vec3 uRingNormal;
uniform float uRingInner;
uniform float uRingOuter;
#endif

void main() {
  vec2 uv = vUv;

  #ifdef USE_TURBULENCE
  // Arus pita awan: UV digeser mengikuti noise yang bergerak, supaya pita gas
  // raksasa tampak mengalir dan bukan gambar statis.
  float w1 = texture2D(uWarpMap, vec2(uv.x * 2.0 - uWarpTime * 0.6, uv.y * 5.0)).r;
  float w2 = texture2D(uWarpMap, vec2(uv.x * 5.0 + uWarpTime * 1.1, uv.y * 13.0)).r;
  uv.y += ((w1 - 0.5) + (w2 - 0.5) * 0.45) * uWarpAmount;
  uv.x += (w2 - 0.5) * uWarpAmount * 0.4;
  #endif

  vec3 baseColor = uTint;
  #ifdef USE_MAP
  baseColor *= texture2D(uMap, uv).rgb;
  #endif

  vec3 N = normalize(vNormal);
  #ifdef USE_NORMAL_MAP
  vec3 nTex = texture2D(uNormalMap, uv).xyz * 2.0 - 1.0;
  nTex.xy *= uNormalScale;
  nTex = normalize(nTex);
  // Kerangka tangen: T searah +u, B searah +v (dikirim dari vertex shader).
  N = normalize(nTex.x * normalize(vTangent) + nTex.y * normalize(vBitangent) + nTex.z * N);
  #endif

  vec3 viewDirection = normalize(cameraPosition - vWorldPosition);

  // --- Pencahayaan Matahari ---
  float shadowFactor;
  float diffuse = sunDiffuse(N, shadowFactor);

  float spec = 0.0;
  #ifdef USE_SPECULAR
  // Kilau samudra: hanya muncul di air (peta specular bernilai tinggi di laut)
  // dan ikut padam ketika permukaan masuk sisi malam.
  float water = texture2D(uSpecularMap, uv).r;
  vec3 halfVector = normalize(viewDirection + uSunDirection);
  spec = pow(max(dot(N, halfVector), 0.0), uShininess) * water * uSpecularStrength;
  #endif

  vec3 color = baseColor * uSunColor * diffuse;
  color += baseColor * fillLight(N);        // sisi malam tetap terbaca
  color += uSunColor * spec * shadowFactor;

  #ifdef USE_NIGHT
  // Lampu kota hanya menyala di sisi malam dan meredup di sekitar terminator.
  float nightMask = 1.0 - smoothstep(-0.20, 0.06, dot(N, uSunDirection));
  vec3 cityLights = texture2D(uNightMap, uv).rgb;
  color += cityLights * cityLights * uNightIntensity * nightMask;
  #endif

  #ifdef USE_RING_SHADOW
  // Bayangan cincin jatuh ke planet: telusuri berkas dari titik permukaan
  // menuju Matahari, lalu periksa di radius berapa berkas itu menembus bidang
  // cincin. Bila berada di antara radius dalam dan luar cincin, titik itu
  // berada dalam bayangan.
  vec3 ringToPoint = vWorldPosition - uRingCenter;
  float denominator = dot(uSunDirection, uRingNormal);
  float softness = max((uRingOuter - uRingInner) * 0.02, 0.004);
  float ringShadow = 1.0;
  if (abs(denominator) > 1e-4) {
    float t = -dot(ringToPoint, uRingNormal) / denominator;
    if (t > 0.0) {
      float hitRadius = length(ringToPoint + uSunDirection * t);
      float innerEdge = smoothstep(uRingInner - softness, uRingInner + softness, hitRadius);
      float outerEdge = 1.0 - smoothstep(uRingOuter - softness, uRingOuter + softness, hitRadius);
      ringShadow = 1.0 - innerEdge * outerEdge * 0.75;
    }
  }
  color *= ringShadow;
  #endif

  gl_FragColor = vec4(color, uOpacity);

  #include <colorspace_fragment>
}
`;

/**
 * Susun material permukaan untuk sebuah benda langit.
 *
 * @param {object} body definisi dari data/bodies.js
 * @param {object} options
 * @param {import('three').Texture} [options.map] albedo
 * @param {import('three').Texture} [options.normalMap]
 * @param {import('three').Texture} [options.specularMap]
 * @param {import('three').Texture} [options.nightMap]
 * @param {import('three').Texture} [options.warpMap]
 */
export function createPlanetMaterial(body, options = {}) {
  const lighting = body.lighting ?? {};
  const defines = {};
  const uniforms = {
    uSunDirection: { value: new Vector3(1, 0, 0) },
    uSunColor: { value: new Color(0xfff3e0) },
    uTerminator: { value: lighting.terminatorSoftness ?? 0.1 },
    uAmbient: { value: lighting.ambient ?? 1.0 },
    uTint: { value: new Color(body.tint ?? 0xffffff) },
    uOpacity: { value: 1 },
  };

  if (options.map) {
    defines.USE_MAP = '';
    uniforms.uMap = { value: options.map };
  }
  if (options.normalMap) {
    defines.USE_NORMAL_MAP = '';
    uniforms.uNormalMap = { value: options.normalMap };
    // Nilai Y dinegasikan: peta normal yang dihasilkan scripts/gen_textures.py
    // memakai G = +d(kecerahan)/d(baris gambar), sedangkan sumbu +v tekstur
    // mengarah ke atas gambar (three.js memuat tekstur dengan flipY).
    const scale = options.normalScale ?? 1.0;
    uniforms.uNormalScale = { value: new Vector2(scale, -scale) };
  }
  if (options.specularMap) {
    defines.USE_SPECULAR = '';
    uniforms.uSpecularMap = { value: options.specularMap };
    uniforms.uSpecularStrength = { value: lighting.specularStrength ?? 0.9 };
    uniforms.uShininess = { value: lighting.shininess ?? 48 };
  }
  if (options.nightMap) {
    defines.USE_NIGHT = '';
    uniforms.uNightMap = { value: options.nightMap };
    uniforms.uNightIntensity = { value: lighting.nightIntensity ?? 0.85 };
  }

  const turbulence = body.turbulence;
  if (turbulence && options.warpMap) {
    defines.USE_TURBULENCE = '';
    uniforms.uWarpMap = { value: options.warpMap };
    uniforms.uWarpAmount = { value: turbulence.amplitude ?? 0.01 };
    uniforms.uWarpTime = { value: 0 };
  }

  const rings = body.rings;
  if (rings?.shadows) {
    defines.USE_RING_SHADOW = '';
    uniforms.uRingCenter = { value: new Vector3() };
    uniforms.uRingNormal = { value: new Vector3(0, 1, 0) };
    uniforms.uRingInner = { value: 0 };
    uniforms.uRingOuter = { value: 1 };
  }

  const material = new ShaderMaterial({
    name: `planet:${body.id}`,
    defines,
    uniforms,
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT_HEAD,
    transparent: false,
  });

  material.userData.body = body;
  return material;
}

export { VERTEX as PLANET_VERTEX, FRAGMENT_HEAD as PLANET_FRAGMENT };
export const PLANET_SIDE = { FrontSide, BackSide, AdditiveBlending, Texture };
