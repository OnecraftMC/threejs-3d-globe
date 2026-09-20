/**
 * Body.js — satu benda langit: permukaan, awan, atmosfer, cincin, dan bulannya.
 *
 * Susunan kerangka (hierarki) sebuah planet:
 *
 *   group            posisi ditentukan orbit Kepler setiap frame
 *   └ tiltGroup      kemiringan sumbu: rotation.y = -bujur kutub, rotation.x = obliquity
 *     ├ surfaceMesh  rotation.y = sudut putar (GMST untuk Bumi)
 *     ├ cloudsMesh
 *     ├ ringMesh
 *     └ atmosphere   cangkang aditif
 *
 * Kemiringan sumbu sengaja dipasang di kerangka inersia (tidak ikut berputar
 * mengikuti posisi orbit). Inilah yang membuat musim muncul dengan sendirinya:
 * kutub tetap menunjuk arah yang sama sepanjang tahun, sehingga garis lintang
 * titik balik matahari bergeser seperti pada kenyataan.
 *
 * Bulan kecil tanpa citra resmi diberi bentuk tidak beraturan (Phobos dan
 * Deimos memang berbentuk kentang, bukan bola).
 */
import {
  DataTexture,
  Group,
  Mesh,
  NearestFilter,
  Quaternion,
  RGBAFormat,
  SphereGeometry,
  Vector3,
} from 'three';
import { createPlanetMaterial } from '../shaders/planet.js';
import { createCloudMaterial } from '../shaders/clouds.js';
import { createAtmosphereShell } from './Atmosphere.js';
import { createRingSystem } from './Rings.js';
import { greenwichSiderealDeg, scenePosition } from '../data/kepler.js';

// ---------------------------------------------------------------------------
// Tekstur pengganti
// ---------------------------------------------------------------------------
//
// Material dibuat sekali dengan seluruh `define` yang diperlukan, lalu setiap
// slot tekstur diisi baik oleh tekstur asli maupun oleh tekstur 1x1 pengganti.
// Dengan begitu tidak pernah ada kompilasi ulang shader saat berjalan, dan
// sebuah berkas yang gagal diunduh hanya berarti slot itu tampil datar —
// bukan permukaan hitam atau galat.

function solidTexture(r, g, b) {
  const data = new Uint8Array([r, g, b, 255]);
  const texture = new DataTexture(data, 1, 1, RGBAFormat);
  texture.needsUpdate = true;
  texture.magFilter = NearestFilter;
  texture.minFilter = NearestFilter;
  texture.generateMipmaps = false;
  return texture;
}

const FALLBACKS = {
  map: () => solidTexture(150, 150, 150),
  normal: () => solidTexture(128, 128, 255),
  specular: () => solidTexture(0, 0, 0),
  night: () => solidTexture(0, 0, 0),
  clouds: () => solidTexture(0, 0, 0),
  ozone: () => solidTexture(255, 255, 255),
  warp: () => solidTexture(128, 128, 128),
};

/** Ambil tekstur dari aset, atau tekstur datar penggantinya. */
function textureOr(assets, key, fallbackKind) {
  const fallback = FALLBACKS[fallbackKind] ?? FALLBACKS.map;
  if (!key) return fallback();
  return assets.get(key) ?? fallback();
}

// ---------------------------------------------------------------------------
// Pembantu geometri
// ---------------------------------------------------------------------------

function hash3(x, y, z) {
  const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453;
  return s - Math.floor(s);
}

function valueNoise3(x, y, z) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fy = y - iy;
  const fz = z - iz;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const sz = fz * fz * (3 - 2 * fz);

  const lerp = (a, b, t) => a + (b - a) * t;

  const c000 = hash3(ix, iy, iz);
  const c100 = hash3(ix + 1, iy, iz);
  const c010 = hash3(ix, iy + 1, iz);
  const c110 = hash3(ix + 1, iy + 1, iz);
  const c001 = hash3(ix, iy, iz + 1);
  const c101 = hash3(ix + 1, iy, iz + 1);
  const c011 = hash3(ix, iy + 1, iz + 1);
  const c111 = hash3(ix + 1, iy + 1, iz + 1);

  return lerp(
    lerp(lerp(c000, c100, sx), lerp(c010, c110, sx), sy),
    lerp(lerp(c001, c101, sx), lerp(c011, c111, sx), sy),
    sz,
  );
}

function fbm3(x, y, z, octaves = 4) {
  let sum = 0;
  let amp = 0.5;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += valueNoise3(x, y, z) * amp;
    norm += amp;
    x *= 2.03;
    y *= 2.03;
    z *= 2.03;
    amp *= 0.5;
  }
  return sum / norm;
}

/** Ubah bola menjadi bentuk tidak beraturan (Phobos, Deimos). */
function makeIrregular(geometry, amount, seed) {
  const position = geometry.attributes.position;
  const vertex = new Vector3();
  for (let i = 0; i < position.count; i++) {
    vertex.fromBufferAttribute(position, i);
    const length = vertex.length() || 1;
    const nx = vertex.x / length;
    const ny = vertex.y / length;
    const nz = vertex.z / length;
    const noise = fbm3(nx * 2.2 + seed, ny * 2.2 + seed * 1.7, nz * 2.2, 4);
    const scale = 1 + (noise - 0.5) * 2 * amount;
    position.setXYZ(i, vertex.x * scale, vertex.y * scale, vertex.z * scale);
  }
  position.needsUpdate = true;
}

/**
 * Geometri bola untuk sebuah benda langit.
 *
 * Oblateness (pemepatan kutub) dibakar ke dalam geometri, bukan lewat
 * mesh.scale. Dengan begitu normal atribut langsung benar dan shader tidak
 * perlu matriks normal khusus untuk skala tak-seragam.
 */
export function createBodyGeometry(radius, segments, oblateness = 1, irregular = null) {
  const heightSegments = Math.max(8, segments);
  const geometry = new SphereGeometry(radius, heightSegments * 2, heightSegments);

  if (oblateness && Math.abs(oblateness - 1) > 1e-4) {
    geometry.scale(1, oblateness, 1);
  }
  if (irregular) {
    makeIrregular(geometry, irregular.amount ?? 0.26, irregular.seed ?? 1);
  }
  geometry.computeVertexNormals();
  return geometry;
}

/**
 * Satu benda langit (planet atau bulan) beserta seluruh lapisan visualnya.
 */
export class CelestialBody {
  /**
   * @param {object} def definisi dari data/bodies.js
   * @param {{ assets: import('../core/Assets.js').Assets, preset: object, segments?: number }} context
   */
  constructor(def, context) {
    this.def = def;
    this.id = def.id;
    this.name = def.name;
    this.kind = def.kind;
    this.assets = context.assets;
    this.preset = context.preset;
    this.isMoon = def.kind === 'moon';
    this.displayRadius = def.displayRadius;
    this.displayDistance = def.displayDistance ?? 0;

    /** Sudut putar saat ini (radian). */
    this.spinAngle = 0;
    /** Sudut orbit untuk bulan (radian). */
    this.orbitAngle = 0;

    /** Material yang perlu menerima arah Matahari setiap frame. */
    this.sunMaterials = [];
    /** Tekstur yang boleh ditingkatkan ke versi resolusi tinggi. */
    this.textureSlots = {};

    const segments = context.segments ?? (this.isMoon
      ? this.preset.sphereSegments.moon
      : this.preset.sphereSegments.planet);

    this.group = new Group();
    this.group.name = `body:${def.id}`;

    // Kerangka kemiringan sumbu. Urutan 'YXZ' penting: bujur kutub dulu,
    // baru obliquity, supaya arah kutub mendarat di tempat yang benar.
    this.tiltGroup = new Group();
    this.tiltGroup.name = `tilt:${def.id}`;
    this.tiltGroup.rotation.order = 'YXZ';
    this.tiltGroup.rotation.y = -((def.poleEclipticLongitude ?? 0) * Math.PI) / 180;
    this.tiltGroup.rotation.x = ((def.axialTilt ?? 0) * Math.PI) / 180;
    this.group.add(this.tiltGroup);

    this.#buildSurface(segments);
    this.#buildClouds(segments);
    this.#buildAtmosphere();
    this.#buildRings();

    /** @type {CelestialBody[]} */
    this.moons = [];
    /** @type {Group[]} sumbu orbit bulan, diputar setiap frame. */
    this.moonPivots = [];
  }

  /** @param {number} segments */
  #buildSurface(segments) {
    const def = this.def;
    const textures = def.textures ?? {};

    const geometry = createBodyGeometry(
      this.displayRadius,
      segments,
      def.oblateness ?? 1,
      def.irregular ? { amount: 0.30, seed: def.id.charCodeAt(0) } : null,
    );

    const material = createPlanetMaterial(def, {
      map: textureOr(this.assets, textures.surface, 'map'),
      normalMap: textures.normal ? textureOr(this.assets, textures.normal, 'normal') : null,
      normalScale: def.normalScale ?? 1.0,
      specularMap: textures.specular ? textureOr(this.assets, textures.specular, 'specular') : null,
      nightMap: textures.night ? textureOr(this.assets, textures.night, 'night') : null,
      warpMap: def.turbulence ? textureOr(this.assets, def.turbulence.warp, 'warp') : null,
    });

    this.surfaceMaterial = material;
    this.surfaceMesh = new Mesh(geometry, material);
    this.surfaceMesh.name = `surface:${def.id}`;
    this.surfaceMesh.userData.body = def;
    this.surfaceMesh.userData.pickable = true;
    this.tiltGroup.add(this.surfaceMesh);

    this.sunMaterials.push(material);
    this.textureSlots.map = { key: textures.surface, heroKey: textures.surfaceHero, material, uniform: 'uMap' };
    if (textures.normal) {
      this.textureSlots.normal = {
        key: textures.normal, heroKey: textures.normalHero, material, uniform: 'uNormalMap',
      };
    }
    if (textures.specular) {
      this.textureSlots.specular = {
        key: textures.specular, heroKey: textures.specularHero, material, uniform: 'uSpecularMap',
      };
    }
    if (textures.night) {
      this.textureSlots.night = {
        key: textures.night, heroKey: textures.nightHero, material, uniform: 'uNightMap',
      };
    }
  }

  #buildClouds(segments) {
    const deck = this.def.cloudDeck;
    if (!deck) return;

    const textures = this.def.textures ?? {};
    const key = textures[deck.mapKey ?? 'clouds'];
    const alphaFromMap = deck.alphaFromMap ?? true;
    const map = key
      ? textureOr(this.assets, key, alphaFromMap ? 'clouds' : 'ozone')
      : textureOr(this.assets, null, 'ozone');

    const material = createCloudMaterial(map, deck, alphaFromMap);
    this.cloudMaterial = material;
    this.cloudMesh = new Mesh(
      createBodyGeometry(this.displayRadius * (deck.scale ?? 1.012), segments, this.def.oblateness ?? 1),
      material,
    );
    this.cloudMesh.name = `clouds:${this.def.id}`;
    this.cloudMesh.renderOrder = 4;
    this.tiltGroup.add(this.cloudMesh);

    this.sunMaterials.push(material);
    if (key) {
      this.textureSlots.clouds = {
        key, heroKey: textures.cloudsHero, material, uniform: 'uMap',
      };
    }
    }

  #buildAtmosphere() {
    const shell = createAtmosphereShell(this.def, {
      layers: this.preset.atmosphereLayers,
      segments: 40,
    });
    if (!shell) return;

    this.atmosphere = shell;
    this.tiltGroup.add(shell);
    for (const child of shell.children) this.sunMaterials.push(child.material);
  }

  #buildRings() {
    if (!this.def.rings) return;
    const rings = createRingSystem(this.def, this.assets.textures);
    if (!rings) return;

    this.rings = rings;
    // Cincin berada di bidang ekuator, jadi dipasang pada kerangka kemiringan
    // sumbu — sama seperti permukaan planetnya.
    this.tiltGroup.add(rings);
    this.sunMaterials.push(rings.material);
  }

  /**
   * Pasang sebuah bulan pada planet ini.
   *
   * Bulan mengorbit pada bidang ekuator planet (seperti bulan-bulan besar
   * Jupiter, Saturnus, Uranus) atau pada bidang ekliptika (seperti Bulan Bumi).
   * Karena itu pemasangannya bisa ke kerangka kemiringan sumbu atau ke kerangka
   * orbit planet.
   *
   * @param {object} moonDef definisi bulan dari data/bodies.js
   * @param {{ mode?: 'equatorial'|'ecliptic', initialLongitude?: number }} [options]
   */
  attachMoon(moonDef, options = {}) {
    const moon = new CelestialBody(moonDef, {
      assets: this.assets,
      preset: this.preset,
    });

    const attachment = options.mode === 'ecliptic' ? this.group : this.tiltGroup;

    // Dua kerangka: bidang orbit (kemiringan tetap) lalu poros yang berputar.
    const orbitPlane = new Group();
    orbitPlane.name = `orbit-plane:${moonDef.id}`;
    orbitPlane.rotation.x = ((moonDef.inclinationDeg ?? 0) * Math.PI) / 180;

    const pivot = new Group();
    pivot.name = `orbit:pivot:${moonDef.id}`;

    const holder = new Group();
    holder.position.set(moonDef.orbit, 0, 0);
    holder.add(moon.group);

    pivot.add(holder);
    orbitPlane.add(pivot);
    attachment.add(orbitPlane);

    moon.pivot = pivot;
    moon.orbitRadius = moonDef.orbit;
    // Bulan yang terkunci pasang-surut tidak perlu berputar sendiri: ia sudah
    // ikut berputar bersama poros orbitnya, dan itulah definisi rotasi terkunci.
    moon.lockedToPivot = !!moonDef.tidallyLocked;
    moon.initialLongitude = options.initialLongitude ?? (moonDef.phaseOffset ?? 0) * Math.PI * 2;

    this.moons.push(moon);
    return moon;
  }

  /**
   * Perbarui posisi orbit, sudut putar, dan sudut orbit bulan.
   *
   * @param {import('../core/Clock.js').SimulationClock} clock
   * @param {(elements: object, centuries: number) => {x:number,y:number,z:number}} [positionOf]
   */
  updateTransform(clock, positionOf) {
    const def = this.def;

    if (this.isMoon) {
      if (this.pivot) {
        this.orbitAngle = this.initialLongitude + clock.elapsedHours * def.angularSpeed;
        this.pivot.rotation.y = this.orbitAngle;
      }
    } else if (positionOf && def.elements) {
      const position = positionOf(def.elements, clock.centuries);
      this.group.position.set(position.x, position.y, position.z);
    }

    // Sudut putar. Bumi memakai GMST supaya meredian utama benar-benar
    // mengikuti jam UTC; planet lain memakai periode rotasi siderisnya.
    if (def.useGmst) {
      // 180 derajat ditambahkan karena peta Bumi menempatkan bujur tekstur 0
      // pada sisi yang berlawanan dengan sumbu +X scene.
      this.spinAngle = (greenwichSiderealDeg(clock.julian) * Math.PI) / 180 + Math.PI;
    } else if (def.rotationHours) {
      this.spinAngle = (Math.PI * 2 * clock.elapsedHours) / def.rotationHours;
    }
    const surfaceSpin = this.lockedToPivot ? 0 : this.spinAngle;
    this.surfaceMesh.rotation.y = surfaceSpin;
    if (this.cloudMesh) {
      const deck = def.cloudDeck;
      this.cloudMesh.rotation.y = deck?.rotationHours
        ? (Math.PI * 2 * clock.elapsedHours) / deck.rotationHours
        : surfaceSpin * 1.08;
    }
    if (def.turbulence) {
      const material = this.surfaceMaterial;
      if (material.uniforms.uWarpTime) {
        material.uniforms.uWarpTime.value = clock.elapsedHours * def.turbulence.speed;
      }
    }
  }

  /**
   * Arahkan seluruh material ke Matahari.
   *
   * Arah dihitung dari posisi benda ke posisi Matahari, bukan disamakan untuk
   * seluruh sistem. Perbedaannya kecil, tetapi inilah yang membuat fase planet
   * mengikuti geometri sebenarnya.
   *
   * @param {import('three').Vector3} sunPosition posisi Matahari di scene
   */
  updateSunLighting(sunPosition) {
    this.group.getWorldPosition(TMP_POSITION);
    TMP_DIRECTION.copy(sunPosition).sub(TMP_POSITION);
    const distance = TMP_DIRECTION.length();
    if (distance > 1e-6) TMP_DIRECTION.divideScalar(distance);

    for (const material of this.sunMaterials) {
      const direction = material.uniforms.uSunDirection;
      if (direction) direction.value.copy(TMP_DIRECTION);
    }

    // Bayangan cincin pada permukaan planet hanya untuk benda yang punya cincin.
    if (this.rings) {
      const surface = this.surfaceMaterial;
      if (surface.uniforms.uRingCenter) {
        this.tiltGroup.getWorldQuaternion(TMP_QUATERNION);
        TMP_NORMAL.set(0, 1, 0).applyQuaternion(TMP_QUATERNION).normalize();
        surface.uniforms.uRingCenter.value.copy(TMP_POSITION);
        surface.uniforms.uRingNormal.value.copy(TMP_NORMAL);
      }
      const ringMaterial = this.rings.material;
      ringMaterial.uniforms.uPlanetCenter.value.copy(TMP_POSITION);
      ringMaterial.uniforms.uPlanetRadius.value = this.displayRadius;
    }
  }

  /** Titik pusat benda di koordinat dunia. */
  getWorldPosition(target) {
    return this.group.getWorldPosition(target);
  }

  /**
   * Naikkan tekstur ke versi resolusi tinggi (8K) untuk satu slot.
   * @param {'map'|'normal'|'specular'|'night'|'clouds'} slot
   * @param {Map<string, import('three').Texture>} loaded
   */
  upgradeTexture(slot, loaded) {
    const entry = this.textureSlots[slot];
    if (!entry?.heroKey) return false;
    const texture = loaded.get(entry.heroKey);
    if (!texture || entry.heroApplied) return false;

    entry.material.uniforms[entry.uniform].value = texture;
    entry.heroApplied = true;
    return true;
  }

  /** Nama berkas tekstur hero yang belum diterapkan (untuk pemuatan bertahap). */
  pendingHeroTextures() {
    return Object.values(this.textureSlots)
      .filter((entry) => entry.heroKey && !entry.heroApplied)
      .map((entry) => entry.heroKey);
  }

  /** Semua berkas tekstur yang dipakai benda ini pada resolusi dasar. */
  baseTextureKeys() {
    return Object.values(this.textureSlots).map((entry) => entry.key).filter(Boolean);
  }
}

// Titik bantu tingkat modul: menghindari alokasi baru setiap frame.
// Dideklarasikan setelah kelas — aman karena modul dievaluasi seluruhnya
// sebelum metode apa pun dipanggil.
const TMP_POSITION = new Vector3();
const TMP_DIRECTION = new Vector3();
const TMP_NORMAL = new Vector3();
const TMP_QUATERNION = new Quaternion();
