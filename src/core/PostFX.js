/**
 * PostFX.js — rangkaian pasca-proses.
 *
 * Composer bawaan three sudah memakai render target half-float, sehingga
 * shader boleh menulis nilai di atas 1,0 (HDR). Inilah yang membuat Matahari
 * benar-benar "menyala" lewat UnrealBloomPass, bukan sekadar berwarna kuning
 * terang.
 *
 * Tone mapping dan konversi ruang warna dikerjakan OutputPass, karena
 * material kustom hanya mengeluarkan warna linear.
 */
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { Vector2 } from 'three';

export class PostFX {
  /**
   * @param {import('three').WebGLRenderer} renderer
   * @param {import('three').Scene} scene
   * @param {import('three').PerspectiveCamera} camera
   * @param {{ bloom?: boolean, strength?: number, radius?: number, threshold?: number }} [options]
   */
  constructor(renderer, scene, camera, options = {}) {
    this.renderer = renderer;
    this.composer = new EffectComposer(renderer);
    this.renderPass = new RenderPass(scene, camera);
    this.composer.addPass(this.renderPass);

    this.bloomPass = new UnrealBloomPass(
      new Vector2(window.innerWidth, window.innerHeight),
      options.strength ?? 0.62,
      options.radius ?? 0.45,
      options.threshold ?? 0.72,
    );
    this.composer.addPass(this.bloomPass);

    this.outputPass = new OutputPass();
    this.composer.addPass(this.outputPass);

    this.setBloomEnabled(options.bloom ?? true);
    this.setSize(window.innerWidth, window.innerHeight);
  }

  setBloomEnabled(enabled) {
    this.bloomPass.enabled = enabled;
  }

  get bloomEnabled() {
    return this.bloomPass.enabled;
  }

  /** Intensitas bloom; 0 mematikan efeknya tanpa membongkar rangkaian. */
  setBloomStrength(strength) {
    this.bloomPass.strength = strength;
  }

  setSize(width, height) {
    this.composer.setSize(width, height);
    this.bloomPass.setSize(width, height);
  }

  render(delta) {
    this.composer.render(delta);
  }

  dispose() {
    this.composer.dispose?.();
    this.bloomPass.dispose?.();
  }
}
