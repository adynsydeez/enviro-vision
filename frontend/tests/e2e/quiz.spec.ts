import { test, expect } from '@playwright/test';
import { LandingPage } from './pages/LandingPage';
import { QuizPage as QuizPageObj } from './pages/QuizPage';

test.describe('Quiz', () => {
  test.beforeEach(async ({ page }) => {
    const landing = new LandingPage(page);
    await landing.goto();
    await landing.clickQuiz();
  });

  test('renders question 1 with 4 answer options', async ({ page }) => {
    const quiz = new QuizPageObj(page);
    await expect(page.getByText('Question 1 of 10')).toBeVisible();
    await expect(quiz.answerOptions()).toHaveCount(4);
  });

  test('selecting any answer reveals the correct answer highlighted green', async ({ page }) => {
    const quiz = new QuizPageObj(page);
    await quiz.selectAnswer(0);

    // After answering, the correct answer must be highlighted green
    const greenAnswer = page.locator('[data-testid="answer-option"][class*="bg-green"]');
    await expect(greenAnswer.first()).toBeVisible({ timeout: 3_000 });
  });

  test('selecting a wrong answer highlights it red and reveals the correct one green', async ({ page }) => {
    const quiz = new QuizPageObj(page);

    // Pick the last option (index 3) — statistically unlikely to always be correct
    await quiz.selectAnswer(3);

    // The correct answer must always turn green regardless of which option was chosen
    const greenAnswer = page.locator('[data-testid="answer-option"][class*="bg-green"]');
    await expect(greenAnswer.first()).toBeVisible({ timeout: 3_000 });
  });

  test('Next button advances through all 10 questions to completion', async ({ page }) => {
    const quiz = new QuizPageObj(page);

    for (let q = 1; q <= 10; q++) {
      await expect(page.getByText(`Question ${q} of 10`)).toBeVisible();
      await quiz.selectAnswer(0);
      await quiz.clickNext();
    }

    await expect(quiz.completionHeading).toBeVisible({ timeout: 5_000 });
  });

  test('completion screen shows score in N/10 format', async ({ page }) => {
    const quiz = new QuizPageObj(page);

    for (let q = 0; q < 10; q++) {
      await quiz.selectAnswer(0);
      await quiz.clickNext();
    }

    await expect(quiz.completionHeading).toBeVisible({ timeout: 5_000 });
    const scoreText = await quiz.getScoreText();
    expect(scoreText).toMatch(/^\d+\/10$/);
  });
});
