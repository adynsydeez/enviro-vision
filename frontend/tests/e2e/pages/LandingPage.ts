import { expect, type Page, type Locator } from '@playwright/test';

export class LandingPage {
  readonly page: Page;
  readonly quizBtn: Locator;
  readonly mapToggleBtn: Locator;
  readonly gridToggleBtn: Locator;

  constructor(page: Page) {
    this.page = page;
    this.quizBtn = page.getByRole('button', { name: /take the quiz/i });
    this.mapToggleBtn = page.getByRole('button', { name: /^map$/i });
    this.gridToggleBtn = page.getByRole('button', { name: /^grid$/i });
  }

  async goto() {
    await this.page.goto('/');
    await expect(this.page.getByText("D'Aguilar National Park")).toBeVisible();
  }

  async launchScenario(scenarioName: string) {
    await this.page.getByRole('button', { name: scenarioName }).click();
    await expect(
      this.page.getByRole('button', { name: /scenarios/i })
    ).toBeVisible({ timeout: 15_000 });
  }

  async toggleMapView() {
    await this.mapToggleBtn.click();
    await expect(this.page.locator('.leaflet-container')).toBeVisible();
  }

  async clickQuiz() {
    await this.quizBtn.click();
    await expect(
      this.page.getByText('Question 1 of 10')
    ).toBeVisible({ timeout: 5_000 });
  }
}
