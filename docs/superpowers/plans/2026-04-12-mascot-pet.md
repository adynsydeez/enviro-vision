# Mascot/Pet Assistant Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a funny/goofy mascot ("The Goofy Aide") with intro messages and contextual commentary in the simulation.

**Architecture:** A dedicated `Mascot` component for UI, a `useMascot` hook for state/dialogue logic, and data extensions in `scenarios.js`.

**Tech Stack:** React, Tailwind CSS (Vanilla CSS classes), Lucide icons.

---

### Task 0: Fix Baseline Lint Errors

**Files:**
- Modify: `frontend/src/LandingPage.jsx` (Fix Math.random in useMemo)
- Modify: `frontend/src/hooks/useSimulation.js` (Fix setState in useEffect)
- Modify: `frontend/src/layers/BaseCanvasLayer.js` (Fix unused variable)

- [ ] **Step 1: Fix LandingPage.jsx lint error**
  Move the random generation inside the `useMemo` but ensure it doesn't trigger the "impure function" rule if possible, or just ignore if it's a false positive (but better to fix). Actually, `Math.random()` inside `useMemo` *is* impure because `useMemo` might re-run. But if the dependency array is `[]`, it's stable. The linter is just being safe. I'll wrap it or disable the rule for that line if it's intended to be stable random.
  
- [ ] **Step 2: Fix useSimulation.js lint error**
  Wrap the initial state resets in a function or move them out of the effect if possible.
  
- [ ] **Step 3: Fix BaseCanvasLayer.js lint error**
  Remove unused `dt` variable.

- [ ] **Step 4: Verify lint passes**
  Run: `npm run --prefix frontend lint`
  Expected: PASS

- [ ] **Step 5: Commit baseline fixes**
  ```bash
  git add frontend/src/LandingPage.jsx frontend/src/hooks/useSimulation.js frontend/src/layers/BaseCanvasLayer.js
  git commit -m "chore: fix baseline lint errors"
  ```

### Task 1: Update Scenarios Data

**Files:**
- Modify: `frontend/src/data/scenarios.js`

- [ ] **Step 1: Add introMessages and mascotDialogue to all scenarios**
  Add funny, scenario-specific messages.

- [ ] **Step 2: Commit**
  ```bash
  git add frontend/src/data/scenarios.js
  git commit -m "feat: add mascot dialogue to scenarios data"
  ```

### Task 2: Create useMascot Hook

**Files:**
- Create: `frontend/src/hooks/useMascot.js`

- [ ] **Step 1: Implement useMascot hook**
  Manage intro state, current message, and random triggers.

- [ ] **Step 2: Commit**
  ```bash
  git add frontend/src/hooks/useMascot.js
  git commit -m "feat: implement useMascot hook"
  ```

### Task 3: Create Mascot Component

**Files:**
- Create: `frontend/src/components/Mascot.jsx`
- Create: `frontend/src/components/Mascot.css` (for bubble animations and triangle)

- [ ] **Step 1: Implement Mascot UI**
  Pill/rounded rectangle bubble, triangle pointer, glassmorphism style.

- [ ] **Step 2: Commit**
  ```bash
  git add frontend/src/components/Mascot.jsx frontend/src/components/Mascot.css
  git commit -m "feat: implement Mascot component UI"
  ```

### Task 4: Integrate Mascot into MapView

**Files:**
- Modify: `frontend/src/MapView.jsx`

- [ ] **Step 1: Add Mascot component to MapView**
- [ ] **Step 2: Hook up simulation pause logic**
  Ensure simulation stays paused during intro.
- [ ] **Step 3: Hook up contextual triggers**
  React to tool use and wind changes.

- [ ] **Step 4: Commit**
  ```bash
  git add frontend/src/MapView.jsx
  git commit -m "feat: integrate mascot into MapView with simulation control"
  ```

### Task 5: Final Verification

- [ ] **Step 1: Manual verification**
  Check intro flow, click-to-advance, and contextual messages.
- [ ] **Step 2: Run lint one last time**
  Run: `npm run --prefix frontend lint`
- [ ] **Step 3: Final commit**
  ```bash
  git commit --allow-empty -m "feat: mascot implementation complete"
  ```
