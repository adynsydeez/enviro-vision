# Start Simulation Paused Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Change the simulation so it starts paused by default and only resumes after the mascot's intro is finished.

**Architecture:** 
1. Update `MockWebSocket` to initialize with `_paused = true`.
2. Update `useSimulation` hook to initialize with `paused = true`.
3. Simplify `MapView` logic to remove the manual "pause on start" attempt.

**Tech Stack:** React, WebSocket (Mock).

---

### Task 1: Update Initial States

**Files:**
- Modify: `frontend/src/services/MockWebSocket.js`
- Modify: `frontend/src/hooks/useSimulation.js`

- [ ] **Step 1: Set `_paused = true` in `MockWebSocket` constructor**
  Ensure the interval is not started by default.
- [ ] **Step 2: Set `paused = true` in `useSimulation` hook**
  Ensure React state matches the backend initial state.
- [ ] **Step 3: Commit**
  ```bash
  git add frontend/src/services/MockWebSocket.js frontend/src/hooks/useSimulation.js
  git commit -m "feat: start simulation in paused state by default"
  ```

### Task 2: Simplify MapView Integration

**Files:**
- Modify: `frontend/src/MapView.jsx`

- [ ] **Step 1: Simplify auto-pause/resume logic**
  Remove the condition that checks `isIntroActive && !paused` to call `togglePause`.
  Since it's already paused, we only need to:
  - Call `start()` when intro ends.
  - Call `togglePause()` when intro ends (to resume).
- [ ] **Step 2: Commit**
  ```bash
  git add frontend/src/MapView.jsx
  git commit -m "feat: simplify MapView logic to rely on initial paused state"
  ```

### Task 3: Verification

- [ ] **Step 1: Verify flow**
  Launch scenario. Verify "paused" status is shown immediately.
  Verify NO fire.
  Finish dialogue. Verify fire appears AND simulation starts ticking automatically.
- [ ] **Step 2: Final commit**
  ```bash
  git commit --allow-empty -m "feat: simulation start-paused implementation complete"
  ```
