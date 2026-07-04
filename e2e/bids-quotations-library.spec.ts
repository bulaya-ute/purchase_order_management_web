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

  // ----- Create two standalone quotations (one per currency) via the Quotations library screen. -----
  await page.getByRole('link', { name: 'Quotations' }).click();
  await expect(page).toHaveURL(/\/quotations$/);

  for (const [reference, currency, description, unitCost] of [
    ['ZMW Library Quote', 'ZMW', 'E2E library ZMW widget', '60'],
    ['USD Library Quote', 'USD', 'E2E library USD widget', '40'],
  ] as const) {
    await page.getByRole('button', { name: 'New Quotation' }).click();
    await page.selectOption('#quotation-supplier', { label: supplier.name });
    await page.fill('#quotation-reference', reference);
    await page.selectOption('#quotation-currency', currency);

    const tmpFile = path.join(os.tmpdir(), `e2e-library-quotation-${Date.now()}-${currency}.txt`);
    const tmpFileName = path.basename(tmpFile);
    fs.writeFileSync(tmpFile, 'Sample quotation document content for the library e2e test.');
    const quotationDialog = page.getByRole('dialog', { name: 'New Quotation' });
    try {
      await page.setInputFiles('input[type="file"]', tmpFile);
      await expect(quotationDialog.getByText(tmpFileName)).toBeVisible();

      await page.fill('#add-line-description', description);
      await page.fill('#add-line-qty', '1');
      await page.fill('#add-line-unit-cost', unitCost);
      await page.getByRole('button', { name: 'Add line' }).click();
      await expect(quotationDialog.getByText(description)).toBeVisible();

      await page.getByRole('button', { name: 'Save quotation' }).click();
      await expect(page.getByText('Quotation created.')).toBeVisible();
    } finally {
      fs.rmSync(tmpFile, { force: true });
    }
  }

  // ----- Create a Draft PO, start a new bid for the supplier, and check one line from each
  // quotation to produce a genuinely multi-currency bid. -----
  await page.getByRole('link', { name: 'Purchase Orders' }).click();
  await expect(page).toHaveURL(/\/purchase-orders$/);
  await page.getByRole('link', { name: 'New PO' }).click();
  await expect(page).toHaveURL(/\/purchase-orders\/new$/);

  await page.selectOption('#po-company', { label: 'Head Office' });
  await page.selectOption('#po-currency', 'ZMW');
  await page.getByRole('button', { name: 'Create draft' }).click();
  await expect(page).toHaveURL(/\/purchase-orders\/\d+$/);

  await page.getByRole('button', { name: '+ Add bid' }).click();
  const addBidDialog = page.getByRole('dialog', { name: 'Add supplier bid' });
  await addBidDialog.getByRole('combobox', { name: 'Supplier' }).selectOption({ label: supplier.name });
  await addBidDialog.getByRole('button', { name: /Start a new bid/ }).click();
  await expect(page.getByText('New supplier bid started.')).toBeVisible();

  await page.getByRole('button', { name: '+ Add a quotation' }).click();
  await page.getByText('ZMW Library Quote').click();
  await page.getByRole('button', { name: 'Add quotation' }).click();
  await page.getByRole('button', { name: '+ Add a quotation' }).click();
  await page.getByText('USD Library Quote').click();
  await page.getByRole('button', { name: 'Add quotation' }).click();

  // Checking a line calls addBidItem asynchronously and the checkbox re-renders once the bid
  // refreshes, so click rather than check (check's built-in post-click state assertion can race
  // the refresh) and assert the resulting state explicitly afterward.
  await page.locator('tr', { hasText: 'E2E library ZMW widget' }).locator('input[type="checkbox"]').click();
  await expect(
    page.locator('tr', { hasText: 'E2E library ZMW widget' }).locator('input[type="checkbox"]'),
  ).toBeChecked();
  await page.locator('tr', { hasText: 'E2E library USD widget' }).locator('input[type="checkbox"]').click();
  await expect(
    page.locator('tr', { hasText: 'E2E library USD widget' }).locator('input[type="checkbox"]'),
  ).toBeChecked();

  // The bid card's total in the row is a multi-currency vector joined by " + ". USD renders via
  // its currency symbol ($) per formatMoney's Intl.NumberFormat, ZMW renders with its code.
  const bidCardTotal = page.locator('[role="radio"]', { hasText: supplier.name });
  await expect(bidCardTotal).toContainText('$40.00');
  await expect(bidCardTotal).toContainText('ZMW');
  await expect(bidCardTotal).toContainText('+');
});
