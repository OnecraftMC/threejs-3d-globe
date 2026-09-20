/**
 * OrbitLines.js — garis orbit planet.
 *
 * Jalur digambar dengan menyampel elemen orbit sesungguhnya, bukan lingkaran
 * sederhana: jadi eksentrisitas Merkurius (0,206) dan kemiringan bidangnya ikut
 * terlihat. Radius tiap titik kemudian dipetakan lewat kurva kompresi yang sama
 * dengan posisi planet, sehingga garis orbit selalu melewati planetnya.
 */
import { BufferGeometry, Group, Line, LineBasicMaterial, Vector3 } from 'three';
import { eclipticToScene, heliocentric } from '../data/kepler.js';
import { displayDistance } from '../config/scale.js';

/**
 * Sampel jalur orbit dalam koordinat scene.
 * @param {object} elements elemen orbit planet
 * @param {number} samples jumlah titik
 */
export function sampleOrbit(elements, samples = 360) {
  const points = [];
  const target = displayDistance(elements.a);

  for (let i = 0; i <= samples; i++) {
    const meanAnomalyDeg = (i / samples) * 360;

    // Elemen tiruan: laju dihilangkan, dan bujur rata-rata digeser sehingga
    // anomali rata-ratanya berjalan dari 0 sampai 360 derajat.
    const probe = {
      a: elements.a,
      e: elements.e,
      I: elements.I,
      L: elements.peri + meanAnomalyDeg,
      peri: elements.peri,
      node: elements.node,
    };

    const h = heliocentric(probe, 0);
    const scale = h.r > 0 ? target / h.r : 0;
    const scene = eclipticToScene(h.x * scale, h.y * scale, h.z * scale);
    points.push(new Vector3(scene.x, scene.y, scene.z));
  }

  return points;
}

export class OrbitLines {
  /** @param {object[]} planets daftar planet dari data/bodies.js */
  constructor(planets, options = {}) {
    this.group = new Group();
    this.group.name = 'orbit-lines';

    for (const planet of planets) {
      const geometry = new BufferGeometry().setFromPoints(
        sampleOrbit(planet.elements, options.samples ?? 320),
      );
      const material = new LineBasicMaterial({
        color: planet.color,
        transparent: true,
        opacity: options.opacity ?? 0.26,
        depthWrite: false,
      });
      const line = new Line(geometry, material);
      line.name = `orbit:${planet.id}`;
      line.renderOrder = -1;
      this.group.add(line);
    }
  }

  setVisible(visible) {
    this.group.visible = visible;
  }

  setOpacity(opacity) {
    for (const line of this.group.children) {
      line.material.opacity = opacity;
    }
  }

  dispose() {
    for (const line of this.group.children) {
      line.geometry.dispose();
      line.material.dispose();
    }
  }
}
