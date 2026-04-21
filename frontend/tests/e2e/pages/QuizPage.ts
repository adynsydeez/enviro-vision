import { expect, type Page, type Locator } from '@playwright/test';

export class QuizPage {
  readonly page: Page;
  readonly nextBtn: Locator;
  readonly scoreDisplay: Locator;
  readonly completionHeading: Locator;

  constructor(page: Page) {
    this.page = page;
    this.nextBtn = page.getByTestId('quiz-next-btn');
    this.scoreDisplay = page.getByTestId('quiz-score');
    this.completionHeading = page.getByRole('heading', { name: /quiz complete/i });
  }

  answerOptions() {
    return this.page.getByTestId('answer-option');
  }

  async selectAnswer(index: number) {
    await this.answerOptions().nth(index).click();
  }

  async clickNext() {
    await expect(this.nextBtn).toBeVisible({ timeout: 5_000 });
    await this.nextBtn.click();
  }

  async getScoreText(): Promise<string> {
    return (await this.scoreDisplay.textContent()) ?? '';
  }
}
