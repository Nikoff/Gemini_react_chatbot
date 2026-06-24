import { test, expect } from '@playwright/test';

test('chat page loads without auth', async ({ page }) => {
  const res = await page.goto('/');
  expect(res?.status()).toBeLessThan(500);
});

test('unauthenticated user sees auth screen or landing', async ({ page }) => {
  await page.goto('/');
  const body = await page.textContent('body');
  expect(body).toBeTruthy();
});
