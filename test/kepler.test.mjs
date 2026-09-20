/**
 * Uji mekanika orbit: solver Kepler, arah posisi planet, dan kebenaran
 * kedudukan planet pada tanggal acuan.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEG,
  centuriesSinceJ2000,
  eclipticToScene,
  greenwichSiderealDeg,
  heliocentric,
  julianDay,
  scenePosition,
  solveKepler,
  wrap180,
} from '../src/data/kepler.js';
import { ELEMENTS } from '../src/data/elements.js';
import { displayDistance } from '../src/config/scale.js';

describe('solveKepler', () => {
  it('menyelesaikan M = E - e sin E sampai presisi tinggi', () => {
    for (const [mDeg, ecc] of [
      [0, 0.0167],
      [30, 0.2056],
      [180, 0.0934],
      [270, 0.0484],
      [359, 0.8],
    ]) {
      const M = mDeg * DEG;
      const E = solveKepler(M, ecc);
      const residual = Math.abs(E - ecc * Math.sin(E) - M);
      assert(residual < 1e-9, `M=${mDeg} e=${ecc}: residu ${residual}`);
    }
  });

  it('e = 0 memberi E = M', () => {
    assert(Math.abs(solveKepler(1.234, 0) - 1.234) < 1e-12);
  });
});

describe('wrap180', () => {
  it('melipat sudut ke rentang [-180, 180)', () => {
    assert.equal(wrap180(190), -170);
    assert.equal(wrap180(-190), 170);
    assert.equal(wrap180(360), 0);
    assert(wrap180(45) === 45);
  });
});

describe('heliocentric', () => {
  it('jarak Bumi pada 1 Jan 2000 mendekati perihelion Januari (+-0,5%)', () => {
    const date = new Date(Date.UTC(2000, 0, 4, 12, 0, 0));
    const state = heliocentric(ELEMENTS.earth, centuriesSinceJ2000(date));
    // Perihelion Bumi ~0,983 AU.
    assert(Math.abs(state.r - 0.983) < 0.005, `r = ${state.r}`);
  });

  it('Mars lebih jauh dari Bumi pada tanggal arbitrer 2026', () => {
    const date = new Date(Date.UTC(2026, 5, 15));
    const T = centuriesSinceJ2000(date);
    const mars = heliocentric(ELEMENTS.mars, T);
    const earth = heliocentric(ELEMENTS.earth, T);
    assert(mars.r > earth.r);
  });

  it('inklinasi Merkurius benar-benar memengaruhi sumbu z', () => {
    const date = new Date(Date.UTC(2026, 2, 20));
    const mercury = heliocentric(ELEMENTS.mercury, centuriesSinceJ2000(date));
    assert(Math.abs(mercury.z) > 0.005, `z merkurius = ${mercury.z} (seharusnya tak sebidang)`);
    const venus = heliocentric(ELEMENTS.venus, centuriesSinceJ2000(date));
    assert(Number.isFinite(venus.x) && Number.isFinite(venus.y) && Number.isFinite(venus.z));
  });
});

describe('scenePosition', () => {
  it('mempertahankan arah tetapi memakai radius tampilan yang dikompresi', () => {
    const date = new Date(Date.UTC(2026, 8, 20, 12, 0, 0));
    const T = centuriesSinceJ2000(date);
    const real = heliocentric(ELEMENTS.neptune, T);
    const shown = scenePosition(ELEMENTS.neptune, T, displayDistance);
    assert(Math.abs(Math.hypot(shown.x, shown.y, shown.z) - displayDistance(real.a)) < 1e-9);

    // Arah sama: selisih antara vektor ternormalisasi ~ 0.
    const realScene = eclipticToScene(real.x, real.y, real.z);
    const norm = (v) => Math.hypot(v.x, v.y, v.z);
    const dot =
      (shown.x / norm(shown)) * (realScene.x / norm(realScene)) +
      (shown.y / norm(shown)) * (realScene.y / norm(realScene)) +
      (shown.z / norm(shown)) * (realScene.z / norm(realScene));
    assert(dot > 0.999999, `arah berbeda: dot = ${dot}`);
  });

  it('kedudukan planet pada J2000 tetap masuk akal (Jupiter ~5,2 AU)', () => {
    const state = heliocentric(ELEMENTS.jupiter, 0);
    assert(Math.abs(state.r - 5.2) < 0.35, `r jupiter = ${state.r}`);
  });
});

describe('greenwichSiderealDeg', () => {
  it('GMST pada J2000 = 280,46061837 derajat', () => {
    assert(Math.abs(greenwichSiderealDeg(2451545.0) - 280.46061837) < 1e-6);
  });

  it('menambah ~360,9856 derajat per hari', () => {
    const a = greenwichSiderealDeg(2460000);
    const b = greenwichSiderealDeg(2460001);
    assert(Math.abs(b - a - 360.98564736629) < 1e-6);
  });
});

describe('julianDay & centuriesSinceJ2000', () => {
  it('Unix epoch = 2440587,5 dan J2000 = 2451545,0', () => {
    assert(Math.abs(julianDay(new Date(Date.UTC(1970, 0, 1))) - 2440587.5) < 1e-6);
    assert(Math.abs(centuriesSinceJ2000(new Date(Date.UTC(2000, 0, 1, 12))) - 0) < 1e-6);
  });
});
