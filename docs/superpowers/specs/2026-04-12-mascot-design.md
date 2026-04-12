# Design Spec: Mascot/Pet Assistant ("The Goofy Aide")

**Date:** 2026-04-12
**Status:** Draft
**Goal:** Implement a funny/goofy mascot to guide the user through scenarios and provide contextual commentary during gameplay.

## 1. Visual Design

- **Character:** `@frontend/public/mascot-ingame.png`
- **Placement:** Bottom-left corner of the `MapView`.
- **Speech Bubble:**
  - Glassmorphism style (matching `MapView` panels).
  - **Shape:** Pill shape (single line) or rounded rectangle (multiline).
  - **Pointer:** A triangle (tail) pointing to the mascot.
  - Positioned above or to the right of the mascot.
  - Animated entry/exit (fade/scale).
- **Intro Overlay:**
  - When in "Intro Mode", a transparent `div` covers the entire screen.
  - Clicking anywhere on this `div` triggers the next intro message.

## 2. Data Architecture

### `frontend/src/data/scenarios.js`
Extend each scenario with:
- `introMessages`: `string[]` — Sequence of messages to show on launch.
- `mascotDialogue`: `object` — Contextual reactions.
  - `water`: `string[]`
  - `wind`: `string[]`
  - `idle`: `string[]`
  - `victory`: `string[]`
  - `defeat`: `string[]`

## 3. Implementation Details

### `frontend/src/hooks/useMascot.js`
A custom hook to manage mascot state:
- `introIndex`: `number` (current intro message index)
- `isIntroActive`: `boolean`
- `currentMessage`: `string | null`
- `showBubble`: `boolean`
- `nextIntro()`: Advances the intro or finishes it.
- `say(msg, duration)`: Shows a temporary message bubble.
- `triggerRandom(category)`: Picks a random message from the current scenario's dialogue.

### `frontend/src/components/Mascot.jsx`
- Displays the mascot image.
- Displays the speech bubble with the `currentMessage`.
- Handles the full-screen click-to-advance logic during intro.

### `frontend/src/MapView.jsx` Integration
- Initialize `useMascot` with the current `scenario`.
- The simulation is **paused** as long as `isIntroActive` is true.
- Effects:
  - Watch `activeTool` (or `onWaterDrop`) to trigger mascot reactions.
  - Watch `stats.score` for victory/defeat hints.
  - Interval (30-60s) for idle comments.

## 4. Interaction Flow

1. **Launch:** `MapView` loads. `isIntroActive` = true. Simulation = paused.
2. **Intro:** Mascot says message 1. User clicks anywhere. Message 2...
3. **Start:** Last message dismissed. `isIntroActive` = false. Simulation = resumed (auto-unpause).
4. **Gameplay:**
   - User drops water -> Mascot says "Splash!".
   - User changes wind -> Mascot says "Hold on!".
   - Idle -> Mascot says something goofy about the location.

## 5. Success Criteria
- [ ] Mascot appears in the bottom left.
- [ ] Intro messages block simulation start.
- [ ] Clicking anywhere advances intro.
- [ ] Mascot reacts to tools and wind.
- [ ] UI remains consistent with existing "Tactical Sentinel" theme.
