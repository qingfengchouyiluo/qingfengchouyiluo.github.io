import { Canvas, useFrame, useLoader } from '@react-three/fiber';
import type { ThreeEvent } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { MutableRefObject } from 'react';
import * as THREE from 'three';
import type { PlanetProfile } from './planetPortfolioData';

export type SpaceView = {
  yaw: number;
  pitch: number;
  distance: number;
};

export type InspectRotation = {
  x: number;
  y: number;
  z: number;
  w: number;
};

type PlanetSystemSceneProps = {
  planets: PlanetProfile[];
  activeId: string;
  dossierCollapsed: boolean;
  focusPulse: number;
  focusMode: boolean;
  inspectRotation: InspectRotation;
  inspectRotationRef: MutableRefObject<InspectRotation>;
  speed: number;
  showLabels: boolean;
  showOrbits: boolean;
  view: SpaceView;
  viewRef: MutableRefObject<SpaceView>;
  onSelect: (id: string) => void;
};

type PlanetNodeProps = {
  planet: PlanetProfile;
  active: boolean;
  dossierCollapsed: boolean;
  focusPulse: number;
  focusMode: boolean;
  inspectRotationRef: MutableRefObject<InspectRotation>;
  speed: number;
  showLabels: boolean;
  onSelect: (id: string) => void;
};

const SUN_HOME_POSITION = new THREE.Vector3(0, 0, 0);
const SUN_FOCUS_POSITION = new THREE.Vector3(-4.05, -0.34, -3.08);

const focusLayouts: Record<string, { position: THREE.Vector3; scale: number }> = {
  sun: { position: new THREE.Vector3(0.62, -0.14, 2.34), scale: 1.48 },
  mercury: { position: new THREE.Vector3(0.78, -0.18, 2.42), scale: 5.25 },
  venus: { position: new THREE.Vector3(0.74, -0.18, 2.42), scale: 3.78 },
  earth: { position: new THREE.Vector3(0.7, -0.2, 2.42), scale: 3.52 },
  mars: { position: new THREE.Vector3(0.78, -0.18, 2.42), scale: 4.12 },
  jupiter: { position: new THREE.Vector3(0.54, -0.18, 2.5), scale: 2.04 },
  saturn: { position: new THREE.Vector3(0.32, -0.14, 2.58), scale: 1.58 },
  uranus: { position: new THREE.Vector3(0.68, -0.18, 2.48), scale: 2.72 },
  neptune: { position: new THREE.Vector3(0.68, -0.18, 2.48), scale: 2.74 },
};

const defaultFocusLayout = { position: new THREE.Vector3(0.74, -0.18, 2.42), scale: 3.2 };

const mobileFocusLayouts: Record<string, { position: THREE.Vector3; scale: number }> = {
  sun: { position: new THREE.Vector3(0, -0.1, 2.62), scale: 0.86 },
  mercury: { position: new THREE.Vector3(0, -0.14, 2.62), scale: 3.45 },
  venus: { position: new THREE.Vector3(0, -0.14, 2.62), scale: 2.54 },
  earth: { position: new THREE.Vector3(0, -0.14, 2.62), scale: 2.42 },
  mars: { position: new THREE.Vector3(0, -0.14, 2.62), scale: 2.7 },
  jupiter: { position: new THREE.Vector3(0, -0.12, 2.72), scale: 1.34 },
  saturn: { position: new THREE.Vector3(0, -0.12, 2.82), scale: 0.98 },
  uranus: { position: new THREE.Vector3(0, -0.14, 2.68), scale: 1.8 },
  neptune: { position: new THREE.Vector3(0, -0.14, 2.68), scale: 1.82 },
};

const mobileDefaultFocusLayout = { position: new THREE.Vector3(0, -0.14, 2.62), scale: 2.3 };

const planetTextureFiles: Record<string, string> = {
  earth: 'earth.webp',
  jupiter: 'jupiter.webp',
  mars: 'mars.webp',
  mercury: 'mercury.webp',
  neptune: 'neptune.webp',
  saturn: 'saturn.webp',
  uranus: 'uranus.webp',
  venus: 'venus.webp',
};

const planetRotationOffsets: Record<string, number> = {
  earth: -2.45,
  jupiter: -0.34,
  mars: 0.76,
  mercury: 0.4,
  neptune: 0.28,
  saturn: 0.18,
  uranus: -0.52,
  venus: 0.2,
};

function usePlanetMap(planet: PlanetProfile) {
  const texture = useLoader(THREE.TextureLoader, `/assets/textures/${planetTextureFiles[planet.id]}`);
  const enhancedTexture = useMemo(() => createEnhancedPlanetTexture(planet, texture.image), [planet, texture.image]);
  const finalTexture = enhancedTexture ?? texture;
  finalTexture.colorSpace = THREE.SRGBColorSpace;
  finalTexture.wrapS = THREE.RepeatWrapping;
  finalTexture.wrapT = THREE.RepeatWrapping;
  finalTexture.anisotropy = getTextureAnisotropy();
  finalTexture.needsUpdate = true;
  return finalTexture;
}

function getResponsiveCanvasDpr() {
  if (typeof window === 'undefined') {
    return 1.5;
  }

  if (window.innerWidth <= 860) {
    return 1.16;
  }

  if (window.innerWidth <= 1280) {
    return 1.4;
  }

  return 1.55;
}

function useResponsiveCanvasDpr(): [number, number] {
  const [maxDpr, setMaxDpr] = useState(getResponsiveCanvasDpr);

  useEffect(() => {
    const handleResize = () => setMaxDpr(getResponsiveCanvasDpr());
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return [1, maxDpr];
}

function getTextureAnisotropy() {
  if (typeof window !== 'undefined' && window.innerWidth <= 860) {
    return 6;
  }

  return 12;
}

function getRotationOffset(planet: PlanetProfile) {
  return planetRotationOffsets[planet.id] ?? 0;
}

function isNarrowViewport() {
  return typeof window !== 'undefined' && window.innerWidth <= 860;
}

function getFocusScaleById(id: string) {
  if (isNarrowViewport()) {
    return mobileFocusLayouts[id]?.scale ?? mobileDefaultFocusLayout.scale;
  }

  const scale = focusLayouts[id]?.scale ?? defaultFocusLayout.scale;

  return scale;
}

function getFocusScale(planet: PlanetProfile) {
  return getFocusScaleById(planet.id);
}

function getMobileCollapsedFocusBoost(id: string, dossierCollapsed: boolean) {
  if (!isNarrowViewport() || !dossierCollapsed) {
    return 1;
  }

  if (id === 'saturn') {
    return 1;
  }

  if (id === 'sun' || id === 'jupiter') {
    return 1.14;
  }

  return 1.18;
}

function getFocusPosition(id: string) {
  if (isNarrowViewport()) {
    return mobileFocusLayouts[id]?.position ?? mobileDefaultFocusLayout.position;
  }

  return focusLayouts[id]?.position ?? defaultFocusLayout.position;
}

function createTextureFromCanvas(canvas: HTMLCanvasElement) {
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = getTextureAnisotropy();
  return texture;
}

function drawFeatheredAtmosphericOval(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  radiusX: number,
  radiusY: number,
  rotation: number,
  color: string,
  alpha: number,
  seedBase: number,
) {
  context.save();
  context.filter = 'blur(22px)';
  context.fillStyle = color;

  for (let layer = 0; layer < 5; layer += 1) {
    const driftX = (seeded(seedBase + layer * 7) - 0.5) * radiusX * 0.28;
    const driftY = (seeded(seedBase + layer * 11) - 0.5) * radiusY * 0.52;
    const scaleX = 0.68 + seeded(seedBase + layer * 13) * 0.44;
    const scaleY = 0.62 + seeded(seedBase + layer * 17) * 0.38;
    context.globalAlpha = alpha * (0.78 - layer * 0.1);
    context.beginPath();
    context.ellipse(
      x + driftX,
      y + driftY,
      radiusX * scaleX,
      radiusY * scaleY,
      rotation + (seeded(seedBase + layer * 19) - 0.5) * 0.18,
      0,
      Math.PI * 2,
    );
    context.fill();
  }

  context.restore();
  context.save();
  context.filter = 'blur(10px)';
  context.globalAlpha = alpha * 0.48;
  context.strokeStyle = 'rgba(210, 238, 255, 0.64)';
  context.lineWidth = Math.max(2, radiusY * 0.16);
  context.beginPath();
  context.ellipse(x - radiusX * 0.2, y - radiusY * 0.08, radiusX * 0.42, radiusY * 0.2, rotation, 0, Math.PI * 2);
  context.stroke();
  context.restore();
}

function softenHorizontalTextureSeam(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  blendWidth = 96,
) {
  const image = context.getImageData(0, 0, width, height);
  const data = image.data;
  const original = new Uint8ClampedArray(data);
  const maxOffset = Math.min(blendWidth, Math.floor(width / 2));

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < maxOffset; x += 1) {
      const leftX = x;
      const rightX = width - 1 - x;
      const leftIndex = (y * width + leftX) * 4;
      const rightIndex = (y * width + rightX) * 4;
      const edgeWeight = x / Math.max(1, maxOffset - 1);
      const keepOriginal = edgeWeight * edgeWeight * (3 - 2 * edgeWeight);

      for (let channel = 0; channel < 3; channel += 1) {
        const average = (original[leftIndex + channel] + original[rightIndex + channel]) * 0.5;
        data[leftIndex + channel] = average * (1 - keepOriginal) + original[leftIndex + channel] * keepOriginal;
        data[rightIndex + channel] = average * (1 - keepOriginal) + original[rightIndex + channel] * keepOriginal;
      }
    }
  }

  context.putImageData(image, 0, 0);
}

function createRadialGlowTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const context = canvas.getContext('2d');

  if (!context) {
    return null;
  }

  const center = canvas.width / 2;
  const image = context.createImageData(canvas.width, canvas.height);
  const data = image.data;

  for (let y = 0; y < canvas.height; y += 1) {
    for (let x = 0; x < canvas.width; x += 1) {
      const dx = (x - center) / center;
      const dy = (y - center) / center;
      const radius = Math.sqrt(dx * dx + dy * dy);
      const edgeGlow = Math.exp(-Math.pow((radius - 0.73) / 0.105, 2));
      const outerFalloff = Math.max(0, 1 - Math.pow(Math.max(0, radius - 0.72) / 0.32, 1.55));
      const alpha = Math.max(0, Math.min(1, edgeGlow * 0.78 + outerFalloff * 0.12)) * (radius > 0.62 ? 1 : 0);
      const hot = Math.max(0, Math.min(1, edgeGlow * 1.2));
      const index = (y * canvas.width + x) * 4;

      data[index] = 255;
      data[index + 1] = 118 + Math.round(hot * 74);
      data[index + 2] = 20 + Math.round(hot * 32);
      data[index + 3] = Math.round(alpha * 255);
    }
  }

  context.putImageData(image, 0, 0);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function createSaturnRingTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 2048;
  canvas.height = 48;
  const context = canvas.getContext('2d');

  if (!context) {
    return null;
  }

  const smooth = (edge0: number, edge1: number, value: number) => {
    const amount = Math.min(1, Math.max(0, (value - edge0) / (edge1 - edge0)));
    return amount * amount * (3 - 2 * amount);
  };

  for (let x = 0; x < canvas.width; x += 1) {
    const t = x / (canvas.width - 1);
    const edgeFade = smooth(0.02, 0.12, t) * (1 - smooth(0.88, 0.99, t));
    const cassini = 1 - Math.exp(-Math.pow((t - 0.58) / 0.022, 2)) * 0.92;
    const innerBreak = 1 - Math.exp(-Math.pow((t - 0.18) / 0.028, 2)) * 0.46;
    const outerBreak = 1 - Math.exp(-Math.pow((t - 0.79) / 0.04, 2)) * 0.34;
    const fineNoise = 0.84 + seeded(x + 31000) * 0.24;
    const stripe = 0.9 + Math.sin(t * 120) * 0.04 + Math.sin(t * 430) * 0.025;
    const alpha = Math.min(0.92, Math.max(0, edgeFade * cassini * innerBreak * outerBreak * fineNoise * stripe));
    const warmth = smooth(0.16, 0.5, t) * (1 - smooth(0.7, 0.96, t));
    const shadow = 1 - smooth(0.52, 0.62, t) * 0.22;
    const red = Math.round((150 + warmth * 78 + seeded(x + 32000) * 16) * shadow);
    const green = Math.round((137 + warmth * 64 + seeded(x + 33000) * 13) * shadow);
    const blue = Math.round((113 + warmth * 38 + seeded(x + 34000) * 10) * shadow);

    context.fillStyle = `rgba(${red}, ${green}, ${blue}, ${alpha})`;
    context.fillRect(x, 0, 1, canvas.height);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.anisotropy = 12;
  texture.needsUpdate = true;
  return texture;
}

function createSaturnRingGeometry(innerRadius: number, outerRadius: number, segments = 420) {
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let index = 0; index <= segments; index += 1) {
    const angle = (index / segments) * Math.PI * 2;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);

    positions.push(cos * innerRadius, sin * innerRadius, 0);
    positions.push(cos * outerRadius, sin * outerRadius, 0);
    normals.push(0, 0, 1, 0, 0, 1);
    uvs.push(0, index / segments, 1, index / segments);

    if (index < segments) {
      const start = index * 2;
      indices.push(start, start + 1, start + 2, start + 1, start + 3, start + 2);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeBoundingSphere();
  return geometry;
}

function createEnhancedPlanetTexture(planet: PlanetProfile, source?: CanvasImageSource) {
  if (!['earth', 'uranus', 'neptune'].includes(planet.id)) {
    return null;
  }

  const canvas = document.createElement('canvas');
  canvas.width = 2048;
  canvas.height = 1024;
  const context = canvas.getContext('2d');

  if (!context) {
    return null;
  }

  if (planet.id === 'earth' && source) {
    context.filter = 'brightness(1.12) contrast(1.02) saturate(0.76)';
    context.drawImage(source, 0, 0, canvas.width, canvas.height);
    context.filter = 'none';
    context.globalCompositeOperation = 'screen';
    context.fillStyle = 'rgba(116, 190, 222, 0.1)';
    context.fillRect(0, 0, canvas.width, canvas.height);
    const oceanGlow = context.createLinearGradient(0, 0, 0, canvas.height);
    oceanGlow.addColorStop(0, 'rgba(142, 205, 230, 0.07)');
    oceanGlow.addColorStop(0.48, 'rgba(136, 204, 232, 0.12)');
    oceanGlow.addColorStop(1, 'rgba(96, 164, 210, 0.06)');
    context.fillStyle = oceanGlow;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.globalCompositeOperation = 'source-over';
    softenHorizontalTextureSeam(context, canvas.width, canvas.height, 128);
    return createTextureFromCanvas(canvas);
  }

  if (planet.id === 'uranus') {
    const base = context.createLinearGradient(0, 0, 0, canvas.height);
    base.addColorStop(0, '#dcffff');
    base.addColorStop(0.22, '#b8eee9');
    base.addColorStop(0.52, '#8dd8d4');
    base.addColorStop(0.78, '#64bdc1');
    base.addColorStop(1, '#4e9fa9');
    context.fillStyle = base;
    context.fillRect(0, 0, canvas.width, canvas.height);

    for (let index = 0; index < 42; index += 1) {
      const y = 44 + index * 23 + seeded(index + 5100) * 16;
      const height = 7 + seeded(index + 5300) * 22;
      const alpha = 0.028 + seeded(index + 5200) * 0.06;
      context.globalAlpha = alpha;
      context.fillStyle = index % 4 === 0 ? '#e8ffff' : index % 3 === 0 ? '#357f8b' : '#67c4c8';
      context.fillRect(0, y, canvas.width, height);
    }

    context.globalAlpha = 0.16;
    context.fillStyle = '#dfffff';
    context.fillRect(0, 118, canvas.width, 30);
    context.globalAlpha = 0.1;
    context.fillStyle = '#1f737d';
    context.fillRect(0, 774, canvas.width, 56);
    context.globalAlpha = 0.12;
    const haze = context.createLinearGradient(0, 0, 0, canvas.height);
    haze.addColorStop(0, 'rgba(255, 255, 255, 0.16)');
    haze.addColorStop(0.48, 'rgba(255, 255, 255, 0.05)');
    haze.addColorStop(1, 'rgba(19, 92, 104, 0.18)');
    context.fillStyle = haze;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.save();
    context.filter = 'blur(18px)';
    context.globalAlpha = 0.055;
    context.fillStyle = '#317984';
    context.translate(canvas.width * 0.54, canvas.height * 0.5);
    context.rotate(-0.1);
    context.fillRect(-canvas.width * 0.55, -14, canvas.width * 1.1, 28);
    context.globalAlpha = 0.042;
    context.fillStyle = '#e6ffff';
    context.fillRect(-canvas.width * 0.46, -48, canvas.width * 0.86, 18);
    context.restore();
    context.globalAlpha = 1;
    softenHorizontalTextureSeam(context, canvas.width, canvas.height, 128);
    return createTextureFromCanvas(canvas);
  }

  const base = context.createLinearGradient(0, 0, 0, canvas.height);
  base.addColorStop(0, '#263ca5');
  base.addColorStop(0.36, '#326dd6');
  base.addColorStop(0.63, '#4c93ee');
  base.addColorStop(1, '#1d338f');
  context.fillStyle = base;
  context.fillRect(0, 0, canvas.width, canvas.height);

  for (let index = 0; index < 54; index += 1) {
    const y = 44 + index * 18 + seeded(index + 6100) * 16;
    const height = 8 + seeded(index + 6200) * 18;
    context.globalAlpha = 0.028 + seeded(index + 6300) * 0.078;
    context.fillStyle = index % 5 === 0 ? '#91caff' : index % 4 === 0 ? '#072675' : '#2454bd';
    context.fillRect(0, y, canvas.width, height);
  }

  drawFeatheredAtmosphericOval(context, 1160, 530, 190, 58, -0.12, '#102b84', 0.18, 7100);
  drawFeatheredAtmosphericOval(context, 1660, 390, 122, 36, 0.16, '#0c2474', 0.075, 7400);
  context.globalAlpha = 0.12;
  context.fillStyle = '#8bc4ff';
  context.fillRect(0, 168, canvas.width, 22);
  context.globalAlpha = 0.1;
  context.fillStyle = '#071b66';
  context.fillRect(0, 738, canvas.width, 46);
  context.globalAlpha = 0.08;
  const neptuneHaze = context.createLinearGradient(0, 0, 0, canvas.height);
  neptuneHaze.addColorStop(0, 'rgba(132, 194, 255, 0.24)');
  neptuneHaze.addColorStop(0.54, 'rgba(255, 255, 255, 0.04)');
  neptuneHaze.addColorStop(1, 'rgba(3, 15, 74, 0.24)');
  context.fillStyle = neptuneHaze;
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.globalAlpha = 1;
  softenHorizontalTextureSeam(context, canvas.width, canvas.height, 128);
  return createTextureFromCanvas(canvas);
}

function toQuaternion(rotation: InspectRotation) {
  return new THREE.Quaternion(rotation.x, rotation.y, rotation.z, rotation.w).normalize();
}

function getBodyQuaternion(planet: PlanetProfile, rotationY = 0) {
  const axialTilt = planet.id === 'uranus' ? THREE.MathUtils.degToRad(97.8) : planet.inclination;
  return new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rotationY, axialTilt));
}

function getPlanetMaterialStyle(planet: PlanetProfile, active: boolean, backdrop: boolean, focusActive: boolean) {
  const styles: Record<string, { color: string; emissive: string; focusEmissive: number; roughness: number; metalness: number }> = {
    earth: {
      color: '#d8eaf6',
      emissive: '#2d78a7',
      focusEmissive: 0.065,
      metalness: 0.01,
      roughness: 0.78,
    },
    uranus: {
      color: '#b8eeea',
      emissive: '#55c5c8',
      focusEmissive: 0.12,
      metalness: 0.02,
      roughness: 0.9,
    },
    neptune: {
      color: '#76a0ff',
      emissive: '#1d58bd',
      focusEmissive: 0.105,
      metalness: 0.02,
      roughness: 0.84,
    },
    saturn: {
      color: '#ffe1aa',
      emissive: '#7a4a20',
      focusEmissive: 0.052,
      metalness: 0.015,
      roughness: 0.78,
    },
  };
  const style = styles[planet.id];

  return {
    color: style?.color ?? '#ffffff',
    emissive: style?.emissive ?? planet.accent,
    emissiveIntensity: backdrop ? 0.002 : focusActive ? style?.focusEmissive ?? 0.08 : active ? 0.14 : 0.035,
    metalness: style?.metalness ?? 0.03,
    roughness: backdrop ? 0.88 : focusActive ? style?.roughness ?? 0.76 : 0.6,
  };
}

function seeded(index: number) {
  const value = Math.sin(index * 9283.137 + 17.19) * 10000;
  return value - Math.floor(value);
}

function getCompressedAngularVelocity(planet: PlanetProfile) {
  return 0.22 * Math.pow(365.26 / planet.orbitalPeriodDays, 0.62);
}

function getOrbitalPosition(planet: PlanetProfile, angle: number): [number, number, number] {
  const eccentricity = planet.orbitalEccentricity;
  const semiMajor = planet.orbitRadius;
  const semiMinor = semiMajor * Math.sqrt(1 - eccentricity * eccentricity);
  const focusOffset = -semiMajor * eccentricity;
  const baseX = Math.cos(angle) * semiMajor + focusOffset;
  const baseZ = Math.sin(angle) * semiMinor * 0.58;
  const inclination = THREE.MathUtils.degToRad(planet.orbitalInclinationDeg) * 1.4;
  const verticalLift = Math.sin(angle) * semiMinor * Math.sin(inclination) * 0.16;

  return [baseX, verticalLift, baseZ * Math.cos(inclination)];
}

function createPlanetTexture(planet: PlanetProfile) {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;

  const context = canvas.getContext('2d');
  if (!context) {
    return null;
  }

  const base = context.createLinearGradient(0, 0, 1024, 512);
  base.addColorStop(0, planet.glow);
  base.addColorStop(0.28, planet.color);
  base.addColorStop(1, planet.shadow);
  context.fillStyle = base;
  context.fillRect(0, 0, 1024, 512);

  if (planet.textureMode === 'bands' || planet.textureMode === 'storm') {
    for (let index = 0; index < 44; index += 1) {
      const y = index * 12 + seeded(index) * 10;
      const height = 7 + seeded(index + 40) * 18;
      context.globalAlpha = 0.22 + seeded(index + 70) * 0.22;
      context.fillStyle = index % 3 === 0 ? planet.accent : planet.shadow;
      context.fillRect(0, y, 1024, height);
      context.globalAlpha = 0.09;
      context.fillStyle = '#fff4d5';
      context.fillRect(0, y + height * 0.42, 1024, Math.max(1, height * 0.18));
    }

    if (planet.textureMode === 'storm') {
      context.globalAlpha = 0.72;
      context.fillStyle = '#b65a42';
      context.beginPath();
      context.ellipse(690, 268, 108, 44, -0.2, 0, Math.PI * 2);
      context.fill();
      context.globalAlpha = 0.32;
      context.fillStyle = '#ffe0ad';
      context.beginPath();
      context.ellipse(662, 258, 62, 18, -0.24, 0, Math.PI * 2);
      context.fill();
    }
  }

  if (planet.textureMode === 'cloud' || planet.textureMode === 'ocean' || planet.textureMode === 'ice') {
    for (let index = 0; index < 82; index += 1) {
      const x = seeded(index + 10) * 1024;
      const y = seeded(index + 20) * 512;
      const rx = 28 + seeded(index + 30) * 138;
      const ry = 5 + seeded(index + 50) * 28;
      context.globalAlpha = planet.textureMode === 'ocean' ? 0.28 : 0.18;
      context.fillStyle = planet.textureMode === 'ocean' ? '#f2fbff' : planet.accent;
      context.beginPath();
      context.ellipse(x, y, rx, ry, seeded(index) * Math.PI, 0, Math.PI * 2);
      context.fill();
    }

    if (planet.textureMode === 'ocean') {
      context.globalAlpha = 0.24;
      context.fillStyle = '#2c7b56';
      for (let index = 0; index < 18; index += 1) {
        context.beginPath();
        context.ellipse(
          seeded(index + 100) * 1024,
          seeded(index + 130) * 512,
          28 + seeded(index + 140) * 92,
          18 + seeded(index + 150) * 42,
          seeded(index + 160) * Math.PI,
          0,
          Math.PI * 2,
        );
        context.fill();
      }
    }
  }

  if (planet.textureMode === 'crater') {
    for (let index = 0; index < 72; index += 1) {
      const x = seeded(index + 210) * 1024;
      const y = seeded(index + 230) * 512;
      const radius = 6 + seeded(index + 250) * 42;
      context.globalAlpha = 0.22 + seeded(index + 270) * 0.24;
      context.strokeStyle = '#090a0d';
      context.lineWidth = 1 + seeded(index + 280) * 2;
      context.beginPath();
      context.ellipse(x, y, radius, radius * (0.52 + seeded(index + 290) * 0.5), 0, 0, Math.PI * 2);
      context.stroke();
    }
  }

  if (planet.id === 'mars') {
    context.globalAlpha = 0.38;
    context.fillStyle = '#f2d7bb';
    context.beginPath();
    context.ellipse(160, 58, 86, 30, 0.1, 0, Math.PI * 2);
    context.ellipse(816, 452, 96, 34, -0.12, 0, Math.PI * 2);
    context.fill();
  }

  if (planet.id === 'neptune') {
    context.globalAlpha = 0.34;
    context.fillStyle = '#12275f';
    context.beginPath();
    context.ellipse(688, 286, 104, 34, -0.18, 0, Math.PI * 2);
    context.fill();
  }

  if (planet.id === 'uranus') {
    context.globalAlpha = 0.16;
    context.fillStyle = '#e2fffa';
    for (let index = 0; index < 8; index += 1) {
      context.fillRect(0, 160 + index * 18, 1024, 4);
    }
  }

  context.globalAlpha = 0.2;
  const shade = context.createLinearGradient(0, 0, 1024, 0);
  shade.addColorStop(0, '#ffffff');
  shade.addColorStop(0.4, 'rgba(255,255,255,0)');
  shade.addColorStop(1, '#000000');
  context.fillStyle = shade;
  context.fillRect(0, 0, 1024, 512);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 8;
  return texture;
}

function createLabelTexture(planet: PlanetProfile, active: boolean) {
  const canvas = document.createElement('canvas');
  canvas.width = 360;
  canvas.height = 116;

  const context = canvas.getContext('2d');
  if (!context) {
    return null;
  }

  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = active ? 'rgba(8, 18, 25, 0.72)' : 'rgba(8, 18, 25, 0.34)';
  context.strokeStyle = active ? planet.accent : 'rgba(146, 209, 225, 0.28)';
  context.lineWidth = active ? 2 : 1;
  context.beginPath();
  context.roundRect(22, 18, 316, 80, 12);
  context.fill();
  context.stroke();

  context.fillStyle = active ? '#f8efe0' : 'rgba(248, 239, 224, 0.68)';
  context.font = '700 34px "Noto Serif SC", "Microsoft YaHei", sans-serif';
  context.textAlign = 'center';
  context.fillText(planet.name, 180, 56);
  context.fillStyle = active ? planet.accent : 'rgba(146, 209, 225, 0.58)';
  context.font = '600 18px "Chakra Petch", "Microsoft YaHei", sans-serif';
  context.fillText(planet.englishName.toUpperCase(), 180, 82);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function StarField() {
  const positions = useMemo(() => {
    const count = isNarrowViewport() ? 1150 : 1450;
    const values = new Float32Array(count * 3);

    for (let index = 0; index < count; index += 1) {
      const radius = 15 + seeded(index) * 48;
      const theta = seeded(index + 2000) * Math.PI * 2;
      const phi = Math.acos(2 * seeded(index + 4000) - 1);
      values[index * 3] = radius * Math.sin(phi) * Math.cos(theta);
      values[index * 3 + 1] = radius * Math.cos(phi) * 0.76;
      values[index * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta);
    }

    return values;
  }, []);

  return (
    <points>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        color="#eaf8ff"
        depthWrite={false}
        opacity={0.76}
        size={0.037}
        sizeAttenuation
        transparent
      />
    </points>
  );
}

function StellarDust() {
  const dustPositions = useMemo(() => {
    const count = isNarrowViewport() ? 460 : 620;
    const values = new Float32Array(count * 3);

    for (let index = 0; index < count; index += 1) {
      const radius = 3.3 + seeded(index + 9000) * 10.4;
      const theta = seeded(index + 9100) * Math.PI * 2;
      values[index * 3] = Math.cos(theta) * radius;
      values[index * 3 + 1] = (seeded(index + 9200) - 0.5) * 0.64;
      values[index * 3 + 2] = Math.sin(theta) * radius * 0.58;
    }

    return values;
  }, []);

  return (
    <points rotation={[0.04, 0, -0.18]}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[dustPositions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        blending={THREE.AdditiveBlending}
        color="#d99743"
        depthWrite={false}
        opacity={0.35}
        size={0.032}
        sizeAttenuation
        transparent
      />
    </points>
  );
}

function SolarPlasma({ focusMode }: { focusMode: boolean }) {
  const pointsRef = useRef<THREE.Points>(null);
  const materialRef = useRef<THREE.PointsMaterial>(null);
  const positions = useMemo(() => {
    const count = isNarrowViewport() ? 160 : 220;
    const values = new Float32Array(count * 3);

    for (let index = 0; index < count; index += 1) {
      const radius = 1.18 + seeded(index + 12200) * 1.02;
      const theta = seeded(index + 12300) * Math.PI * 2;
      const lift = (seeded(index + 12400) - 0.5) * 0.74;
      values[index * 3] = Math.cos(theta) * radius;
      values[index * 3 + 1] = lift;
      values[index * 3 + 2] = Math.sin(theta) * radius * 0.92;
    }

    return values;
  }, []);

  useFrame(({ clock }) => {
    if (pointsRef.current) {
      pointsRef.current.rotation.y = clock.elapsedTime * 0.16;
      pointsRef.current.rotation.z = Math.sin(clock.elapsedTime * 0.38) * 0.08;
      pointsRef.current.scale.setScalar(1 + Math.sin(clock.elapsedTime * 1.2) * 0.045);
    }

    if (materialRef.current) {
      materialRef.current.opacity += ((focusMode ? 0.22 : 0.48) - materialRef.current.opacity) * 0.08;
      materialRef.current.size = focusMode ? 0.052 : 0.068;
    }
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        ref={materialRef}
        blending={THREE.AdditiveBlending}
        color="#ffd176"
        depthWrite={false}
        opacity={focusMode ? 0.22 : 0.48}
        size={0.068}
        sizeAttenuation
        transparent
      />
    </points>
  );
}

function Sun({
  active,
  dossierCollapsed,
  focusMode,
  focusPulse,
  inspectRotationRef,
  onSelect,
}: {
  active: boolean;
  dossierCollapsed: boolean;
  focusMode: boolean;
  focusPulse: number;
  inspectRotationRef: MutableRefObject<InspectRotation>;
  onSelect: (id: string) => void;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const sunRef = useRef<THREE.Mesh>(null);
  const outerGlowRef = useRef<THREE.Sprite>(null);
  const pulseRef = useRef(0);
  const texture = useLoader(THREE.TextureLoader, '/assets/textures/sun.webp');
  const glowTexture = useMemo(() => createRadialGlowTexture(), []);
  const sunMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          map: { value: texture },
          uTime: { value: 0 },
          uFocus: { value: 0 },
        },
        vertexShader: `
          varying vec2 vUv;
          varying vec3 vNormal;

          void main() {
            vUv = uv;
            vNormal = normalize(normalMatrix * normal);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          uniform sampler2D map;
          uniform float uTime;
          uniform float uFocus;
          varying vec2 vUv;
          varying vec3 vNormal;

          void main() {
            vec2 flowA = vec2(fract(vUv.x + uTime * 0.012), vUv.y);
            vec2 flowB = vec2(fract(vUv.x * 1.34 - uTime * 0.018), fract(vUv.y * 1.08 + sin(vUv.x * 8.0 + uTime) * 0.012));
            vec3 textureA = texture2D(map, flowA).rgb;
            vec3 textureB = texture2D(map, flowB).rgb;
            float cell = sin((vUv.x + uTime * 0.018) * 62.0) * sin((vUv.y - uTime * 0.012) * 38.0);
            float detail = smoothstep(0.16, 0.96, textureA.r * 0.7 + textureB.g * 0.22 + cell * 0.08);
            float hot = smoothstep(0.46, 0.96, textureA.r + cell * 0.12);
            float dark = 1.0 - smoothstep(0.16, 0.72, textureA.g + textureB.r * 0.22 + cell * 0.08);
            float rim = pow(1.0 - max(dot(normalize(vNormal), vec3(0.0, 0.0, 1.0)), 0.0), 1.9);
            vec3 ember = vec3(0.72, 0.16, 0.018);
            vec3 gold = vec3(1.0, 0.48, 0.055);
            vec3 whiteHot = vec3(1.0, 0.72, 0.24);
            vec3 color = mix(ember, gold, detail);
            color = mix(color, whiteHot, hot * 0.18);
            color = mix(color, vec3(0.5, 0.09, 0.012), dark * 0.18);
            color += vec3(1.0, 0.42, 0.05) * rim * (0.26 + uFocus * 0.16);
            color *= 0.86;
            gl_FragColor = vec4(color, 1.0);
          }
        `,
      }),
    [texture],
  );
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = getTextureAnisotropy();

  useEffect(() => {
    if (active && focusMode) {
      pulseRef.current = 1;
    }
  }, [active, focusMode, focusPulse]);

  useFrame(({ clock }) => {
    pulseRef.current = Math.max(0, pulseRef.current - 0.015);
    const focused = active && focusMode;
    sunMaterial.uniforms.uTime.value = clock.elapsedTime;
    sunMaterial.uniforms.uFocus.value += ((focused ? 1 : 0) - sunMaterial.uniforms.uFocus.value) * 0.08;

    if (groupRef.current) {
      const targetScale = focused
        ? getFocusScaleById('sun') * getMobileCollapsedFocusBoost('sun', dossierCollapsed)
        : focusMode
          ? 0.14
          : 1;
      const targetPosition = focused ? getFocusPosition('sun') : focusMode ? SUN_FOCUS_POSITION : SUN_HOME_POSITION;
      groupRef.current.position.lerp(targetPosition, 0.08);
      groupRef.current.scale.setScalar(groupRef.current.scale.x + (targetScale - groupRef.current.scale.x) * 0.08);
    }

    if (sunRef.current) {
      const targetQuaternion = focused
        ? toQuaternion(inspectRotationRef.current)
        : new THREE.Quaternion().setFromEuler(
            new THREE.Euler(0, clock.elapsedTime * 0.045, Math.sin(clock.elapsedTime * 0.18) * 0.025),
          );
      sunRef.current.quaternion.copy(targetQuaternion);
    }

    if (outerGlowRef.current) {
      const targetScale = focused ? (isNarrowViewport() ? 1.62 : 2.92) : focusMode ? 1.72 : 2.58;
      outerGlowRef.current.scale.setScalar(targetScale + Math.sin(clock.elapsedTime * 0.82) * 0.05 + pulseRef.current * 0.2);
    }
  });

  const focused = active && focusMode;
  const updateCursor = (cursor: string) => {
    document.body.style.cursor = cursor;
  };

  return (
    <group ref={groupRef} position={[0, 0, 0]}>
      <pointLight color="#ff8d36" distance={focused ? 28 : 24} intensity={focused ? 3.4 : focusMode ? 1.9 : 3.4} decay={1.35} />
      <pointLight color="#ffc06a" distance={focused ? 16 : 10} intensity={focused ? 2.15 : focusMode ? 0.9 : 1.8} decay={1.05} />
      {glowTexture && (
        <sprite ref={outerGlowRef} scale={[2.58, 2.58, 1]}>
          <spriteMaterial
            blending={THREE.AdditiveBlending}
            color="#ff942f"
            depthTest
            depthWrite={false}
            map={glowTexture}
            opacity={focused ? 1.08 : focusMode ? 0.34 : 0.66}
            transparent
          />
        </sprite>
      )}
      <mesh
        ref={sunRef}
        onClick={(event: ThreeEvent<MouseEvent>) => {
          event.stopPropagation();
          onSelect('sun');
        }}
        onPointerOut={() => updateCursor('auto')}
        onPointerOver={(event: ThreeEvent<PointerEvent>) => {
          event.stopPropagation();
          updateCursor('pointer');
        }}
      >
        <sphereGeometry args={[1.06, 128, 128]} />
        <primitive attach="material" object={sunMaterial} />
      </mesh>
    </group>
  );
}

function OrbitLine({
  planet,
  active,
  focusMode,
  show,
}: {
  planet: PlanetProfile;
  active: boolean;
  focusMode: boolean;
  show: boolean;
}) {
  const geometry = useMemo(() => {
    const points: THREE.Vector3[] = [];

    for (let index = 0; index <= 360; index += 1) {
      const angle = (index / 360) * Math.PI * 2;
      points.push(new THREE.Vector3(...getOrbitalPosition(planet, angle)));
    }

    return new THREE.BufferGeometry().setFromPoints(points);
  }, [planet]);
  const orbitOpacity = active ? 0.58 : 0.22;
  const orbitLine = useMemo(
    () =>
      new THREE.Line(
        geometry,
        new THREE.LineBasicMaterial({
          blending: THREE.AdditiveBlending,
          color: active ? planet.accent : focusMode ? '#1d3340' : '#426270',
          depthWrite: false,
          opacity: orbitOpacity,
          transparent: true,
        }),
      ),
    [active, focusMode, geometry, orbitOpacity, planet.accent],
  );

  return <primitive object={orbitLine} visible={show && !focusMode} />;
}

function PlanetRingSystem({
  active,
  dim = false,
  focus = false,
  radius,
}: {
  active: boolean;
  dim?: boolean;
  focus?: boolean;
  radius: number;
}) {
  const ringTexture = useMemo(() => createSaturnRingTexture(), []);
  const ringGeometry = useMemo(
    () => createSaturnRingGeometry(radius * 1.23, radius * (focus ? 2.06 : 2.18)),
    [focus, radius],
  );
  const opacity = dim ? 0.16 : focus ? 0.78 : active ? 0.7 : 0.52;

  return (
    <group rotation={[0.78, 0.08, -0.18]}>
      {ringTexture && (
        <mesh renderOrder={focus ? 2 : 0}>
          <primitive attach="geometry" object={ringGeometry} />
          <meshBasicMaterial
            alphaTest={0.025}
            color={focus ? '#f0dfb9' : '#d9c69f'}
            depthTest
            depthWrite={false}
            map={ringTexture}
            opacity={opacity}
            side={THREE.DoubleSide}
            transparent
          />
        </mesh>
      )}
      <mesh renderOrder={focus ? 3 : 1}>
        <ringGeometry args={[radius * 1.55, radius * 1.57, 420]} />
        <meshBasicMaterial
          blending={THREE.AdditiveBlending}
          color="#f4d8a8"
          depthTest
          depthWrite={false}
          opacity={dim ? 0.025 : focus ? 0.1 : 0.08}
          side={THREE.DoubleSide}
          transparent
        />
      </mesh>
      <mesh renderOrder={focus ? 3 : 1}>
        <ringGeometry args={[radius * 1.78, radius * 1.84, 420]} />
        <meshBasicMaterial
          color="#030406"
          depthTest
          depthWrite={false}
          opacity={dim ? 0.12 : focus ? 0.42 : 0.32}
          side={THREE.DoubleSide}
          transparent
        />
      </mesh>
    </group>
  );
}

function PlanetLabel({ planet, active, visible }: { planet: PlanetProfile; active: boolean; visible: boolean }) {
  const texture = useMemo(() => createLabelTexture(planet, active), [active, planet]);

  if (!texture) {
    return null;
  }

  return (
    <sprite position={[0, -planet.radius * 2.35 - 0.28, 0]} scale={[1.42, 0.46, 1]} visible={visible}>
      <spriteMaterial
        map={texture}
        opacity={active ? 0.95 : 0.56}
        transparent
        depthWrite={false}
      />
    </sprite>
  );
}

function FocusBurst({
  focusMode,
  focusPulse,
  planet,
}: {
  focusMode: boolean;
  focusPulse: number;
  planet: PlanetProfile;
}) {
  const pulseRef = useRef(0);
  const coreRef = useRef<THREE.Mesh>(null);
  const outerRef = useRef<THREE.Mesh>(null);
  const sparkRef = useRef<THREE.Points>(null);
  const sparkMaterialRef = useRef<THREE.PointsMaterial>(null);
  const sparkPositions = useMemo(() => {
    const count = 96;
    const values = new Float32Array(count * 3);

    for (let index = 0; index < count; index += 1) {
      const theta = seeded(index + 20000) * Math.PI * 2;
      const phi = Math.acos(2 * seeded(index + 20100) - 1);
      const radius = planet.radius * (1.35 + seeded(index + 20200) * 0.72);
      values[index * 3] = radius * Math.sin(phi) * Math.cos(theta);
      values[index * 3 + 1] = radius * Math.cos(phi);
      values[index * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta);
    }

    return values;
  }, [planet.radius]);

  useEffect(() => {
    if (focusMode) {
      pulseRef.current = 1;
    }
  }, [focusMode, focusPulse]);

  useFrame(({ clock }) => {
    pulseRef.current = Math.max(0, pulseRef.current - 0.018);
    const pulse = pulseRef.current;
    const eased = 1 - Math.pow(1 - pulse, 3);

    if (coreRef.current) {
      coreRef.current.scale.setScalar(1.2 + (1 - eased) * 1.7);
      const material = coreRef.current.material as THREE.MeshBasicMaterial;
      material.opacity = pulse * 0.54;
    }

    if (outerRef.current) {
      outerRef.current.rotation.z = clock.elapsedTime * 0.62;
      outerRef.current.scale.setScalar(1.55 + (1 - eased) * 2.7);
      const material = outerRef.current.material as THREE.MeshBasicMaterial;
      material.opacity = pulse * 0.36;
    }

    if (sparkRef.current) {
      sparkRef.current.rotation.y = clock.elapsedTime * 0.9;
      sparkRef.current.scale.setScalar(1 + (1 - eased) * 2.1);
    }

    if (sparkMaterialRef.current) {
      sparkMaterialRef.current.opacity = pulse * 0.72;
      sparkMaterialRef.current.size = planet.radius * (0.08 + (1 - eased) * 0.05);
    }
  });

  return (
    <group visible={focusMode}>
      <mesh ref={coreRef} rotation={[Math.PI / 2.18, 0.28, -0.36]} scale={[1, 0.62, 1]}>
        <torusGeometry args={[planet.radius * 1.55, planet.radius * 0.026, 10, 220]} />
        <meshBasicMaterial
          blending={THREE.AdditiveBlending}
          color={planet.accent}
          depthWrite={false}
          opacity={0}
          transparent
        />
      </mesh>
      <mesh ref={outerRef} rotation={[Math.PI / 2.7, -0.34, 0.5]} scale={[1, 0.58, 1]}>
        <torusGeometry args={[planet.radius * 1.92, planet.radius * 0.014, 8, 220]} />
        <meshBasicMaterial
          blending={THREE.AdditiveBlending}
          color="#f4fbff"
          depthWrite={false}
          opacity={0}
          transparent
        />
      </mesh>
      <points ref={sparkRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[sparkPositions, 3]} />
        </bufferGeometry>
        <pointsMaterial
          ref={sparkMaterialRef}
          blending={THREE.AdditiveBlending}
          color={planet.glow}
          depthWrite={false}
          opacity={0}
          size={planet.radius * 0.09}
          sizeAttenuation
          transparent
        />
      </points>
    </group>
  );
}

function ActivePlanetEffects({
  focusMode,
  focusPulse,
  planet,
}: {
  focusMode: boolean;
  focusPulse: number;
  planet: PlanetProfile;
}) {
  const lockRef = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    if (lockRef.current) {
      lockRef.current.rotation.y = clock.elapsedTime * 0.44;
      lockRef.current.rotation.z = -clock.elapsedTime * 0.28;
    }
  });

  return (
    <group ref={lockRef}>
      <FocusBurst focusMode={focusMode} focusPulse={focusPulse} planet={planet} />
      {!focusMode && (
        <>
          <mesh rotation={[Math.PI / 2.15, 0.08, -0.22]} scale={[1, 0.64, 1]}>
            <torusGeometry args={[planet.radius * 1.78, planet.radius * 0.018, 8, 180]} />
            <meshBasicMaterial
              blending={THREE.AdditiveBlending}
              color={planet.accent}
              depthWrite={false}
              opacity={0.62}
              transparent
            />
          </mesh>
          <mesh rotation={[Math.PI / 2.62, 0.72, 0.38]} scale={[1, 0.52, 1]}>
            <torusGeometry args={[planet.radius * 2.05, planet.radius * 0.01, 8, 180]} />
            <meshBasicMaterial
              blending={THREE.AdditiveBlending}
              color="#eaf8ff"
              depthWrite={false}
              opacity={0.2}
              transparent
            />
          </mesh>
          <mesh rotation={[Math.PI / 1.92, -0.12, 0.62]} scale={[1, 0.58, 1]}>
            <torusGeometry args={[planet.radius * 2.24, planet.radius * 0.007, 8, 180]} />
            <meshBasicMaterial
              blending={THREE.AdditiveBlending}
              color={planet.glow}
              depthWrite={false}
              opacity={0.12}
              transparent
            />
          </mesh>
        </>
      )}
    </group>
  );
}

function PlanetNode({
  planet,
  active,
  dossierCollapsed,
  focusPulse,
  focusMode,
  inspectRotationRef,
  speed,
  showLabels,
  onSelect,
}: PlanetNodeProps) {
  const groupRef = useRef<THREE.Group>(null);
  const bodyRef = useRef<THREE.Group>(null);
  const meshRef = useRef<THREE.Mesh>(null);
  const haloRef = useRef<THREE.Mesh>(null);
  const motionTimeRef = useRef(0);
  const spinTimeRef = useRef(0);
  const texture = usePlanetMap(planet);
  const startAngle = THREE.MathUtils.degToRad(planet.initialAngle);
  const startPosition = useMemo<[number, number, number]>(
    () => getOrbitalPosition(planet, startAngle),
    [planet, startAngle],
  );

  useFrame(({ clock }, delta) => {
    motionTimeRef.current += delta * speed;
    const motionTime = motionTimeRef.current;
    spinTimeRef.current += speed === 0 ? 0 : delta * (0.5 + speed * 0.45);
    const spinTime = spinTimeRef.current;
    const focusActive = active && focusMode;
    const backdrop = focusMode && !active;
    const angle = THREE.MathUtils.degToRad(planet.initialAngle) + motionTime * getCompressedAngularVelocity(planet);
    const orbitTarget = new THREE.Vector3(...getOrbitalPosition(planet, angle));
    const backdropTarget = orbitTarget.clone();
    backdropTarget.x *= 0.86;
    backdropTarget.y -= 0.52;
    backdropTarget.z -= 3.4;
    const target = focusActive ? getFocusPosition(planet.id) : backdrop ? backdropTarget : orbitTarget;

    if (groupRef.current) {
      const targetScale = focusActive
        ? getFocusScale(planet) * getMobileCollapsedFocusBoost(planet.id, dossierCollapsed)
        : backdrop
          ? 0.18
          : active
            ? 1.18
            : 1;
      groupRef.current.position.lerp(target, focusActive ? 0.07 : 0.14);
      groupRef.current.scale.setScalar(groupRef.current.scale.x + (targetScale - groupRef.current.scale.x) * 0.08);
    }

    if (bodyRef.current) {
      const orbitalSpin =
        getRotationOffset(planet) + spinTime * planet.rotationSpeed;
      const focusBase = getBodyQuaternion(planet, getRotationOffset(planet));
      const targetQuaternion = focusActive
        ? toQuaternion(inspectRotationRef.current).multiply(focusBase)
        : getBodyQuaternion(planet, orbitalSpin);
      bodyRef.current.quaternion.copy(targetQuaternion);
    }

    if (haloRef.current) {
      const targetScale = focusActive
        ? 1.06 + Math.sin(clock.elapsedTime * 1.7) * 0.012
        : active
          ? 1.12 + Math.sin(clock.elapsedTime * 2.3) * 0.018
          : 1.04;
      haloRef.current.scale.setScalar(haloRef.current.scale.x + (targetScale - haloRef.current.scale.x) * 0.08);
    }
  });

  const backdrop = focusMode && !active;
  const focusActive = active && focusMode;
  const materialStyle = getPlanetMaterialStyle(planet, active, backdrop, focusActive);

  const updateCursor = (cursor: string) => {
    document.body.style.cursor = cursor;
  };

  return (
    <group ref={groupRef} position={startPosition}>
      <mesh ref={haloRef}>
        <sphereGeometry args={[planet.radius * 1.045, 56, 56]} />
        <meshBasicMaterial
          blending={THREE.AdditiveBlending}
          color={planet.glow}
          depthWrite={false}
          opacity={active && !focusMode ? 0.1 : 0}
          side={THREE.BackSide}
          transparent
        />
      </mesh>
      <group ref={bodyRef}>
        <mesh
          ref={meshRef}
          onClick={(event: ThreeEvent<MouseEvent>) => {
            event.stopPropagation();
            onSelect(planet.id);
          }}
          onPointerOut={() => updateCursor('auto')}
          onPointerOver={(event: ThreeEvent<PointerEvent>) => {
            event.stopPropagation();
            updateCursor('pointer');
          }}
        >
          <sphereGeometry args={[planet.radius, 96, 96]} />
          <meshStandardMaterial
            color={materialStyle.color}
            emissive={materialStyle.emissive}
            emissiveIntensity={materialStyle.emissiveIntensity}
            depthWrite={!backdrop}
            map={texture}
            metalness={materialStyle.metalness}
            opacity={backdrop ? 0.045 : 1}
            roughness={materialStyle.roughness}
            transparent={backdrop}
          />
        </mesh>
        {planet.ring && (
          <PlanetRingSystem
            active={active}
            dim={backdrop}
            focus={focusActive}
            radius={planet.radius}
          />
        )}
      </group>
      {active && <ActivePlanetEffects focusMode={focusMode} focusPulse={focusPulse} planet={planet} />}
      <PlanetLabel active={active} planet={planet} visible={showLabels && !focusMode} />
    </group>
  );
}

function CameraRig({
  activeId,
  focusMode,
  focusPulse,
  view,
  viewRef,
}: {
  activeId: string;
  focusMode: boolean;
  focusPulse: number;
  view: SpaceView;
  viewRef: MutableRefObject<SpaceView>;
}) {
  const pushRef = useRef(0);

  useEffect(() => {
    if (focusMode) {
      pushRef.current = 1;
    }
  }, [focusMode, focusPulse]);

  useFrame(({ camera }) => {
    pushRef.current = Math.max(0, pushRef.current - 0.025);
    const push = pushRef.current;
    const liveView = viewRef.current;
    const focusPosition = getFocusPosition(activeId);
    const mobile = isNarrowViewport();
    const targetPosition = focusMode
      ? mobile
        ? new THREE.Vector3(0, 2.56 - push * 0.08, 10.25 + push * 0.42)
        : new THREE.Vector3(-0.16 - push * 0.1, 2.7 - push * 0.14, Math.min(liveView.distance, 8.8) + push * 0.54)
      : mobile
        ? new THREE.Vector3(0, 6.7, liveView.distance + 1.1)
        : new THREE.Vector3(0, 6.9, liveView.distance);
    const targetLookAt = focusMode
      ? mobile
        ? new THREE.Vector3(focusPosition.x, focusPosition.y + 0.02, focusPosition.z - 0.16)
        : new THREE.Vector3(focusPosition.x + 0.28, focusPosition.y + 0.02, focusPosition.z - 0.28)
      : mobile
        ? new THREE.Vector3(0, -0.02, 0)
        : new THREE.Vector3(0.2, -0.04, 0);

    camera.position.lerp(targetPosition, 0.08);
    camera.lookAt(targetLookAt);

    if ('fov' in camera) {
      const targetFov = focusMode ? (mobile ? 37 + push * 3 : 29 + push * 4) : mobile ? 46 : 42;
      camera.fov += (targetFov - camera.fov) * 0.07;
      camera.updateProjectionMatrix();
    }
  });

  return null;
}

function SystemRig({
  planets,
  activeId,
  dossierCollapsed,
  focusPulse,
  focusMode,
  inspectRotationRef,
  speed,
  showLabels,
  showOrbits,
  viewRef,
  onSelect,
}: PlanetSystemSceneProps) {
  const groupRef = useRef<THREE.Group>(null);

  useFrame(() => {
    if (groupRef.current) {
      const liveView = viewRef.current;
      const mobile = isNarrowViewport();
      const targetYaw = focusMode ? (mobile ? -0.04 : -0.18) : liveView.yaw;
      const targetPitch = focusMode ? (mobile ? -0.06 : -0.14) : liveView.pitch - (mobile ? 0.04 : 0.1);
      groupRef.current.rotation.y += (targetYaw - groupRef.current.rotation.y) * 0.07;
      groupRef.current.rotation.x += (targetPitch - groupRef.current.rotation.x) * 0.07;
      groupRef.current.rotation.z = mobile ? -0.06 : -0.13;
    }
  });

  const mobile = isNarrowViewport();
  const overviewScale = mobile && !focusMode ? 0.54 : 1;
  const rigPosition: [number, number, number] = mobile && !focusMode
    ? [0, -0.18, 0]
    : mobile
      ? [0, -0.14, 0]
      : [0.55, -0.24, 0];

  return (
    <>
      <group ref={groupRef} position={rigPosition} scale={overviewScale}>
        <StellarDust />
        <Sun
          active={activeId === 'sun'}
          dossierCollapsed={dossierCollapsed}
          focusMode={focusMode}
          focusPulse={focusPulse}
          inspectRotationRef={inspectRotationRef}
          onSelect={onSelect}
        />
        {planets.map((planet) => (
          <OrbitLine
            active={planet.id === activeId}
            focusMode={focusMode}
            key={`${planet.id}-orbit`}
            planet={planet}
            show={showOrbits}
          />
        ))}
        {planets.map((planet) => (
          <PlanetNode
            active={planet.id === activeId}
            dossierCollapsed={dossierCollapsed}
            focusPulse={focusPulse}
            focusMode={focusMode}
            inspectRotationRef={inspectRotationRef}
            key={planet.id}
            onSelect={onSelect}
            planet={planet}
            showLabels={showLabels}
            speed={speed}
          />
        ))}
      </group>
    </>
  );
}

export function PlanetSystemScene({
  planets,
  activeId,
  dossierCollapsed,
  focusPulse,
  focusMode,
  inspectRotation,
  inspectRotationRef,
  speed,
  showLabels,
  showOrbits,
  view,
  viewRef,
  onSelect,
}: PlanetSystemSceneProps) {
  const canvasDpr = useResponsiveCanvasDpr();
  const mobile = isNarrowViewport();
  const ambientIntensity = mobile ? 0.58 : 0.42;
  const coolKeyIntensity = mobile ? 1.95 : 1.7;
  const warmFillIntensity = mobile ? 1.08 : 0.9;

  return (
    <div className={`system-scene ${focusMode ? 'is-focus-mode' : ''}`} aria-hidden="true">
      <Canvas
        camera={{ fov: 42, near: 0.1, far: 80, position: [0, 6.9, view.distance] }}
        dpr={canvasDpr}
        gl={{ alpha: true, antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: false }}
        onPointerMissed={() => {
          document.body.style.cursor = 'auto';
        }}
      >
        <fog attach="fog" args={['#03070b', 18, 44]} />
        <ambientLight color="#b9d4df" intensity={ambientIntensity} />
        <directionalLight color="#e6f8ff" intensity={coolKeyIntensity} position={[7, 8, 12]} />
        <directionalLight color="#ffb36d" intensity={warmFillIntensity} position={[-5, 3, 2]} />
        <StarField />
        <CameraRig activeId={activeId} focusMode={focusMode} focusPulse={focusPulse} view={view} viewRef={viewRef} />
        <SystemRig
          activeId={activeId}
          dossierCollapsed={dossierCollapsed}
          focusPulse={focusPulse}
          focusMode={focusMode}
          inspectRotation={inspectRotation}
          inspectRotationRef={inspectRotationRef}
          onSelect={onSelect}
          planets={planets}
          showLabels={showLabels}
          showOrbits={showOrbits}
          speed={speed}
          view={view}
          viewRef={viewRef}
        />
      </Canvas>
    </div>
  );
}
