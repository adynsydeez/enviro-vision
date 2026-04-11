import { Flame, MapPin, ChevronRight, Wind } from 'lucide-react';
import scenarios, { RISK_LEVELS } from './data/scenarios';

function ScenarioCard({ scenario, onSelect }) {
  const risk = RISK_LEVELS[scenario.risk];

  return (
    <button
      onClick={() => onSelect(scenario)}
      className="group text-left bg-gray-900 border border-gray-800 rounded-xl p-5 flex flex-col gap-3 hover:border-orange-500/70 hover:bg-gray-900/80 transition-all duration-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-orange-500/50"
    >
      {/* Top row: state + risk + year */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <span className="flex items-center gap-1.5 text-xs font-medium text-gray-400">
          <MapPin size={12} className="text-orange-400" />
          {scenario.state}
        </span>
        <div className="flex items-center gap-2">
          <span className={`text-xs font-semibold px-2 py-0.5 rounded border ${risk.bg} ${risk.color}`}>
            {risk.label}
          </span>
          <span className="text-xs text-gray-500">{scenario.year}</span>
        </div>
      </div>

      {/* Name */}
      <h2 className="text-white font-bold text-lg leading-tight group-hover:text-orange-100 transition-colors">
        {scenario.name}
      </h2>

      {/* Description */}
      <p className="text-gray-400 text-sm leading-relaxed flex-1">
        {scenario.description}
      </p>

      {/* Footer: area + launch */}
      <div className="flex items-center justify-between pt-1 border-t border-gray-800">
        <span className="flex items-center gap-1.5 text-xs text-gray-500">
          <Flame size={12} className="text-orange-500" />
          {scenario.areaHa} ha affected
        </span>
        <span className="flex items-center gap-1 text-xs font-semibold text-orange-400 group-hover:text-orange-300 transition-colors">
          Launch
          <ChevronRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
        </span>
      </div>
    </button>
  );
}

export default function LandingPage({ onSelect }) {
  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <header className="border-b border-gray-800/60 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center gap-3">
          <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-orange-500/10 border border-orange-500/30">
            <Flame size={18} className="text-orange-400" />
          </div>
          <div>
            <span className="font-bold text-white tracking-wide text-sm">PALAN-TIR</span>
            <span className="text-gray-600 mx-2">·</span>
            <span className="text-gray-400 text-sm">Wildfire Simulation Training</span>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-7xl mx-auto px-6 pt-14 pb-10">
        <div className="flex items-center gap-2 text-orange-400 text-sm font-medium mb-4">
          <Wind size={15} />
          Training Environment
        </div>
        <h1 className="text-4xl md:text-5xl font-bold text-white leading-tight tracking-tight max-w-2xl">
          Select a wildfire<br />
          <span className="text-orange-400">scenario</span> to simulate
        </h1>
        <p className="mt-4 text-gray-400 text-lg max-w-xl leading-relaxed">
          Practice suppression strategies on realistic Australian terrain. Deploy control lines, water drops, and backburns across historical fire scenarios.
        </p>
      </section>

      {/* Scenario grid */}
      <main className="max-w-7xl mx-auto px-6 pb-16">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {scenarios.map((scenario) => (
            <ScenarioCard key={scenario.id} scenario={scenario} onSelect={onSelect} />
          ))}
        </div>
      </main>
    </div>
  );
}
