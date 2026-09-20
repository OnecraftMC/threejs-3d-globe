/**
 * CameraRig.js — kontrol kamera: orbit, zoom berjenjang, dan terbang ke benda.
 *
 * Inilah mekanisme inti dari permintaan "scroll untuk memperkecil globe Bumi
 * sampai seluruh tata surya terlihat". OrbitControls bawaan tidak dipakai
 * karena perilakunya perlu dikendalikan penuh:
 *
 *   z (0..1)   satu parameter zoom untuk SELURUH perjalanan, dari menempel di
 *              permukaan sebuah planet sampai melihat seluruh tata surya.
 *
 *   radius     exp(lerp(ln rDekat, ln rJauh)) — interpolasi logaritmik, karena
 *              rentangnya sangat lebar (2,4 sampai 520 satuan). Interpolasi
 *              linear akan membuat hampir seluruh perjalanan terasa mandek.
 *
 *   anchor     titik yang dipandang. Selagi dekat, anchor = planet fokus.
 *              Menuju jauh, anchor bergeser mulus ke Matahari lewat smoothstep,
 *              sehingga yang terasa adalah kamera ditarik mundur ke angkasa —
 *              bukan target yang melompat.
 *
 *   near/far   dihitung ulang setiap frame dari radius, agar presisi kedalaman
 *              tetap memadai di kedua ujung skala tanpa buffer logaritmik.
 *
 * Orientasi disimpan sebagai koordinat bola dengan peredaman, jadi ada inersia
 * lembut ketika pengguna melepas tetikus.
 */
import { MathUtils, Spherical, Vector3 } from 'three';
import { ZOOM, anchorBlend, clamp01, smoothstep, zoomRadius } from '../config/scale.js';

const { damp } = MathUtils;

/** Perpindahan parameter zoom per satuan delta roda tetikus. */
const SCROLL_SENSITIVITY = 0.0011;

export class CameraRig {
  /** Titik bantu — dibuat sekali agar tidak ada alokasi baru tiap frame. */
  #anchorCurrent = new Vector3();
  #anchorPrevious = new Vector3();
  #spherical = new Spherical();
  #pointers = new Map();
  #pointerId = null;
  #lastPointer = { x: 0, y: 0 };
  #pinchDistance = 0;

  /**
   * @param {import('three').PerspectiveCamera} camera
   * @param {HTMLElement} domElement
   */
  constructor(camera, domElement) {
    this.camera = camera;
    this.domElement = domElement;

    /** Parameter zoom saat ini dan nilai tujuannya. */
    this.zoom = ZOOM.start;
    this.zoomTarget = ZOOM.start;

    /** Sudut pandang bola dan nilai tujuannya. */
    this.azimuth = Math.PI * 0.35;
    this.polar = Math.PI * 0.42;
    this.azimuthTarget = this.azimuth;
    this.polarTarget = this.polar;

    /** Benda langit yang sedang difokuskan. */
    this.focus = null;
    this.focusPrevious = null;
    /** 0..1 — seberapa jauh perpindahan fokus sudah berjalan. */
    this.focusBlend = 1;

    this.minPolar = 0.06;
    this.maxPolar = Math.PI - 0.06;
    this.autoRotate = false;
    this.autoRotateSpeed = 0.05;
    this.enabled = true;

    this.distance = 1;
    this.target = new Vector3();
    this.worldPosition = new Vector3();

    this.#bindEvents();
  }

  // -------------------------------------------------------------------------
  // Masukan pengguna
  // -------------------------------------------------------------------------

  #bindEvents() {
    const dom = this.domElement;
    dom.style.touchAction = 'none';

    this.onPointerDown = (event) => {
      if (!this.enabled) return;
      this.#pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (this.#pointers.size === 1) {
        this.#pointerId = event.pointerId;
        this.#lastPointer = { x: event.clientX, y: event.clientY };
        dom.setPointerCapture?.(event.pointerId);
      } else if (this.#pointers.size === 2) {
        this.#pinchDistance = this.#currentPinchDistance();
      }
    };

    this.onPointerMove = (event) => {
      if (!this.#pointers.has(event.pointerId)) return;
      this.#pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

      if (this.#pointers.size >= 2) {
        // Cubit dua jari: jari merapat berarti kamera menjauh.
        const distance = this.#currentPinchDistance();
        if (this.#pinchDistance > 0) this.zoomBy((this.#pinchDistance - distance) * 0.004);
        this.#pinchDistance = distance;
        return;
      }

      if (event.pointerId !== this.#pointerId) return;
      const deltaX = event.clientX - this.#lastPointer.x;
      const deltaY = event.clientY - this.#lastPointer.y;
      this.#lastPointer = { x: event.clientX, y: event.clientY };
      this.rotate(-deltaX * 0.0045, -deltaY * 0.0045);
    };

    this.onPointerUp = (event) => {
      this.#pointers.delete(event.pointerId);
      if (this.#pointerId === event.pointerId) this.#pointerId = null;
      if (this.#pointers.size < 2) this.#pinchDistance = 0;
      dom.releasePointerCapture?.(event.pointerId);
    };

    this.onWheel = (event) => {
      if (!this.enabled) return;
      event.preventDefault();
      // deltaMode 1 = baris (Firefox pada Windows), 2 = halaman.
      const scale = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 100 : 1;
      this.zoomBy(event.deltaY * scale * SCROLL_SENSITIVITY);
    };

    dom.addEventListener('pointerdown', this.onPointerDown);
    dom.addEventListener('pointermove', this.onPointerMove);
    dom.addEventListener('pointerup', this.onPointerUp);
    dom.addEventListener('pointercancel', this.onPointerUp);
    dom.addEventListener('wheel', this.onWheel, { passive: false });
  }

  #currentPinchDistance() {
    const [a, b] = [...this.#pointers.values()];
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  dispose() {
    const dom = this.domElement;
    dom.removeEventListener('pointerdown', this.onPointerDown);
    dom.removeEventListener('pointermove', this.onPointerMove);
    dom.removeEventListener('pointerup', this.onPointerUp);
    dom.removeEventListener('pointercancel', this.onPointerUp);
    dom.removeEventListener('wheel', this.onWheel);
  }

  /** Putar sudut pandang (seret tetikus atau tombol panah). */
  rotate(deltaAzimuth, deltaPolar) {
    this.azimuthTarget += deltaAzimuth;
    this.polarTarget = MathUtils.clamp(this.polarTarget + deltaPolar, this.minPolar, this.maxPolar);
  }

  /** Ubah zoom; nilai positif berarti menjauh (objek mengecil). */
  zoomBy(amount) {
    this.zoomTarget = clamp01(this.zoomTarget + amount);
  }

  /** Lompat ke tingkat zoom tertentu (slider, tombol tingkat). */
  setZoom(z, immediate = false) {
    this.zoomTarget = clamp01(z);
    if (immediate) this.zoom = this.zoomTarget;
  }

  /**
   * Pindah fokus ke benda langit lain. Perpindahan anchor dianimasikan supaya
   * kamera tidak melompat.
   */
  setFocus(body, { zoom = 0 } = {}) {
    if (!body || body === this.focus) {
      if (body) this.setZoom(zoom);
      return;
    }
    this.focusPrevious = this.focus;
    this.focus = body;
    this.focusBlend = this.focusPrevious ? 0 : 1;
    this.setZoom(zoom);
  }

  // -------------------------------------------------------------------------
  // Pembaruan tiap frame
  // -------------------------------------------------------------------------

  /** @param {number} delta detik sejak frame sebelumnya */
  update(delta) {
    const damping = 1 - Math.exp(-delta * 9);

    if (this.autoRotate && this.#pointers.size === 0) {
      this.azimuthTarget += this.autoRotateSpeed * delta;
    }

    this.zoom += (this.zoomTarget - this.zoom) * damping;
    this.azimuth += (this.azimuthTarget - this.azimuth) * damping;
    this.polar += (this.polarTarget - this.polar) * damping;
    this.focusBlend = Math.min(1, this.focusBlend + delta * 1.6);

    // --- Titik yang dipandang ----------------------------------------------
    const focusRadius = this.focus?.displayRadius ?? 1;
    this.focus?.getWorldPosition?.(this.#anchorCurrent);

    if (this.focusPrevious && this.focusBlend < 1) {
      this.focusPrevious.getWorldPosition?.(this.#anchorPrevious);
      this.#anchorCurrent.lerpVectors(
        this.#anchorPrevious,
        this.#anchorCurrent,
        smoothstep(0, 1, this.focusBlend),
      );
    }
    if (this.focusBlend >= 1) this.focusPrevious = null;

    // Saat zoom menuju jauh, anchor bergeser mulus dari planet ke Matahari,
    // yang berada di titik asal scene.
    const blend = anchorBlend(this.zoom);
    this.target.set(0, 0, 0).lerp(this.#anchorCurrent, 1 - blend);

    // --- Jarak & posisi kamera ---------------------------------------------
    this.distance = zoomRadius(this.zoom, focusRadius);

    // Sedikit menunduk saat melihat seluruh sistem, agar susunan planet
    // terbaca sebagai diagram dan bukan garis horizontal yang tipis.
    const overviewPolar = MathUtils.lerp(this.polar, 1.02, smoothstep(0.55, 1.0, this.zoom) * 0.75);
    this.#spherical.set(this.distance, overviewPolar, this.azimuth);
    this.worldPosition.setFromSpherical(this.#spherical).add(this.target);
    this.camera.position.copy(this.worldPosition);

    // Cegah kamera menembus benda yang sedang difokuskan.
    const minDistance = focusRadius * 1.06;
    if (this.camera.position.distanceTo(this.target) < minDistance) {
      this.#anchorPrevious.copy(this.camera.position).sub(this.target).normalize();
      this.camera.position.copy(this.target).addScaledVector(this.#anchorPrevious, minDistance);
    }

    this.camera.up.set(0, 1, 0);
    this.camera.lookAt(this.target);

    // Bidang potong mengikuti skala, sehingga presisi kedalaman tetap memadai
    // baik saat menempel di permukaan planet maupun saat melihat seluruh
    // tata surya sekaligus.
    this.camera.near = MathUtils.clamp(this.distance * 0.02, 0.01, 24);
    this.camera.far = Math.max(this.distance * 3.2, 900);
    this.camera.updateProjectionMatrix();
  }

  /** Tingkat zoom 0..1 untuk ditampilkan di antarmuka. */
  get progress() {
    return clamp01(this.zoom);
  }

  /**
   * Kunci debug untuk perangkat uji otomatis (screenshot headless).
   * Dipakai oleh scripts/screenshot.mjs lewat window.__hermesDebug.
   * @param {number} z
   */
  debugSetZoom(z) {
    this.setZoom(z, false);
    this.zoomTarget = clamp01(z);
  }
}
