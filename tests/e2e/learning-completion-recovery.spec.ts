import { expect, test } from '@playwright/test';

test('does not return home and reopen the same chapter when completion is rejected', async ({ page }) => {
  let completionRequestCount = 0;
  await page.route('**/api/learning/session/*/complete', async (route) => {
    completionRequestCount += 1;
    await route.fulfill({
      status: 422,
      contentType: 'application/json',
      body: JSON.stringify({ error: { code: 'PRECONDITION_FAILED' } }),
    });
  });

  await page.goto('/curio');
  await page.getByPlaceholder('请输入手机号').fill('13800001003');
  await page.getByPlaceholder('请输入密码').fill('123456');
  await page.getByRole('button', { name: '登录' }).click();
  await expect(page.getByText('每个单词')).toBeVisible();
  await page.reload();
  await expect(page.locator('#home')).toBeVisible();
  await page.locator('.main-story-card').click();
  await expect(page.locator('#reader')).toBeVisible();

  await page.locator('.choice-card').first().click();
  await page.getByRole('button', { name: /理解并回到主线，完成第 1 章/ }).click();

  await expect.poll(() => completionRequestCount).toBe(1);
  await expect(page.locator('#reader')).toBeVisible();
  await expect(page.locator('#home')).not.toBeVisible();
  await expect(page.locator('.branch-story-container')).toBeVisible();
});
