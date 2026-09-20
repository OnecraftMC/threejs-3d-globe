/**
 * elements.js — elemen orbit Keplerian dari JPL
 * ("Approximate Positions of the Planets", berlaku 1800–2050 M).
 *
 * Setiap elemen ditulis [nilai pada epoch J2000, laju per abad Julian].
 * Satuan: a dalam AU, sudut dalam derajat.
 *
 *   a    : sumbu semi-mayor
 *   e    : eksentrisitas
 *   I    : inklinasi terhadap ekliptika
 *   L    : bujur rata-rata (mean longitude)
 *   peri : bujur perihelion
 *   node : bujur titik simpul naik (ascending node)
 *
 * Dengan tabel ini konfigurasi planet pada halaman yang dibuka sesuai dengan
 * langit nyata pada tanggal tersebut — bukan sudut acak.
 */

const e = (v, d) => ({ value: v, dot: d });

const raw = {
  mercury: {
    a: e(0.38709927, 0.00000037),
    e: e(0.20563593, 0.00001906),
    I: e(7.00497902, -0.00594749),
    L: e(252.2503235, 149472.67411175),
    peri: e(77.45779628, 0.16047689),
    node: e(48.33076593, -0.12534081),
  },
  venus: {
    a: e(0.72333566, 0.0000039),
    e: e(0.00677672, -0.00004107),
    I: e(3.39467605, -0.0007889),
    L: e(181.9790995, 58517.81538729),
    peri: e(131.60246718, 0.00268329),
    node: e(76.67984255, -0.27769418),
  },
  earth: {
    a: e(1.00000261, 0.00000562),
    e: e(0.01671123, -0.00004392),
    I: e(-0.00001531, -0.01294668),
    L: e(100.46457166, 35999.37244981),
    peri: e(102.93768193, 0.32327364),
    node: e(0.0, 0.0),
  },
  mars: {
    a: e(1.52371034, 0.00001847),
    e: e(0.0933941, 0.00007882),
    I: e(1.84969142, -0.00813131),
    L: e(-4.55343205, 19140.30268499),
    peri: e(-23.94362959, 0.44441088),
    node: e(49.55953891, -0.29257343),
  },
  jupiter: {
    a: e(5.202887, -0.00011607),
    e: e(0.04838624, -0.00013253),
    I: e(1.30439695, -0.00183714),
    L: e(34.39644051, 3034.74612775),
    peri: e(14.72847983, 0.21252668),
    node: e(100.47390909, 0.20469106),
  },
  saturn: {
    a: e(9.53667594, -0.0012506),
    e: e(0.05386179, -0.00050991),
    I: e(2.48599187, 0.00193609),
    L: e(49.95424423, 1222.49362201),
    peri: e(92.59887831, -0.41897216),
    node: e(113.66242448, -0.28867794),
  },
  uranus: {
    a: e(19.18916464, -0.00196176),
    e: e(0.04725744, -0.00004397),
    I: e(0.77263783, -0.00242939),
    L: e(313.23810451, 428.48202785),
    peri: e(170.9542763, 0.40805281),
    node: e(74.01692503, 0.04240589),
  },
  neptune: {
    a: e(30.06992276, 0.00026291),
    e: e(0.00859048, 0.00005105),
    I: e(1.77004347, 0.00035372),
    L: e(-55.12002969, 218.45945325),
    peri: e(44.96476227, -0.32241464),
    node: e(131.78422574, -0.00508664),
  },
};

/** Ratakan struktur menjadi objek datar { a, aDot, e, eDot, ... }. */
function flatten(spec) {
  const out = {};
  for (const [key, pair] of Object.entries(spec)) {
    out[key] = pair.value;
    out[`${key}Dot`] = pair.dot;
  }
  return out;
}

export const ELEMENTS = Object.fromEntries(
  Object.entries(raw).map(([id, spec]) => [id, flatten(spec)]),
);

/**
 * Elemen orbit Bulan (disederhanakan, mengorbit Bumi). Cukup untuk visual:
 * jarak rata-rata 384.400 km, inklinasi 5,145°, periode sideris 27,322 hari,
 * eksentrisitas 0,0549 dan rotasi terkunci (periode rotasi = periode orbit).
 */
export const MOON_ELEMENTS = {
  aKm: 384400,
  e: 0.0549,
  inclinationDeg: 5.145,
  periodDays: 27.321661,
  /** Sudut awal supaya fase Bulan hari ini tidak terlihat acak. */
  meanLongitudeJ2000: 218.316,
  meanLongitudeRatePerDay: 13.176396,
};
