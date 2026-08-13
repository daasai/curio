import { expect, test } from '@playwright/test';

test('renders the current chapter summary and vocabulary instead of demo copy', async ({ page }) => {
  await page.goto('/curio');
  await page.getByPlaceholder('请输入手机号').fill('13800001007');
  await page.getByPlaceholder('请输入密码').fill('123456');
  await page.getByRole('button', { name: '登录' }).click();
  await page.reload();

  await expect(page.locator('#home')).toBeVisible();
  await expect(page.getByText('E2E fixture')).toBeVisible();
  await expect(page.getByText('cascade').last()).toBeVisible();
  await expect(page.getByText('Elena Voss')).not.toBeVisible();
});
