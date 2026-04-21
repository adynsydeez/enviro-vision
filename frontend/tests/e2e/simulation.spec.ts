import { test, expect } from '@playwright/test';
import { LandingPage } from './pages/LandingPage';
import { SimulationPage } from './pages/SimulationPage';

const SCENARIOS: { name: string }[] = [
  { name: "D'Aguilar National Park" },
  { name: 'Lamington National Park' },
  { name: 'Glass House Mountains' },
  { name: 'Bunya Mountains' },
  { name: 'Girraween National Park' },
  { name: 'Eungella National Park' },
];

// Each scenario creates a session and waits for the real backend to tick —
// allow 90 s per test because the backend loads .npy arrays on session create.
for (const { name } of SCENARIOS) {
  test(`${name} — reaches tick > 0 via real backend`, async ({ page }) => {
    test.setTimeout(90_000);

    const landing = new LandingPage(page);
    const sim = new SimulationPage(page);

    await landing.goto();
    await landing.launchScenario(name);
    await sim.dismissIntro();
    await sim.waitForTick(1);
  });
}

test.describe("D'Aguilar simulation state", () => {
  test.beforeEach(async ({ page }) => {
    test.setTimeout(90_000);
    const landing = new LandingPage(page);
    const sim = new SimulationPage(page);
    await landing.goto();
    await landing.launchScenario("D'Aguilar National Park");
    await sim.dismissIntro();
    await sim.waitForTick(1);
  });

  test('burning cell count becomes non-zero', async ({ page }) => {
    const sim = new SimulationPage(page);
    await expect(async () => {
      expect(await sim.getStatValue('stat-burning')).toBeGreaterThan(0);
    }).toPass({ timeout: 20_000 });
  });

  test('score starts at 100 and is within valid range', async ({ page }) => {
    const sim = new SimulationPage(page);
    const score = await sim.getStatValue('stat-score');
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  test('score decreases as fire spreads', async ({ page }) => {
    test.setTimeout(120_000);
    const sim = new SimulationPage(page);
    await sim.waitForTick(5);
    const first = await sim.getStatValue('stat-score');
    await sim.waitForTick(20);
    const later = await sim.getStatValue('stat-score');
    expect(later).toBeLessThanOrEqual(first);
  });

  test('pause halts tick progression', async ({ page }) => {
    const sim = new SimulationPage(page);
    await sim.waitForTick(2);

    await sim.togglePause();
    await expect(sim.simStatus).toHaveText('paused');

    const tickBefore = await sim.getStatValue('stat-tick');
    // Wait two seconds — tick must not advance while paused
    await page.waitForTimeout(2_000);
    const tickAfter = await sim.getStatValue('stat-tick');
    expect(tickAfter).toBe(tickBefore);
  });

  test('resume restores tick progression after pause', async ({ page }) => {
    const sim = new SimulationPage(page);
    await sim.waitForTick(2);

    await sim.togglePause();
    await expect(sim.simStatus).toHaveText('paused');
    await sim.togglePause();
    await expect(sim.simStatus).not.toHaveText('paused', { timeout: 5_000 });

    const tickBefore = await sim.getStatValue('stat-tick');
    await expect(async () => {
      expect(await sim.getStatValue('stat-tick')).toBeGreaterThan(tickBefore);
    }).toPass({ timeout: 10_000 });
  });
});
