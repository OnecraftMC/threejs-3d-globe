/**
 * SolarSystem.js — perakit seluruh tata surya dan pengelola pembaruannya.
 *
 * Tanggung jawab:
 *   1. Memuat tekstur dalam dua tahap: berkas yang diperlukan globe Bumi lebih
 *      dulu, sisanya menyusul di latar belakang.
 *   2. Merakit benda langit: Matahari, delapan planet, lima belas bulan, sabuk
 *      asteroid, sabuk Kuiper, dan garis orbit.
 *   3. Memperbarui setiap frame: posisi orbit dari elemen Kepler, rotasi,
 *      arah cahaya Matahari, dan penyesuaian sabuk asteroid.
 *   4. Menaikkan tekstur Bumi/Bulan/Matahari ke versi 8K ketika kamera benar-
 *      benar mendekat, dan hanya pada perangkat yang sanggup.
 */
import { Group, Vector3 } from 'three';
import { ASTEROID_BELT, KUIPER_BELT, PLANETS, SUN, TEX } from '../data/bodies.js';
import { displayDistance } from '../config/scale.js';
import { julianDay, scenePosition } from '../data/kepler.js';
import { MOON_ELEMENTS } from '../data/elements.js';
import { AsteroidBelt, KuiperBelt } from './AsteroidBelt.js';
import { CelestialBody } from './Body.js';
import { OrbitLines } from './OrbitLines.js';
import { Starfield } from './Starfield.js';
import { Sun } from './Sun.js';

/**
 * Tekstur yang harus siap sebelum apa pun digambar: yang diperlukan globe Bumi,
 * latar langit, dan bahan prosedural yang wajib ada saat benda dibuat.
 */
const PHASE_ONE = [
  TEX.sun2k,
  TEX.milkyway,
  TEX.earthDay2k,
  TEX.earthNight2k,
  TEX.earthClouds2k,
  TEX.earthNormal2k,
  TEX.earthSpecular2k,
  TEX.moon2k,
  TEX.moonNormal2k,
  TEX.saturnRing,
  TEX.noiseFbm,
  TEX.noiseWarp,
];

/** Sisanya dimuat di latar belakang setelah globe Bumi muncul. */
const PHASE_TWO = [
  TEX.mercury,
  TEX.mercuryNormal,
  TEX.venusSurface,
  TEX.venusNormal,
  TEX.venusAtmosphere,
  TEX.mars,
  TEX.jupiter,
  TEX.saturn,
  TEX.uranus,
  TEX.neptune,
];

/** Benda langit yang teksturnya boleh naik ke 8K saat didekati. */
const HERO_BODIES = ['earth', 'moon', 'sun'];

/**
 * Rasio jarak kamera terhadap radius benda: di bawah nilai ini, tekstur
 * resolusi tinggi mulai dimuat.
 */
const HERO_DISTANCE_RATIO = 16;

export class SolarSystem {
  /** Titik bantu agar tidak ada alokasi baru tiap frame. */
  #sunPosition = new Vector3();
  #heroState = new Map();

  /**
   * @param {{ assets: import('../core/Assets.js').Assets, preset: object, scene: import('three').Scene, startDate: Date }} context
   */
  constructor(context) {
    this.assets = context.assets;
    this.preset = context.preset;
    this.scene = context.scene;
    this.startDate = context.startDate ?? new Date();

    this.root = new Group();
    this.root.name = 'solar-system';
    this.scene.add(this.root);

    /** @type {Map<string, Sun|CelestialBody>} */
    this.bodies = new Map();
    /** @type {import('three').Mesh[]} */
    this.pickables = [];
    this.belt = null;
    this.kuiper = null;
    this.orbitLines = null;
    this.starfield = null;

    this.ready = false;
    this.phaseTwoLoaded = false;

    this.#positionOf = (elements, centuries) =>
      scenePosition(elements, centuries, displayDistance, this.#probe);
  }

  #probe = { x: 0, y: 0, z: 0 };
  #positionOf;

  /**
   * Muat tekstur tahap pertama lalu rakit scene. Tahap kedua berjalan di latar
   * belakang tanpa menghambat tampilan.
   * @param {(progress: { loaded: number, total: number }) => void} [onProgress]
   */
  async init(onProgress) {
    const moonTextures = [];
    for (const planet of PLANETS) {
      for (const moon of planet.moons ?? []) {
        if (moon.textures?.surface) moonTextures.push(moon.textures.surface);
        if (moon.textures?.normal) moonTextures.push(moon.textures.normal);
      }
    }

    await this.assets.load([...PHASE_ONE, ...moonTextures]);
    this.#build();
    this.#applyBaseTextures();
    this.ready = true;
    onProgress?.({ loaded: 1, total: 1 });

    // Tahap kedua: tidak ditunggu. Planet-planet lain akan "menyala" saat
    // teksturnya selesai diunduh.
    this.loadRemaining().catch((error) => {
      console.warn('[hermes] pemuatan tahap dua gagal sebagian:', error?.message ?? error);
    });
  }

  /** Muat sisa tekstur lalu pasang ke benda langit yang bersangkutan. */
  async loadRemaining() {
    await this.assets.load(PHASE_TWO);
    this.#applyBaseTextures();
    this.phaseTwoLoaded = true;
  }

  /** Bangun seluruh benda langit, sabuk, dan garis orbit. */
  #build() {
    this.starfield = new Starfield(this.assets.get(TEX.milkyway), {
      starCount: this.preset.starCount,
      starBrightness: 1.0,
    });
    this.root.add(this.starfield.group);

    this.sun = new Sun(this.assets, this.preset, SUN);
    this.root.add(this.sun.group);
    this.bodies.set(SUN.id, this.sun);
    this.pickables.push(this.sun.surfaceMesh);

    for (const def of PLANETS) {
      const body = new CelestialBody(def, { assets: this.assets, preset: this.preset });
      this.root.add(body.group);
      this.bodies.set(def.id, body);
      this.pickables.push(body.surfaceMesh);

      for (const moonDef of def.moons ?? []) {
        // Bulan Bumi mengorbit mendekati bidang ekliptika; bulan-bulan besar
        // planet raksasa mengorbit pada bidang ekuator planetnya.
        const mode = def.id === 'earth' ? 'ecliptic' : 'equatorial';
        const moon = body.attachMoon(moonDef, {
          mode,
          initialLongitude: def.id === 'earth' ? this.#initialMoonLongitude() : undefined,
        });
        this.bodies.set(moonDef.id, moon);
        this.pickables.push(moon.surfaceMesh);
      }
    }

    this.orbitLines = new OrbitLines(PLANETS);
    this.root.add(this.orbitLines.group);

    this.belt = new AsteroidBelt(ASTEROID_BELT, this.preset);
    this.root.add(this.belt.mesh);

    this.kuiper = new KuiperBelt(KUIPER_BELT, this.preset);
    this.kuiper.setVisible(false);
    this.root.add(this.kuiper.points);
  }

  /**
   * Bujur ekliptika Bulan pada tanggal awal, dihitung dari elemen orbitnya.
   * Dengan begitu fase Bulan saat halaman dibuka mendekati kenyataan.
   */
  #initialMoonLongitude() {
    const days = julianDay(this.startDate) - 2451545.0;
    const longitudeDeg =
      MOON_ELEMENTS.meanLongitudeJ2000 + MOON_ELEMENTS.meanLongitudeRatePerDay * days;
    return (longitudeDeg * Math.PI) / 180;
  }

  /** Pasang tekstur yang sudah dimuat ke seluruh slot material. */
  #applyBaseTextures() {
    for (const body of this.bodies.values()) {
      for (const entry of Object.values(body.textureSlots)) {
        if (!entry.key) continue;
        const texture = this.assets.get(entry.key);
        if (texture) entry.material.uniforms[entry.uniform].value = texture;
      }
    }
  }

  /**
   * Perbarui seluruh scene.
   *
   * @param {number} delta detik nyata sejak frame sebelumnya
   * @param {import('../core/Clock.js').SimulationClock} clock
   * @param {import('three').PerspectiveCamera} camera
   * @param {number} zoom tingkat zoom kamera 0..1
   */
  update(delta, clock, camera, zoom) {
    // 1. Posisi orbit dan rotasi setiap benda.
    for (const body of this.bodies.values()) {
      if (body === this.sun) continue;
      body.updateTransform(clock, this.#positionOf);
    }
    this.sun.update(clock);

    // 2. Arah cahaya Matahari. Dihitung dari posisi benda ke posisi Matahari,
    //    sehingga fase tiap planet mengikuti geometri sebenarnya.
    this.sun.group.getWorldPosition(this.#sunPosition);
    for (const body of this.bodies.values()) {
      body.updateSunLighting(this.#sunPosition);
    }

    // 3. Sabuk asteroid: hanya dihitung ketika memang terlihat, dan tidak
    //    setiap frame — beberapa ribu matriks instanced tidak perlu diperbarui
    //    selama planetnya belum sampai.
    const beltVisible = zoom > 0.26;
    this.belt.setVisible(beltVisible);
    if (beltVisible) {
      this.#beltFrame = (this.#beltFrame + 1) % 4;
      if (this.#beltFrame === 0) this.belt.update(clock.elapsedHours);
    }

    const kuiperVisible = zoom > 0.74;
    this.kuiper.setVisible(kuiperVisible);
    if (kuiperVisible) this.kuiper.update(clock.elapsedHours);

    // 4. Latar langit berkedip sangat lambat.
    this.starfield.update(clock.elapsedSeconds, this.pixelRatio ?? 1);

    // 5. Naikkan tekstur ke resolusi tinggi bila kamera mendekat.
    this.#maybeUpgradeHeroTextures(camera, zoom);

    void delta;
  }

  #beltFrame = 0;
  #heroPosition = new Vector3();

  /**
   * Muat tekstur 8K untuk benda yang sedang dilihat dari dekat.
   *
   * Ini alasan memori GPU tetap aman meski berkas 8K disertakan: tiga tekstur
   * 8K RGBA sekaligus berarti sekitar setengah gigabyte VRAM, jadi tekstur itu
   * baru diambil ketika kamera benar-benar berada dekat benda tersebut.
   */
  #maybeUpgradeHeroTextures(camera, zoom) {
    if (!this.preset.heroTextures || zoom > 0.3) return;

    for (const id of HERO_BODIES) {
      const body = this.bodies.get(id);
      if (!body) continue;

      const state = this.#heroState.get(id);
      if (state?.requested || state?.failed) continue;

      body.getWorldPosition(this.#heroPosition);
      const distance = camera.position.distanceTo(this.#heroPosition);
      if (distance / body.displayRadius > HERO_DISTANCE_RATIO) continue;

      const keys = body.pendingHeroTextures();
      if (keys.length === 0) continue;

      this.#heroState.set(id, { requested: true });
      this.assets
        .load(keys)
        .then(() => {
          for (const slot of Object.keys(body.textureSlots)) {
            body.upgradeTexture(slot, this.assets.textures);
          }
          this.#heroState.set(id, { requested: true, applied: true });
        })
        .catch(() => {
          // Gagal memuat 8K bukan masalah: versi 2K sudah tampil.
          this.#heroState.set(id, { requested: true, failed: true });
        });
    }
  }

  /** @param {string} id */
  getBody(id) {
    return this.bodies.get(id) ?? null;
  }

  /** Daftar semua benda langit yang bisa dipilih pengguna. */
  getFocusableBodies() {
    return [...this.bodies.values()];
  }

  setOrbitsVisible(visible) {
    this.orbitLines?.setVisible(visible);
  }

  setBeltsVisible(visible) {
    if (this.belt) this.belt.setVisible(visible);
    if (this.kuiper) this.kuiper.setVisible(visible && (this.lastZoom ?? 1) > 0.74);
    this.beltsEnabled = visible;
  }

  setPixelRatio(ratio) {
    this.pixelRatio = ratio;
  }

  dispose() {
    this.starfield?.dispose();
    this.orbitLines?.dispose();
    this.belt?.dispose();
    this.kuiper?.dispose();
    this.scene.remove(this.root);
  }
}
