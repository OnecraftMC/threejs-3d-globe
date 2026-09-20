/**
 * Sun.js — Matahari: permukaan yang mendidih, korona, dan titik nol tata surya.
 *
 * Matahari berada di titik asal scene. Karena seluruh pencahayaan planet
 * dihitung dari arah ke posisi ini, Matahari otomatis menjadi satu-satunya
 * sumber cahaya di sistem — sekaligus alasan planet-planet punya fase.
 */
import { DataTexture, Group, Mesh, PointLight, RGBAFormat, SphereGeometry } from 'three';
import { createSunCoronaMaterial, createSunSurfaceMaterial } from '../shaders/sun.js';
import { createBodyGeometry } from './Body.js';

export class Sun {
  /**
   * @param {import('../core/Assets.js').Assets} assets
   * @param {object} preset preset kualitas
   * @param {object} def definisi dari data/bodies.js (SUN)
   */
  constructor(assets, preset, def) {
    this.def = def;
    this.id = def.id;
    this.name = def.name;
    this.kind = 'star';
    this.displayRadius = def.displayRadius;
    this.isMoon = false;

    this.group = new Group();
    this.group.name = 'body:sun';

    const segments = preset.sphereSegments.sun;
    const surfaceMap = assets.get(def.textures.surface);

    this.surfaceMaterial = createSunSurfaceMaterial(surfaceMap ?? dummyTexture());
    this.surfaceMesh = new Mesh(
      createBodyGeometry(this.displayRadius, segments, 1, null),
      this.surfaceMaterial,
    );
    this.surfaceMesh.name = 'surface:sun';
    this.surfaceMesh.userData.body = def;
    this.surfaceMesh.userData.pickable = true;
    this.group.add(this.surfaceMesh);

    // Korona: cangkang aditif sedikit lebih besar dari piringan. Bersama bloom
    // pasca-proses, inilah yang membuat Matahari tampak bersinar, bukan seperti
    // bola kuning dengan tepi terpotong.
    this.coronaMaterial = createSunCoronaMaterial();
    this.coronaMesh = new Mesh(
      new SphereGeometry(this.displayRadius * (def.coronaScale ?? 1.22), 48, 32),
      this.coronaMaterial,
    );
    this.coronaMesh.name = 'corona:sun';
    this.coronaMesh.renderOrder = 1;
    this.group.add(this.coronaMesh);

    // Lampu titik disediakan untuk keperluan apa pun yang memakai material
    // bawaan three (mis. batuan sabuk asteroid bila kelak diganti).
    this.light = new PointLight(0xfff0d0, 6, 0, 0);
    this.group.add(this.light);

    this.spinAngle = 0;
    this.textureSlots = {
      map: {
        key: def.textures.surface,
        heroKey: def.textures.surfaceHero,
        material: this.surfaceMaterial,
        uniform: 'uMap',
      },
    };
  }

  /** @param {import('../core/Clock.js').SimulationClock} clock */
  update(clock) {
    this.surfaceMaterial.uniforms.uTime.value = clock.elapsedSeconds;
    this.coronaMaterial.uniforms.uTime.value = clock.elapsedSeconds;

    if (this.def.rotationHours) {
      this.spinAngle = (Math.PI * 2 * clock.elapsedHours) / this.def.rotationHours;
      this.surfaceMesh.rotation.y = this.spinAngle;
    }
    // Korona ikut berputar sangat lambat supaya tidak terlihat seperti
    // cangkang yang membeku.
    this.coronaMesh.rotation.y = this.spinAngle * 0.25;
  }

  getWorldPosition(target) {
    return this.group.getWorldPosition(target);
  }

  /** Naikkan tekstur permukaan ke versi 8K bila sudah tersedia. */
  upgradeTexture(slot, loaded) {
    const entry = this.textureSlots[slot];
    if (!entry?.heroKey || entry.heroApplied) return false;
    const texture = loaded.get(entry.heroKey);
    if (!texture) return false;
    entry.material.uniforms[entry.uniform].value = texture;
    entry.heroApplied = true;
    return true;
  }

  pendingHeroTextures() {
    return Object.values(this.textureSlots)
      .filter((entry) => entry.heroKey && !entry.heroApplied)
      .map((entry) => entry.heroKey);
  }

  baseTextureKeys() {
    return Object.values(this.textureSlots).map((entry) => entry.key).filter(Boolean);
  }

  /** Matahari tidak butuh uniform arah Matahari; disediakan agar seragam. */
  updateSunLighting() {}
}

/** Tekstur 1x1 putih bila berkas permukaan Matahari gagal dimuat. */
function dummyTexture() {
  const texture = new DataTexture(new Uint8Array([255, 240, 214, 255]), 1, 1, RGBAFormat);
  texture.needsUpdate = true;
  texture.generateMipmaps = false;
  return texture;
}
