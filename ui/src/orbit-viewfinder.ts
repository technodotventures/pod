export interface OrbitViewfinderNode {
  id: string;
  x: number;
  y: number;
  z: number;
  color: string;
  isHub?: boolean;
}

export interface OrbitViewfinderIndicator {
  x: number;
  y: number;
  zoomRatio: number;
  frontFacing: boolean;
}

export function orbitViewfinderCamera(
  direction: { x: number; y: number; z: number },
  distance: number,
  overviewDistance: number,
  width: number,
  height: number,
): OrbitViewfinderIndicator {
  const safeWidth = Math.max(16, width);
  const safeHeight = Math.max(16, height);
  const length = Math.hypot(direction.x, direction.y, direction.z) || 1;
  const x = direction.x / length;
  const y = direction.y / length;
  const z = direction.z / length;
  const radiusX = safeWidth * 0.37;
  const radiusY = safeHeight * 0.34;
  const edgePadding = 8;
  return {
    x: Math.max(edgePadding, Math.min(safeWidth - edgePadding, safeWidth / 2 + x * radiusX)),
    y: Math.max(edgePadding, Math.min(safeHeight - edgePadding, safeHeight / 2 - y * radiusY)),
    zoomRatio: overviewDistance > 0
      ? Math.max(0.2, Math.min(1, distance / overviewDistance))
      : 0.2,
    frontFacing: z >= 0,
  };
}

export function drawOrbitViewfinder(
  canvas: HTMLCanvasElement,
  options: {
    nodes: OrbitViewfinderNode[];
    sphereRadius: number;
    cameraDirection: { x: number; y: number; z: number };
    cameraDistance: number;
    overviewDistance: number;
    accent: string;
    guide: string;
    devicePixelRatio?: number;
  },
): void {
  const width = canvas.clientWidth || 160;
  const height = canvas.clientHeight || 110;
  const ratio = Math.max(1, Math.min(2, options.devicePixelRatio ?? window.devicePixelRatio ?? 1));
  const pixelWidth = Math.max(1, Math.round(width * ratio));
  const pixelHeight = Math.max(1, Math.round(height * ratio));
  if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
    canvas.width = pixelWidth;
    canvas.height = pixelHeight;
  }
  const context = canvas.getContext('2d');
  if (!context) return;
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  context.clearRect(0, 0, width, height);

  const centerX = width / 2;
  const centerY = height / 2;
  const radiusX = width * 0.37;
  const radiusY = height * 0.34;
  const sphereRadius = Math.max(1, options.sphereRadius);

  context.save();
  context.beginPath();
  context.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, Math.PI * 2);
  context.clip();
  for (const node of options.nodes) {
    const depth = Math.max(-1, Math.min(1, node.z / sphereRadius));
    const x = centerX + Math.max(-1, Math.min(1, node.x / sphereRadius)) * radiusX * 0.94;
    const y = centerY - Math.max(-1, Math.min(1, node.y / sphereRadius)) * radiusY * 0.94;
    const size = node.isHub ? 1.65 : 0.72 + (depth + 1) * 0.18;
    context.globalAlpha = 0.18 + (depth + 1) * 0.22;
    context.fillStyle = node.color;
    context.beginPath();
    context.arc(x, y, size, 0, Math.PI * 2);
    context.fill();
  }
  context.restore();
  context.globalAlpha = 1;

  context.strokeStyle = options.guide;
  context.lineWidth = 1;
  context.beginPath();
  context.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, Math.PI * 2);
  context.stroke();
  context.beginPath();
  context.moveTo(centerX - radiusX, centerY);
  context.lineTo(centerX + radiusX, centerY);
  context.moveTo(centerX, centerY - radiusY);
  context.lineTo(centerX, centerY + radiusY);
  context.globalAlpha = 0.36;
  context.stroke();
  context.globalAlpha = 1;

  const camera = orbitViewfinderCamera(
    options.cameraDirection,
    options.cameraDistance,
    options.overviewDistance,
    width,
    height,
  );
  const towardCenterX = centerX - camera.x;
  const towardCenterY = centerY - camera.y;
  const towardLength = Math.hypot(towardCenterX, towardCenterY) || 1;
  const normalX = -towardCenterY / towardLength;
  const normalY = towardCenterX / towardLength;
  const sightWidth = 4 + camera.zoomRatio * 12;

  context.fillStyle = options.accent;
  context.globalAlpha = 0.1;
  context.beginPath();
  context.moveTo(camera.x, camera.y);
  context.lineTo(centerX + normalX * sightWidth, centerY + normalY * sightWidth);
  context.lineTo(centerX - normalX * sightWidth, centerY - normalY * sightWidth);
  context.closePath();
  context.fill();

  context.globalAlpha = camera.frontFacing ? 0.78 : 0.42;
  context.strokeStyle = options.accent;
  context.setLineDash(camera.frontFacing ? [] : [3, 3]);
  context.beginPath();
  context.moveTo(camera.x, camera.y);
  context.lineTo(centerX, centerY);
  context.stroke();
  context.setLineDash([]);
  context.globalAlpha = 1;
  context.fillStyle = options.accent;
  context.beginPath();
  context.arc(camera.x, camera.y, 2.6, 0, Math.PI * 2);
  context.fill();
  context.strokeStyle = options.accent;
  context.globalAlpha = 0.52;
  context.beginPath();
  context.arc(camera.x, camera.y, 5 + camera.zoomRatio * 5, 0, Math.PI * 2);
  context.stroke();
  context.globalAlpha = 1;
}
