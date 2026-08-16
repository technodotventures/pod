import assert from 'node:assert/strict';
import test from 'node:test';

import {
  captureOrbitCameraView,
  configureOrbitControls,
  installOrbitGestureGuard,
  orbitCameraPose,
  orbitDistanceBounds,
  orbitDistancePresentation,
  orbitOverviewDistance,
  orbitZoomDistance,
} from '../src/orbit-controls';

function browserEvent(type: string, properties: Record<string, unknown> = {}) {
  const event = new Event(type, { cancelable: true });
  for (const [key, value] of Object.entries(properties)) {
    Object.defineProperty(event, key, { value });
  }
  return event;
}

test('Orbit stops immediately on pointer release and uses deliberate mouse speeds', () => {
  const controls = {
    staticMoving: false,
    rotateSpeed: 1,
    zoomSpeed: 1.2,
    panSpeed: 0.3,
  };

  configureOrbitControls(controls);

  assert.equal(controls.staticMoving, true);
  assert.equal(controls.rotateSpeed, 0.65);
  assert.equal(controls.zoomSpeed, 1.35);
  assert.equal(controls.panSpeed, 0.25);
});

test('Orbit camera keeps a dataset-relative reading-distance floor', () => {
  const bounds = orbitDistanceBounds(800, 220);

  assert.equal(bounds.minDistance, 160);
  assert.equal(bounds.maxDistance, 2000);
  assert.equal(orbitZoomDistance(180, 0.5, bounds), bounds.minDistance);
  assert.equal(orbitZoomDistance(180, 1.5, bounds), 270);
});

test('Orbit camera view preserves depth, target and angle across mode switches', () => {
  const position = { x: 11, y: -3, z: 19 };
  const target = { x: 1, y: 2, z: 4 };
  const up = { x: 0.2, y: 1, z: 0.1 };
  const view = captureOrbitCameraView(position, target, up);

  assert.ok(view);
  const pose = orbitCameraPose(view, { minDistance: 1, maxDistance: 100 });

  assert.ok(pose);
  assert.deepEqual(pose.target, target);
  assert.ok(Math.abs(pose.position.x - position.x) < 0.0001);
  assert.ok(Math.abs(pose.position.y - position.y) < 0.0001);
  assert.ok(Math.abs(pose.position.z - position.z) < 0.0001);
  assert.ok(Math.abs(Math.hypot(
    pose.position.x - pose.target.x,
    pose.position.y - pose.target.y,
    pose.position.z - pose.target.z,
  ) - view.distance) < 0.0001);
});

test('restored Orbit depth is clamped without changing its viewing angle', () => {
  const view = captureOrbitCameraView(
    { x: 0, y: 0, z: 500 },
    { x: 0, y: 0, z: 0 },
    { x: 0, y: 1, z: 0 },
  );

  assert.ok(view);
  const pose = orbitCameraPose(view, { minDistance: 20, maxDistance: 200 });

  assert.deepEqual(pose?.position, { x: 0, y: 0, z: 200 });
  assert.deepEqual(pose?.target, { x: 0, y: 0, z: 0 });
});

test('repeated button zoom preserves the Orbit sphere and navigation model', () => {
  const overviewDistance = 800;
  const bounds = orbitDistanceBounds(overviewDistance, 220);
  let distance = overviewDistance;

  for (let click = 1; click <= 5; click += 1) {
    distance = orbitZoomDistance(distance, 0.78, bounds);
    const presentation = orbitDistancePresentation(distance, overviewDistance);
    assert.equal(presentation.faceCameraBlend, 0, `click ${click} must not rotate the graph toward the camera`);
    assert.equal(presentation.depthScale, 1, `click ${click} must not flatten the sphere`);
  }
});

test('Orbit overview frames the whole sphere with deliberate breathing room', () => {
  const landscape = orbitOverviewDistance(220, 32, 16 / 9);
  const portrait = orbitOverviewDistance(220, 32, 0.6);

  assert.ok(landscape > 220 * 5 && landscape < 220 * 7);
  assert.ok(portrait > landscape, 'portrait viewports should use their narrower horizontal field of view');
});

test('Orbit claims browser pinch gestures only while they occur over its surface', () => {
  const surface = new EventTarget();
  const zoomFactors: number[] = [];
  const cleanup = installOrbitGestureGuard(surface, factor => zoomFactors.push(factor));

  const trackpadPinch = browserEvent('wheel', { ctrlKey: true });
  surface.dispatchEvent(trackpadPinch);
  assert.equal(trackpadPinch.defaultPrevented, true);

  const ordinaryWheel = browserEvent('wheel', { ctrlKey: false });
  surface.dispatchEvent(ordinaryWheel);
  assert.equal(ordinaryWheel.defaultPrevented, false);

  const gestureStart = browserEvent('gesturestart', { scale: 1 });
  const gestureChange = browserEvent('gesturechange', { scale: 1.1 });
  surface.dispatchEvent(gestureStart);
  surface.dispatchEvent(gestureChange);
  assert.equal(gestureStart.defaultPrevented, true);
  assert.equal(gestureChange.defaultPrevented, true);
  assert.equal(zoomFactors.length, 1);
  assert.ok(zoomFactors[0] < 1 && zoomFactors[0] > 0.9);

  const gestureZoomOut = browserEvent('gesturechange', { scale: 0.55 });
  surface.dispatchEvent(gestureZoomOut);
  assert.ok(zoomFactors[1] > 1.2, 'pinch zoom-out should escape a close view quickly');

  cleanup();
  const afterCleanup = browserEvent('wheel', { ctrlKey: true });
  surface.dispatchEvent(afterCleanup);
  assert.equal(afterCleanup.defaultPrevented, false);
});
