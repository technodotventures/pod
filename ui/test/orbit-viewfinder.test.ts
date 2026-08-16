import assert from 'node:assert/strict';
import test from 'node:test';

import { orbitViewfinderCamera } from '../src/orbit-viewfinder';

test('Orbit viewfinder projects camera direction and zoom into its overview', () => {
  const indicator = orbitViewfinderCamera(
    { x: 1, y: 0, z: 0 },
    400,
    800,
    160,
    110,
  );

  assert.ok(indicator.x > 130);
  assert.equal(indicator.y, 55);
  assert.equal(indicator.zoomRatio, 0.5);
  assert.equal(indicator.frontFacing, true);
});

test('Orbit viewfinder keeps extreme camera values inside the instrument', () => {
  const indicator = orbitViewfinderCamera(
    { x: -20, y: 20, z: -10 },
    10,
    0,
    160,
    110,
  );

  assert.ok(indicator.x >= 8 && indicator.x <= 152);
  assert.ok(indicator.y >= 8 && indicator.y <= 102);
  assert.equal(indicator.zoomRatio, 0.2);
  assert.equal(indicator.frontFacing, false);
});
