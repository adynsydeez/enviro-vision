import { expect, type Page, type Locator } from '@playwright/test';

export class SimulationPage {
  readonly page: Page;
  readonly introNextBtn: Locator;
  readonly scenariosBtn: Locator;
  readonly pauseBtn: Locator;
  readonly statTick: Locator;
  readonly statBurning: Locator;
  readonly statScore: Locator;
  readonly simStatus: Locator;
  readonly windSpeedDisplay: Locator;

  constructor(page: Page) {
    this.page = page;
    this.introNextBtn = page.getByRole('button', { name: /next intro message/i });
    this.scenariosBtn = page.getByRole('button', { name: /scenarios/i });
    this.pauseBtn = page.getByTestId('pause-btn');
    this.statTick = page.getByTestId('stat-tick');
    this.statBurning = page.getByTestId('stat-burning');
    this.statScore = page.getByTestId('stat-score');
    this.simStatus = page.getByTestId('sim-status');
    this.windSpeedDisplay = page.getByTestId('wind-speed-display');
  }

  async dismissIntro() {
    for (let i = 0; i < 5; i++) {
      if (!(await this.introNextBtn.isVisible())) break;
      await this.introNextBtn.click();
    }
    await expect(this.introNextBtn).not.toBeVisible({ timeout: 3_000 });
  }

  async waitForTick(minTick = 1) {
    await expect(async () => {
      const text = await this.statTick.textContent();
      expect(Number(text)).toBeGreaterThanOrEqual(minTick);
    }).toPass({ timeout: 45_000 });
  }

  async getStatValue(testid: string): Promise<number> {
    const text = await this.page.getByTestId(testid).textContent();
    return Number(text?.trim() ?? '0');
  }

  async togglePause() {
    await this.pauseBtn.click();
  }

  async selectLayer(name: string) {
    await this.page.getByRole('button', { name: new RegExp(name, 'i') }).click();
  }

  async clickWaterTool() {
    await this.page.locator('button[title="Water"]').click();
  }

  async clickControlTool() {
    await this.page.locator('button[title="Control"]').click();
  }

  /** Click at an offset from the map centre. Default (0,0) = dead centre. */
  async clickMap(offsetX = 0, offsetY = 0) {
    const box = await this.page.locator('.leaflet-container').boundingBox();
    if (!box) throw new Error('Leaflet map not found');
    await this.page.mouse.click(
      box.x + box.width / 2 + offsetX,
      box.y + box.height / 2 + offsetY,
    );
  }

  async goBack() {
    await this.scenariosBtn.click();
    await expect(this.page.getByText("D'Aguilar National Park")).toBeVisible();
  }
}
