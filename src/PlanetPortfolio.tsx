import { Suspense, lazy, startTransition, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, PointerEvent as ReactPointerEvent, WheelEvent as ReactWheelEvent } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  CircleGauge,
  Eye,
  Gauge,
  Info,
  MousePointer2,
  Orbit,
  Pause,
  Play,
  RotateCcw,
  Sparkles,
  Tags,
} from 'lucide-react';
import { planets, sceneModes, solarBody } from './planetPortfolioData';
import type { SceneMode } from './planetPortfolioData';
import type { InspectRotation, SpaceView } from './PlanetSystemScene';

const PlanetSystemScene = lazy(() =>
  import('./PlanetSystemScene').then((module) => ({ default: module.PlanetSystemScene })),
);

const defaultView: SpaceView = {
  yaw: -0.34,
  pitch: -0.11,
  distance: 15.6,
};

const defaultInspectionRotation: InspectRotation = {
  x: 0,
  y: 0,
  z: 0,
  w: 1,
};

const selectableBodies = [solarBody, ...planets];

type DossierSheetMode = 'collapsed' | 'peek' | 'full';

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function isMobileViewport() {
  return typeof window !== 'undefined' && window.matchMedia('(max-width: 860px)').matches;
}

function axisAngleQuaternion(axisX: number, axisY: number, axisZ: number, angle: number): InspectRotation {
  const halfAngle = angle * 0.5;
  const scale = Math.sin(halfAngle);

  return {
    x: axisX * scale,
    y: axisY * scale,
    z: axisZ * scale,
    w: Math.cos(halfAngle),
  };
}

function multiplyQuaternion(left: InspectRotation, right: InspectRotation): InspectRotation {
  return {
    x: left.w * right.x + left.x * right.w + left.y * right.z - left.z * right.y,
    y: left.w * right.y - left.x * right.z + left.y * right.w + left.z * right.x,
    z: left.w * right.z + left.x * right.y - left.y * right.x + left.z * right.w,
    w: left.w * right.w - left.x * right.x - left.y * right.y - left.z * right.z,
  };
}

function normalizeQuaternion(rotation: InspectRotation): InspectRotation {
  const length = Math.hypot(rotation.x, rotation.y, rotation.z, rotation.w) || 1;

  return {
    x: rotation.x / length,
    y: rotation.y / length,
    z: rotation.z / length,
    w: rotation.w / length,
  };
}

function getInspectionRotation(current: InspectRotation, deltaX: number, deltaY: number) {
  const horizontal = axisAngleQuaternion(0, 1, 0, deltaX * 0.008);
  const vertical = axisAngleQuaternion(1, 0, 0, deltaY * 0.008);
  const dragRotation = multiplyQuaternion(horizontal, vertical);

  return normalizeQuaternion(multiplyQuaternion(dragRotation, current));
}

function getSpriteVars(index: number, planet = planets[index]) {
  return {
    '--planet-color': planet.color,
    '--planet-accent': planet.accent,
    '--planet-shadow': planet.shadow,
    '--sprite-x': `${(index % 4) * 33.333333}%`,
    '--sprite-y': `${Math.floor(index / 4) * 100}%`,
  } as CSSProperties;
}

export function PlanetPortfolio() {
  const [activePlanetId, setActivePlanetId] = useState('earth');
  const [sceneMode, setSceneMode] = useState<SceneMode>('观测');
  const [speed, setSpeed] = useState(1);
  const [showLabels, setShowLabels] = useState(true);
  const [showOrbits, setShowOrbits] = useState(true);
  const [isTouring, setIsTouring] = useState(false);
  const [isMotionPaused, setIsMotionPaused] = useState(false);
  const [isPlanetView, setIsPlanetView] = useState(false);
  const [dossierSheetMode, setDossierSheetMode] = useState<DossierSheetMode>('peek');
  const [switchPulse, setSwitchPulse] = useState(0);
  const [view, setView] = useState<SpaceView>(defaultView);
  const [inspectionRotation, setInspectionRotation] = useState<InspectRotation>(defaultInspectionRotation);
  const shellRef = useRef<HTMLElement | null>(null);
  const dragRef = useRef({
    active: false,
    mode: 'scene' as 'scene' | 'inspect',
    pendingX: 0,
    pendingY: 0,
    x: 0,
    y: 0,
  });
  const sheetDragRef = useRef({
    active: false,
    currentY: 0,
    mode: 'peek' as DossierSheetMode,
    moved: false,
    pointerId: -1,
    startY: 0,
  });
  const suppressDossierToggleRef = useRef(false);
  const pinchRef = useRef({
    active: false,
    distance: 0,
  });
  const pointerMapRef = useRef(new Map<number, { x: number; y: number }>());
  const dragFrameRef = useRef<number | null>(null);
  const inspectionRotationRef = useRef<InspectRotation>(defaultInspectionRotation);
  const previousActiveRef = useRef(activePlanetId);
  const viewRef = useRef<SpaceView>(defaultView);

  const activeBody = useMemo(
    () => selectableBodies.find((planet) => planet.id === activePlanetId) ?? planets[2],
    [activePlanetId],
  );
  const activeIndex = selectableBodies.findIndex((planet) => planet.id === activeBody.id);
  const activeSpriteIndex = activeBody.id === 'sun' ? 0 : planets.findIndex((planet) => planet.id === activeBody.id);
  const isDossierCollapsed = dossierSheetMode === 'collapsed';
  const isDossierFull = dossierSheetMode === 'full';
  const dossierSheetClass = isPlanetView ? `is-${dossierSheetMode}` : '';
  const sceneSpeed = isMotionPaused ? 0 : speed;

  const updateView = (nextView: SpaceView, render = true) => {
    viewRef.current = nextView;
    if (render) {
      setView(nextView);
    }
  };

  const updateInspectionRotation = (nextRotation: InspectRotation, render = true) => {
    inspectionRotationRef.current = nextRotation;
    if (render) {
      setInspectionRotation(nextRotation);
    }
  };

  const getPinchDistance = () => {
    const points = Array.from(pointerMapRef.current.values());
    if (points.length < 2) {
      return 0;
    }

    return Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
  };

  const flushDragFrame = () => {
    dragFrameRef.current = null;

    const drag = dragRef.current;
    const deltaX = drag.pendingX;
    const deltaY = drag.pendingY;
    drag.pendingX = 0;
    drag.pendingY = 0;

    if (deltaX === 0 && deltaY === 0) {
      return;
    }

    if (drag.mode === 'inspect') {
      updateInspectionRotation(getInspectionRotation(inspectionRotationRef.current, deltaX, deltaY), false);
      return;
    }

    updateView({
      ...viewRef.current,
      yaw: viewRef.current.yaw + deltaX * 0.0034,
      pitch: clamp(viewRef.current.pitch + deltaY * 0.0022, -0.62, 0.24),
    }, false);
  };

  const scheduleDragFrame = () => {
    if (dragFrameRef.current !== null) {
      return;
    }

    dragFrameRef.current = window.requestAnimationFrame(flushDragFrame);
  };

  useEffect(
    () => () => {
      if (dragFrameRef.current !== null) {
        window.cancelAnimationFrame(dragFrameRef.current);
      }
    },
    [],
  );

  useEffect(() => {
    if (previousActiveRef.current === activePlanetId) {
      return;
    }

    previousActiveRef.current = activePlanetId;
    setSwitchPulse((current) => current + 1);
  }, [activePlanetId]);

  useEffect(() => {
    if (!isTouring || isMotionPaused) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      startTransition(() => {
        setActivePlanetId((currentId) => {
          const currentIndex = planets.findIndex((planet) => planet.id === currentId);
          return planets[(currentIndex + 1) % planets.length].id;
        });
      });
    }, 4300);

    return () => window.clearInterval(intervalId);
  }, [isMotionPaused, isTouring]);

  const enterFocusCamera = () => {
    updateView({
      ...viewRef.current,
      distance: 8.8,
      pitch: -0.04,
    });
  };

  const scrollInspectionIntoView = () => {
    window.requestAnimationFrame(() => {
      shellRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  };

  const selectPlanet = (planetId: string, options: { focus?: boolean } = {}) => {
    startTransition(() => setActivePlanetId(planetId));
    setIsTouring(false);
    setIsPlanetView(Boolean(options.focus));
    if (sceneMode === '漫游') {
      setSceneMode('观测');
    }

    if (options.focus) {
      setDossierSheetMode('peek');
      enterFocusCamera();
      updateInspectionRotation(defaultInspectionRotation);
      setSwitchPulse((current) => current + 1);
      scrollInspectionIntoView();
    }
  };

  const stepPlanet = (direction: 1 | -1) => {
    const nextIndex = (activeIndex + direction + selectableBodies.length) % selectableBodies.length;
    selectPlanet(selectableBodies[nextIndex].id, { focus: isPlanetView });
  };

  const setMode = (mode: SceneMode) => {
    setSceneMode(mode);
    setIsTouring(mode === '漫游');
    if (mode === '漫游') {
      setIsMotionPaused(false);
    }
    setIsPlanetView(false);
    setDossierSheetMode('peek');
    if (mode === '讲解') {
      setShowLabels(true);
      setShowOrbits(true);
      setSpeed(0.65);
    }
  };

  const enterPlanetView = () => {
    setIsTouring(false);
    setIsPlanetView(true);
    setDossierSheetMode('peek');
    setSceneMode('观测');
    enterFocusCamera();
    updateInspectionRotation(defaultInspectionRotation);
    setSwitchPulse((current) => current + 1);
    scrollInspectionIntoView();
  };

  const resetView = () => {
    setIsTouring(false);
    setIsMotionPaused(false);
    setIsPlanetView(false);
    setDossierSheetMode('peek');
    setSceneMode('观测');
    setSpeed(1);
    setShowLabels(true);
    setShowOrbits(true);
    updateView(defaultView);
    updateInspectionRotation(defaultInspectionRotation);
  };

  const toggleDossierSheet = () => {
    if (suppressDossierToggleRef.current) {
      suppressDossierToggleRef.current = false;
      return;
    }

    setDossierSheetMode((current) => {
      if (!isMobileViewport()) {
        return current === 'collapsed' ? 'peek' : 'collapsed';
      }

      if (current === 'collapsed') {
        return 'peek';
      }

      if (current === 'peek') {
        return 'full';
      }

      return 'collapsed';
    });
  };

  const settleDossierSheetDrag = (deltaY: number, startMode: DossierSheetMode) => {
    if (startMode === 'collapsed') {
      return deltaY < -44 ? 'peek' : 'collapsed';
    }

    if (startMode === 'peek') {
      if (deltaY < -52) {
        return 'full';
      }

      if (deltaY > 52) {
        return 'collapsed';
      }

      return 'peek';
    }

    if (deltaY > 128) {
      return 'collapsed';
    }

    if (deltaY > 52) {
      return 'peek';
    }

    return 'full';
  };

  const handleDossierPointerDown = (event: ReactPointerEvent<HTMLElement>) => {
    if (!isPlanetView || !isMobileViewport()) {
      return;
    }

    const target = event.target as HTMLElement;
    if (dossierSheetMode === 'full' && target.closest('.dossier-content') && !target.closest('.dossier-collapse-toggle')) {
      return;
    }

    sheetDragRef.current = {
      active: true,
      currentY: event.clientY,
      mode: dossierSheetMode,
      moved: false,
      pointerId: event.pointerId,
      startY: event.clientY,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handleDossierPointerMove = (event: ReactPointerEvent<HTMLElement>) => {
    const sheetDrag = sheetDragRef.current;
    if (!sheetDrag.active || sheetDrag.pointerId !== event.pointerId) {
      return;
    }

    const deltaY = event.clientY - sheetDrag.startY;
    sheetDrag.currentY = event.clientY;
    if (Math.abs(deltaY) > 8) {
      sheetDrag.moved = true;
      event.preventDefault();
    }
  };

  const handleDossierPointerUp = (event: ReactPointerEvent<HTMLElement>) => {
    const sheetDrag = sheetDragRef.current;
    if (!sheetDrag.active || sheetDrag.pointerId !== event.pointerId) {
      return;
    }

    const deltaY = sheetDrag.currentY - sheetDrag.startY;
    const nextMode = settleDossierSheetDrag(deltaY, sheetDrag.mode);
    if (sheetDrag.moved) {
      suppressDossierToggleRef.current = true;
      setDossierSheetMode(nextMode);
      window.setTimeout(() => {
        suppressDossierToggleRef.current = false;
      }, 0);
    }

    sheetDragRef.current.active = false;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    if (target.closest('button, a, input, [data-interactive="true"]')) {
      return;
    }

    event.preventDefault();
    pointerMapRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    event.currentTarget.setPointerCapture(event.pointerId);

    if (!isPlanetView && pointerMapRef.current.size >= 2) {
      pinchRef.current = {
        active: true,
        distance: getPinchDistance(),
      };
      dragRef.current.active = false;
      return;
    }

    dragRef.current = {
      active: true,
      mode: isPlanetView ? 'inspect' : 'scene',
      pendingX: 0,
      pendingY: 0,
      x: event.clientX,
      y: event.clientY,
    };
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (pointerMapRef.current.has(event.pointerId)) {
      pointerMapRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    }

    if (pinchRef.current.active && !isPlanetView && pointerMapRef.current.size >= 2) {
      const nextDistance = getPinchDistance();
      const delta = nextDistance - pinchRef.current.distance;
      pinchRef.current.distance = nextDistance;
      event.preventDefault();

      updateView({
        ...viewRef.current,
        distance: clamp(viewRef.current.distance - delta * 0.035, 9.8, 24.6),
      }, false);
      return;
    }

    if (!dragRef.current.active) {
      return;
    }

    const deltaX = event.clientX - dragRef.current.x;
    const deltaY = event.clientY - dragRef.current.y;
    dragRef.current.x = event.clientX;
    dragRef.current.y = event.clientY;

    event.preventDefault();

    dragRef.current.pendingX += deltaX;
    dragRef.current.pendingY += deltaY;
    scheduleDragFrame();
  };

  const handlePointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    pointerMapRef.current.delete(event.pointerId);
    if (pointerMapRef.current.size < 2) {
      pinchRef.current.active = false;
    }

    dragRef.current.active = false;
    setView(viewRef.current);
    setInspectionRotation(inspectionRotationRef.current);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const handleWheel = (event: ReactWheelEvent<HTMLDivElement>) => {
    if (isPlanetView) {
      event.preventDefault();
      return;
    }

    if (Math.abs(event.deltaY) < 4) {
      return;
    }

    updateView({
      ...viewRef.current,
      distance: clamp(viewRef.current.distance + event.deltaY * 0.01, 11.6, 23.2),
    }, false);
  };

  return (
    <main
      className={`orbital-cinema ${isPlanetView ? 'is-planet-view' : ''} ${isPlanetView ? `is-dossier-${dossierSheetMode}` : ''}`}
      ref={shellRef}
      onPointerDown={handlePointerDown}
      onPointerCancel={handlePointerUp}
      onPointerLeave={handlePointerUp}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onWheel={handleWheel}
    >
      <div className="deep-space-field" aria-hidden="true" />
      <div className="cinema-vignette" aria-hidden="true" />

      <nav className="cinema-topbar" data-interactive="true" aria-label="页面导航">
        <a className="cinema-mark" href="#top" aria-label="返回八大行星首屏">
          <span />
          <strong>
            <em>ORBITAL CINEMA</em>
            <small className="cinema-mark-mobile-title">轻风愁亦落</small>
          </strong>
        </a>
        <div className="topbar-readout" aria-label="观测坐标">
          <span>Solar System / Interactive WebGL</span>
          <strong>UTC+08  OBSERVATORY</strong>
        </div>
        <button className="ghost-button" type="button" onClick={resetView}>
          <RotateCcw size={17} strokeWidth={1.8} />
          重置视角
        </button>
      </nav>

      <Suspense fallback={<div className="system-scene system-scene-fallback" aria-hidden="true" />}>
        <PlanetSystemScene
          activeId={activeBody.id}
          dossierCollapsed={isDossierCollapsed}
          focusPulse={switchPulse}
          focusMode={isPlanetView}
          inspectRotation={inspectionRotation}
          inspectRotationRef={inspectionRotationRef}
          onSelect={(planetId) => selectPlanet(planetId, { focus: true })}
          planets={planets}
          showLabels={showLabels}
          showOrbits={showOrbits}
          speed={sceneSpeed}
          view={view}
          viewRef={viewRef}
        />
      </Suspense>

      <section className="cinema-copy" id="top">
        <p className="cinema-eyebrow">ORBITAL CINEMA</p>
        <h1>
          <span>轻风愁亦落</span>
          <span>交互式深空作品</span>
        </h1>
        <div className="title-rule" aria-hidden="true">
          <i />
          <span />
        </div>
        <p className="cinema-lead">在引力的诗篇中，八颗行星，八段旅程。用交互、镜头与轨道秩序，探索深空的层次与浪漫。</p>
        <div className="intro-action" data-interactive="true">
          <button
            aria-label={isMotionPaused ? '继续星体运动' : '暂停星体运动'}
            aria-pressed={!isMotionPaused}
            className="play-button"
            onClick={() => {
              setSceneMode('观测');
              setIsPlanetView(false);
              setIsTouring(false);
              setIsMotionPaused((current) => !current);
            }}
            type="button"
          >
            {isMotionPaused ? <Play size={21} fill="currentColor" /> : <Pause size={21} fill="currentColor" />}
          </button>
          <div>
            <strong>{isMotionPaused ? '继续运动' : '暂停运动'}</strong>
            <span>{isMotionPaused ? '当前已暂停' : '星体运转中'}</span>
          </div>
        </div>
      </section>

      <aside
        className={`planet-dossier ${dossierSheetClass} ${isDossierCollapsed ? 'is-collapsed' : ''}`}
        data-interactive="true"
        data-sheet-mode={dossierSheetMode}
        aria-live="polite"
        onPointerCancel={handleDossierPointerUp}
        onPointerDown={handleDossierPointerDown}
        onPointerMove={handleDossierPointerMove}
        onPointerUp={handleDossierPointerUp}
      >
        <button
          aria-expanded={!isDossierCollapsed}
          aria-label={isDossierFull ? '收起行星介绍' : isDossierCollapsed ? '展开行星介绍' : '展开完整介绍'}
          className="dossier-collapse-toggle"
          onClick={toggleDossierSheet}
          type="button"
        >
          {isDossierFull ? <ArrowRight size={16} strokeWidth={1.9} /> : <ArrowLeft size={16} strokeWidth={1.9} />}
          <span>{isDossierFull ? '收起' : isDossierCollapsed ? '展开' : '详情'}</span>
        </button>

        <div className="dossier-content" aria-hidden={isDossierCollapsed}>
        <div className="dossier-header" key={`${activeBody.id}-header-${switchPulse}`}>
          <span>当前选择</span>
          <div
            className={`dossier-planet-preview ${activeBody.id === 'sun' ? 'is-sun' : ''}`}
            style={getSpriteVars(activeSpriteIndex, activeBody)}
            aria-hidden="true"
          />
          <h2>{activeBody.name}</h2>
          <strong>{activeBody.englishName.toUpperCase()}</strong>
          <p>{activeBody.subtitle}</p>
        </div>

        <div className="dossier-section" key={`${activeBody.id}-metrics-${switchPulse}`}>
          <h3>
            <Info size={16} strokeWidth={1.8} />
            基本数据
          </h3>
          <dl className="metric-table">
            {activeBody.metrics.map((metric) => (
              <div key={metric.label}>
                <dt>{metric.label}</dt>
                <dd>{metric.value}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="dossier-section" key={`${activeBody.id}-orbit-${switchPulse}`}>
          <h3>
            <CircleGauge size={16} strokeWidth={1.8} />
            轨道状态
          </h3>
          <dl className="status-table">
            {activeBody.orbitStatus.map((item) => (
              <div key={item.label}>
                <dt>{item.label}</dt>
                <dd>{item.value}</dd>
              </div>
            ))}
          </dl>
        </div>

        <p className="planet-insight">{activeBody.insight}</p>

        <button
          className="dossier-cta"
          key={`${activeBody.id}-cta-${switchPulse}`}
          type="button"
          onClick={isPlanetView ? resetView : enterPlanetView}
        >
          {isPlanetView ? '返回轨道总览' : `进入${activeBody.name}视角`}
          {isPlanetView ? <ArrowLeft size={18} strokeWidth={1.9} /> : <ArrowRight size={18} strokeWidth={1.9} />}
        </button>
        </div>
      </aside>

      <section className="control-deck" data-interactive="true" aria-label="星图控制台">
        <div className="mode-switch" aria-label="模式切换">
          {sceneModes.map((mode) => (
            <button
              className={mode === sceneMode ? 'is-active' : ''}
              key={mode}
              onClick={() => setMode(mode)}
              type="button"
            >
              {mode}
            </button>
          ))}
        </div>

        <div className="toggle-row">
          <button
            aria-pressed={showOrbits}
            className={showOrbits ? 'is-active' : ''}
            onClick={() => setShowOrbits((current) => !current)}
            type="button"
          >
            <Orbit size={17} strokeWidth={1.8} />
            轨道
          </button>
          <button
            aria-pressed={showLabels}
            className={showLabels ? 'is-active' : ''}
            onClick={() => setShowLabels((current) => !current)}
            type="button"
          >
            <Tags size={17} strokeWidth={1.8} />
            标签
          </button>
        </div>

        <label className="speed-control">
          <span>
            <Gauge size={17} strokeWidth={1.8} />
            速度
          </span>
          <input
            max="2.6"
            min="0.25"
            onChange={(event) => setSpeed(Number(event.target.value))}
            step="0.05"
            type="range"
            value={speed}
          />
          <strong>{speed.toFixed(2)}x</strong>
        </label>
      </section>

      <section className="planet-console" data-interactive="true" aria-label="八大行星导航">
        <div className="planet-strip">
          {selectableBodies.map((planet) => {
            const spriteIndex = planet.id === 'sun' ? 0 : planets.findIndex((item) => item.id === planet.id);

            return (
              <button
                className={`${planet.id === activeBody.id ? 'is-active' : ''} ${planet.id === 'sun' ? 'is-sun' : ''}`}
                key={planet.id}
                onClick={() => selectPlanet(planet.id, { focus: true })}
                style={getSpriteVars(spriteIndex, planet)}
                type="button"
              >
                <span className="planet-thumb" aria-hidden="true" />
                <strong>{planet.name}</strong>
                <small>{planet.order}</small>
              </button>
            );
          })}
        </div>

        <div className="console-hints">
          <button type="button" onClick={() => stepPlanet(-1)} aria-label="上一个行星">
            <ArrowLeft size={18} strokeWidth={1.9} />
          </button>
          <span>
            <MousePointer2 size={16} strokeWidth={1.8} />
            滚动缩放星图 · 拖拽旋转视角 · 点击 3D 行星进入近景
          </span>
          <button type="button" onClick={() => stepPlanet(1)} aria-label="下一个行星">
            <ArrowRight size={18} strokeWidth={1.9} />
          </button>
        </div>
      </section>

      <div className="active-caption" key={`${activeBody.id}-caption-${switchPulse}`} aria-hidden="true">
        <Sparkles size={14} strokeWidth={1.8} />
        {activeBody.order} / {activeBody.name} / {activeBody.englishName}
      </div>

      {isPlanetView && (
        <div className="focus-status" key={`${activeBody.id}-focus-${switchPulse}`} aria-hidden="true">
          <Orbit size={15} strokeWidth={1.8} />
          近景观测 / {activeBody.name} / DRAG TO INSPECT
        </div>
      )}

      <div className="accessibility-summary">
        <h2>八大行星交互作品</h2>
        <p>{activeBody.description}</p>
        <button type="button" onClick={() => stepPlanet(1)}>
          切换到下一颗行星
        </button>
        <button type="button" onClick={enterPlanetView}>
          进入当前行星视角
        </button>
        <button type="button" onClick={() => setShowLabels((current) => !current)}>
          {showLabels ? '隐藏标签' : '显示标签'}
        </button>
        <button type="button" onClick={() => setShowOrbits((current) => !current)}>
          {showOrbits ? '隐藏轨道' : '显示轨道'}
        </button>
        <Eye size={1} aria-hidden="true" />
      </div>
    </main>
  );
}
