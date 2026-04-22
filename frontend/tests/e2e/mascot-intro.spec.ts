import { test, expect } from '@playwright/test';
import { LandingPage } from './pages/LandingPage';
import { SimulationPage } from './pages/SimulationPage';

test.describe('Mascot intro overlay', () => {
  test.beforeEach(async ({ page }) => {
    const landing = new LandingPage(page);
    await landing.goto();
    await landing.launchScenario("D'Aguilar National Park");
  });

  test('vignette overlay is visible during intro', async ({ page }) => {
    const overlay = page.getByRole('button', { name: /next intro message/i });
    await expect(overlay).toBeVisible({ timeout: 5_000 });
    await expect(overlay).toHaveClass(/mascot-intro-vignette/);
  });

  test('progress dots are visible and active dot advances on click', async ({ page }) => {
    const dots = page.getByTestId('mascot-progress-dots');
    await expect(dots).toBeVisible({ timeout: 5_000 });

    // Exactly one active dot initially
    await expect(dots.locator('[aria-current="true"]')).toHaveCount(1);

    // Click to advance
    await page.getByRole('button', { name: /next intro message/i }).click();

    // Still exactly one active dot after advance
    await expect(dots).toBeVisible();
    await expect(dots.locator('[aria-current="true"]')).toHaveCount(1);
  });

  test('overlay and dots are removed after intro is dismissed', async ({ page }) => {
    const sim = new SimulationPage(page);
    await sim.dismissIntro();

    await expect(
      page.getByRole('button', { name: /next intro message/i })
    ).not.toBeVisible({ timeout: 500 });

    await expect(
      page.getByTestId('mascot-progress-dots')
    ).not.toBeVisible({ timeout: 500 });
  });
});
