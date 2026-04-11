import { useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import { ArrowLeft, Flame, MapPin, Zap, Shield, Sparkles, Play, Pause } from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import { RISK_LEVELS } from './data/scenarios';
import { getBounds } from './utils/geo';
import { useSimulation } from './hooks/useSimulation';
import { GRID_SIZE } from './services/MockWebSocket';
import FireCanvasLayer from './layers/FireCanvasLayer';
import ToolPalette from './components/ToolPalette';
import MapClickHandler from './components/MapClickHandler';

// Default wind matches the MockWebSocket constants
const DEFAULT_WIND_DIR = 45;
const DEFAULT_WIND_SPD = 30;

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

// Compass rose — click or drag anywhere to set wind direction
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
      {/* Cardinal ticks */}
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
      {/* Labels */}
      {[
        { a: 0,   l: 'N', x: 50, y: 10 },
        { a: 90,  l: 'E', x: 90, y: 53 },
        { a: 180, l: 'S', x: 50, y: 94 },
        { a: 270, l: 'W', x: 10, y: 53 },
      ].map(({ a, l, x, y }) => (
        <text key={a} x={x} y={y} textAnchor="middle" dominantBaseline="middle"
          fill="#6b7280" fontSize="9" fontFamily="system-ui,sans-serif">{l}</text>
      ))}
      {/* Downwind direction (where fire spreads) — dashed */}
      <line x1="50" y1="50" x2={dx} y2={dy}
        stroke="#fb923c" strokeWidth="1.5" strokeOpacity="0.35" strokeDasharray="3 2" />
      {/* Wind FROM arrow */}
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

export default function MapView({ scenario, onBack }) {
  const risk   = RISK_LEVELS[scenario.risk];
  const bounds = useMemo(() => getBounds(scenario.center, 5), [scenario]);
  const { gridRef, burnAgeRef, stats, status, paused, interact, setWind, togglePause } = useSimulation(scenario);

  const [windDir, setWindDir] = useState(DEFAULT_WIND_DIR);
  const [windSpd, setWindSpd] = useState(DEFAULT_WIND_SPD);
  const [effects, setEffects] = useState(true);
  const [activeTool,    setActiveTool]    = useState(null);
  const [cooldownActive, setCooldownActive] = useState(false);
  const cooldownUntil = useRef(0);
  const cooldownEpoch = useRef(0);

  const handleWindChange = (dir, spd) => {
    setWindDir(dir);
    setWindSpd(spd);
    setWind(dir, spd);
  };

  const handleToolSelect = (id) => {
    setActiveTool(prev => {
      if (prev === id) {
        // Deselect: reset cooldown immediately
        setCooldownActive(false);
        cooldownUntil.current = 0;
        return null;
      }
      return id;
    });
  };

  const handleWaterDrop = () => {
    cooldownUntil.current = Date.now() + 3000;
    cooldownEpoch.current += 1;
    setCooldownActive(true);
    setTimeout(() => setCooldownActive(false), 3000);
  };

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        setActiveTool(null);
        setCooldownActive(false);
        cooldownUntil.current = 0;
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
        <FireLayer
          gridRef={gridRef}
          burnAgeRef={burnAgeRef}
          scenario={scenario}
          windDir={windDir}
          windSpd={windSpd}
          effects={effects}
        />
        <MapClickHandler
          scenario={scenario}
          activeTool={activeTool}
          cooldownUntil={cooldownUntil}
          gridRef={gridRef}
          interact={interact}
          onWaterDrop={handleWaterDrop}
        />
      </MapContainer>

      {/* Overlay panel */}
      <div className="absolute top-4 left-4 z-[1000] flex flex-col gap-2">
        {/* Top button row */}
        <div className="flex gap-2">
          <button
            onClick={onBack}
            className="flex items-center gap-2 bg-gray-950/90 hover:bg-gray-900 border border-gray-700 text-white text-sm font-medium px-3 py-2 rounded-lg backdrop-blur-sm transition-colors cursor-pointer"
          >
            <ArrowLeft size={15} />
            Scenarios
          </button>
          <button
            onClick={togglePause}
            title={paused ? 'Resume simulation' : 'Pause simulation'}
            className="flex items-center gap-1.5 bg-gray-950/90 hover:bg-gray-900 border border-gray-700 text-white text-sm font-medium px-3 py-2 rounded-lg backdrop-blur-sm transition-colors cursor-pointer"
          >
            {paused ? <Play size={15} /> : <Pause size={15} />}
          </button>
          <button
            onClick={() => setEffects(v => !v)}
            title={effects ? 'Disable visual effects' : 'Enable visual effects'}
            className={`flex items-center gap-1.5 border text-sm font-medium px-3 py-2 rounded-lg backdrop-blur-sm transition-colors cursor-pointer ${
              effects
                ? 'bg-orange-950/80 border-orange-700 text-orange-300 hover:bg-orange-900/80'
                : 'bg-gray-950/90 border-gray-700 text-gray-500 hover:bg-gray-900'
            }`}
          >
            <Sparkles size={15} />
            FX
          </button>
        </div>

        {/* Scenario info */}
        <div className="bg-gray-950/90 border border-gray-700 rounded-xl backdrop-blur-sm p-4 w-64">
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
        <div className="bg-gray-950/90 border border-gray-700 rounded-xl backdrop-blur-sm p-4 w-64">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Live Stats</span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
              paused             ? 'bg-blue-950 text-blue-400'    :
              status === 'running'    ? 'bg-green-950 text-green-400' :
              status === 'connecting' ? 'bg-yellow-950 text-yellow-400' :
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

        {/* Wind controls */}
        <div className="bg-gray-950/90 border border-gray-700 rounded-xl backdrop-blur-sm p-4 w-64">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Wind</p>
          <div className="flex items-start gap-3">
            <WindCompass windDir={windDir} onChange={dir => handleWindChange(dir, windSpd)} />

            <div className="flex-1 flex flex-col gap-3 pt-0.5">
              {/* Direction readout */}
              <div>
                <p className="text-xs text-gray-500 mb-0.5">Direction</p>
                <p className="text-white font-bold text-sm leading-none">
                  {windDir}°&nbsp;
                  <span className="text-orange-400">{bearingLabel(windDir)}</span>
                </p>
                <p className="text-gray-600 text-xs">wind from</p>
              </div>

              {/* Speed slider */}
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

      <ToolPalette
        activeTool={activeTool}
        cooldownActive={cooldownActive}
        cooldownEpoch={cooldownEpoch.current}
        onToolSelect={handleToolSelect}
      />
    </div>
  );
}
