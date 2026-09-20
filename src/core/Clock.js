/**
 * Clock.js — waktu simulasi.
 *
 * Semua gerak benda langit diturunkan dari satu sumber waktu. Posisi planet
 * dihitung dari elemen orbit nyata pada tanggal simulasi, sehingga konfigurasi
 * tata surya yang terlihat saat halaman dibuka sesuai dengan langit hari itu.
 *
 * Satuan kecepatan adalah "hari simulasi per detik nyata". Nilai bawaan
 * 0,1 hari/detik berarti Bumi berputar sekali setiap ±10 detik sambil
 * mengelilingi Matahari dalam waktu sekitar satu jam — cukup lambat untuk
 * dinikmati, cukup cepat agar gerak orbit terlihat.
 */
import { centuriesSinceJ2000, julianDay } from '../data/kepler.js';

/** Preset kecepatan yang ditawarkan di panel pengaturan. */
export const SPEED_PRESETS = [
  { label: 'Berhenti', daysPerSecond: 0 },
  { label: '1 jam / detik', daysPerSecond: 1 / 24 },
  { label: '2,4 jam / detik', daysPerSecond: 0.1 },
  { label: '1 hari / detik', daysPerSecond: 1 },
  { label: '10 hari / detik', daysPerSecond: 10 },
];

export class SimulationClock {
  /** @param {Date} [startDate] tanggal awal simulasi */
  constructor(startDate = new Date()) {
    this.startJulian = julianDay(startDate);
    this.startDate = new Date(startDate.getTime());

    /** Hari simulasi yang sudah berjalan sejak tanggal awal. */
    this.elapsedDays = 0;
    this.daysPerSecond = 0.1;
    this.paused = false;

    /** Detik nyata sejak halaman dibuka — dipakai animasi shader. */
    this.elapsedSeconds = 0;
  }

  /** Tanggal simulasi saat ini. */
  get date() {
    return new Date((this.startJulian + this.elapsedDays - 2440587.5) * 86400000);
  }

  get julian() {
    return this.startJulian + this.elapsedDays;
  }

  /** Abad Julian sejak J2000 — masukan untuk solver Kepler. */
  get centuries() {
    return centuriesSinceJ2000(this.date);
  }

  /** Jam simulasi sejak tanggal awal — dipakai untuk rotasi & orbit bulan. */
  get elapsedHours() {
    return this.elapsedDays * 24;
  }

  /** @param {number} deltaSeconds selisih waktu nyata antar frame */
  update(deltaSeconds) {
    this.elapsedSeconds += deltaSeconds;
    if (!this.paused) {
      // Batasi lompatan waktu ketika tab kembali aktif setelah lama di latar.
      const step = Math.min(deltaSeconds, 0.25) * this.daysPerSecond;
      this.elapsedDays += step;
    }
  }

  setSpeed(daysPerSecond) {
    this.daysPerSecond = Math.max(0, daysPerSecond);
  }

  /** Kembali ke hari ini. */
  reset() {
    this.elapsedDays = 0;
  }
}
