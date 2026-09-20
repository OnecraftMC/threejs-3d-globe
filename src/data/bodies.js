/**
 * bodies.js — data fisik & orbit seluruh benda langit di scene.
 *
 * Berkas ini sengaja TIDAK mengimpor three.js supaya bisa diuji langsung di
 * Node (lihat test/bodies.test.mjs).
 *
 * Catatan tentang skala:
 *   - `radiusKm`, `rotationHours`, `axialTilt`, `elements` = angka NYATA.
 *   - `displayRadius` dan `displayDistance` = angka TAMPILAN hasil kurva
 *     kompresi di config/scale.js. Beberapa bulan kecil memakai nilai
 *     tampilan yang ditetapkan tangan agar hierarkinya tetap terbaca
 *     (dijelaskan komentar di tempatnya).
 *   - `texture` = kunci logis (bukan URL); core/Assets.js yang mengubahnya
 *     menjadi URL sesuai base path aplikasi.
 */
import { displayDistance, displayRadius } from '../config/scale.js';
import { ELEMENTS } from './elements.js';

/** Nama berkas tekstur yang dipakai scene, dipisah agar mudah diganti. */
export const TEX = {
  sun2k: 'planets/sun_2k.jpg',
  sun8k: 'sun/sun_8k.jpg',
  mercury: 'planets/mercury.jpg',
  mercuryNormal: 'planets/mercury_normal_2k.jpg',
  venusSurface: 'planets/venus_surface.jpg',
  venusNormal: 'planets/venus_normal_2k.jpg',
  venusAtmosphere: 'planets/venus_atmosphere.jpg',
  earthDay2k: 'planets/earth_day_2k.jpg',
  earthNight2k: 'planets/earth_night_2k.jpg',
  earthClouds2k: 'planets/earth_clouds_2k.jpg',
  earthNormal2k: 'earth/earth_normal_2k.jpg',
  earthSpecular2k: 'earth/earth_specular_2k.jpg',
  earthDay8k: 'earth/earth_day_8k.jpg',
  earthNight8k: 'earth/earth_night_8k.jpg',
  earthClouds8k: 'earth/earth_clouds_8k.jpg',
  earthNormal4k: 'earth/earth_normal_4k.jpg',
  earthSpecular4k: 'earth/earth_specular_4k.jpg',
  mars: 'planets/mars.jpg',
  jupiter: 'planets/jupiter.jpg',
  saturn: 'planets/saturn.jpg',
  uranus: 'planets/uranus.jpg',
  neptune: 'planets/neptune.jpg',
  moon2k: 'planets/moon_2k.jpg',
  moonNormal2k: 'planets/moon_normal_2k.jpg',
  moon8k: 'moon/moon_8k.jpg',
  moonNormal4k: 'moon/moon_normal_4k.jpg',
  saturnRing: 'rings/saturn_ring_alpha.png',
  milkyway: 'sky/milkyway_2k.jpg',
  noiseFbm: 'generated/noise_fbm.png',
  noiseWarp: 'generated/noise_warp.png',
  moonTex: (name) => `generated/moons/${name}_albedo.jpg`,
  moonNormal: (name) => `generated/moons/${name}_normal.jpg`,
};

/** Definisi Matahari. */
export const SUN = {
  id: 'sun',
  kind: 'star',
  name: { id: 'Matahari', en: 'Sun' },
  radiusKm: 696340,
  displayRadius: displayRadius(696340),
  rotationHours: 609.12,
  axialTilt: 7.25,
  color: 0xffd27f,
  textures: { surface: TEX.sun2k, surfaceHero: TEX.sun8k },
  coronaScale: 1.22,
};

/** Delapan planet, urut dari dalam ke luar. */
export const PLANETS = [
  {
    id: 'mercury',
    kind: 'planet',
    name: { id: 'Merkurius', en: 'Mercury' },
    radiusKm: 2440,
    elements: ELEMENTS.mercury,
    rotationHours: 1407.6,
    axialTilt: 0.034,
    oblateness: 0.999,
    color: 0xa8a29b,
    textures: { surface: TEX.mercury, normal: TEX.mercuryNormal },
    atmosphere: null,
    cameraHint: { minPolar: 0.12, maxPolar: Math.PI - 0.12 },
  },
  {
    id: 'venus',
    kind: 'planet',
    name: { id: 'Venus', en: 'Venus' },
    radiusKm: 6052,
    elements: ELEMENTS.venus,
    rotationHours: -5832.5, // rotasi retrograde
    axialTilt: 177.36,
    oblateness: 0.999,
    color: 0xd9c07a,
    textures: {
      surface: TEX.venusSurface,
      normal: TEX.venusNormal,
      cloudDeck: TEX.venusAtmosphere,
    },
    atmosphere: { color: 0xe6cf92, intensity: 1.55, scale: 1.055, power: 2.3 },
    // Dek awan tebal berputar jauh lebih cepat dari permukaannya (super-rotasi),
    // dan menutup seluruh planet sehingga ketebalannya seragam.
    cloudDeck: {
      mapKey: 'cloudDeck',
      alphaFromMap: false,
      scale: 1.018,
      rotationHours: -220,
      opacity: 0.94,
      tint: 0xfff0c8,
    },
    lighting: { terminatorSoftness: 0.16 },
  },
  {
    id: 'earth',
    kind: 'planet',
    name: { id: 'Bumi', en: 'Earth' },
    radiusKm: 6371,
    elements: ELEMENTS.earth,
    rotationHours: 23.9345,
    /** Sudut putar diambil dari GMST, bukan dari periode rotasi saja. */
    useGmst: true,
    axialTilt: 23.44,
    /** Kutub utara Bumi menunjuk ke bujur ekliptika 90°, jadi acuannya 0. */
    poleEclipticLongitude: 0,
    oblateness: 0.9966,
    color: 0x3f7fd6,
    /**
     * Peta normal relief Bumi dari sumbernya memang sangat halus (deviasi kanal
     * R/G hanya sekitar 4 dari nilai 128). Penguatan 2,2x membuat relief gunung
     * terlihat tanpa menimbulkan riak palsu di dataran.
     */
    normalScale: 2.2,
    textures: {
      surface: TEX.earthDay2k,
      surfaceHero: TEX.earthDay8k,
      night: TEX.earthNight2k,
      nightHero: TEX.earthNight8k,
      clouds: TEX.earthClouds2k,
      cloudsHero: TEX.earthClouds8k,
      normal: TEX.earthNormal2k,
      normalHero: TEX.earthNormal4k,
      specular: TEX.earthSpecular2k,
      specularHero: TEX.earthSpecular4k,
    },
    atmosphere: { color: 0x5a9fe0, intensity: 1.25, scale: 1.032, power: 3.1 },
    cloudDeck: {
      mapKey: 'clouds',
      alphaFromMap: true,
      scale: 1.012,
      rotationHours: 21.6,
      opacity: 0.86,
      tint: 0xffffff,
    },
    lighting: { terminatorSoftness: 0.09, nightIntensity: 0.95, specularStrength: 1.1, shininess: 56 },
  },
  {
    id: 'mars',
    kind: 'planet',
    name: { id: 'Mars', en: 'Mars' },
    radiusKm: 3390,
    elements: ELEMENTS.mars,
    rotationHours: 24.6229,
    axialTilt: 25.19,
    oblateness: 0.994,
    color: 0xc1440e,
    textures: { surface: TEX.mars },
    atmosphere: { color: 0xd08b5c, intensity: 0.42, scale: 1.022, power: 3.4 },
    lighting: { terminatorSoftness: 0.14 },
  },
  {
    id: 'jupiter',
    kind: 'planet',
    name: { id: 'Jupiter', en: 'Jupiter' },
    radiusKm: 69911,
    elements: ELEMENTS.jupiter,
    rotationHours: 9.925,
    axialTilt: 3.13,
    oblateness: 0.935,
    color: 0xd8b27a,
    textures: { surface: TEX.jupiter },
    atmosphere: { color: 0xe0c8a0, intensity: 0.55, scale: 1.026, power: 3.0 },
    // Arus pita awan: peta permukaan digeser oleh tekstur noise yang beranimasi.
    turbulence: { amplitude: 0.012, speed: 0.035, warp: TEX.noiseWarp },
    rings: { inner: 1.42, outer: 1.81, opacity: 0.16, color: 0xb0a08c, procedural: 'faint' },
    lighting: { terminatorSoftness: 0.2, bandShading: true },
  },
  {
    id: 'saturn',
    kind: 'planet',
    name: { id: 'Saturnus', en: 'Saturn' },
    radiusKm: 58232,
    elements: ELEMENTS.saturn,
    rotationHours: 10.656,
    axialTilt: 26.73,
    oblateness: 0.902,
    color: 0xe3d3a3,
    textures: { surface: TEX.saturn },
    atmosphere: { color: 0xf0e0b0, intensity: 0.5, scale: 1.028, power: 3.0 },
    rings: {
      inner: 1.11,
      outer: 2.35,
      opacity: 1.0,
      color: 0xd8c8a8,
      texture: TEX.saturnRing,
      /** Bayangan cincin jatuh ke planet, dan bayangan planet jatuh ke cincin. */
      shadows: true,
    },
    lighting: { terminatorSoftness: 0.18, bandShading: true },
  },
  {
    id: 'uranus',
    kind: 'planet',
    name: { id: 'Uranus', en: 'Uranus' },
    radiusKm: 25362,
    elements: ELEMENTS.uranus,
    rotationHours: -17.24, // retrograde
    axialTilt: 97.77, // hampir rebah, menggelinding pada bidang orbitnya
    oblateness: 0.977,
    color: 0x9fe3e8,
    textures: { surface: TEX.uranus },
    atmosphere: { color: 0xa8ecf2, intensity: 0.9, scale: 1.045, power: 2.7 },
    rings: { inner: 1.62, outer: 2.0, opacity: 0.34, color: 0x8c9aa8, procedural: 'narrow' },
    lighting: { terminatorSoftness: 0.22 },
  },
  {
    id: 'neptune',
    kind: 'planet',
    name: { id: 'Neptunus', en: 'Neptune' },
    radiusKm: 24622,
    elements: ELEMENTS.neptune,
    rotationHours: 16.11,
    axialTilt: 28.32,
    oblateness: 0.983,
    color: 0x3f5fd0,
    textures: { surface: TEX.neptune },
    atmosphere: { color: 0x5f86f0, intensity: 0.95, scale: 1.045, power: 2.7 },
    rings: { inner: 1.7, outer: 2.5, opacity: 0.18, color: 0x7f8ea8, procedural: 'faint' },
    turbulence: { amplitude: 0.006, speed: 0.05, warp: TEX.noiseWarp },
    lighting: { terminatorSoftness: 0.22, bandShading: true },
  },
];

// ---------------------------------------------------------------------------
// Bulan-bulan
// ---------------------------------------------------------------------------
//
// `orbit` adalah jarak tampilan dari pusat planet (satuan scene) dan
// `displayRadius` adalah radius tampilan yang ditetapkan tangan. Keduanya
// sengaja tidak memakai kurva kompresi: jarak Bulan Bumi yang sesungguhnya
// (60 kali jari-jari Bumi) akan menempatkannya di luar tata surya bagian
// dalam, sedangkan radius dengan kurva planet akan membuat bulan-bulan besar
// tampak hampir sebesar planetnya.

const MOON_SPECS = {
  earth: [
    {
      id: 'moon',
      name: { id: 'Bulan', en: 'Moon' },
      radiusKm: 1737,
      displayRadius: 0.42,
      orbit: 4.3,
      periodDays: 27.321661,
      color: 0xbdb6ac,
      textures: {
        surface: TEX.moon2k,
        normal: TEX.moonNormal2k,
        surfaceHero: TEX.moon8k,
        normalHero: TEX.moonNormal4k,
      },
      inclinationDeg: 5.145,
      /** Rotasi terkunci pasang-surut: satu sisi selalu menghadap Bumi. */
      tidallyLocked: true,
      /** Fase awal supaya posisi Bulan hari ini mendekati kenyataan. */
      phaseOffset: 0.63,
    },
  ],
  mars: [
    {
      id: 'phobos', name: { id: 'Phobos', en: 'Phobos' }, radiusKm: 11.3,
      displayRadius: 0.07, orbit: 1.85, periodDays: 0.31891, color: 0x7d746c,
      textures: { surface: TEX.moonTex('phobos'), normal: TEX.moonNormal('phobos') },
      irregular: true, inclinationDeg: 1.08, tidallyLocked: true,
    },
    {
      id: 'deimos', name: { id: 'Deimos', en: 'Deimos' }, radiusKm: 6.2,
      displayRadius: 0.05, orbit: 2.75, periodDays: 1.263, color: 0x8e857a,
      textures: { surface: TEX.moonTex('deimos'), normal: TEX.moonNormal('deimos') },
      irregular: true, inclinationDeg: 1.79, tidallyLocked: true,
    },
  ],
  jupiter: [
    // Bulan-bulan Jupiter diletakkan di luar tepi terluar cincin samar
    // (1,81 R ~ 6,68 satuan) agar tidak tertutup oleh piringan cincin.
    { id: 'io', name: { id: 'Io', en: 'Io' }, radiusKm: 1821, displayRadius: 0.30, orbit: 7.4,
      periodDays: 1.769138, color: 0xd8bf60,
      textures: { surface: TEX.moonTex('io'), normal: TEX.moonNormal('io') }, tidallyLocked: true },
    { id: 'europa', name: { id: 'Europa', en: 'Europa' }, radiusKm: 1561, displayRadius: 0.26,
      orbit: 9.0, periodDays: 3.551181, color: 0xd6d0c0,
      textures: { surface: TEX.moonTex('europa'), normal: TEX.moonNormal('europa') }, tidallyLocked: true },
    { id: 'ganymede', name: { id: 'Ganymede', en: 'Ganymede' }, radiusKm: 2634, displayRadius: 0.42,
      orbit: 11.3, periodDays: 7.154553, color: 0x9a8f7e,
      textures: { surface: TEX.moonTex('ganymede'), normal: TEX.moonNormal('ganymede') }, tidallyLocked: true },
    { id: 'callisto', name: { id: 'Callisto', en: 'Callisto' }, radiusKm: 2410, displayRadius: 0.39,
      orbit: 14.8, periodDays: 16.689017, color: 0x6a625a,
      textures: { surface: TEX.moonTex('callisto'), normal: TEX.moonNormal('callisto') }, tidallyLocked: true },
  ],
  saturn: [
    // Semua bulan diletakkan di luar tepi terluar cincin (2,35 R ~ 8,04 satuan)
    // agar tidak tertutup oleh piringan cincin.
    { id: 'enceladus', name: { id: 'Enceladus', en: 'Enceladus' }, radiusKm: 252, displayRadius: 0.14,
      orbit: 9.3, periodDays: 1.370218, color: 0xe8eef2,
      textures: { surface: TEX.moonTex('enceladus'), normal: TEX.moonNormal('enceladus') },
      tidallyLocked: true, geysers: true },
    { id: 'rhea', name: { id: 'Rhea', en: 'Rhea' }, radiusKm: 764, displayRadius: 0.19, orbit: 10.6,
      periodDays: 4.518212, color: 0xc8c4bc,
      textures: { surface: TEX.moonTex('rhea'), normal: TEX.moonNormal('rhea') }, tidallyLocked: true },
    { id: 'titan', name: { id: 'Titan', en: 'Titan' }, radiusKm: 2575, displayRadius: 0.40, orbit: 13.0,
      periodDays: 15.945, color: 0xcf9a4a,
      textures: { surface: TEX.moonTex('titan'), normal: TEX.moonNormal('titan') },
      atmosphere: { color: 0xd8a44e, intensity: 0.7, scale: 1.05, power: 2.6 }, tidallyLocked: true },
  ],
  uranus: [
    { id: 'titania', name: { id: 'Titania', en: 'Titania' }, radiusKm: 789, displayRadius: 0.19,
      orbit: 5.4, periodDays: 8.706234, color: 0xc0b8b0,
      textures: { surface: TEX.moonTex('titania'), normal: TEX.moonNormal('titania') }, tidallyLocked: true },
    { id: 'oberon', name: { id: 'Oberon', en: 'Oberon' }, radiusKm: 761, displayRadius: 0.18,
      orbit: 6.7, periodDays: 13.463234, color: 0xb0a8a0,
      textures: { surface: TEX.moonTex('oberon'), normal: TEX.moonNormal('oberon') }, tidallyLocked: true },
  ],
  neptune: [
    { id: 'triton', name: { id: 'Triton', en: 'Triton' }, radiusKm: 1353, displayRadius: 0.24, orbit: 7.6,
      periodDays: -5.876854, // retrograde: satu-satunya bulan besar yang mundur
      color: 0xd8c8c4,
      textures: { surface: TEX.moonTex('triton'), normal: TEX.moonNormal('triton') },
      inclinationDeg: 156.885, tidallyLocked: true },
  ],
};

/** Ubah spesifikasi ringkas menjadi objek bulan yang dipakai scene. */
function makeMoon(spec, parent) {
  const periodHours = Math.abs(spec.periodDays) * 24;
  return {
    ...spec,
    kind: 'moon',
    parent: parent.id,
    /** Kecepatan sudut orbit (radian per jam waktu simulasi). */
    angularSpeed: (Math.PI * 2) / (spec.periodDays * 24),
    rotationHours: spec.tidallyLocked ? periodHours : periodHours * 0.5,
    /** Bulan dianggap tidak miring terhadap bidang orbitnya sendiri. */
    axialTilt: 0,
    oblateness: 1,
  };
}

for (const planet of PLANETS) {
  planet.moons = (MOON_SPECS[planet.id] ?? []).map((spec) => makeMoon(spec, planet));
}

/** Lengkapi nilai tampilan tiap planet (radius & jarak orbit). */
for (const planet of PLANETS) {
  planet.displayRadius = displayRadius(planet.radiusKm);
  planet.displayDistance = displayDistance(planet.elements.a);
}

/** Sabuk asteroid utama, antara Mars dan Jupiter. */
export const ASTEROID_BELT = {
  id: 'asteroid-belt',
  /** Radius dalam & luar (satuan scene), mengapit celah Mars–Jupiter. */
  inner: displayDistance(2.06),
  outer: displayDistance(3.28),
  count: 3600,
  /** Ketinggian lembar sabuk (satuan scene) — sebaran inklinasi. */
  thickness: 6.0,
  color: 0x9a8c7a,
  seed: 1234567,
};

/** Cincin samar sabuk Kuiper di luar Neptunus. */
export const KUIPER_BELT = {
  id: 'kuiper-belt',
  inner: displayDistance(33),
  outer: displayDistance(48),
  count: 2200,
  thickness: 9.0,
  color: 0x8fa6c8,
  seed: 7654321,
};




/** Semua benda langit dalam satu daftar: Matahari lalu planet-planet. */
export function allBodies() {
  return [SUN, ...PLANETS];
}

/** Cari definisi benda langit berdasarkan id (termasuk bulan). */
export function findBody(id) {
  for (const body of allBodies()) {
    if (body.id === id) return body;
    for (const moon of body.moons ?? []) {
      if (moon.id === id) return moon;
    }
  }
  return null;
}
