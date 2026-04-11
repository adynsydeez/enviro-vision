import { useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import { ArrowLeft, Flame, MapPin, Zap, Shield } from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import { RISK_LEVELS } from './data/scenarios';
import { getBounds } from './utils/geo';
import { useSimulation } from './hooks/useSimulation';
import { GRID_SIZE } from './services/MockWebSocket';
import FireCanvasLayer from './layers/FireCanvasLayer';

function FlyToScenario({ center, zoom }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo(center, zoom, { duration: 1.5, easeLinearity: 0.25 });
  }, [center, zoom, map]);
  return null;
}

function FireLayer({ gridRef, scenario }) {
  const map = useMap();
  useEffect(() => {
    const bounds = getBounds(scenario.center, 5);
    const layer  = new FireCanvasLayer(gridRef, bounds, GRID_SIZE);
    map.addLayer(layer);
    return () => map.removeLayer(layer);
  }, [map, gridRef, scenario]);
  return null;
}

export default function MapView({ scenario, onBack }) {
  const risk = RISK_LEVELS[scenario.risk];
  const bounds = useMemo(() => getBounds(scenario.center, 5), [scenario]);
  const { gridRef, stats, status } = useSimulation(scenario);

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
        <FireLayer gridRef={gridRef} scenario={scenario} />
      </MapContainer>

      {/* Overlay panel */}
      <div className="absolute top-4 left-4 z-[1000] flex flex-col gap-2">
        {/* Back button */}
        <button
          onClick={onBack}
          className="flex items-center gap-2 bg-gray-950/90 hover:bg-gray-900 border border-gray-700 text-white text-sm font-medium px-3 py-2 rounded-lg backdrop-blur-sm transition-colors cursor-pointer"
        >
          <ArrowLeft size={15} />
          Scenarios
        </button>

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
              status === 'running'    ? 'bg-green-950 text-green-400' :
              status === 'connecting' ? 'bg-yellow-950 text-yellow-400' :
                                       'bg-gray-800 text-gray-500'
            }`}>
              {status}
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
    </div>
  );
}
