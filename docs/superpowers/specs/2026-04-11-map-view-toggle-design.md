# Map View Toggle — Design Spec

**Date:** 2026-04-11
**Status:** Approved

## Summary

Add a Grid/Map toggle to the FireCommander landing page. The map view shows all six Queensland scenarios as pins on an interactive Leaflet map. Clicking a pin shows an anchored popup card. Clicking away dismisses it.

## State & Structure

`LandingPage.jsx` gains two state variables:

- `view: 'grid' | 'map'` — defaults to `'grid'`, resets to `'grid'` on page load (no persistence)
- `selectedScenario: null | scenario` — the scenario whose popup is open; resets to `null` when switching views

No routing changes. The existing `<main>` area conditionally renders either the scenario grid or `<ScenarioMapView>`.

## Header Toggle

A Grid/Map pill is added to the right side of the existing header bar (alongside the logo and tagline). Two buttons inside a dark pill container:

- Active view: orange background, white text
- Inactive view: transparent background, muted text
- Switching views resets `selectedScenario` to `null`

## ScenarioMapView Component

New file: `frontend/src/ScenarioMapView.jsx`

**Props:** `scenarios`, `selectedScenario`, `onSelectScenario(scenario)`, `onDismiss()`

**Map setup:**
- react-leaflet `MapContainer` filling the `<main>` area (same dimensions as the grid)
- Tile layer: CartoDB Dark Matter (`https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png`) — matches the dark theme
- Initial center: `[-22, 147]`, zoom `6` — frames all of QLD
- `scrollWheelZoom`, `dragging`, `zoomControl` all enabled
- Map click (not on a marker) → calls `onDismiss()`; implemented via `useMapEvents` in an inner component

**Markers:**
- One `Marker` per scenario using a custom `divIcon`: 12px orange circle with a glow shadow, no default Leaflet icon
- Clicking a marker calls `onSelectScenario(scenario)` — sets it as selected

**Popup:**
- react-leaflet `Popup` attached to the selected marker's position
- Styled to match the dark theme — removes default Leaflet popup chrome via CSS overrides
- Content mirrors the `ScenarioCard` layout:
  - Scenario image (fixed height ~80px, `object-cover`)
  - Risk level badge (top-right of image)
  - State · Year row
  - Scenario name (bold)
  - Area in ha
  - "Launch →" button that calls `onSelect(scenario)` (navigates to MapView)
- Width: ~220px
- Callout arrow pointing down to the pin

## CSS

A small block of global CSS (added to `index.css`) strips the default Leaflet popup box-shadow, border, and background so the styled React content is the only visible chrome:

```css
.leaflet-popup-content-wrapper { background: transparent; box-shadow: none; border: none; padding: 0; }
.leaflet-popup-tip-container { display: none; }
.leaflet-popup-content { margin: 0; }
```

The callout arrow is rendered as part of the React popup content itself (a rotated div).

## Behaviour

| Action | Result |
|--------|--------|
| Click Grid toggle | Shows scenario grid; selectedScenario = null |
| Click Map toggle | Shows QLD map; selectedScenario = null |
| Click a pin | selectedScenario = that scenario; popup opens |
| Click another pin | selectedScenario switches; previous popup closes |
| Click map (not a pin) | selectedScenario = null; popup closes |
| Click "Launch →" in popup | Calls onSelect(scenario); navigates to MapView |

## Files Changed

| File | Change |
|------|--------|
| `frontend/src/LandingPage.jsx` | Add `view`/`selectedScenario` state, header toggle, conditional render |
| `frontend/src/ScenarioMapView.jsx` | New component |
| `frontend/src/index.css` | Leaflet popup CSS overrides |

No new dependencies — react-leaflet is already installed.
