# Fix Mascot Layout and Bubble Positioning Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the mascot's position so it remains stationary in the bottom-left corner, and adjust the speech bubble's triangle tail to always point to it.

**Architecture:** 
- Change the container alignment from `items-center` to `items-start`.
- Anchoring the bubble's triangle to a fixed horizontal offset relative to the mascot's center.

**Tech Stack:** React, CSS.

---

### Task 1: Update Mascot Component Layout

**Files:**
- Modify: `frontend/src/components/Mascot.jsx`

- [ ] **Step 1: Change container alignment**
  Change `items-center` to `items-start` in the main container (`fixed bottom-4 left-4`).
  This will keep the mascot and the left edge of the bubble at the same horizontal position.

- [ ] **Step 2: Adjust bubble positioning**
  Ensure the bubble container has `items-start` or similar so it expands to the right.

- [ ] **Step 3: Commit**
  ```bash
  git add frontend/src/components/Mascot.jsx
  git commit -m "feat: fix mascot layout to items-start for stable positioning"
  ```

### Task 2: Update Bubble Tail Positioning

**Files:**
- Modify: `frontend/src/components/Mascot.css`

- [ ] **Step 1: Relocate bubble tail**
  Change `.mascot-bubble-tail` to use a fixed `left` value instead of `50%`.
  The mascot is `w-24` (96px). Its center is at 48px.
  The container has `left-4` (16px).
  So the tail should be at `left: 48px` (relative to the bubble's container which is also starting at `left-4`).

- [ ] **Step 2: Remove centering transform**
  Remove `transform: translateX(-50%)` from the tail.

- [ ] **Step 3: Commit**
  ```bash
  git add frontend/src/components/Mascot.css
  git commit -m "feat: relocate bubble triangle tail to point to fixed mascot position"
  ```

### Task 3: Verification

- [ ] **Step 1: Manual verification**
  Launch a scenario. Verify mascot stays in the same place when long and short messages appear.
  Verify the bubble tail always points to the mascot's center.
  Verify the bubble never goes below the left edge of the screen.

- [ ] **Step 2: Final commit**
  ```bash
  git commit --allow-empty -m "feat: mascot layout fix complete"
  ```
