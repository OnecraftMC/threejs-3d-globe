/**
 * Uji konsistensi data benda langit: id unik, tekstur terdaftar, hierarki bulan,
 * dan tidak ada geometri tampilan yang bertumpang-tindih.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ASTEROID_BELT, KUIPER_BELT, PLANETS, SUN, TEX } from '../src/data/bodies.js';

describe('struktur data benda langit', () => {
  const all = [
    SUN,
    ...PLANETS,
    ...PLANETS.flatMap((planet) => planet.moons ?? []),
  ];

  it('id unik di seluruh sistem', () => {
    const ids = all.map((body) => body.id);
    assert.equal(new Set(ids).size, ids.length);
  });

  it('semua benda punya radius tampilan positif dan nama dua bahasa', () => {
    for (const body of all) {
      assert(body.displayRadius > 0, body.id);
      assert(typeof body.name.id === 'string' && body.name.id.length > 0, body.id);
      assert(typeof body.name.en === 'string' && body.name.en.length > 0, body.id);
      assert(typeof body.color === 'number', body.id);
    }
  });

  it('delapan planet berurutan jarak orbitnya', () => {
    for (let i = 1; i < PLANETS.length; i++) {
      assert(
        PLANETS[i].displayDistance > PLANETS[i - 1].displayDistance,
        `${PLANETS[i].id} tidak lebih jauh dari ${PLANETS[i - 1].id}`,
      );
    }
  });

  it('semua kunci tekstur yang dipakai terdefinisi singkat di TEX', () => {
    const known = new Set(Object.values(TEX));
    for (const planet of PLANETS) {
      for (const value of Object.values(planet.textures ?? {})) {
        assert(known.has(value), `${planet.id}: ${value} tidak terdaftar di TEX`);
      }
      if (planet.textures?.cloudDeck) {
        assert(known.has(planet.textures.cloudDeck), planet.id);
      }
      if (planet.turbulence?.warp) {
        assert(known.has(planet.turbulence.warp), planet.id);
      }
      if (planet.rings?.texture) {
        assert(known.has(planet.rings.texture), planet.id);
      }
      for (const moon of planet.moons ?? []) {
        for (const value of Object.values(moon.textures ?? {})) {
          assert(
            known.has(value) || value.startsWith('generated/moons/'),
            `${moon.id}: ${value} tidak terdaftar di TEX`,
          );
        }
      }
    }
  });
});

describe('geometri tampilan', () => {
  it('tidak ada planet yang berada di dalam Matahari', () => {
    const sunOuter = SUN.displayRadius;
    for (const planet of PLANETS) {
      assert(
        planet.displayDistance - planet.displayRadius > sunOuter,
        `${planet.id} bertabrakan dengan Matahari`,
      );
    }
  });

  it('orbit planet berurutan tidak saling bertabrakan (termasuk cincin)', () => {
    const outerOf = (planet) =>
      planet.displayDistance + planet.displayRadius * (planet.rings ? planet.rings.outer : 1);
    const innerOf = (planet) =>
      planet.displayDistance - planet.displayRadius * (planet.rings ? planet.rings.outer : 1);
    for (let i = 1; i < PLANETS.length; i++) {
      assert(
        innerOf(PLANETS[i]) > outerOf(PLANETS[i - 1]),
        `${PLANETS[i].id} bertabrakan dengan ${PLANETS[i - 1].id}`,
      );
    }
  });

  it('bulan berada di luar permukaan planetnya tetapi tidak terlalu jauh', () => {
    for (const planet of PLANETS) {
      for (const moon of planet.moons ?? []) {
        assert(
          moon.orbit > planet.displayRadius * (planet.rings?.outer ?? 1),
          `${moon.id} berada di dalam ${planet.id}`,
        );
        assert(
          moon.orbit < planet.displayDistance * 0.5,
          `${moon.id} terlalu jauh dari ${planet.id}`,
        );
      }
    }
  });

  it('sabuk asteroid mengapit celah Mars-Jupiter', () => {
    const mars = PLANETS.find((planet) => planet.id === 'mars');
    const jupiter = PLANETS.find((planet) => planet.id === 'jupiter');
    assert(ASTEROID_BELT.inner > mars.displayDistance + mars.displayRadius);
    assert(ASTEROID_BELT.outer < jupiter.displayDistance - jupiter.displayRadius);
  });

  it('sabuk Kuiper berada di luar Neptunus', () => {
    const neptune = PLANETS.find((planet) => planet.id === 'neptune');
    assert(KUIPER_BELT.inner > neptune.displayDistance + neptune.displayRadius);
  });

  it('kamera bisa melihat seluruh sistem dalam batas far-nya', () => {
    const neptune = PLANETS.find((planet) => planet.id === 'neptune');
    const extent = neptune.displayDistance + neptune.displayRadius + 60;
    assert(extent < 520 * 1.6, `jangkauan sistem ${extent} melebihi far maksimum`);
  });
});

describe('kecepatan orbit', () => {
  it('bulan mengikuti hukum posisi: periode positif kecuali Triton', () => {
    const triton = PLANETS.find((planet) => planet.id === 'neptune').moons.find((moon) => moon.id === 'triton');
    assert(triton.periodDays < 0, 'Triton seharusnya retrograde');
    const io = PLANETS.find((planet) => planet.id === 'jupiter').moons.find((moon) => moon.id === 'io');
    assert(Math.abs(io.periodDays - 1.769138) < 1e-6);
  });

  it('angularSpeed konsisten dengan periodDays', () => {
    for (const planet of PLANETS) {
      for (const moon of planet.moons ?? []) {
        const expected = (Math.PI * 2) / (moon.periodDays * 24);
        assert(Math.abs(moon.angularSpeed - expected) < 1e-12, moon.id);
      }
    }
  });
});
