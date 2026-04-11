// frontend/src/components/ToolPalette.jsx
import { Droplets, Construction, Flame, AlertTriangle } from 'lucide-react';

const TOOLS = [
  { id: 'water',   label: 'Water',    Icon: Droplets,       locked: false },
  { id: 'line',    label: 'Control',  Icon: Construction,   locked: true  },
  { id: 'burn',    label: 'Backburn', Icon: Flame,          locked: true  },
  { id: 'evac',    label: 'Evac',     Icon: AlertTriangle,  locked: true  },
];

// SVG circle with r=24 in a 56×56 viewBox → circumference ≈ 150.8
const CIRCUMFERENCE = 2 * Math.PI * 24;

function CooldownRing({ active, epoch }) {
  if (!active) return null;
  return (
    <svg
      key={epoch}
      width="56"
      height="56"
      viewBox="0 0 56 56"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        transform: 'rotate(-90deg)',
        pointerEvents: 'none',
      }}
    >
      <circle
        cx="28"
        cy="28"
        r="24"
        fill="none"
        stroke="#60a5fa"
        strokeWidth="3"
        strokeDasharray={CIRCUMFERENCE}
        strokeDashoffset="0"
        strokeLinecap="round"
        style={{ animation: 'cooldown-ring 3s linear forwards' }}
      />
    </svg>
  );
}

export default function ToolPalette({ activeTool, cooldownActive, cooldownEpoch, onToolSelect }) {
  return (
    <>
      <style>{`
        @keyframes cooldown-ring {
          from { stroke-dashoffset: 0; }
          to   { stroke-dashoffset: ${CIRCUMFERENCE}; }
        }
      `}</style>

      <div className="absolute right-4 top-1/2 -translate-y-1/2 z-[1000] flex flex-col items-center gap-3">
        {TOOLS.map(({ id, label, Icon, locked }) => {
          const isActive = activeTool === id;
          const isCoolingDown = isActive && cooldownActive;

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
                  width:  isActive ? 56 : 44,
                  height: isActive ? 56 : 44,
                  borderRadius: '50%',
                  background: isActive
                    ? 'rgba(30,64,175,0.9)'
                    : 'rgba(15,23,42,0.8)',
                  border: isActive
                    ? '2.5px solid #93c5fd'
                    : '1.5px solid #4b5563',
                  boxShadow: isActive
                    ? '0 0 0 4px rgba(59,130,246,.2), 0 4px 16px rgba(59,130,246,.4)'
                    : 'none',
                  opacity: locked ? 0.35 : isActive ? 1 : 0.6,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'width 0.15s ease, height 0.15s ease, opacity 0.15s ease',
                }}
              >
                <Icon
                  size={isActive ? 22 : 18}
                  color={isActive ? '#bfdbfe' : '#9ca3af'}
                />
                <CooldownRing active={isCoolingDown} epoch={cooldownEpoch} />
              </div>
              <span
                style={{
                  fontSize: 9,
                  fontWeight: 700,
                  letterSpacing: '.05em',
                  textTransform: 'uppercase',
                  color: isActive ? '#bfdbfe' : locked ? '#4b5563' : '#6b7280',
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
