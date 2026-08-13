import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }, testInfo) => {
  const phone = testInfo.project.name === 'chromium-mobile' ? '13800001011' : '13800001002';
  await page.goto('/curio');
  await page.getByPlaceholder('请输入手机号').fill(phone);
  await page.getByPlaceholder('请输入密码').fill('123456');
  await page.getByRole('button', { name: '登录' }).click();
  await expect(page.getByText('每个单词')).toBeVisible();
  // 登录完成后 cookie 已写入；刷新验证真正的服务端恢复路径。
  await page.reload();
  await expect(page.locator('#home')).toBeVisible();
  await page.locator('.main-story-card').click();
  await expect(page.locator('#reader')).toBeVisible();
  await expect(page.locator('.chapter-illustration img')).toHaveAttribute('src', '/assets/canglan-mist-chapter-1-comic-v1.png');
  await expect(page.locator('[data-word="cascade"]')).toBeVisible();
});

test('every opened word renders the real vocabulary record instead of a fallback placeholder', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await page.locator('[data-word="cascade"]').click();
  await expect(page.locator('.word-tooltip')).toContainText('层叠落下；级联');
  await expect(page.locator('.word-tooltip')).not.toContainText('高考重点必考词汇');
  expect(pageErrors).toEqual([]);
});

test('shows an explicit empty state when the server has no verified word-family relation', async ({ page }) => {
  await page.locator('[data-word="ambiguous"]').click();
  await expect(page.locator('.word-tooltip')).toContainText('暂无可验证的高中范围词族');
});

test('looked-up words remain present in the vocabulary book after a reload', async ({ page }) => {
  await page.locator('[data-word="cascade"]').click();
  await page.getByRole('button', { name: '词汇本' }).last().click();
  await expect(page.locator('#vocab-list')).toContainText('cascade');
  await page.reload();
  await page.getByRole('button', { name: '词汇本' }).first().click();
  await expect(page.locator('#vocab-list')).toContainText('cascade');
});

test('mobile layout has no horizontal overflow in the reader', async ({ page }) => {
  const dimensions = await page.evaluate(() => ({
    documentWidth: document.documentElement.scrollWidth,
    viewportWidth: document.documentElement.clientWidth,
  }));
  expect(dimensions.documentWidth).toBeLessThanOrEqual(dimensions.viewportWidth);
});
