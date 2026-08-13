import { expect, test } from '@playwright/test';

test('returns to the home screen after a wrong choice without crypto.randomUUID', async ({ page }, testInfo) => {
  const phone = testInfo.project.name === 'chromium-mobile' ? '13800001010' : '13800001002';
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.addInitScript(() => {
    try {
      Object.defineProperty(Object.getPrototypeOf(globalThis.crypto), 'randomUUID', {
        configurable: true,
        value: undefined,
      });
    } catch {
      // Older Safari-style implementations may expose a non-configurable property.
    }
  });

  await page.goto('/curio');
  await page.getByPlaceholder('请输入手机号').fill(phone);
  await page.getByPlaceholder('请输入密码').fill('123456');
  await page.getByRole('button', { name: '登录' }).click();
  await expect(page.getByText('每个单词')).toBeVisible();
  await page.reload();
  await expect(page.locator('#home')).toBeVisible();
  await page.locator('.main-story-card').click();
  await expect(page.locator('#reader')).toBeVisible();

  await page.locator('.choice-card').first().click();
  await expect(page.locator('#reader-feedback')).toBeVisible();
  await page.getByRole('button', { name: /理解并回到主线，完成第 1 章/ }).click();
  await expect(page.locator('#home')).toBeVisible({ timeout: 10_000 });
  expect(pageErrors.filter((message) => message.includes('randomUUID'))).toEqual([]);
});
