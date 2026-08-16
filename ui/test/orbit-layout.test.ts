import assert from 'node:assert/strict';
import test from 'node:test';

import { BUILTIN_LENSES } from '../src/lenses';
import {
  layoutOrbitSphere,
  orbitLinkPresentation,
  orbitNodePresentation,
  type OrbitLayoutInput,
} from '../src/orbit-layout';

const sphereNodes: OrbitLayoutInput[] = Array.from({ length: 240 }, (_, index) => ({
  id: `node:${index}`,
  cluster: `collection:${index % 6}`,
  community: index < 60 ? index % 3 : undefined,
  isHub: index % 40 === 0,
}));

test('clustered sphere layout is deterministic across input order', () => {
  const first = layoutOrbitSphere(sphereNodes, 'default');
  const second = layoutOrbitSphere([...sphereNodes].reverse(), 'default');
  const positions = (result: typeof first) => Object.fromEntries(
    result.nodes.map(node => [node.id, { x: node.x, y: node.y, z: node.z }]),
  );

  assert.deepEqual(positions(first), positions(second));
});

test('clustered sphere fills a rounded volume while keeping collections together', () => {
  const result = layoutOrbitSphere(sphereNodes, 'default');
  const extents = (axis: 'x' | 'y' | 'z') => {
    const values = result.nodes.map(node => node[axis]);
    return Math.max(...values) - Math.min(...values);
  };
  assert.ok(extents('x') > result.radius * 1.2);
  assert.ok(extents('y') > result.radius * 1.2);
  assert.ok(extents('z') > result.radius * 1.2);

  const collection = result.nodes.filter(node => node.cluster === 'collection:0' && !node.isHub);
  const centroid = collection.reduce((sum, node) => ({ x: sum.x + node.x, y: sum.y + node.y, z: sum.z + node.z }), { x: 0, y: 0, z: 0 });
  const centroidLength = Math.hypot(centroid.x, centroid.y, centroid.z);
  for (const node of collection) {
    const alignment = (node.x * centroid.x + node.y * centroid.y + node.z * centroid.z)
      / (Math.hypot(node.x, node.y, node.z) * centroidLength);
    assert.ok(alignment > 0.5);
  }
});

test('analytic lenses have visible, evidence-driven Orbit presentation', () => {
  const ordinary = { type: 'concept', degree: 1, influence: 0, community: undefined, isHub: false, isBridge: false };
  const influential = { ...ordinary, influence: 0.36, community: 2, isBridge: true };

  assert.ok(orbitNodePresentation(influential, 'influence').size > orbitNodePresentation(ordinary, 'influence').size * 2);
  assert.notEqual(orbitNodePresentation(influential, 'themes').color, orbitNodePresentation(ordinary, 'themes').color);
  assert.equal(orbitLinkPresentation({ layer: 'canonical', crossCommunity: true, emphasis: 0.2 }, 'bridges').color, '#FB7185');
  assert.ok(orbitLinkPresentation({ layer: 'canonical', crossCommunity: true, emphasis: 0.2 }, 'bridges').width > 1);
});

test('Orbit follows the shared uniform versus influence sizing contract', () => {
  const ordinary = { type: 'concept', degree: 1, influence: 0, community: undefined, isHub: false, isBridge: false };
  const connected = { ...ordinary, degree: 40 };
  const influential = { ...connected, influence: 0.36 };

  assert.equal(orbitNodePresentation(ordinary, 'default', 'fixed').size, orbitNodePresentation(connected, 'default', 'fixed').size);
  assert.ok(orbitNodePresentation(influential, 'default', 'betweenness').size > orbitNodePresentation(ordinary, 'default', 'betweenness').size * 2);
});

test('lenses do not trigger expensive layouts or hide the evidence they describe', () => {
  const themes = BUILTIN_LENSES.find(lens => lens.id === 'themes')!;
  const bridges = BUILTIN_LENSES.find(lens => lens.id === 'bridges')!;
  for (const lens of BUILTIN_LENSES) {
    assert.equal(lens.settings.layout, 'hub-spoke');
    assert.equal(lens.settings.autoCollapseAbove, 0);
  }
  assert.equal(themes.settings.color, 'community');
  assert.equal(bridges.settings.showDerivedAssociations, true);
});
