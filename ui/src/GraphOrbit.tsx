/**
 * GraphOrbit — stable 3D view of the knowledge graph.
 *
 * It remains a true 3D knowledge sphere (3d-force-graph / three.js) throughout
 * camera navigation. Moving closer reveals more labels without changing the
 * projection or interaction model.
 *
 * Nodes render as soft luminous particles (a single white radial-gradient
 * sprite tinted by the current lens) rather than shaded spheres — minimal at rest,
 * glowing in aggregate.
 *
 * Filters, trust facets and time playback apply live: the parent passes the
 * already-filtered node/link set and we rebuild the stable sphere on change.
 */
import React from 'react';
import ForceGraph3D from '3d-force-graph';
import SpriteText from 'three-spritetext';
import * as THREE from 'three';
import { orbitLabelPresentation } from './graph-contract';
import {
  captureOrbitCameraView,
  configureOrbitControls,
  installOrbitGestureGuard,
  orbitCameraPose,
  orbitDistancePresentation,
  orbitDistanceBounds,
  orbitOverviewDistance,
  orbitZoomDistance,
  type OrbitCameraView,
  type OrbitControlsConfigurable,
  type OrbitDistanceBounds,
} from './orbit-controls';
import { drawOrbitViewfinder, type OrbitViewfinderNode } from './orbit-viewfinder';
import { layoutOrbitSphere, orbitLinkPresentation, orbitNodePresentation } from './orbit-layout';
import type { LensId, SizeMode } from './lenses';

export interface OrbitNode {
  id: string;
  label: string;
  type: string;
  epistemic?: string;
  degree: number;
  isHub?: boolean;
  rank: number;
  cluster?: string;
  community?: number;
  influence: number;
  isBridge?: boolean;
}

export interface OrbitLink {
  source: string;
  target: string;
  layer: 'structural' | 'canonical' | 'derived' | 'annotation';
  crossCommunity?: boolean;
  emphasis?: number;
}

export interface GraphOrbitHandle {
  /** Dolly the camera toward (<1) or away from (>1) the orbit target. */
  zoomBy: (factor: number) => void;
  fitToView: () => void;
}

/** One shared white radial-gradient texture — tinted per node via material.color. */
let particleTexture: THREE.CanvasTexture | null = null;
const particleMaterials = new Map<string, THREE.SpriteMaterial>();
function getParticleTexture(): THREE.CanvasTexture {
  if (particleTexture) return particleTexture;
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.25, 'rgba(255,255,255,0.9)');
  g.addColorStop(0.55, 'rgba(255,255,255,0.28)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  particleTexture = new THREE.CanvasTexture(canvas);
  return particleTexture;
}

function getParticleMaterial(color: string, selected = false): THREE.SpriteMaterial {
  const key = selected ? 'selected' : color;
  const existing = particleMaterials.get(key);
  if (existing) return existing;
  const material = new THREE.SpriteMaterial({
    map: getParticleTexture(),
    color: new THREE.Color(selected ? '#FFFFFF' : color),
    transparent: true,
    depthWrite: false,
  });
  particleMaterials.set(key, material);
  return material;
}

function disposeLabels(labels: Map<string, { sprite: SpriteText; node: OrbitNode }>) {
  labels.forEach(({ sprite }) => {
    sprite.material.map?.dispose();
    sprite.material.dispose();
  });
  labels.clear();
}

const GraphOrbit = React.forwardRef<GraphOrbitHandle, {
  nodes: OrbitNode[];
  links: OrbitLink[];
  lensId: LensId;
  sizeMode: SizeMode;
  nodeScale: number;
  linkScale: number;
  linkOpacity: number;
  labelDensity: number;
  active?: boolean;
  selectedId?: string | null;
  initialView?: OrbitCameraView | null;
  onViewChange?: (view: OrbitCameraView) => void;
  onSelectNode?: (id: string) => void;
}>(function GraphOrbit(props, ref) {
  const wrapRef = React.useRef<HTMLDivElement>(null);
  const viewfinderRef = React.useRef<HTMLCanvasElement>(null);
  // 3d-force-graph's fluent instance — kept as any; its d.ts and our TSX setup disagree on generics.
  const fgRef = React.useRef<any>(null);
  const spritesRef = React.useRef<Map<string, { sprite: SpriteText; node: OrbitNode }>>(new Map());
  const groupsRef = React.useRef<Map<string, THREE.Group>>(new Map());
  const particlesRef = React.useRef<Map<string, THREE.Sprite>>(new Map());
  const nodesByIdRef = React.useRef<Map<string, OrbitNode>>(new Map());
  const nodeCountRef = React.useRef(props.nodes.length);
  const sphereRadiusRef = React.useRef(90);
  const overviewDistRef = React.useRef(0);
  const distanceBoundsRef = React.useRef<OrbitDistanceBounds>({ minDistance: 0, maxDistance: Infinity });
  const viewfinderNodesRef = React.useRef<OrbitViewfinderNode[]>([]);
  const lensIdRef = React.useRef<LensId>(props.lensId);
  const sizeModeRef = React.useRef<SizeMode>(props.sizeMode);
  const nodeScaleRef = React.useRef(props.nodeScale);
  const linkScaleRef = React.useRef(props.linkScale);
  const linkOpacityRef = React.useRef(props.linkOpacity);
  const labelDensityRef = React.useRef(props.labelDensity);
  const selectedIdRef = React.useRef(props.selectedId);
  const previousSelectedIdRef = React.useRef<string | null>(null);
  const zoomFnRef = React.useRef<(factor: number) => void>(() => {});
  const frameViewRef = React.useRef<(duration: number) => void>(() => {});
  const fitViewRef = React.useRef<() => void>(() => {});
  const restoreViewRef = React.useRef<(view: OrbitCameraView) => boolean>(() => false);
  const refreshLabelsRef = React.useRef<() => void>(() => {});
  const drawViewfinderRef = React.useRef<() => void>(() => {});
  const ensureLabelRef = React.useRef<(node: OrbitNode) => void>(() => {});
  const initialViewRef = React.useRef<OrbitCameraView | null>(props.initialView ?? null);
  const onViewChangeRef = React.useRef(props.onViewChange);
  const onSelectRef = React.useRef(props.onSelectNode);
  onSelectRef.current = props.onSelectNode;
  onViewChangeRef.current = props.onViewChange;
  selectedIdRef.current = props.selectedId;
  lensIdRef.current = props.lensId;
  sizeModeRef.current = props.sizeMode;
  nodeScaleRef.current = props.nodeScale;
  linkScaleRef.current = props.linkScale;
  linkOpacityRef.current = props.linkOpacity;
  labelDensityRef.current = props.labelDensity;

  React.useImperativeHandle(ref, () => ({
    zoomBy: (factor: number) => zoomFnRef.current(factor),
    fitToView: () => fitViewRef.current(),
  }), []);

  React.useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;

    // Follow the app theme — the Map ground is themable (:root[data-theme='light']).
    const isLight = document.documentElement.dataset.theme === 'light';
    const cssBg = getComputedStyle(document.documentElement).getPropertyValue('--graph-bg').trim();
    const bgColor = cssBg || (isLight ? '#F6F7F9' : '#0F141D');
    const labelColor = isLight ? 'rgba(32, 38, 46, 0.95)' : 'rgba(226, 236, 248, 0.95)';
    const labelStroke = isLight ? '#F6F7F9' : '#0F141D';

    function ensureLabel(node: OrbitNode) {
      if (spritesRef.current.has(node.id)) return;
      const group = groupsRef.current.get(node.id);
      if (!group) return;
      const sprite = new SpriteText(node.label, 6.2, labelColor);
      sprite.fontFace = 'Inter, ui-sans-serif, system-ui, sans-serif';
      sprite.fontWeight = '600';
      sprite.strokeWidth = 0.08;
      sprite.strokeColor = labelStroke;
      sprite.padding = [2, 1];
      sprite.material.transparent = true;
      sprite.material.opacity = 0;
      sprite.material.depthWrite = false;
      sprite.material.depthTest = false;
      sprite.renderOrder = 10;
      sprite.position.set(0, orbitNodePresentation(node, lensIdRef.current, sizeModeRef.current).size * nodeScaleRef.current + 7, 0);
      (sprite as any).__baseScale = sprite.scale.clone();
      (sprite as any).__baseOffsetY = sprite.position.y;
      spritesRef.current.set(node.id, { sprite, node });
      group.add(sprite as unknown as THREE.Object3D);
    }
    ensureLabelRef.current = ensureLabel;

    // v1.73+ exports a class — must be constructed with `new`.
    const fg: any = new (ForceGraph3D as any)(el);
    fg.backgroundColor(bgColor)
      .showNavInfo(false)
      .nodeVal((n: any) => orbitNodePresentation(n, lensIdRef.current, sizeModeRef.current).size * nodeScaleRef.current)
      .nodeLabel(() => '') // no HTML tooltip — sprite labels appear at reading distance
      .linkColor((link: OrbitLink) => orbitLinkPresentation(link, lensIdRef.current).color)
      .linkWidth((link: OrbitLink) => orbitLinkPresentation(link, lensIdRef.current).width * linkScaleRef.current)
      .linkOpacity(linkOpacityRef.current)
      .nodeThreeObjectExtend(false)
      .nodeThreeObject((n: any) => {
        const group = new THREE.Group();
        // Luminous particle — one white texture, tinted by the active lens.
        // Shared materials are keyed by the lens-derived color, not allocated per node.
        const presentation = orbitNodePresentation(n, lensIdRef.current, sizeModeRef.current);
        const particle = new THREE.Sprite(getParticleMaterial(presentation.color));
        const s = presentation.size * 3 * nodeScaleRef.current;
        particle.scale.set(s, s, 1);
        (particle as any).__baseScale = s;
        group.add(particle);
        groupsRef.current.set(n.id, group);
        particlesRef.current.set(n.id, particle);
        // Keep the expensive text-object pool bounded. Any selected node is added lazily.
        if (n.isHub || n.rank < Math.round(240 * labelDensityRef.current) || selectedIdRef.current === n.id) ensureLabel(n);
        return group;
      })
      .onNodeClick((n: any) => {
        onSelectRef.current?.(n.id);
        if (Number.isFinite(n.x) && Number.isFinite(n.y) && Number.isFinite(n.z)) {
          const target = new THREE.Vector3(n.x, n.y, n.z);
          const focusDistance = Math.max(60, distanceBoundsRef.current.minDistance);
          const position = (fg.camera() as THREE.PerspectiveCamera).position.clone()
            .sub(target)
            .normalize()
            .multiplyScalar(focusDistance)
            .add(target);
          fg.cameraPosition(position, n, 700);
        }
      })
      .warmupTicks(0)
      .cooldownTicks(0)
      .cooldownTime(0);
    fgRef.current = fg;

    // Close camera distances reveal reading detail without changing the sphere transform.
    const camera = fg.camera() as THREE.PerspectiveCamera;
    camera.fov = 32;
    camera.updateProjectionMatrix();
    const controls = fg.controls() as unknown as THREE.EventDispatcher & OrbitControlsConfigurable & {
      addEventListener: any;
      removeEventListener: any;
      target?: THREE.Vector3;
      minDistance?: number;
      maxDistance?: number;
      update?: () => void;
    };
    configureOrbitControls(controls);
    const Z_AXIS = new THREE.Vector3(0, 0, 1);
    const qTarget = new THREE.Quaternion();
    const camDir = new THREE.Vector3();
    const worldPosition = new THREE.Vector3();

    drawViewfinderRef.current = () => {
      const viewfinder = viewfinderRef.current;
      if (!viewfinder) return;
      const target = (controls.target as THREE.Vector3) ?? new THREE.Vector3();
      const cameraOffset = camera.position.clone().sub(target);
      const rootStyles = getComputedStyle(document.documentElement);
      drawOrbitViewfinder(viewfinder, {
        nodes: viewfinderNodesRef.current,
        sphereRadius: sphereRadiusRef.current,
        cameraDirection: cameraOffset,
        cameraDistance: cameraOffset.length(),
        overviewDistance: overviewDistRef.current,
        accent: rootStyles.getPropertyValue('--coffee-pink').trim() || '#FE006B',
        guide: isLight ? 'rgba(64, 79, 99, 0.24)' : 'rgba(178, 194, 214, 0.25)',
      });
    };

    function updateDistanceContext(): { overviewDistance: number; bounds: OrbitDistanceBounds } {
      const aspect = Number.isFinite(camera.aspect) && camera.aspect > 0
        ? camera.aspect
        : Math.max(0.1, el!.clientWidth / Math.max(1, el!.clientHeight));
      const overviewDistance = orbitOverviewDistance(sphereRadiusRef.current, camera.fov, aspect);
      overviewDistRef.current = overviewDistance;
      const bounds = orbitDistanceBounds(overviewDistance, sphereRadiusRef.current);
      distanceBoundsRef.current = bounds;
      controls.minDistance = bounds.minDistance;
      controls.maxDistance = bounds.maxDistance;
      (fg.scene() as THREE.Scene).fog = new THREE.Fog(
        getComputedStyle(document.documentElement).getPropertyValue('--graph-bg').trim() || '#0F141D',
        Math.max(0, overviewDistance - sphereRadiusRef.current * 0.72),
        overviewDistance + sphereRadiusRef.current * 1.28,
      );
      return { overviewDistance, bounds };
    }

    frameViewRef.current = (duration: number) => {
      const target = (controls.target as THREE.Vector3) ?? new THREE.Vector3();
      const direction = camera.position.clone().sub(target);
      if (direction.lengthSq() < 0.0001) direction.set(0, 0, 1);
      direction.normalize();
      const { overviewDistance } = updateDistanceContext();
      const center = new THREE.Vector3();
      fg.cameraPosition(direction.multiplyScalar(overviewDistance), center, duration);
      window.setTimeout(() => refreshLabelsRef.current(), duration + 20);
    };
    fitViewRef.current = () => frameViewRef.current(400);

    function graphGroup(): THREE.Object3D | undefined {
      return (fg.scene() as THREE.Scene).children.find(
        (c: any) => typeof c.graphData === 'function'
      ) as THREE.Object3D | undefined;
    }

    function publishCameraView() {
      const target = (controls.target as THREE.Vector3) ?? new THREE.Vector3();
      const view = captureOrbitCameraView(camera.position, target, camera.up);
      if (view) onViewChangeRef.current?.(view);
    }

    function onCameraChange() {
      const g = graphGroup();
      const target = (controls.target as THREE.Vector3) ?? new THREE.Vector3();
      if (!g) {
        publishCameraView();
        return;
      }
      const d = camera.position.distanceTo(target);
      const d0 = overviewDistRef.current || d;
      const presentation = orbitDistancePresentation(d, d0);
      const t = presentation.readingProximity;

      camDir.copy(camera.position).sub(target).normalize();
      qTarget.setFromUnitVectors(Z_AXIS, camDir);
      g.quaternion.identity().slerp(qTarget, presentation.faceCameraBlend);
      g.scale.z = presentation.depthScale;
      g.updateMatrixWorld(true);

      spritesRef.current.forEach(({ sprite, node }) => {
        const presentation = orbitLabelPresentation({
          distance: d,
          overviewDistance: d0,
          rank: node.rank,
          nodeCount: nodeCountRef.current,
          selected: selectedIdRef.current === node.id,
          hub: Boolean(node.isHub),
          density: labelDensityRef.current,
        });
        const group = groupsRef.current.get(node.id);
        group?.getWorldPosition(worldPosition);
        const onFrontHemisphere = worldPosition.sub(target).dot(camDir) >= -sphereRadiusRef.current * 0.04;
        sprite.visible = presentation.visible && (selectedIdRef.current === node.id || t > 0.55 || onFrontHemisphere);
        sprite.material.opacity = presentation.opacity;
        const screenScale = Math.max(0.35, Math.min(1, d / d0));
        const baseScale = (sprite as any).__baseScale as THREE.Vector3;
        if (baseScale) sprite.scale.copy(baseScale).multiplyScalar(screenScale);
        sprite.position.y = ((sprite as any).__baseOffsetY ?? (orbitNodePresentation(node, lensIdRef.current, sizeModeRef.current).size * nodeScaleRef.current + 7)) * screenScale;
      });
      drawViewfinderRef.current();
      publishCameraView();
    }
    refreshLabelsRef.current = onCameraChange;
    controls.addEventListener('change', onCameraChange);

    restoreViewRef.current = (view: OrbitCameraView) => {
      const { bounds } = updateDistanceContext();
      const pose = orbitCameraPose(view, bounds);
      if (!pose || !controls.target) return false;
      controls.target.set(pose.target.x, pose.target.y, pose.target.z);
      camera.position.set(pose.position.x, pose.position.y, pose.position.z);
      camera.up.set(pose.up.x, pose.up.y, pose.up.z);
      camera.lookAt(controls.target);
      camera.updateMatrixWorld(true);
      controls.update?.();
      onCameraChange();
      return true;
    };

    // Imperative zoom (the floating +/- buttons): dolly toward the orbit target.
    zoomFnRef.current = (factor: number) => {
      const target = (controls.target as THREE.Vector3) ?? new THREE.Vector3();
      const offset = camera.position.clone().sub(target);
      const currentDistance = offset.length();
      if (currentDistance <= 0) return;
      const nextDistance = orbitZoomDistance(currentDistance, factor, distanceBoundsRef.current);
      camera.position.copy(target).add(offset.multiplyScalar(nextDistance / currentDistance));
      onCameraChange();
    };
    const removeGestureGuard = installOrbitGestureGuard(el, factor => zoomFnRef.current(factor));

    const ro = new ResizeObserver(() => {
      fg.width(el.clientWidth);
      fg.height(el.clientHeight);
      drawViewfinderRef.current();
    });
    ro.observe(el);
    fg.width(el.clientWidth);
    fg.height(el.clientHeight);

    return () => {
      publishCameraView();
      ro.disconnect();
      removeGestureGuard();
      controls.removeEventListener('change', onCameraChange);
      disposeLabels(spritesRef.current);
      groupsRef.current.clear();
      particlesRef.current.clear();
      nodesByIdRef.current.clear();
      zoomFnRef.current = () => {};
      frameViewRef.current = () => {};
      fitViewRef.current = () => {};
      restoreViewRef.current = () => false;
      refreshLabelsRef.current = () => {};
      drawViewfinderRef.current = () => {};
      viewfinderNodesRef.current = [];
      ensureLabelRef.current = () => {};
      fg._destructor?.();
      el.innerHTML = '';
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Data updates — filters and time playback flow straight through from the parent.
  React.useEffect(() => {
    const fg = fgRef.current;
    if (!fg) return;
    disposeLabels(spritesRef.current);
    groupsRef.current.clear();
    particlesRef.current.clear();
    nodeCountRef.current = props.nodes.length;
    nodesByIdRef.current = new Map(props.nodes.map(node => [node.id, node]));
    const sphere = layoutOrbitSphere(props.nodes, props.lensId);
    sphereRadiusRef.current = sphere.radius;
    viewfinderNodesRef.current = sphere.nodes.map(node => ({
      id: node.id,
      x: node.x,
      y: node.y,
      z: node.z,
      color: orbitNodePresentation(node, props.lensId, props.sizeMode).color,
      isHub: node.isHub,
    }));
    fg.graphData({
      nodes: sphere.nodes,
      links: props.links.map(link => ({ ...link, source: link.source, target: link.target })),
    });
    fg.refresh?.();
    // Frame the fixed sphere, then derive depth fog and reading thresholds from that view.
    let innerFrame = 0;
    const outerFrame = requestAnimationFrame(() => {
      innerFrame = requestAnimationFrame(() => {
        const initialView = initialViewRef.current;
        initialViewRef.current = null;
        if (!initialView || !restoreViewRef.current(initialView)) frameViewRef.current(0);
      });
    });
    return () => {
      cancelAnimationFrame(outerFrame);
      if (innerFrame) cancelAnimationFrame(innerFrame);
    };
  }, [props.nodes, props.links, props.lensId]);

  React.useEffect(() => {
    const fg = fgRef.current;
    if (!fg) return;
    if (props.active === false) fg.pauseAnimation?.();
    else {
      fg.resumeAnimation?.();
      refreshLabelsRef.current();
    }
  }, [props.active]);

  // Shared visual settings update in place so tuning does not reset the Orbit camera.
  React.useEffect(() => {
    const fg = fgRef.current;
    if (!fg) return;
    const labelPool = Math.round(240 * props.labelDensity);
    for (const node of props.nodes) {
      if (node.isHub || node.rank < labelPool || props.selectedId === node.id) ensureLabelRef.current(node);
      const particle = particlesRef.current.get(node.id);
      if (!particle) continue;
      const presentation = orbitNodePresentation(node, props.lensId, props.sizeMode);
      const base = presentation.size * 3 * props.nodeScale;
      (particle as any).__baseScale = base;
      particle.material = getParticleMaterial(presentation.color, props.selectedId === node.id);
      const rendered = props.selectedId === node.id ? base * 1.35 : base;
      particle.scale.set(rendered, rendered, 1);
      const label = spritesRef.current.get(node.id)?.sprite;
      if (label) {
        (label as any).__baseOffsetY = presentation.size * props.nodeScale + 7;
      }
    }
    fg.nodeVal((node: OrbitNode) => orbitNodePresentation(node, props.lensId, props.sizeMode).size * props.nodeScale);
    fg.linkWidth((link: OrbitLink) => orbitLinkPresentation(link, props.lensId).width * props.linkScale);
    fg.linkOpacity(props.linkOpacity);
    fg.refresh?.();
    const sourceById = new Map(props.nodes.map(node => [node.id, node]));
    viewfinderNodesRef.current = viewfinderNodesRef.current.map(point => {
      const node = sourceById.get(point.id);
      return node
        ? { ...point, color: orbitNodePresentation(node, props.lensId, props.sizeMode).color, isHub: node.isHub }
        : point;
    });
    refreshLabelsRef.current();
  }, [props.labelDensity, props.lensId, props.linkOpacity, props.linkScale, props.nodeScale, props.nodes, props.selectedId, props.sizeMode]);

  // Selection — the picked particle burns white and swells slightly.
  React.useEffect(() => {
    const updateParticle = (id: string | null | undefined) => {
      if (!id) return;
      const particle = particlesRef.current.get(id);
      if (!particle) return;
      const node = nodesByIdRef.current.get(id);
      if (!node) return;
      const base = (particle as any).__baseScale ?? particle.scale.x;
      const isSel = props.selectedId === id;
      particle.material = getParticleMaterial(orbitNodePresentation(node, lensIdRef.current, sizeModeRef.current).color, isSel);
      const s = isSel ? base * 1.35 : base;
      particle.scale.set(s, s, 1);
    };
    updateParticle(previousSelectedIdRef.current);
    updateParticle(props.selectedId);
    if (props.selectedId) {
      const node = nodesByIdRef.current.get(props.selectedId);
      if (node) ensureLabelRef.current(node);
    }
    previousSelectedIdRef.current = props.selectedId ?? null;
    refreshLabelsRef.current();
  }, [props.selectedId, props.nodes]);

  return (
    <>
      <div ref={wrapRef} className="graph-orbit-canvas" />
      <div className="graph-minimap graph-orbit-viewfinder">
        <div className="graph-viewfinder-controls" role="group" aria-label="Orbit view controls">
          <button
            type="button"
            className="graph-viewfinder-control"
            onClick={() => zoomFnRef.current(1.45)}
            aria-label="Zoom out"
            title="Zoom out"
          >−</button>
          <button
            type="button"
            className="graph-viewfinder-control graph-viewfinder-reset"
            onClick={() => fitViewRef.current()}
            title="Reset view"
          >Reset</button>
          <button
            type="button"
            className="graph-viewfinder-control"
            onClick={() => zoomFnRef.current(0.78)}
            aria-label="Zoom in"
            title="Zoom in"
          >+</button>
        </div>
        <button
          type="button"
          className="graph-viewfinder-viewport graph-orbit-viewfinder-button"
          onClick={() => fitViewRef.current()}
          aria-label="Reset Orbit view"
          title="Reset Orbit view"
        >
          <canvas ref={viewfinderRef} aria-hidden="true" />
        </button>
      </div>
    </>
  );
});

export default GraphOrbit;
