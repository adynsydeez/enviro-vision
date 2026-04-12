// frontend/src/components/ToolPalette.jsx
import { Droplets, Construction, Flame, AlertTriangle } from 'lucide-react';

const TOOLS = [
  { id: 'water',   label: 'Water',    Icon: Droplets,      locked: false },
  { id: 'line',    label: 'Control',  Icon: Construction,  locked: false },
  { id: 'burn',    label: 'Backburn', Icon: Flame,         locked: true  },
  { id: 'evac',    label: 'Evac',     Icon: AlertTriangle, locked: true  },
];

function CooldownRing({ active, duration, size }) {
  if (!active) return null;
  const strokeWidth = size > 60 ? 3 : 2;
  const r           = (size - strokeWidth) / 2;
  const center      = size / 2;
  const circ        = 2 * Math.PI * r;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      style={{
        position: 'absolute',
        top: -2.5,
        left: -2.5,
        transform: 'rotate(-90deg)',
        pointerEvents: 'none',
        overflow: 'visible',
        '--circ': circ,
      }}
    >
      <circle
        cx={center}
        cy={center}
        r={r}
        fill="none"
        stroke="#22d3ee"
        strokeWidth={strokeWidth}
        strokeDasharray={circ}
        strokeDashoffset="0"
        strokeLinecap="round"
        style={{ animation: `cooldown-ring ${duration}s linear forwards` }}
      />
    </svg>
  );
}

export default function ToolPalette({
  activeTool,
  cooldowns,
  onToolSelect,
}) {
  return (
    <>
      <style>{`
        @keyframes cooldown-ring {
          from { stroke-dashoffset: 0; }
          to   { stroke-dashoffset: var(--circ); }
        }
      `}</style>

      <div className="absolute right-4 top-1/2 -translate-y-1/2 z-[1000] flex flex-col items-center gap-3">
        {TOOLS.map(({ id, label, Icon: _icon, locked }) => {
          const Icon = _icon;
          const isActive = activeTool === id;
          const cd       = cooldowns[id] || { active: false, duration: 0, epoch: 0 };
          const size     = isActive ? 72 : 56;

          return (
            <button
              key={id}
              onClick={() => !locked && onToolSelect(id)}
              disabled={locked}
              title={locked ? `${label} — coming soon` : label}
              className="flex flex-col items-center gap-1 bg-transparent border-0 p-0"
              style={{ cursor: locked ? 'not-allowed' : 'pointer' }}
            >
              <div
                style={{
                  position: 'relative',
                  width:  size,
                  height: size,
                  borderRadius: '50%',
                  background: isActive
                    ? 'rgba(30,64,175,1)'
                    : 'rgba(15,23,42,0.95)',
                  border: isActive
                    ? '2.5px solid #93c5fd'
                    : '1.5px solid #4b5563',
                  boxShadow: isActive
                    ? '0 0 0 4px rgba(59,130,246,.2), 0 4px 16px rgba(59,130,246,.4)'
                    : 'none',
                  opacity: locked ? 0.35 : (isActive || cd.active) ? 1 : 0.6,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'width 0.15s ease, height 0.15s ease, opacity 0.15s ease',
                }}
              >
                <Icon
                  size={isActive ? 28 : 22}
                  color={isActive ? '#bfdbfe' : (cd.active ? '#93c5fd' : '#9ca3af')}
                />
                <CooldownRing
                  key={cd.epoch}
                  active={cd.active}
                  duration={cd.duration}
                  size={size}
                />
              </div>
              <span
                style={{
                  fontSize: 9,
                  fontWeight: 700,
                  letterSpacing: '.05em',
                  textTransform: 'uppercase',
                  color: locked ? '#4b5563' : '#ffffff',
                  textShadow: '0 1px 4px rgba(0,0,0,0.8)',
                  userSelect: 'none',
                }}
              >
                {label}
              </span>
            </button>
          );
        })}
      </div>
    </>
  );
}
