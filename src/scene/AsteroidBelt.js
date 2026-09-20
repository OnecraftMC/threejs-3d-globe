/**
 * AsteroidBelt.js — sabuk asteroid utama dan sabuk Kuiper.
 *
 * Sabuk asteroid dibangun sebagai InstancedMesh: ribuan batuan dengan satu
 * panggilan gambar. Setiap batuan punya radius, sudut awal, dan kecepatan sudut
 * sendiri yang mengikuti hukum Kepler ketiga (semakin jauh semakin lambat),
 * sehingga sabuk mengalir secara alami dan bukan seperti satu cakram kaku.
 *
 * Batuan hanya terlihat saat kamera jauh, jadi posisinya tidak dihitung ulang
 * setiap frame — pembaruan dilakukan berkala untuk menghemat CPU.
 */
import {
  BufferGeometry,
  DynamicDrawUsage,
  Euler,
  Float32BufferAttribute,
  IcosahedronGeometry,
  InstancedMesh,
  Matrix4,
  MeshBasicMaterial,
  Points,
  PointsMaterial,
  Quaternion,
  Vector3,
} from 'three';

/** RNG deterministik supaya susunan batuan sama pada setiap pemuatan. */
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Batuan tidak beraturan: ikosahedron tingkat 0 yang sudutnya diganggu. */
export function createRockGeometry(seed) {
  const geometry = new IcosahedronGeometry(1, 0);
  const position = geometry.attributes.position;
  const random = mulberry32(seed);
  const vertex = new Vector3();

  for (let i = 0; i < position.count; i++) {
    vertex.fromBufferAttribute(position, i);
    const scale = 0.62 + random() * 0.72;
    position.setXYZ(i, vertex.x * scale, vertex.y * scale * 0.86, vertex.z * scale);
  }
  position.needsUpdate = true;
  geometry.computeVertexNormals();
  return geometry;
}

export class AsteroidBelt {
  /**
   * @param {{ inner:number, outer:number, count:number, thickness:number, color:number, seed:number }} config
   * @param {object} preset preset kualitas (menentukan jumlah batuan)
   */
  constructor(config, preset) {
    this.config = config;
    this.count = Math.min(config.count, preset.asteroids);

    this.radii = new Float32Array(this.count);
    this.initialAngles = new Float32Array(this.count);
    this.angularSpeeds = new Float32Array(this.count);
    this.heights = new Float32Array(this.count);
    /** @type {Quaternion[]} */
    this.tumbles = [];
    this.scales = new Float32Array(this.count * 3);

    const material = new MeshBasicMaterial({
      color: config.color,
      transparent: true,
      opacity: 0.92,
      // Batuan hanya beberapa piksel; pencahayaan per-batuan jauh lebih mahal
      // daripada manfaat visualnya.
      fog: false,
    });

    this.mesh = new InstancedMesh(createRockGeometry(config.seed), material, this.count);
    this.mesh.name = 'asteroid-belt';
    this.mesh.frustumCulled = false;
    this.mesh.instanceMatrix.setUsage(DynamicDrawUsage);

    this.#seedInstances();
    this.update(0);
  }

  #seedInstances() {
    const { inner, outer, thickness } = this.config;
    const random = mulberry32(this.config.seed + 1);

    for (let i = 0; i < this.count; i++) {
      // Sebaran condong ke dalam, dengan celah Kirkwood samar di tengah —
      // pola yang sama dengan sabuk asteroid sesungguhnya.
      let t = Math.pow(random(), 1.35);
      if (random() < 0.2) t = Math.min(1, t + 0.22); // rumpun kecil

      const aAu = 2.06 + t * (3.28 - 2.06);
      this.radii[i] = Math.min(outer, Math.max(inner, this.#radiusFor(aAu)));
      this.initialAngles[i] = random() * Math.PI * 2;

      // Hukum Kepler ketiga: periode sebanding a^1,5.
      const periodHours = Math.pow(aAu, 1.5) * 365.25 * 24;
      this.angularSpeeds[i] = (Math.PI * 2) / periodHours;

      // Sebaran tinggi menyerupai distribusi normal (tiga sampel dirata-ratakan).
      this.heights[i] = (random() + random() + random() - 1.5) * 0.85 * thickness;

      this.tumbles.push(
        new Quaternion().setFromEuler(new Euler(random() * 6.28, random() * 6.28, random() * 6.28)),
      );

      const size = 0.045 + Math.pow(random(), 2.6) * 0.26;
      this.scales[i * 3 + 0] = size;
      this.scales[i * 3 + 1] = size;
      this.scales[i * 3 + 2] = size;
    }
  }

  /** Jarak tampilan untuk sebuah sumbu semi-mayor (AU). */
  #radiusFor(aAu) {
    const { inner, outer } = this.config;
    // Kurva yang sama dengan planet, dinormalkan ke rentang sabuk.
    const t = (aAu - 2.06) / (3.28 - 2.06);
    return inner + (outer - inner) * t;
  }

  /**
   * Hitung ulang matriks seluruh batuan.
   * @param {number} elapsedHours jam simulasi
   */
  update(elapsedHours) {
    const matrix = new Matrix4();
    const quaternion = new Quaternion();
    const position = new Vector3();
    const scale = new Vector3();
    const axis = new Vector3(0, 1, 0);
    const spin = new Quaternion();

    for (let i = 0; i < this.count; i++) {
      const angle = this.initialAngles[i] + elapsedHours * this.angularSpeeds[i];
      position.set(
        Math.cos(angle) * this.radii[i],
        this.heights[i],
        Math.sin(angle) * this.radii[i],
      );
      spin.setFromAxisAngle(axis, angle * 0.6);
      quaternion.copy(spin).multiply(this.tumbles[i]);
      scale.set(this.scales[i * 3], this.scales[i * 3 + 1], this.scales[i * 3 + 2]);
      matrix.compose(position, quaternion, scale);
      this.mesh.setMatrixAt(i, matrix);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  setVisible(visible) {
    this.mesh.visible = visible;
  }

  dispose() {
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
    this.mesh.dispose();
  }
}

/**
 * Sabuk Kuiper di luar Neptunus: terlalu banyak dan terlalu kecil untuk
 * digambar sebagai batuan, jadi cukup berupa titik-titik cahaya samar.
 */
export class KuiperBelt {
  constructor(config, preset) {
    this.count = Math.min(config.count, preset.kuiper);
    const random = mulberry32(config.seed);

    const positions = new Float32Array(this.count * 3);
    for (let i = 0; i < this.count; i++) {
      const angle = random() * Math.PI * 2;
      const t = Math.pow(random(), 0.85);
      const radius = config.inner + (config.outer - config.inner) * t;
      positions[i * 3 + 0] = Math.cos(angle) * radius;
      positions[i * 3 + 1] = (random() + random() - 1) * config.thickness;
      positions[i * 3 + 2] = Math.sin(angle) * radius;
    }

    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));

    this.points = new Points(
      geometry,
      new PointsMaterial({
        color: config.color,
        size: 0.55,
        sizeAttenuation: true,
        transparent: true,
        opacity: 0.42,
        depthWrite: false,
      }),
    );
    this.points.name = 'kuiper-belt';
    this.points.frustumCulled = false;
  }

  /** Berputar lambat sebagai satu kesatuan — gerak diferensial tak terlihat. */
  update(elapsedHours) {
    this.points.rotation.y = elapsedHours * 0.000015;
  }

  setVisible(visible) {
    this.points.visible = visible;
  }

  dispose() {
    this.points.geometry.dispose();
    this.points.material.dispose();
  }
}
