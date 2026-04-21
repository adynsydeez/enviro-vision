# E2E Playwright Test Suite — Design Spec
**Date:** 2026-04-21
**Branch:** feature/real-backend-integration

## Summary

Replace the existing 20 mock-only JS Playwright tests with a comprehensive TypeScript suite that tests the full stack: FastAPI backend + Vite frontend. Playwright boots both servers. No mock fallback path is exercised.

---

## Architecture

### Config (`frontend/playwright.config.ts`)

Replaces `playwright.config.js`. Two `webServer` entries:
1. `uvicorn backend.api:app --port 8000` — waits on `http://localhost:8000/docs`
2. `npm run dev` — waits on `http://localhost:5173`

Environment injected into Vite:
```
VITE_API_URL=http://localhost:8000
VITE_WS_URL=ws://localhost:8000
```

This forces `SimulationClient` onto the real backend path (no mock fallback).

### Directory Layout

```
frontend/tests/e2e/
  pages/
    LandingPage.ts      ← navigate, card/pin interactions, quiz button
    SimulationPage.ts   ← launch, tick wait, pause/resume, wind, tools, layers
    QuizPage.ts         ← answer flow, score screen
  landing.spec.ts
  simulation.spec.ts
  tools.spec.ts
  layers.spec.ts
  quiz.spec.ts
```

Old `app.spec.js` is deleted. Old `playwright.config.js` is replaced.

---

## data-testid Additions (MapView.jsx)

The existing stats panel uses fragile Tailwind CSS selectors. The following `data-testid` attributes will be added to `MapView.jsx`:

| Attribute | Element |
|---|---|
| `stat-tick` | Tick counter value |
| `stat-burning` | Burning cell count |
| `stat-burned-ha` | Burned hectares value |
| `stat-score` | Score value |
| `wind-speed-display` | Wind speed readout text |
| `sim-status` | Paused/running status indicator |

---

## Locator Strategy

| Element | Locator |
|---|---|
| Scenario card buttons | `getByRole('button', { name: scenarioName })` |
| Launch button | `getByRole('button', { name: /launch/i })` |
| Back button | `getByRole('button', { name: /scenarios/i })` |
| Pause button | `getByRole('button', { name: /pause simulation/i })` |
| Resume button | `getByRole('button', { name: /resume simulation/i })` |
| Tool buttons | `getByRole('button', { name: /water/i })` etc. |
| Layer buttons | `getByRole('button', { name: /fire simulation/i })` etc. |
| Stats values | `getByTestId('stat-tick')` etc. |
| Wind slider | `getByRole('slider')` |

---

## Page Objects

### `LandingPage.ts`
- `goto()` — navigate to `/`
- `launchScenario(name)` — click scenario card, wait for map view
- `toggleMapView()` — click Map toggle button
- `clickQuiz()` — click quiz button

### `SimulationPage.ts`
- `dismissIntro()` — click through mascot intro overlay
- `waitForTick(n)` — poll `stat-tick` until value ≥ n
- `togglePause()` — click pause/resume button
- `clickWaterTool()` / `clickControlTool()` — arm tools
- `clickMap(x, y)` — click at viewport coords on the map canvas
- `selectLayer(name)` — click layer toggle button by name
- `getStatValue(testid)` — read numeric stat value
- `goBack()` — click back to scenarios

### `QuizPage.ts`
- `selectAnswer(index)` — click answer option by index
- `clickNext()` — click Next button
- `getScore()` — read score from completion screen

---

## Test Coverage

### `landing.spec.ts` (4 tests)
1. All 6 scenario cards render with name, risk badge, and Launch button
2. Map toggle switches to Leaflet overview with 6 fire pins visible
3. Clicking a pin popup's Launch button navigates to simulation
4. Quiz button navigates to quiz page

### `simulation.spec.ts` (10 tests)
1–6. Each of the 6 scenarios launches and reaches tick > 0 (`test.each` over all scenario IDs)
7. Burning cell count becomes non-zero after simulation runs
8. Score starts at 100 and decreases as fire spreads
9. Pause halts tick progression (tick value frozen)
10. Resume restores tick progression after pause

_(Note: tests 1–6 are parametrised; simulation.spec has 10 test cases total)_

### `tools.spec.ts` (5 tests)
1. Water tool button shows active state on click, returns to inactive on second click
2. Control Line button shows active state on click
3. Backburn and Evac tools show locked/coming-soon state
4. Water drop click on burning map area reduces burning count
5. Control line two-click placement completes (no JS errors, score unchanged = line placed not fire)

### `layers.spec.ts` (3 tests)
1. Fire Simulation is the default active layer on load
2. Selecting Foliage Map deactivates Fire and activates Foliage (button styles swap)
3. Selecting Elevation Map deactivates Fire and activates Elevation (button styles swap)

### `quiz.spec.ts` (5 tests)
1. Quiz renders question 1 with 4 answer options
2. Selecting correct answer highlights it green
3. Selecting wrong answer highlights it red and reveals correct answer
4. Next button advances through all 10 questions to completion
5. Completion screen shows final score out of 10

**Total: 27 tests across 4 spec files, 3 Page Objects**

---

## Constraints

- `fullyParallel: false` — backend sessions are per-connection; parallel tests risk port conflicts
- Backend startup timeout: 60s (sim init loads `.npy` files from disk)
- Test timeout: 45s (real WS frames take longer than mock)
- `retries: 1` in CI to handle transient backend startup race
- Backend is started from repo root (`../`) because `uvicorn backend.api:app` requires the package structure
