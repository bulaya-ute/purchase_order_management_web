import { expect, type Page } from '@playwright/test';

/** Seeded Super Admin (docs / DataSeeder dev fallback). */
export const ADMIN = { email: 'admin@local', password: 'ChangeMe!123' };

/** Logs in through the real login screen and waits for the authenticated shell. */
export async function login(page: Page, who = ADMIN): Promise<void> {
  await page.goto('/login');
  await page.fill('#login-email', who.email);
  await page.fill('#login-password', who.password);
  await page.click('button[type=submit]');
  // The shell renders the primary nav once authenticated.
  await expect(page.getByRole('link', { name: 'Dashboard' })).toBeVisible();
}
