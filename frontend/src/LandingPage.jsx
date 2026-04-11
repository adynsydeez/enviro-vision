import { useMemo, useState } from 'react';
import { MapPin, ChevronRight, Flame } from 'lucide-react';
import ScenarioMapView from './ScenarioMapView';
import mascot from './assets/mascot.png';
import scenarios, { RISK_LEVELS } from './data/scenarios';

const EMBER_COLORS = ['#fb923c', '#f97316', '#fbbf24', '#ef4444'];

function Embers() {
  const embers = useMemo(() =>
    Array.from({ length: 55 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      size: Math.random() * 5 + 2,
      riseDuration: Math.random() * 5 + 5,
      swayDuration: Math.random() * 2 + 2,
      delay: Math.random() * 10,
      opacity: Math.random() * 0.5 + 0.35,
      color: EMBER_COLORS[Math.floor(Math.random() * EMBER_COLORS.length)],
    }))
  , []);

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {/* Glow base at bottom */}
      <div className="absolute bottom-0 inset-x-0 h-56 bg-gradient-to-t from-orange-900/50 via-orange-950/20 to-transparent" />

      {embers.map((e) => (
        <div
          key={e.id}
          className="absolute -bottom-4 ember-rise"
          style={{
            left: `${e.left}%`,
            animationDuration: `${e.riseDuration}s`,
            animationDelay: `${e.delay}s`,
          }}
        >
          <div
            className="ember-sway"
            style={{
              animationDuration: `${e.swayDuration}s`,
              animationDelay: `${e.delay * 0.4}s`,
            }}
          >
            <div
              className="rounded-full"
              style={{
                width: e.size,
                height: e.size,
                background: e.color,
                opacity: e.opacity,
                boxShadow: `0 0 ${e.size * 4}px ${e.size * 1.5}px ${e.color}88`,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function ScenarioCard({ scenario, onSelect }) {
  const risk = RISK_LEVELS[scenario.risk];

  return (
    <button
      onClick={() => onSelect(scenario)}
      className="group relative z-10 text-left bg-gray-900 border border-gray-800 rounded-xl overflow-hidden flex flex-col h-full hover:border-orange-500/70 transition-all duration-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-orange-500/50"
    >
      {/* Image */}
      <div className="relative overflow-hidden flex-1">
        <img
          src={scenario.image}
          alt={scenario.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-gray-900/30 to-transparent" />
        <span className={`absolute top-2 right-2 text-xs font-semibold px-2 py-0.5 rounded border ${risk.bg} ${risk.color}`}>
          {risk.label}
        </span>
      </div>

      {/* Content */}
      <div className="px-5 py-4 flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1 text-xs text-gray-400">
            <MapPin size={11} className="text-orange-400" />
            {scenario.state}
          </span>
          <span className="text-gray-700">·</span>
          <span className="text-xs text-gray-500">{scenario.year}</span>
        </div>

        <div className="flex items-center justify-between gap-2">
          <h2 className="text-white font-bold text-sm leading-tight group-hover:text-orange-100 transition-colors">
            {scenario.name}
          </h2>
          <span className="flex items-center gap-0.5 text-xs font-semibold text-orange-400 group-hover:text-orange-300 transition-colors shrink-0">
            Launch
            <ChevronRight size={13} className="group-hover:translate-x-0.5 transition-transform" />
          </span>
        </div>

        <span className="flex items-center gap-1 text-xs text-gray-600">
          <Flame size={11} className="text-orange-600" />
          {scenario.areaHa} ha
        </span>
      </div>
    </button>
  );
}

export default function LandingPage({ onSelect, onStartQuiz }) {
  const [view, setView] = useState('grid');

  return (
    <div className="h-screen bg-gray-950 text-white flex flex-col overflow-hidden relative">
      <Embers />

      {/* Header */}
      <header className="relative z-10 border-b border-gray-800/60 px-6 py-2.5 shrink-0">
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-3">
            <img src={mascot} alt="FireCommander mascot" className="w-8 h-8 object-contain" />
            <span className="font-bold text-white tracking-wide text-sm">FireCommander</span>
            <span className="text-gray-600">·</span>
            <span className="text-gray-400 text-sm">Play with fire. Safely.</span>
            <button 
              onClick={onStartQuiz}
              className="ml-4 text-xs font-bold px-3 py-1.5 bg-orange-500/10 border border-orange-500/30 text-orange-400 rounded-lg hover:bg-orange-500/20 transition-all cursor-pointer"
            >
              Take the Quiz
            </button>
          </div>
          <div className="flex items-center bg-gray-950 rounded-lg p-0.5 gap-0.5">
            <button
              onClick={() => setView('grid')}
              className={`text-xs font-semibold px-3 py-1 rounded-md transition-colors ${
                view === 'grid'
                  ? 'bg-orange-500 text-white'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              Grid
            </button>
            <button
              onClick={() => setView('map')}
              className={`text-xs font-semibold px-3 py-1 rounded-md transition-colors ${
                view === 'map'
                  ? 'bg-orange-500 text-white'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              Map
            </button>
          </div>
        </div>
      </header>

      {/* Scenario grid */}
      <main className="flex-1 overflow-hidden relative z-10">
        {view === 'grid' ? (
          <div className="p-4 grid grid-cols-3 grid-rows-2 gap-4 h-full">
            {scenarios.map((scenario) => (
              <ScenarioCard key={scenario.id} scenario={scenario} onSelect={onSelect} />
            ))}
          </div>
        ) : (
          <ScenarioMapView scenarios={scenarios} onSelect={onSelect} />
        )}
      </main>
    </div>
  );
}
