import { expect, test } from '@playwright/test';

test('persists the baseline profile and restores it after a page reload', async ({ page }, testInfo) => {
  const phone = testInfo.project.name === 'chromium-mobile' ? '13800001008' : '13800001005';
  await page.goto('/curio');
  await page.getByPlaceholder('请输入手机号').fill(phone);
  await page.getByPlaceholder('请输入密码').fill('123456');
  await page.getByRole('button', { name: '登录' }).click();
  await expect(page.locator('#landing')).toBeVisible();

  await page.getByRole('button', { name: '先读一段故事 →' }).click();
  await page.locator('#demo-choice-box .choice-card').first().click();
  await page.getByRole('button', { name: '建立我的词汇起点 →' }).click();

  const diagnosisChoices = page.locator('#onboarding-content .choice-card');
  for (const answerIndex of [1, 6, 9, 12]) await diagnosisChoices.nth(answerIndex).click();
  await page.getByRole('button', { name: '提交诊断并分析 →' }).click();
  await page.getByRole('button', { name: '确认我的起点 →' }).click();
  await page.getByText('🔍 悬疑推理').click();

  const onboardingResponse = page.waitForResponse((response) =>
    response.url().endsWith('/api/learning/onboarding') && response.request().method() === 'POST',
  );
  await page.getByRole('button', { name: '开始生成故事 →' }).click();
  expect((await onboardingResponse).status()).toBe(200);
  await expect(page.locator('#home')).toBeVisible({ timeout: 10_000 });

  await page.reload();
  await expect(page.locator('#home')).toBeVisible();
  await expect(page.getByText('高考水平：优秀 (A)')).toBeVisible();
});

test('restores the server profile when onboarding was already saved', async ({ page }, testInfo) => {
  const phone = testInfo.project.name === 'chromium-mobile' ? '13800001008' : '13800001005';
  await page.goto('/curio');
  await page.getByPlaceholder('请输入手机号').fill(phone);
  await page.getByPlaceholder('请输入密码').fill('123456');
  await page.getByRole('button', { name: '登录' }).click();
  await page.getByRole('button', { name: '先读一段故事 →' }).click();
  await page.locator('#demo-choice-box .choice-card').first().click();
  await page.getByRole('button', { name: '建立我的词汇起点 →' }).click();

  const diagnosisChoices = page.locator('#onboarding-content .choice-card');
  for (const answerIndex of [1, 6, 9, 12]) await diagnosisChoices.nth(answerIndex).click();
  await page.getByRole('button', { name: '提交诊断并分析 →' }).click();
  await page.getByRole('button', { name: '确认我的起点 →' }).click();
  await page.getByText('🔍 悬疑推理').click();

  await page.route('**/api/learning/onboarding', async (route) => {
    await route.fulfill({
      status: 409,
      contentType: 'application/json',
      body: JSON.stringify({ error: { code: 'BASELINE_ALREADY_SET', retryable: false } }),
    });
  });
  await page.getByRole('button', { name: '开始生成故事 →' }).click();
  await expect(page.locator('#home')).toBeVisible({ timeout: 10_000 });
});

test('offers a retry when onboarding cannot be saved', async ({ page }, testInfo) => {
  const phone = testInfo.project.name === 'chromium-mobile' ? '13800001008' : '13800001005';
  await page.goto('/curio');
  await page.getByPlaceholder('请输入手机号').fill(phone);
  await page.getByPlaceholder('请输入密码').fill('123456');
  await page.getByRole('button', { name: '登录' }).click();
  await page.getByRole('button', { name: '先读一段故事 →' }).click();
  await page.locator('#demo-choice-box .choice-card').first().click();
  await page.getByRole('button', { name: '建立我的词汇起点 →' }).click();

  const diagnosisChoices = page.locator('#onboarding-content .choice-card');
  for (const answerIndex of [1, 6, 9, 12]) await diagnosisChoices.nth(answerIndex).click();
  await page.getByRole('button', { name: '提交诊断并分析 →' }).click();
  await page.getByRole('button', { name: '确认我的起点 →' }).click();
  await page.getByText('🔍 悬疑推理').click();

  await page.route('**/api/learning/onboarding', async (route) => {
    await route.abort('failed');
  });
  await page.getByRole('button', { name: '开始生成故事 →' }).click();
  const retry = page.getByRole('button', { name: '重试保存并进入首页' });
  await expect(retry).toBeVisible({ timeout: 10_000 });

  await page.unroute('**/api/learning/onboarding');
  await retry.click();
  await expect(page.locator('#home')).toBeVisible({ timeout: 10_000 });
});
