/**
 * Renderer.js — penyiapan WebGL dan pengelolaan ukuran kanvas.
 */
import {
  ACESFilmicToneMapping,
  PCFSoftShadowMap,
  SRGBColorSpace,
  WebGLRenderer,
} from 'three';
import { QUALITY_PRESETS } from '../config/quality.js';

/**
 * @param {HTMLCanvasElement} canvas
 * @param {object} [options]
 */
export function createRenderer(canvas, options = {}) {
  const renderer = new WebGLRenderer({
    canvas,
    antialias: options.antialias ?? true,
    alpha: false,
    stencil: false,
    powerPreference: 'high-performance',
    // Membantu beberapa driver saat konteks hilang dan perlu dipulihkan.
    failIfMajorPerformanceCaveat: false,
  });

  renderer.debug.checkShaderErrors = true;
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = options.exposure ?? 1.0;
  renderer.shadowMap.enabled = false;
  renderer.shadowMap.type = PCFSoftShadowMap;
  renderer.setClearColor(0x000000, 1);

  return renderer;
}

/**
 * Terapkan pengaturan yang bergantung pada tingkat kualitas.
 * @param {WebGLRenderer} renderer
 * @param {'low'|'medium'|'high'} level
 */
export function applyRendererQuality(renderer, level) {
  const preset = QUALITY_PRESETS[level] ?? QUALITY_PRESETS.medium;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, preset.pixelRatio));
  renderer.shadowMap.enabled = preset.shadows;
  return preset;
}

/**
 * Jaga agar kanvas selalu mengikuti ukuran jendela.
 * Mengembalikan fungsi pembersih untuk event listener.
 */
export function handleResize(renderer, camera, onResize) {
  const resize = () => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    renderer.setSize(width, height, false);
    camera.aspect = width / Math.max(height, 1);
    camera.updateProjectionMatrix();
    onResize?.(width, height);
  };
  resize();
  window.addEventListener('resize', resize);
  return () => window.removeEventListener('resize', resize);
}
