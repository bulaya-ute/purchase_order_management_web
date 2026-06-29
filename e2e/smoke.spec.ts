import { test, expect } from '@playwright/test';
import { login, ADMIN } from './helpers';

test('unauthenticated access is redirected to login', async ({ page }) => {
  await page.goto('/admin/companies');
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();
});

test('bad credentials are rejected', async ({ page }) => {
  await page.goto('/login');
  await page.fill('#login-email', ADMIN.email);
  await page.fill('#login-password', 'wrong-password');
  await page.click('button[type=submit]');
  await expect(page.getByText('Invalid email or password.')).toBeVisible();
});

test('admin logs in and the Companies screen loads data from the API', async ({ page }) => {
  await login(page);
  await page.getByRole('link', { name: 'Companies' }).click();
  await expect(page).toHaveURL(/\/admin\/companies/);
  // "Head Office" is the seeded root company — proves UI -> API -> DB -> render.
  await expect(page.getByText('Head Office').first()).toBeVisible();
});
