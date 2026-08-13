import { expect, test } from '@playwright/test';

test('resets choice state when moving to the next chapter', async ({ page }, testInfo) => {
  const phone = testInfo.project.name === 'chromium-mobile' ? '13800001009' : '13800001004';
  await page.goto('/curio');
  await page.getByPlaceholder('请输入手机号').fill(phone);
  await page.getByPlaceholder('请输入密码').fill('123456');
  await page.getByRole('button', { name: '登录' }).click();
  await expect(page.getByText('每个单词')).toBeVisible();
  await page.reload();
  await expect(page.locator('#home')).toBeVisible();

  for (const chapterNumber of [1, 2]) {
    await page.locator('.main-story-card').click();
    await expect(page.locator('#reader')).toBeVisible();
    await expect(page.locator('.chapter-title')).toContainText(`${chapterNumber === 1 ? '测试章节' : '第二测试章节'}`);
    await expect(page.locator('#choice-focus-question')).toContainText(chapterNumber === 1 ? 'cascade' : 'ambiguous');
    await expect(page.locator('.choice-card').first()).toBeEnabled();
    await expect(page.locator('#reader-feedback')).not.toBeVisible();

    await page.locator('.choice-card').first().click();
    await expect(page.locator('#reader-feedback')).toBeVisible();
    await page.getByRole('button', { name: /理解并回到主线，完成第/ }).click();
    await expect(page.locator('#home')).toBeVisible();
  }

  await page.locator('.main-story-card').click();
  await expect(page.locator('#reader')).toBeVisible();
  await expect(page.locator('.chapter-title')).toContainText('第三测试章节');
  await expect(page.locator('.choice-card').first()).toBeEnabled();
  await expect(page.locator('#reader-feedback')).not.toBeVisible();
});
