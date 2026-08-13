import { expect, test } from '@playwright/test';

test('shows a recoverable error when the first chapter cannot be started', async ({ page }) => {
  await page.route('**/api/learning/snapshot', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        user: { diagnosticLevel: 'basic', preferences: { genres: ['mystery'], intensity: 'medium' } },
        progress: { storylineId: 'canglan_mist', nextChapterIndex: 1, completedChapterCount: 0, activeSessionId: null, streakDays: 0, revision: 0 },
        chapter: null,
      }),
    });
  });
  await page.route('**/api/learning/session/start', async (route) => {
    await route.fulfill({
      status: 404,
      contentType: 'application/json',
      body: JSON.stringify({ error: { code: 'CHAPTER_NOT_FOUND' } }),
    });
  });

  await page.goto('/curio');
  await page.getByPlaceholder('请输入手机号').fill('13800001002');
  await page.getByPlaceholder('请输入密码').fill('123456');
  await page.getByRole('button', { name: '登录' }).click();
  await expect(page.getByText('每个单词')).toBeVisible();
  await page.reload();
  await expect(page.locator('#home')).toBeVisible();
  await page.locator('.main-story-card').click();

  await expect(page.getByText('Unable to load this chapter')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Retry' })).toBeVisible();
  await expect(page.getByText('Loading chapter data...')).not.toBeVisible();
});
