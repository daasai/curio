import { expect, test } from '@playwright/test';

test('renders vocabulary and core-choice metrics from server records', async ({ page }) => {
  await page.route('**/api/learning/vocabulary', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ list: [{ word: 'cascade' }, { word: 'ambiguous' }] }),
    });
  });
  await page.route('**/api/report/learning', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ coreFirstAttempt: { numerator: 0, denominator: 1, ratePct: 0 } }),
    });
  });

  await page.goto('/curio');
  await page.getByPlaceholder('请输入手机号').fill('13800001006');
  await page.getByPlaceholder('请输入密码').fill('123456');
  await page.getByRole('button', { name: '登录' }).click();
  await page.reload();
  await expect(page.locator('#home')).toBeVisible();

  await expect(page.getByText('2 / 5 个')).toBeVisible();
  await expect(page.getByText('0%')).toBeVisible();
});
