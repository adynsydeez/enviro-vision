import { test, expect } from '@playwright/test';
import { LandingPage } from './pages/LandingPage';
import { SimulationPage } from './pages/SimulationPage';

test.describe('Map layer selector', () => {
  test.beforeEach(async ({ page }) => {
    test.setTimeout(90_000);
    const landing = new LandingPage(page);
    const sim = new SimulationPage(page);
    await landing.goto();
    await landing.launchScenario("D'Aguilar National Park");
    await sim.dismissIntro();
  });

  test('Fire Simulation is the default active layer', async ({ page }) => {
    const fireBtn = page.getByRole('button', { name: /fire simulation/i });
    await expect(fireBtn).toHaveClass(/bg-orange-950/);
  });

  test('selecting Foliage Map deactivates Fire and activates Foliage', async ({ page }) => {
    const sim = new SimulationPage(page);
    const fireBtn = page.getByRole('button', { name: /fire simulation/i });
    const foliageBtn = page.getByRole('button', { name: /foliage map/i });

    await sim.selectLayer('Foliage Map');

    await expect(foliageBtn).toHaveClass(/bg-green-950/);
    await expect(fireBtn).not.toHaveClass(/bg-orange-950/);
  });

  test('selecting Elevation Map deactivates Fire and activates Elevation', async ({ page }) => {
    const sim = new SimulationPage(page);
    const fireBtn = page.getByRole('button', { name: /fire simulation/i });
    const elevBtn = page.getByRole('button', { name: /elevation map/i });

    await sim.selectLayer('Elevation Map');

    await expect(elevBtn).toHaveClass(/bg-blue-950/);
    await expect(fireBtn).not.toHaveClass(/bg-orange-950/);
  });
});
