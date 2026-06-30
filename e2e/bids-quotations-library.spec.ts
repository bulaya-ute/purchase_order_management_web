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
  const name = `E2E Library Supplier ${Date.now()}`;
  const createResp = await api.post('/api/suppliers', {
    data: {
      supplierName: name,
      phone: '555-0188',
      email: 'e2e-library-supplier@example.com',
      address: '1 Library Way',
    },
  });
  expect(createResp.ok(), `create supplier failed: ${createResp.status()}`).toBeTruthy();
  const supplier = (await createResp.json()) as { id: number };
  return { id: supplier.id, name };
}

/**
 * USD is seeded but inactive (ZMW is the only active currency by default), so it never appears
 * in the app's currency pickers. Activating it here (rerunnable — PUT is idempotent) gives this
 * test a second active currency to prove the multi-currency total vector renders correctly.
 */
async function ensureUsdActive(api: APIRequestContext): Promise<void> {
  const resp = await api.put('/api/currencies/USD', {
    data: { name: 'US Dollar', isActive: true },
  });
  expect(resp.ok(), `activate USD failed: ${resp.status()}`).toBeTruthy();
}

test('standalone quotation + standalone bid + attach to a Draft PO, with a multi-currency total', async ({
  page,
}) => {
  const api = await request.newContext({ baseURL: API_ORIGIN, ignoreHTTPSErrors: true });
  let supplier: { id: number; name: string };
  try {
    const loginResp = await api.post('/api/auth/login', {
      data: { email: ADMIN.email, password: ADMIN.password },
    });
    expect(loginResp.ok(), `login failed: ${loginResp.status()}`).toBeTruthy();

    supplier = await seedSupplier(api);
    await ensureUsdActive(api);
  } finally {
    await api.dispose();
  }

  await login(page);

  // ----- Create a standalone quotation via the Quotations library screen. -----
  await page.getByRole('link', { name: 'Quotations' }).click();
  await expect(page).toHaveURL(/\/quotations$/);
  await page.getByRole('button', { name: 'New Quotation' }).click();

  await page.selectOption('#quotation-supplier', { label: supplier.name });

  const tmpFile = path.join(os.tmpdir(), `e2e-library-quotation-${Date.now()}.txt`);
  const tmpFileName = path.basename(tmpFile);
  fs.writeFileSync(tmpFile, 'Sample quotation document content for the library e2e test.');
  const quotationDialog = page.getByRole('dialog', { name: 'New Quotation' });
  try {
    await page.setInputFiles('input[type="file"]', tmpFile);
    await expect(quotationDialog.getByText(tmpFileName)).toBeVisible();

    await page.fill('#quotation-line-description-0', 'E2E library quoted widget');
    await page.fill('#quotation-line-quantity-0', '2');
    await page.fill('#quotation-line-unit-cost-0', '15');

    await page.getByRole('button', { name: 'Save quotation' }).click();
    await expect(page.getByText('Quotation created.')).toBeVisible();
    await expect(page.getByRole('cell', { name: supplier.name }).first()).toBeVisible();
  } finally {
    fs.rmSync(tmpFile, { force: true });
  }

  // ----- Create a standalone bid via the Supplier Bids library screen. -----
  await page.getByRole('link', { name: 'Supplier Bids' }).click();
  await expect(page).toHaveURL(/\/supplier-bids$/);
  await page.getByRole('button', { name: '+ New Bid' }).click();
  await page.selectOption('#new-bid-supplier', { label: supplier.name });
  await page.getByRole('button', { name: 'Create bid' }).click();
  await expect(page.getByText('Bid created.')).toBeVisible();

  // Newly created bid auto-selects and the detail panel shows it as Unattached.
  const detailPanel = page.locator('.admin-panel', { has: page.getByRole('heading', { name: supplier.name }) });
  await expect(detailPanel.getByText('Unattached')).toBeVisible();

  // ----- Create a Draft PO and attach the standalone bid to it. -----
  await page.getByRole('link', { name: 'Purchase Orders' }).click();
  await expect(page).toHaveURL(/\/purchase-orders$/);
  await page.getByRole('link', { name: 'New PO' }).click();
  await expect(page).toHaveURL(/\/purchase-orders\/new$/);

  await page.selectOption('#po-company', { label: 'Head Office' });
  await page.selectOption('#po-currency', 'ZMW');
  await page.getByRole('button', { name: 'Create draft' }).click();
  await expect(page).toHaveURL(/\/purchase-orders\/\d+\/edit$/);

  await page.selectOption('#attach-bid-supplier', { label: supplier.name });
  // The option label is "<supplier name> — <money vector>" so match by prefix via the DOM
  // rather than selectOption's exact-label matching.
  const attachOptionValue = await page
    .locator('#attach-bid-id option', { hasText: supplier.name })
    .first()
    .getAttribute('value');
  await page.selectOption('#attach-bid-id', attachOptionValue ?? '');
  await page.getByRole('button', { name: 'Attach bid' }).click();
  await expect(page.getByText('Bid attached.')).toBeVisible();
  await expect(page.locator('.bid-card-name', { hasText: supplier.name })).toBeVisible();

  // ----- Open the attached bid and add two items in different currencies. -----
  await page.locator('.bid-card', { hasText: supplier.name }).click();
  await expect(page.getByRole('dialog', { name: 'Bid preview' })).toBeVisible();

  await page.fill('#bid-item-description', 'USD item');
  await page.fill('#bid-item-quantity', '1');
  await page.fill('#bid-item-unit-cost', '40');
  await page.selectOption('#bid-item-currency', 'USD');
  await page.getByRole('button', { name: 'Add item' }).click();
  await expect(page.getByText('Bid item added.')).toBeVisible();

  await page.fill('#bid-item-description', 'ZMW item');
  await page.fill('#bid-item-quantity', '1');
  await page.fill('#bid-item-unit-cost', '60');
  await page.selectOption('#bid-item-currency', 'ZMW');
  await page.getByRole('button', { name: 'Add item' }).click();
  await expect(page.getByText('Bid item added.')).toBeVisible();

  // The bid total in the preview header is a multi-currency vector joined by " + ". USD renders
  // via its currency symbol ($) per formatMoney's Intl.NumberFormat, ZMW renders with its code.
  const bidTotalLocator = page.locator('.po-meta-item', { hasText: 'Bid total' });
  await expect(bidTotalLocator).toContainText('$40.00');
  await expect(bidTotalLocator).toContainText('ZMW');
  await expect(bidTotalLocator).toContainText('+');

  await page.getByRole('button', { name: 'Close' }).click();

  // The bid card on the composer's grid also renders the same multi-currency vector.
  const bidCardTotal = page.locator('.bid-card-total', { hasText: '+' });
  await expect(bidCardTotal).toBeVisible();
});
