# Water Drop Tool Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a right-side circular tool palette to the map with a working Water Drop tool that converts a 3×3 block of burning cells to watered on click, with a 3-second cooldown.

**Architecture:** Three new units wired into the existing MapView — a `latlngToCell` coordinate utility, a `ToolPalette` overlay component that renders on the right edge of the map, and a `MapClickHandler` component that lives inside the Leaflet `MapContainer` and intercepts clicks when a tool is armed. `MapView` owns the `activeTool` and `cooldownActive` states and passes them down.

**Tech Stack:** React 18, react-leaflet 4 (`useMapEvents`), Tailwind CSS v4, Lucide React, plain HTML5 Canvas (already rendering via `FireCanvasLayer`), Vite dev server.

> **Note:** No test framework is configured in this project. TDD steps are replaced with manual browser verification. All commands run from `frontend/` inside the worktree (`.worktrees/tool-palette/frontend/`).

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `frontend/src/utils/geo.js` | Modify | Add `latlngToCell(latlng, bounds, gridSize)` pure function |
| `frontend/src/components/ToolPalette.jsx` | Create | Right-side palette: four circular buttons + SVG cooldown ring |
| `frontend/src/components/MapClickHandler.jsx` | Create | Intercepts Leaflet map clicks, applies water drop, triggers cooldown |
| `frontend/src/MapView.jsx` | Modify | Add `activeTool` + `cooldownActive` state; render new components |

---

## Task 1: Add `latlngToCell` to geo.js

**Files:**
- Modify: `frontend/src/utils/geo.js`

- [ ] **Step 1: Open `geo.js` and append the new function**

  Current file has one export (`getBounds`). Append directly after it:

  ```js
  // Converts a Leaflet LatLng object to grid cell coordinates.
  // bounds = [[swLat, swLng], [neLat, neLng]] (from getBounds)
  // Returns { x, y } clamped to [0, gridSize - 1].
  export function latlngToCell(latlng, bounds, gridSize) {
    const [[swLat, swLng], [neLat, neLng]] = bounds;
    const x = Math.floor(((latlng.lng - swLng) / (neLng - swLng)) * gridSize);
    const y = Math.floor(((neLat - latlng.lat) / (neLat - swLat)) * gridSize);
    return {
      x: Math.max(0, Math.min(gridSize - 1, x)),
      y: Math.max(0, Math.min(gridSize - 1, y)),
    };
  }
  ```

- [ ] **Step 2: Manual verification**

  Start the dev server (if not already running):
  ```bash
  npm run dev
  ```
  Open browser devtools console and run:
  ```js
  // Paste and run — should print {x: 500, y: 500} (centre cell)
  import('/src/utils/geo.js').then(({ getBounds, latlngToCell }) => {
    const bounds = getBounds([-33.75, 150.42], 5);
    const centre = { lat: -33.75, lng: 150.42 };
    console.log(latlngToCell(centre, bounds, 1000)); // {x:500, y:500}
    // Edge clamping
    const far = { lat: -99, lng: 200 };
    console.log(latlngToCell(far, bounds, 1000)); // {x:999, y:999}
  });
  ```
  Expected: first log `{x: 500, y: 500}`, second `{x: 999, y: 999}`.

- [ ] **Step 3: Commit**

  ```bash
  git add frontend/src/utils/geo.js
  git commit -m "feat: add latlngToCell coordinate utility"
  ```

---

## Task 2: Create `ToolPalette.jsx`

**Files:**
- Create: `frontend/src/components/ToolPalette.jsx`

This component renders four circular tool buttons stacked vertically on the right edge of the map. Only `water` is active; the other three are locked. The active button is 56px with a blue border + outer glow. Locked/inactive buttons are 44px at reduced opacity. When `cooldownActive` is true, an SVG ring animates from full to empty over 3 seconds on the active button.

- [ ] **Step 1: Create the file**

  ```jsx
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
  ```

- [ ] **Step 2: Manual verification**

  Temporarily render the palette in `MapView` with hardcoded props to check the visuals. Add just before the closing `</div>` of the map wrapper:

  ```jsx
  <ToolPalette
    activeTool="water"
    cooldownActive={false}
    cooldownEpoch={0}
    onToolSelect={() => {}}
  />
  ```

  Import at top of `MapView.jsx`:
  ```jsx
  import ToolPalette from './components/ToolPalette';
  ```

  Open the map view in the browser. Confirm:
  - Four circular buttons on the right edge, vertically centred
  - Water button is 56px, blue border, glowing
  - Other three buttons are smaller, dimmed, locked cursor on hover
  - Labels visible below each button

- [ ] **Step 3: Commit**

  ```bash
  git add frontend/src/components/ToolPalette.jsx
  git commit -m "feat: add ToolPalette component with circular tool buttons"
  ```

---

## Task 3: Create `MapClickHandler.jsx`

**Files:**
- Create: `frontend/src/components/MapClickHandler.jsx`

This component renders `null` but uses `useMapEvents` (react-leaflet) to intercept map clicks when a tool is armed. It also manages the Leaflet container cursor via a `useEffect`. It must be rendered **inside** a `MapContainer`.

- [ ] **Step 1: Create the file**

  ```jsx
  // frontend/src/components/MapClickHandler.jsx
  import { useEffect } from 'react';
  import { useMapEvents } from 'react-leaflet';
  import { getBounds, latlngToCell } from '../utils/geo';
  import { GRID_SIZE } from '../services/MockWebSocket';

  export default function MapClickHandler({
    scenario,
    activeTool,
    cooldownUntil,
    gridRef,
    interact,
    onWaterDrop,
  }) {
    const map = useMapEvents({
      click(e) {
        if (activeTool !== 'water') return;
        if (Date.now() < cooldownUntil.current) return;

        const bounds = getBounds(scenario.center, 5);
        const { x, y } = latlngToCell(e.latlng, bounds, GRID_SIZE);

        // Apply 3×3 water drop — only convert burning (state 1) cells
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const cx = Math.max(0, Math.min(GRID_SIZE - 1, x + dx));
            const cy = Math.max(0, Math.min(GRID_SIZE - 1, y + dy));
            const key = `${cx},${cy}`;
            if (gridRef.current.get(key) === 1) {
              gridRef.current.set(key, 4);
            }
          }
        }

        // Notify backend / mock simulation (fire and forget)
        interact('water', x, y);

        // Start cooldown in parent
        onWaterDrop();
      },
    });

    // Crosshair cursor while a tool is armed
    useEffect(() => {
      map.getContainer().style.cursor = activeTool ? 'crosshair' : '';
    }, [activeTool, map]);

    return null;
  }
  ```

- [ ] **Step 2: Commit** (verification happens in Task 4 after wiring)

  ```bash
  git add frontend/src/components/MapClickHandler.jsx
  git commit -m "feat: add MapClickHandler for tool-aware map click interception"
  ```

---

## Task 4: Wire MapView

**Files:**
- Modify: `frontend/src/MapView.jsx`

Replace the temporary hardcoded `ToolPalette` props from Task 2 with real state. Add cooldown management and Escape-to-deselect.

- [ ] **Step 1: Add imports at the top of `MapView.jsx`**

  Add to the existing import block (keep all existing imports):

  ```jsx
  import ToolPalette from './components/ToolPalette';
  import MapClickHandler from './components/MapClickHandler';
  ```

  Remove any temporary ToolPalette import if you added one in Task 2 — this replaces it.

- [ ] **Step 2: Add state and refs inside `MapView`**

  Add these lines immediately after the existing `const [effects, setEffects] = useState(true);` line:

  ```jsx
  const [activeTool,    setActiveTool]    = useState(null);
  const [cooldownActive, setCooldownActive] = useState(false);
  const cooldownUntil = useRef(0);
  const cooldownEpoch = useRef(0);
  ```

- [ ] **Step 3: Add `handleToolSelect` and `handleWaterDrop` callbacks**

  Add after the `handleWindChange` function:

  ```jsx
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
  ```

- [ ] **Step 4: Add Escape-to-deselect effect**

  Add after the existing `useEffect` calls (before the `return`):

  ```jsx
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
  ```

- [ ] **Step 5: Render `MapClickHandler` inside `MapContainer`**

  Inside the `<MapContainer>` block, add `MapClickHandler` after the existing `<FireLayer ... />`:

  ```jsx
  <MapClickHandler
    scenario={scenario}
    activeTool={activeTool}
    cooldownUntil={cooldownUntil}
    gridRef={gridRef}
    interact={interact}
    onWaterDrop={handleWaterDrop}
  />
  ```

  Also update the `useSimulation` destructure at the top of `MapView` to include `interact` (it's already returned by `useSimulation` but may not be destructured yet):

  ```jsx
  const { gridRef, burnAgeRef, stats, status, paused, interact, setWind, togglePause } = useSimulation(scenario);
  ```

- [ ] **Step 6: Replace temporary `ToolPalette` with wired version**

  Find the temporary `<ToolPalette ... />` added in Task 2 and replace it with:

  ```jsx
  <ToolPalette
    activeTool={activeTool}
    cooldownActive={cooldownActive}
    cooldownEpoch={cooldownEpoch.current}
    onToolSelect={handleToolSelect}
  />
  ```

  This goes in the outer `<div className="relative w-full h-screen">`, **outside** the `<MapContainer>`, alongside the existing overlay panel.

- [ ] **Step 7: Manual end-to-end verification**

  With the dev server running, navigate to any scenario. Verify:

  1. **Palette renders** — four circular buttons on the right edge, vertically centred.
  2. **Activate Water** — click the Water button. It grows to 56px with blue glow. Map cursor changes to crosshair.
  3. **Deactivate by clicking again** — Water button shrinks back. Cursor returns to default.
  4. **Escape deselects** — activate Water, press Escape, button deselects.
  5. **Click map with Water armed** — click near burning cells. Within one rAF cycle, those cells turn cyan on the canvas (FireCanvasLayer picks up state `4`).
  6. **Cooldown ring** — after clicking the map, the blue ring on the Water button animates from full to empty over 3 seconds. Clicking map again during cooldown does nothing.
  7. **Cooldown expires** — after 3 seconds the ring disappears and another click applies water again.
  8. **Locked tools** — hovering Control/Backburn/Evac shows `not-allowed` cursor. Clicking does nothing.

- [ ] **Step 8: Commit**

  ```bash
  git add frontend/src/MapView.jsx
  git commit -m "feat: wire ToolPalette and MapClickHandler into MapView"
  ```
