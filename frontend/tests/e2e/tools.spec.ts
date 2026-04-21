import { test, expect } from '@playwright/test';
import { LandingPage } from './pages/LandingPage';
import { SimulationPage } from './pages/SimulationPage';

test.describe('Tool palette', () => {
  test.beforeEach(async ({ page }) => {
    test.setTimeout(90_000);
    const landing = new LandingPage(page);
    const sim = new SimulationPage(page);
    await landing.goto();
    await landing.launchScenario("D'Aguilar National Park");
    await sim.dismissIntro();
    await sim.waitForTick(1);
  });

  test('Water tool button arms on click and disarms on second click', async ({ page }) => {
    const waterBtn = page.locator('button[title="Water"]');
    const innerDiv = waterBtn.locator('div').first();

    const before = await innerDiv.boundingBox();
    await waterBtn.click();

    // Active state: inner circle grows (> 65 px wide)
    await expect(async () => {
      const after = await innerDiv.boundingBox();
      expect(after!.width).toBeGreaterThan(65);
    }).toPass({ timeout: 3_000 });

    // Second click disarms
    await waterBtn.click();
    await expect(async () => {
      const disarmed = await innerDiv.boundingBox();
      expect(disarmed!.width).toBeLessThanOrEqual(before!.width + 2);
    }).toPass({ timeout: 3_000 });
  });

  test('Control Line tool button arms on click', async ({ page }) => {
    const controlBtn = page.locator('button[title="Control"]');
    const innerDiv = controlBtn.locator('div').first();

    const before = await innerDiv.boundingBox();
    await controlBtn.click();

    // Active size = 72px, inactive = 56px (ToolPalette.jsx)
    await expect(async () => {
      const after = await innerDiv.boundingBox();
      expect(after!.width).toBeGreaterThan(65);
    }).toPass({ timeout: 3_000 });
  });

  test('Backburn and Evac tools show locked / coming-soon state', async ({ page }) => {
    await expect(page.locator('button[title*="coming soon"]')).toHaveCount(2);
  });

  test('Water drop interact command reaches the backend without errors', async ({ page }) => {
    const sim = new SimulationPage(page);
    const wsErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') wsErrors.push(msg.text());
    });
    await sim.waitForTick(3);

    await sim.clickWaterTool();
    await sim.clickMap();

    // Simulation must keep ticking after the drop — confirms backend did not crash
    const tickBefore = await sim.getStatValue('stat-tick');
    await expect(async () => {
      expect(await sim.getStatValue('stat-tick')).toBeGreaterThan(tickBefore);
    }).toPass({ timeout: 10_000 });

    expect(wsErrors).toHaveLength(0);
  });

  test('Control line two-click placement completes without errors', async ({ page }) => {
    const sim = new SimulationPage(page);
    await sim.waitForTick(2);

    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    await sim.clickControlTool();
    await sim.clickMap(-50, -50);
    await sim.clickMap(50, 50);

    const tickBefore = await sim.getStatValue('stat-tick');
    await expect(async () => {
      expect(await sim.getStatValue('stat-tick')).toBeGreaterThan(tickBefore);
    }).toPass({ timeout: 10_000 });

    expect(errors).toHaveLength(0);
  });
});
