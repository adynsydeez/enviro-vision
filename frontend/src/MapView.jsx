import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import { ArrowLeft, Flame, MapPin, Zap, Shield, Sparkles, Play, Pause, TreeDeciduous, Wind } from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { RISK_LEVELS } from './data/scenarios';
import { getBounds } from './utils/geo';
import { useSimulation } from './hooks/useSimulation';
import { GRID_SIZE } from './services/MockWebSocket';
import { VEGETATION_TYPES } from './data/vegetation-mapping';
import FireCanvasLayer from './layers/FireCanvasLayer';
import VegetationCanvasLayer from './layers/VegetationCanvasLayer';
import WindCanvasLayer from './layers/WindCanvasLayer';
import ToolPalette from './components/ToolPalette';
import MapClickHandler from './components/MapClickHandler';
import ControlLineOverlay from './components/ControlLineOverlay';
import Mascot from './components/Mascot';
import { useMascot } from './hooks/useMascot';

// Default wind matches the MockWebSocket constants
const DEFAULT_WIND_DIR = 45;
const DEFAULT_WIND_SPD = 30;

// ─── Layer registry ────────────────────────────────────────────────────────────
// Add a new entry here to extend the Map Layers panel with an additional toggle.
const LAYER_DEFS = [
  {
    id:           'fire',
    label:        'Fire Simulation',
    Icon:         Flame,
    activeStyle:  'bg-orange-950 border-orange-700 text-orange-400',
    inactiveStyle:'bg-gray-900 border-gray-800 text-gray-500 hover:bg-gray-800',
  },
  {
    id:           'foliage',
    label:        'Foliage Map',
    Icon:         TreeDeciduous,
    activeStyle:  'bg-green-950 border-green-700 text-green-400',
    inactiveStyle:'bg-gray-900 border-gray-800 text-gray-500 hover:bg-gray-800',
  },
  // Future layers: Topography, Wind Field, Evac Zones, etc.
];

// ─── Sub-components ────────────────────────────────────────────────────────────

function FlyToScenario({ center, zoom }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo(center, zoom, { duration: 1.5, easeLinearity: 0.25 });
  }, [center, zoom, map]);
  return null;
}

function FireLayer({ gridRef, burnAgeRef, scenario, windDir, windSpd, effects }) {
  const map      = useMap();
  const layerRef = useRef(null);

  useEffect(() => {
    const bounds = getBounds(scenario.center, 5);
    const layer  = new FireCanvasLayer(gridRef, burnAgeRef, bounds, GRID_SIZE);
    layerRef.current = layer;
    map.addLayer(layer);
    return () => {
      map.removeLayer(layer);
      layerRef.current = null;
    };
  }, [map, gridRef, burnAgeRef, scenario]);

  useEffect(() => {
    layerRef.current?.setWind(windDir, windSpd);
  }, [windDir, windSpd]);

  useEffect(() => {
    layerRef.current?.setEffects(effects);
  }, [effects]);

  return null;
}

function VegetationLayer({ vegGridRef, scenario }) {
  const map = useMap();

  useEffect(() => {
    const bounds = getBounds(scenario.center, 5);
    const layer  = new VegetationCanvasLayer(vegGridRef, bounds, GRID_SIZE);
    map.addLayer(layer);
    return () => map.removeLayer(layer);
  }, [map, vegGridRef, scenario]);

  return null;
}

function WindLayer({ windDir, windSpd }) {
  const map      = useMap();
  const layerRef = useRef(null);

  useEffect(() => {
    const layer = new WindCanvasLayer();
    layerRef.current = layer;
    map.addLayer(layer);
    return () => {
      map.removeLayer(layer);
      layerRef.current = null;
    };
  }, [map]);

  useEffect(() => {
    layerRef.current?.setWind(windDir, windSpd);
  }, [windDir, windSpd]);

  return null;
}

function FoliageTooltip({ vegGridRef, scenario }) {
  const map = useMap();
  const [tooltip, setTooltip] = useState(null); // { x, y, veg } | null

  useEffect(() => {
    const leafletBounds = L.latLngBounds(getBounds(scenario.center, 5));
    const gs = GRID_SIZE;

    const onMove = (e) => {
      const grid = vegGridRef.current;
      if (!grid) { setTooltip(null); return; }

      const nw    = map.latLngToContainerPoint(leafletBounds.getNorthWest());
      const se    = map.latLngToContainerPoint(leafletBounds.getSouthEast());
      const cellW = (se.x - nw.x) / gs;
      const cellH = (se.y - nw.y) / gs;

      const gx = Math.floor((e.containerPoint.x - nw.x) / cellW);
      const gy = Math.floor((e.containerPoint.y - nw.y) / cellH);

      if (gx < 0 || gx >= gs || gy < 0 || gy >= gs) { setTooltip(null); return; }

      const typeId = grid[gy * gs + gx];
      const veg    = typeId > 0 ? VEGETATION_TYPES[typeId] : null;

      setTooltip(veg
        ? { x: e.containerPoint.x, y: e.containerPoint.y, veg }
        : null
      );
    };

    map.on('mousemove', onMove);
    map.on('mouseout',  () => setTooltip(null));
    return () => {
      map.off('mousemove', onMove);
      map.off('mouseout');
    };
  }, [map, vegGridRef, scenario]);

  if (!tooltip) return null;

  return createPortal(
    <div
      style={{
        position: 'absolute',
        left: tooltip.x + 14,
        top:  tooltip.y - 12,
        pointerEvents: 'none',
        zIndex: 1001,
      }}
    >
      <div className="bg-gray-950/85 border border-gray-700/50 rounded-lg px-3 py-2 backdrop-blur-md shadow-lg">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: tooltip.veg.color }} />
          <span className="text-white text-xs font-semibold">{tooltip.veg.name}</span>
        </div>
      </div>
    </div>,
    map.getContainer()
  );
}

// ─── Wind compass ──────────────────────────────────────────────────────────────

function WindCompass({ windDir, onChange }) {
  const svgRef = useRef(null);

  const getAngle = (e) => {
    const rect = svgRef.current.getBoundingClientRect();
    const dx = e.clientX - (rect.left + rect.width  / 2);
    const dy = e.clientY - (rect.top  + rect.height / 2);
    return Math.round(((Math.atan2(dx, -dy) * 180 / Math.PI) + 360) % 360);
  };

  const onPointerDown = (e) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    onChange(getAngle(e));
  };

  const onPointerMove = (e) => {
    if (e.buttons === 0) return;
    onChange(getAngle(e));
  };

  const R    = 34;
  const fRad = windDir * Math.PI / 180;
  const dRad = ((windDir + 180) % 360) * Math.PI / 180;
  const ax   = 50 + R * Math.sin(fRad);
  const ay   = 50 - R * Math.cos(fRad);
  const dx   = 50 + 20 * Math.sin(dRad);
  const dy   = 50 - 20 * Math.cos(dRad);

  return (
    <svg
      ref={svgRef}
      width="80" height="80" viewBox="0 0 100 100"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      style={{ cursor: 'crosshair', userSelect: 'none', touchAction: 'none', flexShrink: 0 }}
    >
      <circle cx="50" cy="50" r="46" fill="rgba(0,0,0,0.35)" stroke="#374151" strokeWidth="1.5" />
      {[0, 90, 180, 270].map(a => {
        const r = a * Math.PI / 180;
        return (
          <line key={a}
            x1={50 + 40 * Math.sin(r)} y1={50 - 40 * Math.cos(r)}
            x2={50 + 46 * Math.sin(r)} y2={50 - 46 * Math.cos(r)}
            stroke="#4b5563" strokeWidth="2"
          />
        );
      })}
      {[
        { a: 0,   l: 'N', x: 50, y: 10 },
        { a: 90,  l: 'E', x: 90, y: 53 },
        { a: 180, l: 'S', x: 50, y: 94 },
        { a: 270, l: 'W', x: 10, y: 53 },
      ].map(({ a, l, x, y }) => (
        <text key={a} x={x} y={y} textAnchor="middle" dominantBaseline="middle"
          fill="#6b7280" fontSize="9" fontFamily="system-ui,sans-serif">{l}</text>
      ))}
      <line x1="50" y1="50" x2={dx} y2={dy}
        stroke="#fb923c" strokeWidth="1.5" strokeOpacity="0.35" strokeDasharray="3 2" />
      <line x1="50" y1="50" x2={ax} y2={ay}
        stroke="#fb923c" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx={ax} cy={ay} r="4.5" fill="#fb923c" />
      <circle cx="50"  cy="50" r="3"   fill="#4b5563" />
    </svg>
  );
}

function bearingLabel(deg) {
  return ['N','NE','E','SE','S','SW','W','NW'][Math.round(((deg % 360) + 360) % 360 / 45) % 8];
}

// ─── Main component ────────────────────────────────────────────────────────────

export default function MapView({ scenario, onBack }) {
  const risk   = RISK_LEVELS[scenario.risk];
  const bounds = useMemo(() => getBounds(scenario.center, 5), [scenario]);
  const { gridRef, burnAgeRef, vegGridRef, stats, status, paused, interact, setWind, togglePause, start } =
    useSimulation(scenario);

  const mascotHook = useMascot(scenario);
  const { isIntroActive, triggerRandom } = mascotHook;
  const gameOverTriggered = useRef(false);
  const hasStartedRef = useRef(false);

  // Handle automatic resuming after Mascot intro and trigger ignition
  useEffect(() => {
    if (!isIntroActive && !hasStartedRef.current) {
      start();
      togglePause(); // to resume, since it starts paused
      hasStartedRef.current = true;
    }
  }, [isIntroActive, togglePause, start]);

  // Reset game over trigger and started flag when simulation restarts
  useEffect(() => {
    if (stats.tick === 0) {
      gameOverTriggered.current = false;
      hasStartedRef.current = false;
    }
  }, [stats.tick]);

  // Idle triggers
  useEffect(() => {
    if (isIntroActive || paused) return;

    const interval = setInterval(() => {
      triggerRandom('idle');
    }, 45000);

    return () => clearInterval(interval);
  }, [isIntroActive, paused, triggerRandom]);

  // Victory/Defeat triggers
  useEffect(() => {
    if (isIntroActive || gameOverTriggered.current) return;

    if (stats.score === 0) {
      triggerRandom('defeat');
      gameOverTriggered.current = true;
    } else if (stats.burning === 0 && stats.tick > 100) {
      triggerRandom('victory');
      gameOverTriggered.current = true;
    }
  }, [stats.score, stats.burning, stats.tick, isIntroActive, triggerRandom]);

  const handleTogglePause = () => {
    togglePause();
  };

  // Which top-level layers are toggled on (Set of layer ids)
  const [activeLayers, setActiveLayers] = useState(new Set(['fire']));

  const [windDir, setWindDir] = useState(DEFAULT_WIND_DIR);
  const [windSpd, setWindSpd] = useState(DEFAULT_WIND_SPD);
  const [effects, setEffects] = useState(true);
  const [showWindLayer, setShowWindLayer] = useState(false);
  const [activeTool,    setActiveTool]    = useState(null);
  const [cooldowns, setCooldowns] = useState({
    water: { active: false, duration: 3, epoch: 0 },
    line:  { active: false, duration: 5, epoch: 0 },
  });
  const cooldownUntil    = useRef({ water: 0, line: 0 });
  const cooldownTimers   = useRef({ water: null, line: null });

  const activeToolRef    = useRef(null);
  const [clPreviewCells, setClPreviewCells] = useState(null);

  const isFoliageActive = activeLayers.has('foliage');
  // Fire is suppressed whenever the foliage layer is on
  const isFireActive    = activeLayers.has('fire') && !isFoliageActive;

  const selectLayer = (id) => {
    setActiveLayers(new Set([id]));
    // Disarm any active tool when leaving the fire layer
    if (id !== 'fire') {
      activeToolRef.current = null;
      setActiveTool(null);
      setClPreviewCells(null);
    }
  };

  const handleWindChange = (dir, spd) => {
    setWindDir(dir);
    setWindSpd(spd);
    setWind(dir, spd);
    triggerRandom('wind');
  };

  const handleToolSelect = (id) => {
    const isDeselecting = activeToolRef.current === id;
    activeToolRef.current = isDeselecting ? null : id;
    setActiveTool(activeToolRef.current);
    setClPreviewCells(null);
  };

  const startCooldown = (toolId, durationMs) => {
    cooldownUntil.current[toolId] = Date.now() + durationMs;
    setCooldowns(prev => ({
      ...prev,
      [toolId]: {
        active: true,
        duration: durationMs / 1000,
        epoch: prev[toolId].epoch + 1,
      }
    }));

    clearTimeout(cooldownTimers.current[toolId]);
    cooldownTimers.current[toolId] = setTimeout(() => {
      setCooldowns(prev => ({
        ...prev,
        [toolId]: { ...prev[toolId], active: false }
      }));
    }, durationMs);
  };

  const handleWaterDrop = () => {
    startCooldown('water', 3000);
    triggerRandom('water');
  };

  const handleControlLineCommit = () => {
    setClPreviewCells(null);
    startCooldown('line', 5000);
  };

  useEffect(() => {
    return () => {
      Object.values(cooldownTimers.current).forEach(clearTimeout);
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        activeToolRef.current = null;
        setActiveTool(null);
        setClPreviewCells(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <div className="relative w-full h-screen">
      {/* Map */}
      <MapContainer
        center={scenario.center}
        zoom={12}
        scrollWheelZoom
        attributionControl={false}
        style={{ height: '100%', width: '100%' }}
        zoomControl={false}
        maxBounds={bounds}
        maxBoundsViscosity={1.0}
        minZoom={13}
      >
        <TileLayer
          attribution="Esri, Maxar, Earthstar Geographics"
          url="https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}.png"
        />
        <FlyToScenario center={scenario.center} zoom={scenario.zoom} />
        {isFireActive && (
          <FireLayer
            gridRef={gridRef}
            burnAgeRef={burnAgeRef}
            scenario={scenario}
            windDir={windDir}
            windSpd={windSpd}
            effects={effects}
          />
        )}
        {isFoliageActive && (
          <>
            <VegetationLayer vegGridRef={vegGridRef} scenario={scenario} />
            <FoliageTooltip  vegGridRef={vegGridRef} scenario={scenario} />
          </>
        )}
        {showWindLayer && (
          <WindLayer windDir={windDir} windSpd={windSpd} />
        )}
        <MapClickHandler
          scenario={scenario}
          activeTool={activeTool}
          cooldownUntil={cooldownUntil}
          gridRef={gridRef}
          interact={interact}
          onWaterDrop={handleWaterDrop}
          onControlLinePreview={setClPreviewCells}
          onControlLineCommit={handleControlLineCommit}
        />
        {isFireActive && (
          <ControlLineOverlay
            previewCells={clPreviewCells}
            scenario={scenario}
          />
        )}
      </MapContainer>

      {/* Left panel — nav, scenario info, live stats */}
      <div className="absolute top-4 left-4 z-[1000] flex flex-col gap-2">

        {/* Top button row */}
        <div className="flex gap-2">
          <button
            onClick={onBack}
            className="flex items-center gap-2 bg-gray-950/85 hover:bg-gray-900/70 border border-gray-700/50 backdrop-blur-md text-white text-sm font-medium px-3 py-2 rounded-lg backdrop-blur-sm transition-colors cursor-pointer"
          >
            <ArrowLeft size={15} />
            Scenarios
          </button>
          <button
            onClick={handleTogglePause}
            title={paused ? 'Resume simulation' : 'Pause simulation'}
            className="flex items-center gap-1.5 bg-gray-950/85 hover:bg-gray-900/70 border border-gray-700/50 backdrop-blur-md text-white text-sm font-medium px-3 py-2 rounded-lg backdrop-blur-sm transition-colors cursor-pointer"
          >
            {paused ? <Play size={15} /> : <Pause size={15} />}
          </button>
          <button
            onClick={() => setEffects(v => !v)}
            title={effects ? 'Disable visual effects' : 'Enable visual effects'}
            className={`flex items-center gap-1.5 border text-sm font-medium px-3 py-2 rounded-lg backdrop-blur-sm transition-colors cursor-pointer ${
              effects
                ? 'bg-orange-950/80 border-orange-700 text-orange-300 hover:bg-orange-900/80'
                : 'bg-gray-950/85 border-gray-700 text-gray-500 hover:bg-gray-900'
            }`}
          >
            <Sparkles size={15} />
            FX
          </button>
        </div>

        {/* Scenario info */}
        <div className="bg-gray-950/85 border border-gray-700/50 rounded-xl backdrop-blur-md p-4 w-64">
          <div className="flex items-center gap-2 mb-2">
            <span className="flex items-center gap-1 text-xs text-gray-400">
              <MapPin size={11} className="text-orange-400" />
              {scenario.state}
            </span>
            <span className="text-gray-700">·</span>
            <span className="text-xs text-gray-400">{scenario.year}</span>
          </div>
          <h2 className="text-white font-bold text-base leading-tight">{scenario.name}</h2>
          <div className="mt-3 flex items-center gap-2">
            <span className={`text-xs font-semibold px-2 py-0.5 rounded border ${risk.bg} ${risk.color}`}>
              {risk.label}
            </span>
            <span className="flex items-center gap-1 text-xs text-gray-500">
              <Flame size={11} className="text-orange-500" />
              {scenario.areaHa} ha
            </span>
          </div>
        </div>

        {/* Live stats */}
        <div className="bg-gray-950/85 border border-gray-700/50 rounded-xl backdrop-blur-md p-4 w-64">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Live Stats</span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
              paused                  ? 'bg-blue-950 text-blue-400'      :
              status === 'running'    ? 'bg-green-950 text-green-400'    :
              status === 'connecting' ? 'bg-yellow-950 text-yellow-400'  :
                                        'bg-gray-800 text-gray-500'
            }`}>
              {paused ? 'paused' : status}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-gray-500 mb-0.5">Burning</p>
              <p className="text-orange-400 font-bold text-lg leading-none">{stats.burning}</p>
              <p className="text-gray-600 text-xs">cells</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-0.5">Burned</p>
              <p className="text-red-400 font-bold text-lg leading-none">{stats.burned}</p>
              <p className="text-gray-600 text-xs">cells</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-0.5 flex items-center gap-1">
                <Zap size={10} />Tick
              </p>
              <p className="text-white font-bold text-lg leading-none">{stats.tick}</p>
              <p className="text-gray-600 text-xs">× 500ms</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-0.5 flex items-center gap-1">
                <Shield size={10} />Score
              </p>
              <p className={`font-bold text-lg leading-none ${
                stats.score > 70 ? 'text-green-400' :
                stats.score > 40 ? 'text-yellow-400' : 'text-red-400'
              }`}>{stats.score}</p>
              <p className="text-gray-600 text-xs">/ 100</p>
            </div>
          </div>
        </div>

      </div>

      {/* Right panel — map layers, wind */}
      <div className="absolute top-4 right-4 z-[1000] flex flex-col gap-2">

        {/* Map Layers — driven by LAYER_DEFS */}
        <div className="bg-gray-950/85 border border-gray-700/50 rounded-xl backdrop-blur-md p-4 w-64">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Map Layers</p>
          <div className="flex flex-col gap-2">
            {LAYER_DEFS.map((layerDef) => (
              <button
                key={layerDef.id}
                onClick={() => selectLayer(layerDef.id)}
                className={`border px-3 py-2 text-xs font-bold rounded flex items-center gap-2 cursor-pointer transition-colors ${
                  (layerDef.id === 'fire' ? isFireActive : activeLayers.has(layerDef.id))
                    ? layerDef.activeStyle : layerDef.inactiveStyle
                }`}
              >
                <layerDef.Icon size={14} />
                {layerDef.label}
              </button>
            ))}
          </div>
        </div>

        {/* Wind controls */}
        <div className="bg-gray-950/85 border border-gray-700/50 rounded-xl backdrop-blur-md p-4 w-64">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Wind</p>
            <button
              onClick={() => setShowWindLayer(v => !v)}
              title={showWindLayer ? 'Hide wind layer' : 'Show wind layer'}
              className={`flex items-center gap-1.5 border text-xs font-semibold px-2 py-1 rounded transition-colors cursor-pointer ${
                showWindLayer
                  ? 'bg-cyan-500 border-cyan-400 text-white hover:bg-cyan-400'
                  : 'bg-gray-900 border-gray-700 text-gray-500 hover:bg-gray-800'
              }`}
            >
              <Wind size={11} />
              {showWindLayer ? 'On' : 'Off'}
            </button>
          </div>
          <div className="flex items-start gap-3">
            <WindCompass windDir={windDir} onChange={dir => handleWindChange(dir, windSpd)} />
            <div className="flex-1 flex flex-col gap-3 pt-0.5">
              <div>
                <p className="text-xs text-gray-500 mb-0.5">Direction</p>
                <p className="text-white font-bold text-sm leading-none">
                  {windDir}°&nbsp;
                  <span className="text-orange-400">{bearingLabel(windDir)}</span>
                </p>
                <p className="text-gray-600 text-xs">wind from</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Speed</p>
                <input
                  type="range" min="0" max="100" step="1"
                  value={windSpd}
                  onChange={e => handleWindChange(windDir, +e.target.value)}
                  className="w-full accent-orange-500 cursor-pointer"
                />
                <p className="text-white font-bold text-sm leading-none mt-0.5">
                  {windSpd}&nbsp;<span className="text-gray-500 font-normal text-xs">km/h</span>
                </p>
              </div>
            </div>
          </div>
        </div>

      </div>

      {isFireActive && (
        <ToolPalette
          activeTool={activeTool}
          cooldowns={cooldowns}
          onToolSelect={handleToolSelect}
        />
      )}
      <Mascot mascotHook={mascotHook} />
    </div>
  );
}
