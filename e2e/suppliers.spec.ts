import { test, expect } from '@playwright/test';
import { login } from './helpers';

test('admin can create, edit, and delete a supplier', async ({ page }) => {
  await login(page);

  await page.getByRole('link', { name: 'Suppliers' }).click();
  await expect(page).toHaveURL(/\/suppliers/);

  const uniqueName = `E2E Supplier ${Date.now()}`;
  const updatedName = `${uniqueName} (Updated)`;

  // Create.
  await page.getByRole('button', { name: 'New supplier' }).click();
  await page.fill('#supplier-name', uniqueName);
  await page.fill('#supplier-phone', '555-0100');
  await page.fill('#supplier-email', 'e2e-supplier@example.com');
  await page.fill('#supplier-address', '123 Test Street');
  await page.getByRole('button', { name: 'Save' }).click();

  await expect(page.getByText('Supplier created.')).toBeVisible();
  await expect(page.getByRole('cell', { name: uniqueName, exact: true })).toBeVisible();

  // Edit.
  const row = page.locator('tr', { has: page.getByRole('cell', { name: uniqueName, exact: true }) });
  await row.getByRole('button', { name: 'Edit' }).click();
  await page.fill('#supplier-name', updatedName);
  await page.getByRole('button', { name: 'Save' }).click();

  await expect(page.getByText('Supplier updated.')).toBeVisible();
  await expect(page.getByRole('cell', { name: updatedName, exact: true })).toBeVisible();

  // Delete.
  const updatedRow = page.locator('tr', { has: page.getByRole('cell', { name: updatedName, exact: true }) });
  await updatedRow.getByRole('button', { name: 'Delete' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click();

  await expect(page.getByText('Supplier deleted.')).toBeVisible();
  await expect(page.getByRole('cell', { name: updatedName, exact: true })).not.toBeVisible();
});
