import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test('public invite-only experience is accessible', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText(/territory work/i);
  await expect(page.getByRole('link', { name: /sign in/i })).toBeVisible();
  await expect(page.getByRole('link', { name: /sign up|create account/i })).toHaveCount(0);
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});

test('login and recovery expose keyboard-friendly controls', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByLabel('Email address')).toBeVisible();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Skip to main content' })).toBeFocused();
  await expect(page.getByRole('textbox', { name: 'Password' })).toBeVisible();
  await page.getByRole('link', { name: 'Forgot password?' }).click();
  await expect(page.getByRole('heading', { name: /recover|reset password/i })).toBeVisible();
});

test('public registration is closed and invalid checkout tokens fail safely', async ({ page }) => {
  await page.goto('/register');
  await expect(page.getByText(/invite-only/i)).toBeVisible();
  await page.goto('/checkout?token=invalid');
  await expect(page.getByText(/link unavailable|secure territory checkout/i)).toBeVisible();
});

test('offline fallback states the limited basemap contract', async ({ page }) => {
  await page.goto('/offline');
  await expect(page.getByRole('heading', { name: /offline/i })).toBeVisible();
  await expect(page.getByText(/viewed earlier|downloaded assignment/i).first()).toBeVisible();
});
