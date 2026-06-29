import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test, expect, request, type APIRequestContext } from '@playwright/test';
import { ADMIN, login } from './helpers';

// API reached through the Vite dev proxy origin so the session cookie set by /auth/login
// round-trips to the same context the seeding requests use.
const API_ORIGIN = 'https://localhost:46258';

/** Seeds a fresh supplier via the API so the test is rerunnable without name collisions. */
async function seedSupplier(api: APIRequestContext): Promise<{ id: number; name: string }> {
  const loginResp = await api.post('/api/auth/login', {
    data: { email: ADMIN.email, password: ADMIN.password },
  });
  expect(loginResp.ok(), `login failed: ${loginResp.status()}`).toBeTruthy();

  const name = `E2E Bid Supplier ${Date.now()}`;
  const createResp = await api.post('/api/suppliers', {
    data: { supplierName: name, phone: '555-0199', email: 'e2e-bid-supplier@example.com', address: '1 Test Way' },
  });
  expect(createResp.ok(), `create supplier failed: ${createResp.status()}`).toBeTruthy();
  const supplier = (await createResp.json()) as { id: number };
  return { id: supplier.id, name };
}

test('compose a bid-based PO end to end: bid -> quotation -> seed items -> award -> submit', async ({
  page,
}) => {
  const api = await request.newContext({ baseURL: API_ORIGIN, ignoreHTTPSErrors: true });
  let supplier: { id: number; name: string };
  try {
    supplier = await seedSupplier(api);
  } finally {
    await api.dispose();
  }

  await login(page);

  // PO list -> New PO -> create a Head Office/USD draft.
  await page.getByRole('link', { name: 'Purchase Orders' }).click();
  await expect(page).toHaveURL(/\/purchase-orders$/);
  await page.getByRole('link', { name: 'New PO' }).click();
  await expect(page).toHaveURL(/\/purchase-orders\/new$/);

  await page.selectOption('#po-company', { label: 'Head Office' });
  await page.selectOption('#po-currency', 'USD');
  await page.getByRole('button', { name: 'Create draft' }).click();
  await expect(page).toHaveURL(/\/purchase-orders\/\d+\/edit$/);
  await expect(page.getByRole('heading', { name: /^PO-/ })).toBeVisible();

  // Add a supplier bid.
  await page.selectOption('#bid-supplier', { label: supplier.name });
  await page.getByRole('button', { name: 'Add bid' }).click();
  await expect(page.getByText('Bid added.')).toBeVisible();

  // The bid card opens its preview automatically after creation.
  await expect(page.getByRole('dialog', { name: 'Bid preview' })).toBeVisible();

  // Open the quotation capture form and assert the "Populate from file" stub.
  await page.getByRole('button', { name: 'Capture quotation' }).click();

  const tmpFile = path.join(os.tmpdir(), `e2e-quotation-${Date.now()}.txt`);
  fs.writeFileSync(tmpFile, 'Sample quotation document content for e2e test.');
  try {
    await page.setInputFiles('input[type="file"]', tmpFile);
    await expect(page.getByText(/e2e-quotation-.*\.txt/)).toBeVisible();

    // "Populate from file" is a stub once a file is uploaded — opens a coming-soon modal.
    await page.getByRole('button', { name: 'Populate from file' }).click();
    await expect(page.getByText('Feature coming soon')).toBeVisible();
    await page.getByRole('alertdialog').getByRole('button', { name: 'OK' }).click();

    // Quote date defaults to today; set a line item: qty 4, unit 25 -> line total 100.
    await page.fill('#quotation-line-description-0', 'E2E quoted widget');
    await page.fill('#quotation-line-quantity-0', '4');
    await page.fill('#quotation-line-unit-cost-0', '25');

    await page.getByRole('button', { name: 'Save quotation' }).click();
    await expect(page.getByText('Quotation saved.')).toBeVisible();

    // Seed bid items from the just-saved quotation.
    await page.getByRole('button', { name: 'Seed bid items from this quotation' }).click();
    await expect(page.getByText('Bid items seeded from the quotation.')).toBeVisible();

    // A bid item with line total 100 (qty 4 x unit 25) should now appear.
    await expect(page.getByTestId('bid-item-line-total').filter({ hasText: '100' }).first()).toBeVisible();

    // Select this bid as the winner.
    await page.getByRole('button', { name: 'Select as winner' }).click();
    await expect(page.getByText('Bid selected as winner.')).toBeVisible();

    // Close the preview; the card row shows the Awarded marker.
    await page.getByRole('button', { name: 'Close' }).click();
    await expect(page.locator('.bid-card-awarded').getByText('Awarded')).toBeVisible();
  } finally {
    fs.rmSync(tmpFile, { force: true });
  }

  // Define one approval targeting the admin user, sequence 0.
  await page.selectOption('#approval-target-kind', 'user');
  await page.selectOption('#approval-user', { label: 'Super Admin' });
  await page.fill('#approval-sequence', '0');
  await page.getByRole('button', { name: 'Add approval' }).click();
  await expect(page.getByText('Approval added.')).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Super Admin' })).toBeVisible();

  // Submit: Draft -> Open.
  await page.getByRole('button', { name: 'Submit', exact: true }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Submit' }).click();

  await expect(page).toHaveURL(/\/purchase-orders\/\d+$/);
  await expect(page.locator('.po-detail-header').getByText('Open')).toBeVisible();
});
