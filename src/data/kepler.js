/**
 * kepler.js — mekanika orbit sederhana (murni matematika, tanpa three.js).
 *
 * Modul ini dipisahkan dari kode tampilan supaya bisa diuji langsung dengan
 * `npm test` di Node tanpa peramban. Lihat test/kepler.test.mjs.
 */

export const DEG = Math.PI / 180;
export const RAD = 180 / Math.PI;

/** Julian Day dari objek Date. */
export function julianDay(date) {
  return date.getTime() / 86400000 + 2440587.5;
}

/** Abad Julian sejak epoch J2000.0 — satuan waktu untuk laju elemen orbit. */
export function centuriesSinceJ2000(date) {
  return (julianDay(date) - 2451545.0) / 36525;
}

/** Normalisasi sudut ke rentang [-180, 180) derajat. */
export function wrap180(deg) {
  return deg - 360 * Math.floor(deg / 360 + 0.5);
}

/**
 * Selesaikan persamaan Kepler  M = E - e·sin(E)  untuk E (eksentrik anomali).
 * Newton-Raphson; konvergen dalam beberapa iterasi untuk e < 0,9.
 * @param {number} M mean anomaly (radian)
 * @param {number} e eksentrisitas
 * @returns {number} E (radian)
 */
export function solveKepler(M, e, tolerance = 1e-10, maxIter = 40) {
  let E = e < 0.8 ? M : Math.PI;
  for (let i = 0; i < maxIter; i++) {
    const f = E - e * Math.sin(E) - M;
    const fp = 1 - e * Math.cos(E);
    const step = f / fp;
    E -= step;
    if (Math.abs(step) < tolerance) break;
  }
  return E;
}

/**
 * Posisi heliosentris dalam koordinat ekliptika (bukan satuan scene).
 * Koordinat acuan: x ke arah titik Aries, z ke kutub utara ekliptika
 * (sesuai konvensi astronomi), dalam satuan AU.
 *
 * @param {{a:number,e:number,I:number,L:number,peri:number,node:number}} el elemen orbit
 * @param {number} T abad sejak J2000
 */
export function heliocentric(el, T) {
  const a = el.a + (el.aDot ?? 0) * T;
  const e = el.e + (el.eDot ?? 0) * T;
  const I = (el.I + (el.IDot ?? 0) * T) * DEG;
  const L = el.L + (el.LDot ?? 0) * T;
  const peri = el.peri + (el.periDot ?? 0) * T;
  const node = (el.node + (el.nodeDot ?? 0) * T) * DEG;

  const M = wrap180(L - peri) * DEG;
  const argPeri = (peri * DEG) - node;

  const E = solveKepler(M, e);
  const cosE = Math.cos(E);
  const sinE = Math.sin(E);
  const sqrt1me2 = Math.sqrt(1 - e * e);

  // Bidang orbit -> koordinat ekliptika
  const xp = a * (cosE - e);
  const yp = a * sqrt1me2 * sinE;

  const cw = Math.cos(argPeri);
  const sw = Math.sin(argPeri);
  const cO = Math.cos(node);
  const sO = Math.sin(node);
  const cI = Math.cos(I);
  const sI = Math.sin(I);

  const x = (cw * cO - sw * sO * cI) * xp + (-sw * cO - cw * sO * cI) * yp;
  const y = (cw * sO + sw * cO * cI) * xp + (-sw * sO + cw * cO * cI) * yp;
  const z = (sw * sI) * xp + (cw * sI) * yp;

  const r = Math.hypot(x, y, z);

  return {
    x, y, z, r,
    /** Radius sesungguhnya dalam AU (sebelum kompresi tampilan). */
    a, e,
    meanAnomaly: M * RAD,
    eccentricAnomaly: E,
    trueAnomaly: Math.atan2(yp, xp) * RAD,
  };
}

/**
 * Sudut rotasi sideris Greenwich (GMST) dalam derajat.
 *
 * Dipakai untuk memutar Bumi pada sudut yang benar-benar sesuai jam UTC:
 * meredian utama berada di bawah Matahari pada tengah hari, bukan pada sudut
 * acak. Aproksimasi linear ini akurat sampai beberapa detik busur sepanjang
 * abad ini — jauh lebih teliti daripada yang bisa terlihat di layar.
 */
export function greenwichSiderealDeg(jd) {
  const d = jd - 2451545.0;
  return 280.46061837 + 360.98564736629 * d;
}

/**
 * Ubah vektor ekliptika astronomi (x,y,z) menjadi koordinat scene three.js
 * yang Y-up: ekliptika menjadi bidang XZ, sumbu Y menjadi utara ekliptika.
 */
export function eclipticToScene(x, y, z, out = { x: 0, y: 0, z: 0 }) {
  out.x = x;
  out.y = z;
  out.z = -y;
  return out;
}

/**
 * Posisi scene: arah dari elemen orbit nyata, tetapi radiusnya dipetakan
 * melalui kurva kompresi tampilan. Jadi konfigurasi planet tetap benar
 * (sudutnya sesuai langit nyata), sementara jaraknya bisa dilihat sekaligus.
 *
 * @param {object} el elemen orbit
 * @param {number} T abad sejak J2000
 * @param {(aAu:number)=>number} distanceFor fungsi kompresi jarak
 */
export function scenePosition(el, T, distanceFor, out = { x: 0, y: 0, z: 0 }) {
  const h = heliocentric(el, T);
  const d = distanceFor(h.a);
  const inv = h.r > 0 ? d / h.r : 0;
  return eclipticToScene(h.x * inv, h.y * inv, h.z * inv, out);
}
