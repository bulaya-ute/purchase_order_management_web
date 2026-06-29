import { test, expect } from '@playwright/test';
import { login } from './helpers';

test('compose a direct-entry PO end to end: draft -> lines -> approval -> submit', async ({
  page,
}) => {
  await login(page);

  // PO list -> New PO.
  await page.getByRole('link', { name: 'Purchase Orders' }).click();
  await expect(page).toHaveURL(/\/purchase-orders$/);
  await page.getByRole('link', { name: 'New PO' }).click();
  await expect(page).toHaveURL(/\/purchase-orders\/new$/);

  // Header: company "Head Office", currency USD, then create the draft.
  await page.selectOption('#po-company', { label: 'Head Office' });
  await page.selectOption('#po-currency', 'USD');
  await page.getByRole('button', { name: 'Create draft' }).click();

  // Redirected to /purchase-orders/:id/edit once the draft exists.
  await expect(page).toHaveURL(/\/purchase-orders\/\d+\/edit$/);
  await expect(page.getByRole('heading', { name: /^PO-/ })).toBeVisible();

  // Add a direct-entry line item: qty 3, unit cost 20 -> line/PO total 60.
  await page.fill('#line-description', 'E2E composed widget');
  await page.fill('#line-quantity', '3');
  await page.fill('#line-unit-cost', '20');
  await page.getByRole('button', { name: 'Add line item' }).click();
  await expect(page.getByText('Line item added.')).toBeVisible();
  await expect(page.getByRole('cell', { name: 'E2E composed widget' })).toBeVisible();
  await expect(page.getByTestId('po-total')).toContainText('60');

  // Define one approval targeting the current (admin) user, sequence 0.
  await page.selectOption('#approval-target-kind', 'user');
  await page.selectOption('#approval-user', { label: 'Super Admin' });
  await page.fill('#approval-sequence', '0');
  await page.getByRole('button', { name: 'Add approval' }).click();
  await expect(page.getByText('Approval added.')).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Super Admin' })).toBeVisible();

  // Submit: Draft -> Open, then redirected to the PO detail screen.
  await page.getByRole('button', { name: 'Submit', exact: true }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Submit' }).click();

  // Submission immediately navigates to the PO detail screen (Draft -> Open).
  await expect(page).toHaveURL(/\/purchase-orders\/\d+$/);
  await expect(page.locator('.po-detail-header').getByText('Open')).toBeVisible();
  await expect(page.getByTestId('po-total')).toContainText('60');
});
