/**
 * Uji kurva skala: urutan planet benar, tanpa tumpang-tindih, dan zoom monoton.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { anchorBlend, displayDistance, displayRadius, smoothstep, zoomRadius } from '../src/config/scale.js';

describe('kurva kompresi ukuran & jarak', () => {
  it('menghasilkan nilai tampilan sesuai tabel rencana', () => {
    assert(Math.abs(displayRadius(6371) - 1.35) < 1e-9);
    assert(Math.abs(displayDistance(1) - 30) < 1e-9);
    assert(Math.abs(displayDistance(30.07) - 247.5) < 2.5);
    assert(Math.abs(displayRadius(696340) - 9.7) < 0.35);
  });

  it('monoton: planet yang lebih jauh selalu digambar lebih jauh', () => {
    const distances = [0.387, 0.723, 1, 1.524, 5.203, 9.537, 19.191, 30.07].map(displayDistance);
    for (let i = 1; i < distances.length; i++) assert(distances[i] > distances[i - 1]);
  });

  it('monoton pula untuk ukuran (planet lebih besar digambar lebih besar)', () => {
    const radii = [2440, 3390, 6052, 6371, 24622, 25362, 58232, 69911].map(displayRadius);
    for (let i = 1; i < radii.length; i++) assert(radii[i] > radii[i - 1]);
  });
});

describe('zoomRadius', () => {
  it('monoton naik terhadap z dan mencakup rentang yang direncanakan', () => {
    const focus = 1.35;
    assert(Math.abs(zoomRadius(0, focus) - focus * 1.75) < 1e-9);
    assert(Math.abs(zoomRadius(1, focus) - 520) < 1e-9);
    let previous = 0;
    for (let i = 0; i <= 20; i++) {
      const radius = zoomRadius(i / 20, focus);
      assert(radius > previous, `tidak monoton pada z=${i / 20}`);
      previous = radius;
    }
  });

  it('menempatkan globe Bumi penuh dalam bingkai pada z awal', () => {
    // z = 0.085 -> radius sekitar 2,4-2,6x jari-jari Bumi.
    const radius = zoomRadius(0.085, 1.35);
    assert(radius > 2.2 && radius < 2.9, `radius awal ${radius} di luar rentang bingkai globe`);
  });
});

describe('anchorBlend & smoothstep', () => {
  it('anchor tetap di planet saat dekat, penuh ke Matahari saat jauh', () => {
    assert.equal(anchorBlend(0), 0);
    assert.equal(anchorBlend(0.29), 0);
    assert.equal(anchorBlend(0.87), 1);
    assert.equal(anchorBlend(1), 1);
    const middle = anchorBlend(0.58);
    assert(middle > 0.3 && middle < 0.7, `transisi tengah ${middle} tidak mulus`);
  });

  it('smoothstep terkunci pada 0..1 di luar rentang', () => {
    assert.equal(smoothstep(0, 1, -5), 0);
    assert.equal(smoothstep(0, 1, 5), 1);
  });
});
