/**
 * Atmosphere.js — cangkang atmosfer untuk sebuah benda langit.
 *
 * Setiap atmosfer terdiri dari dua cangkang tipis:
 *   - sisi belakang  -> halo yang terlihat di sekeliling tepi piringan planet
 *   - sisi depan     -> kabut tipis yang mewarnai permukaan bagian tepi
 *
 * Keduanya memakai material aditif dengan depthWrite dimatikan, jadi tidak
 * pernah menutupi permukaan planet dan tidak saling menutupi.
 */
import { Group, Mesh, SphereGeometry } from 'three';
import { createAtmosphereMaterial } from '../shaders/atmosphere.js';

/**
 * @param {object} body definisi benda langit (harus punya `atmosphere`)
 * @param {{ layers?: number, segments?: number }} [options]
 * @returns {Group|null}
 */
export function createAtmosphereShell(body, options = {}) {
  const config = body.atmosphere;
  if (!config) return null;

  const layers = options.layers ?? 2;
  const segments = options.segments ?? 48;
  const radius = body.displayRadius * (config.scale ?? 1.03);
  const group = new Group();
  group.name = `atmosphere:${body.id}`;

  // Satu geometri dipakai bersama oleh kedua lapisan: cangkang ini tipis,
  // jadi kepadatan jaringnya tidak perlu setinggi permukaan planetnya.
  const geometry = new SphereGeometry(radius, segments * 2, segments);

  if (layers >= 1) {
    const back = new Mesh(geometry, createAtmosphereMaterial(config, 'back'));
    back.name = 'atmosphere-back';
    back.renderOrder = 3;
    group.add(back);
  }
  if (layers >= 2) {
    const front = new Mesh(geometry, createAtmosphereMaterial(config, 'front'));
    front.name = 'atmosphere-front';
    front.renderOrder = 6;
    group.add(front);
  }

  group.userData.geometry = geometry;
  return group;
}
