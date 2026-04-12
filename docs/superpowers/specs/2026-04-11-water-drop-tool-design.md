# Water Drop Tool — Design Spec

**Date:** 2026-04-11
**Branch:** feature/tool-palette

## Overview

Add a tool palette to the MapView that lets players apply suppression actions directly on the satellite map. The first tool is **Water Drop** — simulating an aerial water bombing run. The palette is designed to grow to four tools (Control Line, Backburn, Evac Zone) but only Water Drop is implemented in this iteration.

## Layout & Visual

A horizontal row of circular buttons on the **bottom of the map**, horizontally centred:

```
position: absolute, bottom: 2.5rem, left: 50%, translateX(-50%), z-index: 1000
```

- **Active tool:** 56px circle, blue border (`#93c5fd`), outer glow ring (`box-shadow: 0 0 0 4px rgba(59,130,246,.2), 0 4px 16px rgba(59,130,246,.4)`)
- **Inactive tools:** 44px circle, 50% opacity, dark glass background, grey border
- **Locked tools** (not yet implemented): same as inactive, cursor `not-allowed`, non-clickable
- Label: small uppercase text below each circle (`font-size: 9px, font-weight: 700, letter-spacing: .05em`)
- Background: `rgba(15,23,42,0.8)` with `backdrop-blur`

Tools in order (top → bottom):
1. Water Drop — 💧 — implemented
2. Control Line — 🚧 — locked
3. Backburn — 🔥 — locked
4. Evac Zone — 🚨 — locked

## Interaction Model

- One tool active at a time. Clicking the active tool again deselects it (toggle off).
- When a tool is armed, the Leaflet map container cursor changes to `crosshair`.
- While a tool is armed, map clicks are intercepted by the tool handler. Leaflet's default click-to-pan behaviour is suppressed.
- After a successful drop, a **3-second cooldown** begins:
  - The Water button displays a circular SVG countdown ring that depletes over 3 seconds.
  - The button ignores clicks during cooldown.
  - After cooldown expires, the button returns to its normal armed state.
- Deselecting a tool (clicking it again, or pressing Escape) restores the default map cursor and click behaviour immediately, resetting any active cooldown.

## Map Effect

On a valid map click while Water Drop is armed:

1. **Convert cells:** Find the 3×3 block of grid cells (100×100 grid, 10m per cell) centred on the clicked GPS coordinate. For each cell in the block, if its current state is `1` (burning), set it to `4` (watered). States `0`, `2`, `3`, `4` are unaffected.
2. **Optimistic update:** Write changes directly to `gridRef` (the `useRef(new Map())` shared with the canvas). The `FireCanvasLayer` runs a continuous rAF loop, so it will pick up the new cell states automatically on the next frame — no explicit redraw call needed.
3. **Backend call:** Send `POST /api/simulation/interact` with the GPS coords and tool type. Fire-and-forget — no UI blocking. If the backend is unavailable (mock mode), skip silently.
4. **Cooldown starts** after the optimistic update is applied.

### Cell state for watered cells (state 4)

`FireCanvasLayer` already renders state `4` cells as a cyan fill (`rgba(14,165,233,0.65)`), no glow. No changes needed to the canvas layer.

## GPS → Grid coordinate mapping

Use the existing `getBounds` utility to get the scenario's bounding box. Map the clicked `LatLng` to a grid `(x, y)` index:

```js
const bounds = getBounds(scenario.center, 5); // [[swLat, swLng], [neLat, neLng]]
const x = Math.floor((latlng.lng - bounds[0][1]) / (bounds[1][1] - bounds[0][1]) * GRID_SIZE);
const y = Math.floor((bounds[1][0] - latlng.lat) / (bounds[1][0] - bounds[0][0]) * GRID_SIZE);
```

Clamp `x` and `y` to `[0, GRID_SIZE - 1]` before building the 3×3 block.

## State Management

| State | Location | Type | Notes |
|-------|----------|------|-------|
| `activeTool` | `MapView` useState | `null \| 'water'` | Controls cursor + intercept |
| `cooldownUntil` | `MapView` useRef | `number` (timestamp ms) | No re-render mid-cooldown |
| `cooldownActive` | `MapView` useState | `boolean` | Triggers ring animation render |
| Grid cells | `gridRef` (existing) | `Map<string, number>` | Written directly, not React state |

## Component Structure

```
MapView
  ├── (existing) FireLayer
  ├── (existing) WindCompass
  ├── ToolPalette            ← new component (bottom center overlay)
  │     ├── ToolButton       ← reusable circular button
  │     └── CooldownRing     ← SVG countdown ring
  └── MapClickHandler        ← new hook-based component, handles tool clicks on map
```

`ToolPalette` receives `activeTool`, `cooldownActive`, and `onToolSelect` as props.
`MapClickHandler` uses `useMapEvents` from react-leaflet to intercept clicks.

## Files to Create / Modify

| File | Action |
|------|--------|
| `frontend/src/components/ToolPalette.jsx` | Create — palette + buttons + cooldown ring |
| `frontend/src/MapView.jsx` | Modify — add `activeTool` state, wire `ToolPalette` and `MapClickHandler` |
| `frontend/src/layers/FireCanvasLayer.js` | Modify — ensure state `4` renders as blue tint |

## Out of Scope

- Control Line, Backburn, Evac Zone implementation (locked in UI only)
- Cooldown duration configurability
- Sound effects
- Backend persistence of tool interactions (fire-and-forget only)
- Undo / redo
