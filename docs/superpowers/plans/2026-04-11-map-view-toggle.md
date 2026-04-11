# Map View Toggle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Grid/Map toggle to the FireCommander landing page so users can browse scenarios on a QLD map with clickable pins and anchored popup cards.

**Architecture:** `LandingPage.jsx` gains a `view` state that conditionally renders the existing grid or a new `ScenarioMapView` component. A pill toggle in the header switches views. `ScenarioMapView` uses react-leaflet (already installed) with CartoDB Dark Matter tiles, one marker per scenario, and a styled popup card per marker. Leaflet's native popup close-on-click handles dismiss.

**Tech Stack:** React 18, react-leaflet 4.2.1, leaflet 1.9.4, Tailwind CSS v4, Lucide icons

> **Note:** No test framework is configured in this project. Steps marked "Verify" describe manual browser checks instead of automated tests.

---

## File Map

| File | Change |
|------|--------|
| `frontend/src/index.css` | Add Leaflet popup CSS overrides |
| `frontend/src/LandingPage.jsx` | Add `view` state, header toggle pill, conditional render in `<main>` |
| `frontend/src/ScenarioMapView.jsx` | **New** — map container, markers, popup cards |

---

### Task 1: Strip Leaflet popup chrome via CSS

**Files:**
- Modify: `frontend/src/index.css`

- [ ] **Step 1: Add Leaflet popup overrides to the end of `frontend/src/index.css`**

Append after line 122 (after the closing `}` of the `code` rule):

```css
/* Leaflet popup chrome — replaced by custom React card content */
.leaflet-popup-content-wrapper {
  background: transparent;
  box-shadow: none;
  border: none;
  padding: 0;
  border-radius: 0;
}
.leaflet-popup-tip-container {
  display: none;
}
.leaflet-popup-content {
  margin: 0;
  line-height: 1;
}
```

- [ ] **Step 2: Verify**

Run `npm run dev` in `frontend/`. Open http://localhost:5173. No visible change yet — this just pre-stages the CSS. No errors in console.

- [ ] **Step 3: Commit**

```bash
cd frontend && git add src/index.css
git commit -m "style: strip leaflet popup chrome for custom scenario card"
```

---

### Task 2: Add view state and header toggle to LandingPage

**Files:**
- Modify: `frontend/src/LandingPage.jsx`

- [ ] **Step 1: Add `useState` import and `view` state**

Change line 1 from:
```jsx
import { useMemo } from 'react';
```
to:
```jsx
import { useMemo, useState } from 'react';
```

Then in the `LandingPage` component body (line 113), add `view` state as the first line inside the function, before `return`:
```jsx
export default function LandingPage({ onSelect }) {
  const [view, setView] = useState('grid');

  return (
```

- [ ] **Step 2: Add Grid/Map toggle pill to the header**

The current header inner div (lines 120–124) is:
```jsx
<div className="flex items-center gap-3">
  <img src={mascot} alt="FireCommander mascot" className="w-8 h-8 object-contain" />
  <span className="font-bold text-white tracking-wide text-sm">FireCommander</span>
  <span className="text-gray-600">·</span>
  <span className="text-gray-400 text-sm">Play with fire. Safely.</span>
</div>
```

Replace it with:
```jsx
<div className="flex items-center justify-between w-full">
  <div className="flex items-center gap-3">
    <img src={mascot} alt="FireCommander mascot" className="w-8 h-8 object-contain" />
    <span className="font-bold text-white tracking-wide text-sm">FireCommander</span>
    <span className="text-gray-600">·</span>
    <span className="text-gray-400 text-sm">Play with fire. Safely.</span>
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
```

- [ ] **Step 3: Verify**

In the browser, the header should now show "Grid" (orange, active) and "Map" pill buttons on the right. Clicking "Map" highlights it orange. Grid/Map clicks don't crash (map view not wired yet — the grid stays either way). No console errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/LandingPage.jsx
git commit -m "feat: add grid/map view toggle pill to landing page header"
```

---

### Task 3: Wire conditional render in LandingPage main area

**Files:**
- Modify: `frontend/src/LandingPage.jsx`

- [ ] **Step 1: Add ScenarioMapView import**

After the existing imports at the top of `LandingPage.jsx`, add:
```jsx
import ScenarioMapView from './ScenarioMapView';
```

- [ ] **Step 2: Replace the `<main>` block**

The current `<main>` (lines 128–134) is:
```jsx
<main className="flex-1 p-4 overflow-hidden relative z-10">
  <div className="grid grid-cols-3 grid-rows-2 gap-4 h-full">
    {scenarios.map((scenario) => (
      <ScenarioCard key={scenario.id} scenario={scenario} onSelect={onSelect} />
    ))}
  </div>
</main>
```

Replace with:
```jsx
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
```

- [ ] **Step 3: Verify**

`ScenarioMapView.jsx` doesn't exist yet, so the dev server will show an import error when you switch to Map view. That's expected — confirm the Grid view still works perfectly and the toggle pill is visible. Console will show a module-not-found error only after switching to Map.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/LandingPage.jsx
git commit -m "feat: conditionally render ScenarioMapView from landing page"
```

---

### Task 4: Create ScenarioMapView with map and markers

**Files:**
- Create: `frontend/src/ScenarioMapView.jsx`

- [ ] **Step 1: Create `frontend/src/ScenarioMapView.jsx`**

```jsx
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

export default function ScenarioMapView({ scenarios, onSelect }) {
  return (
    <MapContainer
      center={[-25, 152]}
      zoom={7}
      style={{ height: '100%', width: '100%' }}
      zoomControl={true}
      scrollWheelZoom={true}
    >
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
        subdomains="abcd"
        maxZoom={20}
      />

      {scenarios.map((scenario) => (
        <Marker
          key={scenario.id}
          position={scenario.center}
          icon={fireIcon}
        >
          <Popup
            closeButton={false}
            offset={[0, -7]}
          >
            <ScenarioPopupCard scenario={scenario} onSelect={onSelect} />
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
```

- [ ] **Step 2: Verify**

In the browser, click "Map" in the header. You should see:
- A dark CartoDB map centered on SE Queensland
- 6 glowing orange dots at each scenario's coordinates
- No console errors
- Clicking a dot opens the scenario popup card (image, name, risk badge, Launch button)
- Clicking anywhere on the map (not a dot) closes the popup
- Clicking "Grid" returns to the card grid

- [ ] **Step 3: Verify the Launch button**

Click a pin, then click "Launch →" in the popup. The simulation MapView should open for that scenario.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/ScenarioMapView.jsx
git commit -m "feat: add QLD scenario map view with fire pins and popup cards"
```

---

### Task 5: Add .superpowers to .gitignore

**Files:**
- Modify: `.gitignore` (repo root)

- [ ] **Step 1: Add `.superpowers/` to `.gitignore`**

Open `.gitignore` at the repo root. Add this line:
```
.superpowers/
```

- [ ] **Step 2: Commit**

```bash
git add .gitignore
git commit -m "chore: ignore .superpowers brainstorm session files"
```
