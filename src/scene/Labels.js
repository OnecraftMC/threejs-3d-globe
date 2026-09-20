/**
 * Labels.js — label nama benda langit sebagai elemen DOM.
 *
 * Menuliskan teks di kanvas WebGL sulit dibaca dan mahal; jauh lebih tajam dan
 * murah memakai elemen HTML yang diposisikan mengikuti hasil proyeksi 3D ke 2D.
 *
 * Label muncul hanya ketika kamera sudah cukup jauh, supaya pemandangan globe
 * Bumi close-up tidak dipenuhi coretan. Perpindahannya mengikuti tepi atas
 * piringan benda, jadi label tidak menimpa planetnya.
 */
import { Vector3 } from 'three';

export class Labels {
  #projected = new Vector3();

  /**
   * @param {HTMLElement} container
   * @param {Array<{ id: string, name: { id: string, en: string }, body: object, kind: string }>} entries
   * @param {{ language?: string }} [options]
   */
  constructor(container, entries, options = {}) {
    this.container = container;
    this.entries = [];
    this.enabled = true;
    this.language = options.language ?? 'id';

    for (const entry of entries) {
      const element = document.createElement('button');
      element.type = 'button';
      element.className = `label label--${entry.kind}`;
      element.dataset.bodyId = entry.id;
      element.textContent = entry.name[this.language] ?? entry.name.id;
      const dot = `#${(entry.body.color ?? 0x8a94ad).toString(16).padStart(6, '0')}`;
      element.style.setProperty('--label-color', dot);
      container.appendChild(element);

      this.entries.push({ ...entry, element, visible: false });
    }
  }


  setLanguage(language) {
    this.language = language;
    for (const entry of this.entries) {
      entry.element.textContent = entry.name[language] ?? entry.name.id;
    }
  }

  setEnabled(enabled) {
    this.enabled = enabled;
    if (!enabled) {
      for (const entry of this.entries) entry.element.classList.remove('is-visible');
    }
  }

  /**
   * @param {import('three').PerspectiveCamera} camera
   * @param {{ zoom: number, focusId?: string }} state
   */
  update(camera, state) {
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;
    const halfHeight = height / 2;
    const tanHalfFov = Math.tan((camera.fov * Math.PI) / 360);

    // Label mulai muncul setelah kamera meninggalkan permukaan planet, lalu
    // menjadi jelas ketika seluruh tata surya terlihat.
    const globalFade = Math.min(1, Math.max(0, (state.zoom - 0.16) / 0.22));

    for (const entry of this.entries) {
      if (!this.enabled || globalFade <= 0.01) {
        if (entry.visible) {
          entry.element.classList.remove('is-visible');
          entry.visible = false;
        }
        continue;
      }

      entry.body.getWorldPosition(this.#projected);
      const distance = this.#projected.distanceTo(camera.position);
      this.#projected.project(camera);

      // Di belakang kamera, atau terlalu jauh untuk berarti.
      if (this.#projected.z > 1 || distance > 4000) {
        if (entry.visible) {
          entry.element.classList.remove('is-visible');
          entry.visible = false;
        }
        continue;
      }

      const x = (this.#projected.x * 0.5 + 0.5) * width;
      const y = (-this.#projected.y * 0.5 + 0.5) * height;

      // Jarak label dari titik pusat benda, mengikuti radius tampilan planetnya.
      const angularRadius = entry.body.displayRadius / Math.max(distance, 1e-3);
      const pixelRadius = (angularRadius / tanHalfFov) * halfHeight;

      const offset = Math.min(pixelRadius + 14, halfHeight * 0.6);
      const isFocused = state.focusId === entry.id;

      entry.element.style.transform = `translate3d(${x.toFixed(1)}px, ${(y - offset).toFixed(1)}px, 0) translate(-50%, -100%)`;
      entry.element.style.opacity = String(
        (globalFade * (isFocused ? 1 : 0.78) * (pixelRadius > halfHeight * 0.9 ? 0.35 : 1)).toFixed(3),
      );
      entry.element.style.pointerEvents = globalFade > 0.5 ? 'auto' : 'none';

      if (!entry.visible) {
        entry.element.classList.add('is-visible');
        entry.visible = true;
      }
    }
  }

  dispose() {
    for (const entry of this.entries) entry.element.remove();
    this.entries = [];
  }
}
