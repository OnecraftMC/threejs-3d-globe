/**
 * Assets.js — pemuat tekstur bertahap.
 *
 * Dua alasan tekstur tidak dimuat sekaligus:
 *
 *  1. Bumi harus muncul secepat mungkin. Berkas yang diunduh belakangan
 *     jumlahnya puluhan megabita, dan menunggunya berarti layar kosong
 *     beberapa detik lebih lama.
 *  2. Tekstur "hero" 8K (Bumi, Bulan, Matahari) masing-masing 4096x2048 sampai
 *     8192x4096 piksel. Tiga tekstur 8K RGBA memakan sekitar 0,5 GB VRAM, jadi
 *     tekstur ini hanya dimuat ketika kamera benar-benar mendekati benda
 *     tersebut — dan hanya pada perangkat yang sanggup.
 *
 * Semua pemuatan dilacak dan tahan gagal: bila sebuah tekstur tidak dapat
 * dimuat, materi terkait memakai warna prosedural sehingga tidak pernah muncul
 * permukaan hitam atau rusak.
 */
import {
  LinearMipMapLinearFilter,
  LinearSRGBColorSpace,
  NoColorSpace,
  RepeatWrapping,
  SRGBColorSpace,
  TextureLoader,
} from 'three';

/** Tekstur mana yang berisi data warna (sRGB) dan mana yang berisi data. */
const DATA_TEXTURES = new Set([
  'earth/earth_normal_2k.jpg',
  'earth/earth_normal_4k.jpg',
  'earth/earth_specular_2k.jpg',
  'earth/earth_specular_4k.jpg',
  'planets/mercury_normal_2k.jpg',
  'planets/venus_normal_2k.jpg',
  'planets/moon_normal_2k.jpg',
  'moon/moon_normal_4k.jpg',
  'rings/saturn_ring_alpha.png',
  'generated/noise_fbm.png',
  'generated/noise_warp.png',
]);

/** Tekstur yang harus diulang (bukan dijepit) — peta noise. */
const REPEATING = new Set(['generated/noise_fbm.png', 'generated/noise_warp.png']);

export class Assets {
  /**
   * @param {{ baseUrl?: string, anisotropy?: number, onProgress?: Function }} [options]
   */
  constructor(options = {}) {
    this.baseUrl = options.baseUrl ?? '/';
    this.anisotropy = options.anisotropy ?? 4;
    this.onProgress = options.onProgress ?? (() => {});

    /** @type {Map<string, import('three').Texture>} */
    this.textures = new Map();
    /** @type {Map<string, Error>} */
    this.failures = new Map();

    this.loader = new TextureLoader();
    this.loaded = 0;
    this.total = 0;
  }

  /** URL lengkap sebuah kunci tekstur logis. */
  url(key) {
    return `${this.baseUrl}textures/${key}`;
  }

  has(key) {
    return this.textures.has(key);
  }

  /** Tekstur yang sudah dimuat, atau null. */
  get(key) {
    return this.textures.get(key) ?? null;
  }

  /** Atur ulang penyaring sesuai tingkat kualitas (mis. setelah auto-turun). */
  applyAnisotropy(anisotropy) {
    this.anisotropy = anisotropy;
    for (const texture of this.textures.values()) {
      texture.anisotropy = anisotropy;
      texture.needsUpdate = true;
    }
  }

  /**
   * Muat sekumpulan tekstur secara paralel.
   * @param {string[]} keys
   * @returns {Promise<Map<string, import('three').Texture>>}
   */
  async load(keys) {
    const unique = [...new Set(keys)].filter(Boolean);
    this.total += unique.length;

    await Promise.all(
      unique.map(async (key) => {
        if (this.textures.has(key) || this.failures.has(key)) {
          this.#report(key);
          return;
        }
        try {
          const texture = await this.loader.loadAsync(this.url(key));
          this.#configure(texture, key);
          this.textures.set(key, texture);
        } catch (error) {
          this.failures.set(key, error);
          // Bukan kegagalan fatal: materi terkait jatuh ke warna prosedural.
          console.warn(`[hermes] tekstur gagal dimuat: ${key}`, error?.message ?? error);
        } finally {
          this.loaded++;
          this.#report(key);
        }
      }),
    );

    return this.textures;
  }

  #report(key) {
    this.onProgress({ key, loaded: this.loaded, total: this.total });
  }

  #configure(texture, key) {
    const isData = DATA_TEXTURES.has(key);
    texture.colorSpace = isData ? NoColorSpace : SRGBColorSpace;
    texture.anisotropy = this.anisotropy;
    texture.minFilter = LinearMipMapLinearFilter;
    texture.generateMipmaps = true;

    if (REPEATING.has(key)) {
      texture.wrapS = RepeatWrapping;
      texture.wrapT = RepeatWrapping;
    } else {
      // Bola menutup penuh pada arah bujur; klamp mencegah jahitan tipis.
      texture.wrapS = RepeatWrapping;
    }
    texture.needsUpdate = true;
  }

  /** URL tekstur hero bila diizinkan, jika tidak jatuh ke versi 2K. */
  heroOr(key, fallbackKey) {
    return this.textures.has(key) ? key : fallbackKey;
  }

  /** Berapa banyak tekstur yang gagal dimuat (untuk laporan diagnostik). */
  get failureCount() {
    return this.failures.size;
  }
}
