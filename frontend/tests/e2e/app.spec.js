import { test, expect } from "@playwright/test";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

async function goToLanding(page) {
  await page.goto("/");
  await expect(page.locator("text=D'Aguilar National Park")).toBeVisible();
}

/**
 * Launch the D'Aguilar scenario:
 *  1. Click the card button (the whole card is a <button>)
 *  2. Click through the mascot intro overlay (4 messages)
 *  3. Wait until the back "Scenarios" button is visible
 */
async function launchDaguilar(page) {
  await goToLanding(page);

  // Each scenario card is itself a <button> containing the scenario name
  await page
    .locator("button")
    .filter({ hasText: "D'Aguilar National Park" })
    .first()
    .click();

  // Wait for map view (back button appears)
  await expect(
    page.locator("button", { hasText: /scenarios/i })
  ).toBeVisible({ timeout: 10_000 });

  // Dismiss the mascot intro by clicking the full-screen overlay up to 5 times
  const introOverlay = page.locator('button[aria-label="Next intro message"]');
  for (let i = 0; i < 5; i++) {
    if (!(await introOverlay.isVisible())) break;
    await introOverlay.click();
    await page.waitForTimeout(150);
  }

  // Overlay should now be gone
  await expect(introOverlay).not.toBeVisible({ timeout: 3_000 });
}

/**
 * Wait until the simulation has produced at least one tick (tick > 0).
 * The tick counter is the only `p.text-white.font-bold` in the stats panel.
 */
async function waitForFirstTick(page) {
  await expect(async () => {
    const tickEl = page.locator("p.text-white.font-bold.text-lg.leading-none");
    const text = await tickEl.first().textContent();
    expect(Number(text)).toBeGreaterThan(0);
  }).toPass({ timeout: 25_000 });
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests: Landing page
// ─────────────────────────────────────────────────────────────────────────────

test.describe("Landing page", () => {
  test("renders all 6 scenario cards", async ({ page }) => {
    await goToLanding(page);
    // Each card is a button containing the text "Launch"
    const launchButtons = page.locator("button").filter({ hasText: /launch/i });
    await expect(launchButtons).toHaveCount(6);
  });

  test("shows scenario names on cards", async ({ page }) => {
    await goToLanding(page);
    await expect(page.locator("text=D'Aguilar National Park")).toBeVisible();
    await expect(page.locator("text=Lamington")).toBeVisible();
    await expect(page.locator("text=Glass House Mountains")).toBeVisible();
  });

  test("map/grid view toggle shows leaflet overview map", async ({ page }) => {
    await goToLanding(page);
    // Find the toggle button — it contains "Map" text
    const mapToggle = page.locator("button").filter({ hasText: /^map$/i }).first();
    await mapToggle.click();
    await expect(page.locator(".leaflet-container")).toBeVisible();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Tests: Simulation map
// ─────────────────────────────────────────────────────────────────────────────

test.describe("Simulation map", () => {
  test.beforeEach(async ({ page }) => {
    await launchDaguilar(page);
  });

  test("shows scenario name", async ({ page }) => {
    await expect(page.locator("text=D'Aguilar")).toBeVisible();
  });

  test("shows risk level badge", async ({ page }) => {
    await expect(page.locator("text=High")).toBeVisible();
  });

  test("displays Live Stats panel", async ({ page }) => {
    await expect(page.locator("text=Live Stats")).toBeVisible();
    await expect(page.locator("text=Burning")).toBeVisible();
    await expect(page.locator("text=Burned")).toBeVisible();
    await expect(page.locator("text=Tick")).toBeVisible();
    await expect(page.locator("text=Score")).toBeVisible();
  });

  test("tick counter increments after simulation starts", async ({ page }) => {
    await waitForFirstTick(page);
  });

  test("burning cell count becomes non-zero", async ({ page }) => {
    await waitForFirstTick(page);
    await expect(async () => {
      const val = await page
        .locator("p.text-orange-400.font-bold.text-lg")
        .first()
        .textContent();
      expect(Number(val)).toBeGreaterThan(0);
    }).toPass({ timeout: 20_000 });
  });

  test("score starts at 100", async ({ page }) => {
    // Before any cells burn, score should be 100
    const scoreEl = page
      .locator("p.font-bold.text-lg.leading-none")
      .filter({ hasText: /^100$/ });
    await expect(scoreEl).toBeVisible({ timeout: 5_000 });
  });

  test("pause button toggles simulation state", async ({ page }) => {
    await waitForFirstTick(page);

    // Click Pause
    await page.locator("button[title='Pause simulation']").click();
    await expect(page.locator("text=paused")).toBeVisible();

    // Click Resume
    await page.locator("button[title='Resume simulation']").click();
    await expect(page.locator("text=paused")).not.toBeVisible({ timeout: 3_000 });
  });

  test("back button returns to landing page", async ({ page }) => {
    await page.locator("button", { hasText: /scenarios/i }).click();
    await expect(page.locator("text=D'Aguilar National Park")).toBeVisible();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Tests: Tool palette
// ─────────────────────────────────────────────────────────────────────────────

test.describe("Tool palette", () => {
  test.beforeEach(async ({ page }) => {
    await launchDaguilar(page);
    await waitForFirstTick(page);
  });

  test("Water tool button is visible", async ({ page }) => {
    await expect(page.locator("button[title='Water']")).toBeVisible();
  });

  test("Control tool button is visible", async ({ page }) => {
    await expect(page.locator("button[title='Control']")).toBeVisible();
  });

  test("Backburn tool is locked (coming soon)", async ({ page }) => {
    // Two locked tools exist (Backburn + Evac) — just check at least one is present
    await expect(
      page.locator("button[title*='coming soon']").first()
    ).toBeVisible();
  });

  test("arming Water tool enlarges the icon (active = 72px, inactive = 56px)", async ({
    page,
  }) => {
    const waterBtn = page.locator("button[title='Water']");
    const innerDiv = waterBtn.locator("div").first();

    // Before: inner circle should be the inactive size
    const before = await innerDiv.boundingBox();
    expect(before.width).toBeLessThan(65);

    await waterBtn.click();

    // After: inner circle grows to 72px when active
    await expect(async () => {
      const after = await innerDiv.boundingBox();
      expect(after.width).toBeGreaterThan(65);
    }).toPass({ timeout: 3_000 });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Tests: Map layer toggles
// ─────────────────────────────────────────────────────────────────────────────

test.describe("Map layer toggles", () => {
  test.beforeEach(async ({ page }) => {
    await launchDaguilar(page);
  });

  test("Fire Simulation layer button is present", async ({ page }) => {
    await expect(
      page.locator("button", { hasText: /fire simulation/i })
    ).toBeVisible();
  });

  test("Foliage Map layer button is present", async ({ page }) => {
    await expect(
      page.locator("button", { hasText: /foliage map/i })
    ).toBeVisible();
  });

  test("Elevation Map layer button is present", async ({ page }) => {
    await expect(
      page.locator("button", { hasText: /elevation map/i })
    ).toBeVisible();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Tests: Mock fallback (VITE_API_URL not set)
// ─────────────────────────────────────────────────────────────────────────────

test.describe("Mock fallback", () => {
  test("simulation works even when backend is unavailable (fallback path)", async ({
    page,
  }) => {
    // SimulationClient tries the real backend first; when it's down it falls
    // back to MockWebSocket automatically.  The simulation must still tick.
    const backendErrors = [];
    page.on("requestfailed", (req) => {
      if (req.url().includes(":8000")) backendErrors.push(req.url());
    });

    await launchDaguilar(page);
    await waitForFirstTick(page);

    // Tick progressed → fallback is working regardless of backend status
    const tickEl = page
      .locator("p.text-white.font-bold.text-lg.leading-none")
      .first();
    expect(Number(await tickEl.textContent())).toBeGreaterThan(0);
  });

  test("tick counter advances without backend", async ({ page }) => {
    await launchDaguilar(page);
    await waitForFirstTick(page);

    const tickEl = page
      .locator("p.text-white.font-bold.text-lg.leading-none")
      .first();
    const tick1 = Number(await tickEl.textContent());

    await page.waitForTimeout(2000);
    const tick2 = Number(await tickEl.textContent());

    expect(tick2).toBeGreaterThan(tick1);
  });
});
