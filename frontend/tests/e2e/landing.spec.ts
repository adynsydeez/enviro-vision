import { test, expect } from '@playwright/test';
import { LandingPage } from './pages/LandingPage';

const SCENARIO_NAMES = [
  "D'Aguilar National Park",
  'Lamington National Park',
  'Glass House Mountains',
  'Bunya Mountains',
  'Girraween National Park',
  'Eungella National Park',
];

test.describe('Landing page', () => {
  test('renders all 6 scenario cards with name, risk badge, and Launch text', async ({ page }) => {
    const landing = new LandingPage(page);
    await landing.goto();

    for (const name of SCENARIO_NAMES) {
      await expect(page.getByText(name)).toBeVisible();
    }
    await expect(page.getByText('Launch')).toHaveCount(6);
    // At least one risk badge is visible
    await expect(page.getByText('High').first()).toBeVisible();
  });

  test('Map toggle switches to Leaflet overview with fire pins', async ({ page }) => {
    const landing = new LandingPage(page);
    await landing.goto();
    await landing.toggleMapView();

    // Leaflet renders the overview map
    await expect(page.locator('.leaflet-container')).toBeVisible();
    // All 6 pins are present (each scenario has a marker)
    await expect(page.locator('.leaflet-marker-icon')).toHaveCount(6);
  });

  test('clicking a map pin popup Launch button enters simulation', async ({ page }) => {
    const landing = new LandingPage(page);
    await landing.goto();
    await landing.toggleMapView();

    // Hover the first fire pin marker to open the popup
    await page.locator('.leaflet-marker-icon').first().hover();

    // Popup appears with a Launch button — click it
    const launchInPopup = page.getByRole('button', { name: /launch/i });
    await expect(launchInPopup).toBeVisible({ timeout: 5_000 });
    await launchInPopup.click();

    // Should arrive in the simulation map
    await expect(page.getByRole('button', { name: /scenarios/i })).toBeVisible({ timeout: 15_000 });
  });

  test('Take the Quiz button navigates to the quiz page', async ({ page }) => {
    const landing = new LandingPage(page);
    await landing.goto();
    await landing.clickQuiz();

    await expect(page.getByText('Question 1 of 10')).toBeVisible();
  });
});
