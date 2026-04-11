import { useEffect } from 'react';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import { ArrowLeft, Flame, MapPin } from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import { RISK_LEVELS } from './data/scenarios';

// Returns [[south, west], [north, east]] for a square of side 2*radiusKm
function getBounds(center, radiusKm = 5) {
  const [lat, lng] = center;
  const latDelta = radiusKm / 111.32;
  const lngDelta = radiusKm / (111.32 * Math.cos((lat * Math.PI) / 180));
  return [
    [lat - latDelta, lng - lngDelta],
    [lat + latDelta, lng + lngDelta],
  ];
}

function FlyToScenario({ center, zoom }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo(center, zoom, { duration: 1.5, easeLinearity: 0.25 });
  }, [center, zoom, map]);
  return null;
}

export default function MapView({ scenario, onBack }) {
  const risk = RISK_LEVELS[scenario.risk];

  return (
    <div className="relative w-full h-screen">
      {/* Map */}
      <MapContainer
        center={scenario.center}
        zoom={12}
        scrollWheelZoom
        style={{ height: '100%', width: '100%' }}
        zoomControl={false}
        maxBounds={getBounds(scenario.center, 5)}
        maxBoundsViscosity={1.0}
        minZoom={13}
      >
        <TileLayer
          attribution="Esri, Maxar, Earthstar Geographics"
          url="https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}.png"
        />
        <FlyToScenario center={scenario.center} zoom={scenario.zoom} />
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

        {/* Scenario info card */}
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
      </div>
    </div>
  );
}
