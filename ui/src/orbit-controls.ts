export interface OrbitControlsConfigurable {
  staticMoving: boolean;
  rotateSpeed: number;
  zoomSpeed: number;
  panSpeed: number;
  minDistance?: number;
  maxDistance?: number;
}

export interface OrbitDistanceBounds {
  minDistance: number;
  maxDistance: number;
}

export interface OrbitDistancePresentation {
  readingProximity: number;
  faceCameraBlend: number;
  depthScale: number;
}

export interface OrbitVector3 {
  x: number;
  y: number;
  z: number;
}

export interface OrbitCameraView {
  target: OrbitVector3;
  direction: OrbitVector3;
  up: OrbitVector3;
  distance: number;
}

export interface OrbitCameraPose {
  target: OrbitVector3;
  position: OrbitVector3;
  up: OrbitVector3;
}

function finiteVector(vector: OrbitVector3): boolean {
  return Number.isFinite(vector.x) && Number.isFinite(vector.y) && Number.isFinite(vector.z);
}

function normalizedVector(vector: OrbitVector3): OrbitVector3 | null {
  if (!finiteVector(vector)) return null;
  const length = Math.hypot(vector.x, vector.y, vector.z);
  if (length < 0.0001) return null;
  return { x: vector.x / length, y: vector.y / length, z: vector.z / length };
}

/** Capture the view dimensions that users perceive as Orbit depth and angle. */
export function captureOrbitCameraView(
  position: OrbitVector3,
  target: OrbitVector3,
  up: OrbitVector3,
): OrbitCameraView | null {
  if (!finiteVector(position) || !finiteVector(target)) return null;
  const offset = {
    x: position.x - target.x,
    y: position.y - target.y,
    z: position.z - target.z,
  };
  const direction = normalizedVector(offset);
  const normalizedUp = normalizedVector(up);
  if (!direction || !normalizedUp) return null;
  return {
    target: { ...target },
    direction,
    up: normalizedUp,
    distance: Math.hypot(offset.x, offset.y, offset.z),
  };
}

/** Restore a saved Orbit view while respecting the current dataset's distance bounds. */
export function orbitCameraPose(
  view: OrbitCameraView,
  bounds: OrbitDistanceBounds,
): OrbitCameraPose | null {
  if (!finiteVector(view.target) || !Number.isFinite(view.distance)) return null;
  const direction = normalizedVector(view.direction);
  const up = normalizedVector(view.up);
  if (!direction || !up || view.distance <= 0) return null;
  const distance = orbitZoomDistance(view.distance, 1, bounds);
  return {
    target: { ...view.target },
    position: {
      x: view.target.x + direction.x * distance,
      y: view.target.y + direction.y * distance,
      z: view.target.z + direction.z * distance,
    },
    up,
  };
}

/** Frame the stable knowledge sphere independently of renderer initialization and scene transforms. */
export function orbitOverviewDistance(sphereRadius: number, verticalFovDegrees: number, aspect: number): number {
  const radius = Math.max(1, sphereRadius) * 1.12;
  const verticalHalfFov = Math.max(5, Math.min(60, verticalFovDegrees / 2)) * Math.PI / 180;
  const horizontalHalfFov = Math.atan(Math.tan(verticalHalfFov) * Math.max(0.1, aspect));
  const limitingHalfFov = Math.min(verticalHalfFov, horizontalHalfFov);
  const framedHalfAngle = Math.max(0.01, limitingHalfFov * 0.68);
  return radius / Math.sin(framedHalfAngle);
}

/** Keep the camera out of the sphere's unreadable centre while scaling with large datasets. */
export function orbitDistanceBounds(overviewDistance: number, sphereRadius: number): OrbitDistanceBounds {
  const overview = Math.max(1, overviewDistance);
  const radius = Math.max(1, sphereRadius);
  return {
    minDistance: Math.min(overview * 0.5, Math.max(overview * 0.2, radius * 0.6)),
    maxDistance: overview * 2.5,
  };
}

/** Apply the same bounds to buttons and native gestures that bypass TrackballControls. */
export function orbitZoomDistance(
  currentDistance: number,
  factor: number,
  bounds: OrbitDistanceBounds,
): number {
  const nextDistance = currentDistance * factor;
  return Math.max(bounds.minDistance, Math.min(bounds.maxDistance, nextDistance));
}

/** Reveal close-reading detail without changing Orbit's spherical navigation model. */
export function orbitDistancePresentation(
  distance: number,
  overviewDistance: number,
): OrbitDistancePresentation {
  const overview = Math.max(0.001, overviewDistance);
  const readingStart = overview * 0.55;
  const readingEnd = overview * 0.18;
  const readingProximity = Math.min(1, Math.max(
    0,
    (readingStart - distance) / (readingStart - readingEnd),
  ));
  return {
    readingProximity,
    faceCameraBlend: 0,
    depthScale: 1,
  };
}

/** Remove trackball momentum and make mouse movement precise enough for node picking. */
export function configureOrbitControls<T extends OrbitControlsConfigurable>(controls: T): T {
  controls.staticMoving = true;
  controls.rotateSpeed = 0.65;
  controls.zoomSpeed = 1.35;
  controls.panSpeed = 0.25;
  return controls;
}

type BrowserPinchEvent = Event & {
  ctrlKey?: boolean;
  scale?: number;
};

/** Keep native browser pinch zoom out of Orbit while preserving page zoom elsewhere. */
export function installOrbitGestureGuard(surface: EventTarget, zoomBy: (factor: number) => void): () => void {
  let previousGestureScale: number | null = null;
  const options: AddEventListenerOptions = { capture: true, passive: false };
  const scaleOf = (event: BrowserPinchEvent) => Number.isFinite(event.scale) ? event.scale! : 1;

  const onWheel = (event: Event) => {
    if ((event as BrowserPinchEvent).ctrlKey) event.preventDefault();
  };
  const onGestureStart = (event: Event) => {
    event.preventDefault();
    previousGestureScale = scaleOf(event as BrowserPinchEvent);
  };
  const onGestureChange = (event: Event) => {
    event.preventDefault();
    const nextScale = scaleOf(event as BrowserPinchEvent);
    if (previousGestureScale != null && nextScale > 0) {
      const dampedFactor = Math.pow(previousGestureScale / nextScale, 0.9);
      zoomBy(Math.max(0.82, Math.min(1.35, dampedFactor)));
    }
    previousGestureScale = nextScale;
  };
  const onGestureEnd = (event: Event) => {
    event.preventDefault();
    previousGestureScale = null;
  };

  surface.addEventListener('wheel', onWheel, options);
  surface.addEventListener('gesturestart', onGestureStart, options);
  surface.addEventListener('gesturechange', onGestureChange, options);
  surface.addEventListener('gestureend', onGestureEnd, options);

  return () => {
    surface.removeEventListener('wheel', onWheel, options);
    surface.removeEventListener('gesturestart', onGestureStart, options);
    surface.removeEventListener('gesturechange', onGestureChange, options);
    surface.removeEventListener('gestureend', onGestureEnd, options);
  };
}
