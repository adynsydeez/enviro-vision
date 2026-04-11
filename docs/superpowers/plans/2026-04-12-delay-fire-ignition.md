# Delay Fire Ignition Until After Mascot Intro Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ensure the fire only ignites and starts spreading AFTER the mascot's intro messages are finished.

**Architecture:** 
1. Modify `MockWebSocket` to delay `_seedFire()` until a `start` action is received.
2. Update `MapView` to send the `start` action once the intro sequence is complete.

**Tech Stack:** React, WebSocket (Mock).

---

### Task 1: Update MockWebSocket Logic

**Files:**
- Modify: `frontend/src/services/MockWebSocket.js`

- [ ] **Step 1: Remove `_seedFire()` from constructor**
  Ensure the grid starts empty (only vegetation).
- [ ] **Step 2: Add `start` action to `send(raw)`**
  When `msg.action === 'start'` is received:
  - Call `this._seedFire()`.
  - Emit a `FULL_SYNC` or a `TICK_UPDATE` with the new fire cells.
- [ ] **Step 3: Commit**
  ```bash
  git add frontend/src/services/MockWebSocket.js
  git commit -m "feat: delay fire ignition in MockWebSocket until start action"
  ```

### Task 2: Trigger Ignition from MapView

**Files:**
- Modify: `frontend/src/hooks/useSimulation.js` (to expose start method)
- Modify: `frontend/src/MapView.jsx` (to call start)

- [ ] **Step 1: Expose `start` in `useSimulation.js`**
  ```javascript
  const start = useCallback(() => {
    wsRef.current?.send(JSON.stringify({ action: 'start' }));
  }, []);
  ```
- [ ] **Step 2: Update MapView.jsx to trigger `start`**
  In the `useEffect` that handles `isIntroActive`, when it transitions from `true` to `false`, call `start()`.
- [ ] **Step 3: Commit**
  ```bash
  git add frontend/src/hooks/useSimulation.js frontend/src/MapView.jsx
  git commit -m "feat: trigger fire ignition after mascot intro complete"
  ```

### Task 3: Verification

- [ ] **Step 1: Verify ignition delay**
  Launch a scenario. Verify mascot talks first, and map shows NO fire.
  Finish dialogue. Verify fire appears and starts spreading.
- [ ] **Step 2: Final commit**
  ```bash
  git commit --allow-empty -m "feat: fire ignition delay complete"
  ```
