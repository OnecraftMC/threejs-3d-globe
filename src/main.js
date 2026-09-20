/**
 * main.js — titik masuk aplikasi.
 *
 * Alur:
 *   1. Periksa WebGL; bila tidak ada, tampilkan pesan ramah.
 *   2. Bangun renderer, kamera, jam simulasi, dan aset.
 *   3. Muat tekstur tahap pertama, rakit tata surya, sembunyikan loader.
 *   4. Loop render: jam -> tata surya -> kamera -> label -> overlay -> composer.
 *   5. Pasang interaksi: klik untuk mendekati, papan tuntas, pengaturan.
 */
import './styles.css';
import { PerspectiveCamera, Raycaster, Scene, Vector2 } from 'three';
import { Assets } from './core/Assets.js';
import { CameraRig } from './core/CameraRig.js';
import { PostFX } from './core/PostFX.js';
import { SimulationClock } from './core/Clock.js';
import { applyRendererQuality, createRenderer, handleResize } from './core/Renderer.js';
import {
  canUseHeroTextures,
  degradeQuality,
  detectQuality,
  QUALITY_PRESETS,
} from './config/quality.js';
import { PLANETS, SUN } from './data/bodies.js';
import { Labels } from './scene/Labels.js';
import { SolarSystem } from './scene/SolarSystem.js';
import { Overlay } from './ui/Overlay.js';

/** Urutan fokus untuk tombol angka 0-9: Matahari lalu planet dari dalam ke luar. */
const FOCUS_ORDER = [SUN.id, ...PLANETS.map((planet) => planet.id)];

async function boot() {
  const canvas = document.getElementById('canvas');
  const labelLayer = document.getElementById('labels');

  // Label butuh daftar benda langit; dibangun di sini dari data agar Overlay
  // tidak perlu tahu struktur scene.
  const legendEntries = [SUN, ...PLANETS].map((def) => ({
    id: def.id,
    name: def.name,
    def,
    kind: def.kind === 'star' ? 'star' : 'planet',
  }));

  const app = {
    uiHidden: false,
    clock: new SimulationClock(new Date()),
    pointer: new Vector2(),
    raycaster: new Raycaster(),
    fpsSamples: [],
    lastQualityCheck: 0,
  };

  const overlay = new Overlay({
    bodies: legendEntries,
    onSelectBody: (id) => selectBody(id, true),
    onJumpToScale: (z) => {
      overlay.hintDismiss?.();
      rig.setZoom(z);
    },
    onSettingChange: (key, value) => applySetting(key, value),
    onLanguageChange: (language) => {
      overlay.syncLabels(labels);
      void language;
    },
  });

  // -------------------------------------------------------------------------
  // Renderer & kamera (dibuat sebelum tahu apakah WebGL jalan atau tidak)
  // -------------------------------------------------------------------------
  let renderer;
  try {
    renderer = createRenderer(canvas);
  } catch (error) {
    console.error('[hermes] WebGL tidak tersedia:', error);
    overlay.showWebGLError();
    return;
  }

  const camera = new PerspectiveCamera(52, window.innerWidth / Math.max(window.innerHeight, 1), 0.05, 2000);
  const scene = new Scene();

  // -------------------------------------------------------------------------
  // Kualitas grafis
  // -------------------------------------------------------------------------
  let qualityLevel = detectQuality(renderer);
  let qualityAuto = true;
  let preset = structuredClone(QUALITY_PRESETS[qualityLevel]);
  applyRendererQuality(renderer, qualityLevel);

  // Kunci utama pengaman VRAM: tekstur hero 8K hanya boleh pada perangkat yang
  // sanggup menanganinya (maxTextureSize >= 8192) dan pada preset tinggi.
  preset.heroTextures = canUseHeroTextures(renderer, QUALITY_PRESETS[qualityLevel]) && qualityLevel === 'high';

  const baseUrl = import.meta.env.BASE_URL;
  const assets = new Assets({
    baseUrl,
    anisotropy: preset.anisotropy,
    onProgress: (progress) => overlay.setProgress(progress.loaded / Math.max(progress.total, 1) * 0.92),
  });

  const system = new SolarSystem({ assets, preset, scene, startDate: app.clock.startDate });
  await system.init((progress) => overlay.setProgress(0.92 + progress.loaded * 0.08));
  system.setPixelRatio(renderer.getPixelRatio());

  const rig = new CameraRig(camera, canvas);
  const focusStart = system.getBody('earth');
  rig.setFocus(focusStart ? focusStart : system.sun, { zoom: 0 });

  const postfx = new PostFX(renderer, scene, camera, {
    bloom: preset.bloom,
    strength: 0.62,
    radius: 0.45,
    threshold: 0.72,
  });

  const labels = new Labels(
    labelLayer,
    [SUN, ...PLANETS].map((def) => ({
      id: def.id,
      name: def.name,
      body: system.getBody(def.id),
      kind: def.kind === 'star' ? 'star' : 'planet',
    })),
  );

  // -------------------------------------------------------------------------
  // Kunci debug untuk uji otomatis (screenshot headless). Tidak memengaruhi
  // perilaku normal; hanya diekspos supaya perangkat uji bisa menggerakkan
  // kamera tanpa mensimulasikan roda tetikus ribuan piksel.
  // -------------------------------------------------------------------------
  window.__hermesDebug = {
    setZoom: (z) => rig.debugSetZoom(z),
    focus: (id) => selectBody(id, true),
    state: () => ({ zoom: rig.zoom, focusId: rig.focus?.id }),
  };

  // -------------------------------------------------------------------------
  // Pemilihan benda langit
  // -------------------------------------------------------------------------
  function selectBody(id, showInfo = false) {
    const body = system.getBody(id);
    if (!body) return;

    rig.setFocus(body, { zoom: 0 });
    overlay.setActiveBody(id);
    overlay.hintDismiss?.();
    if (showInfo) {
      const def = id === SUN.id ? SUN : body.def;
      overlay.showInfo(def);
    }
  }
  app.selectBody = selectBody;

  // Klik pada planet: cari mesh yang diklik lewat raycaster.
  let downAt = null;
  canvas.addEventListener('pointerdown', (event) => {
    downAt = { x: event.clientX, y: event.clientY };
  });
  canvas.addEventListener('pointerup', (event) => {
    if (!downAt) return;
    const moved = Math.hypot(event.clientX - downAt.x, event.clientY - downAt.y);
    downAt = null;
    if (moved > 6) return; // itu seret, bukan klik

    const rect = canvas.getBoundingClientRect();
    app.pointer.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    );
    app.raycaster.setFromCamera(app.pointer, camera);
    const hits = app.raycaster.intersectObjects(system.pickables, false);
    if (hits.length > 0) {
      const picked = hits[0].object.userData.body;
      if (picked) selectBody(picked.id ?? picked, true);
    }
  });

  // -------------------------------------------------------------------------
  // Pengaturan
  // -------------------------------------------------------------------------
  function applySetting(key, value) {
    const clock = app.clock;
    switch (key) {
      case 'speed':
        clock.setSpeed(value);
        break;
      case 'paused':
        clock.paused = value;
        break;
      case 'orbits':
        system.setOrbitsVisible(value);
        break;
      case 'labels':
        labels.setEnabled(value);
        break;
      case 'belts':
        system.setBeltsVisible(value);
        break;
      case 'bloom':
        postfx.setBloomEnabled(value);
        break;
      case 'autoRotate':
        rig.autoRotate = value;
        break;
      case 'resetDate':
        clock.reset();
        break;
      case 'quality':
        if (value === 'auto') {
          qualityAuto = true;
          qualityLevel = detectQuality(renderer);
        } else {
          qualityAuto = false;
          qualityLevel = value;
        }
        applyLiveQuality();
        break;
      default:
        break;
    }
  }

  /**
   * Terapkan tingkat kualitas untuk hal yang bisa diganti saat berjalan:
   * rasio piksel, bloom, dan anisotropi. Segmen geometri hanya berubah dengan
   * memuat ulang, jadi dipertahankan dari preset awal.
   */
  function applyLiveQuality() {
    applyRendererQuality(renderer, qualityLevel);
    const enabled = QUALITY_PRESETS[qualityLevel].bloom;
    postfx.setBloomEnabled(enabled);
    overlay.setToggle('bloom', enabled);
    assets.applyAnisotropy(QUALITY_PRESETS[qualityLevel].anisotropy);
    system.setPixelRatio(renderer.getPixelRatio());
    postfx.setSize(window.innerWidth, window.innerHeight);
  }

  /** Turunkan kualitas otomatis bila laju gambar rendah selama beberapa detik. */
  function autoDegrade(now) {
    if (!qualityAuto) return;
    if (now - app.lastQualityCheck < 4000) return;
    app.lastQualityCheck = now;

    const samples = app.fpsSamples;
    if (samples.length < 30) return;
    const average = samples.reduce((sum, value) => sum + value, 0) / samples.length;
    app.fpsSamples = [];

    const next = degradeQuality(qualityLevel, average);
    if (next !== qualityLevel) {
      qualityLevel = next;
      applyLiveQuality();
      console.info(`[hermes] kualitas diturunkan otomatis ke ${qualityLevel} (rata-rata ${average.toFixed(0)} fps)`);
    }
  }

  // -------------------------------------------------------------------------
  // Papan tuntas
  // -------------------------------------------------------------------------
  window.addEventListener('keydown', (event) => {
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement) return;

    switch (event.key) {
      case ' ':
        event.preventDefault();
        overlay.paused = !overlay.paused;
        overlay.pauseButton.textContent = overlay.paused ? overlay.text.play : overlay.text.pause;
        applySetting('paused', overlay.paused);
        break;
      case 'r':
      case 'R':
        selectBody('earth', true);
        break;
      case 'o':
      case 'O':
        overlay.setToggle('orbits', !overlay.toggles.orbits.checked);
        applySetting('orbits', overlay.toggles.orbits.checked);
        break;
      case 'l':
      case 'L':
        overlay.setToggle('labels', !overlay.toggles.labels.checked);
        applySetting('labels', overlay.toggles.labels.checked);
        break;
      case 'h':
      case 'H':
        app.uiHidden = !app.uiHidden;
        overlay.setInterfaceVisible(!app.uiHidden);
        break;
      case 'ArrowUp':
        rig.rotate(0, -0.06);
        break;
      case 'ArrowDown':
        rig.rotate(0, 0.06);
        break;
      case 'ArrowLeft':
        rig.rotate(-0.06, 0);
        break;
      case 'ArrowRight':
        rig.rotate(0.06, 0);
        break;
      case '+':
      case '=':
        rig.zoomBy(-0.05);
        break;
      case '-':
      case '_':
        rig.zoomBy(0.05);
        break;
      default: {
        const index = Number.parseInt(event.key, 10);
        if (!Number.isNaN(index) && index >= 0 && index < FOCUS_ORDER.length) {
          selectBody(FOCUS_ORDER[index], true);
        }
        break;
      }
    }
  });

  // Label dalam kanvas ikut berpindah ke info saat diklik.
  labelLayer.addEventListener('click', (event) => {
    const button = event.target.closest('[data-body-id]');
    if (button?.dataset.bodyId) selectBody(button.dataset.bodyId, true);
  });

  // -------------------------------------------------------------------------
  // Ukuran, penyelesaian pemuatan, dan loop utama
  // -------------------------------------------------------------------------
  handleResize(renderer, camera, (width, height) => postfx.setSize(width, height));

  overlay.hideLoader();
  overlay.setZoomState(rig.zoom);
  overlay.setActiveBody('earth');
  overlay.setSimDate(app.clock.date, app.clock.paused);
  overlay.showInfo(system.getBody('earth').def);
  overlay.showHint(() => {});

  // Catat waktu antar-frame untuk pengukur laju gambar.
  let lastTime = performance.now();

  renderer.setAnimationLoop((now) => {
    const delta = Math.min((now - lastTime) / 1000, 0.1);
    lastTime = now;

    if (delta > 0) app.fpsSamples.push(1 / delta);
    if (app.fpsSamples.length > 240) app.fpsSamples.shift();
    autoDegrade(now);

    app.clock.update(delta);
    system.update(delta, app.clock, camera, rig.zoom);
    rig.update(delta);

    system.lastZoom = rig.zoom;
    labels.update(camera, { zoom: rig.zoom, focusId: rig.focus?.id });

    overlay.setZoomState(rig.zoom);
    if (!overlay.paused !== !app.clock.paused) {
      overlay.paused = app.clock.paused;
      overlay.pauseButton.textContent = app.clock.paused ? overlay.text.play : overlay.text.pause;
    }
    overlay.setSimDate(app.clock.date, app.clock.paused);

    postfx.render(delta);
  });
}

boot().catch((error) => {
  console.error('[hermes] gagal dijalankan:', error);
  const loader = document.querySelector('.loader__label');
  if (loader) loader.textContent = `Gagal memuat: ${error?.message ?? error}`;
});
