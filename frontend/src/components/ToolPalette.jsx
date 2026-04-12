import {
  Flame,
  Droplets,
  Shield,
  Users,
  Timer
} from "lucide-react";

const TOOLS = [
  {
    id: "water",
    label: "Water Drop",
    Icon: Droplets,
    color: "text-blue-400",
    bg: "bg-blue-950/80",
    border: "border-blue-700",
    activeStyle: "bg-blue-600 border-blue-400 text-white shadow-[0_0_15px_rgba(37,99,235,0.5)]",
    description: "Extinguish active fire in a small radius."
  },
  {
    id: "line",
    label: "Fire Break",
    Icon: Shield,
    color: "text-cyan-400",
    bg: "bg-cyan-950/80",
    border: "border-cyan-700",
    activeStyle: "bg-cyan-600 border-cyan-400 text-white shadow-[0_0_15px_rgba(8,145,178,0.5)]",
    description: "Dig a permanent dirt barrier (2-click path)."
  },
  {
    id: "backburn",
    label: "Backburn",
    Icon: Flame,
    color: "text-orange-400",
    bg: "bg-orange-950/80",
    border: "border-orange-700",
    activeStyle: "bg-orange-600 border-orange-400 text-white shadow-[0_0_15px_rgba(234,88,12,0.5)]",
    description: "Intentionally burn fuel to stop fire (2-click path)."
  },
  {
    id: "evac",
    label: "Evac Zone",
    Icon: Users,
    color: "text-purple-400",
    bg: "bg-purple-950/80",
    border: "border-purple-700",
    activeStyle: "bg-purple-600 border-purple-400 text-white shadow-[0_0_15px_rgba(147,51,234,0.5)]",
    description: "Protect critical areas from ignition."
  }
];

export default function ToolPalette({ activeTool, cooldowns, onToolSelect }) {
  return (
    <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-[1000] flex flex-col items-center gap-3">
      <div className="bg-gray-950/90 border border-gray-700/50 backdrop-blur-xl rounded-2xl p-2 flex gap-2 shadow-2xl items-end">
        {TOOLS.map((tool) => {
          const cd = cooldowns[tool.id] || { active: false, epoch: 0, duration: 0 };
          const isActive = activeTool === tool.id;
          
          return (
            <div key={tool.id} className="relative group">
              {/* Tooltip */}
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 px-3 py-1.5 bg-gray-900 border border-gray-700 rounded-lg text-[10px] text-gray-300 font-bold uppercase tracking-widest whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                {tool.label}
              </div>

              <button
                onClick={() => onToolSelect(tool.id)}
                disabled={cd.active}
                className={`
                  w-14 h-14 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all duration-200
                  ${isActive ? tool.activeStyle : `${tool.bg} ${tool.border} ${tool.color} hover:bg-gray-900`}
                  ${cd.active ? "opacity-50 cursor-not-allowed grayscale" : "cursor-pointer"}
                `}
              >
                <tool.Icon size={isActive ? 22 : 20} className={isActive ? "animate-pulse" : ""} />
                {cd.active && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-xl overflow-hidden">
                    <div 
                      key={cd.epoch}
                      className="absolute bottom-0 left-0 right-0 bg-white/20 animate-[cd_linear_forwards]"
                      style={{ height: '100%', animationDuration: `${cd.duration}s` }}
                    />
                    <Timer size={16} className="text-white relative z-10" />
                  </div>
                )}
              </button>
            </div>
          );
        })}
      </div>
      
      <p className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em] bg-gray-950/50 px-3 py-1 rounded-full backdrop-blur-sm">
        Tactical Operations Command
      </p>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes cd {
          from { height: 100%; }
          to { height: 0%; }
        }
      `}} />
    </div>
  );
}
