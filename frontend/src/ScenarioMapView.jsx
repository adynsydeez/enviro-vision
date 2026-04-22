import { useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapPin, Flame, ChevronRight } from 'lucide-react';
import { RISK_LEVELS } from './data/scenarios';

// Custom orange fire pin — no default Leaflet icon
const fireIcon = L.divIcon({
  html: `<div style="
    width:14px;height:14px;
    background:#f97316;
    border-radius:50%;
    box-shadow:0 0 0 4px rgba(249,115,22,0.25),0 0 14px 2px rgba(249,115,22,0.45);
  "></div>`,
  className: '',
  iconSize: [14, 14],
  iconAnchor: [7, 7],
  popupAnchor: [0, -14],
});

function ScenarioPopupCard({ scenario, onSelect }) {
  const risk = RISK_LEVELS[scenario.risk];

  return (
    <div style={{ width: '220px', position: 'relative' }}>
      {/* Card */}
      <div className="bg-gray-900 rounded-xl overflow-hidden border border-gray-800 shadow-2xl">
        {/* Image */}
        <div className="relative h-24 overflow-hidden">
          <img
            src={scenario.image}
            alt={scenario.name}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-gray-900/20 to-transparent" />
          <span className={`absolute top-2 right-2 text-xs font-semibold px-2 py-0.5 rounded border ${risk.bg} ${risk.color}`}>
            {risk.label}
          </span>
        </div>

        {/* Content */}
        <div className="px-4 py-3 flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1 text-xs text-gray-400">
              <MapPin size={10} className="text-orange-400" />
              {scenario.state}
            </span>
            <span className="text-gray-700">·</span>
            <span className="text-xs text-gray-500">{scenario.year}</span>
          </div>

          <p className="text-white font-bold text-sm leading-tight">{scenario.name}</p>

          <div className="flex items-center justify-between mt-0.5">
            <span className="flex items-center gap-1 text-xs text-gray-600">
              <Flame size={10} className="text-orange-600" />
              {scenario.areaHa} ha
            </span>
            <button
              onClick={() => onSelect(scenario)}
              className="flex items-center gap-0.5 text-xs font-semibold text-orange-400 hover:text-orange-300 transition-colors"
            >
              Launch
              <ChevronRight size={12} />
            </button>
          </div>
        </div>
      </div>

      {/* Callout arrow pointing down to pin */}
      <div style={{
        position: 'absolute',
        bottom: '-6px',
        left: '50%',
        transform: 'translateX(-50%) rotate(45deg)',
        width: '12px',
        height: '12px',
        background: '#111827',
        borderRight: '1px solid #1f2937',
        borderBottom: '1px solid #1f2937',
      }} />
    </div>
  );
}

function ScenarioMarker({ scenario, onSelect }) {
  const markerRef = useRef(null);
  const closeTimer = useRef(null);

  const eventHandlers = {
    mouseover() {
      clearTimeout(closeTimer.current);
      markerRef.current?.openPopup();
    },
    mouseout() {
      closeTimer.current = setTimeout(() => markerRef.current?.closePopup(), 200);
    },
  };

  return (
    <Marker
      ref={markerRef}
      position={scenario.center}
      icon={fireIcon}
      eventHandlers={eventHandlers}
    >
      <Popup closeButton={false} offset={[0, -7]} autoPan={false}>
        <ScenarioPopupCard scenario={scenario} onSelect={onSelect} />
      </Popup>
    </Marker>
  );
}

export default function ScenarioMapView({ scenarios, onSelect }) {
  return (
    <MapContainer
      center={[-25, 152]}
      zoom={7}
      attributionControl={false}
      style={{ height: '100%', width: '100%' }}
      scrollWheelZoom
    >
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
        subdomains="abcd"
        maxZoom={20}
      />

      {scenarios.map((scenario) => (
        <ScenarioMarker key={scenario.id} scenario={scenario} onSelect={onSelect} />
      ))}
    </MapContainer>
  );
}
