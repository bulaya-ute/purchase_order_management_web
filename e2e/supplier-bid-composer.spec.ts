import { test, expect, request, type APIRequestContext } from '@playwright/test';
import { ADMIN, login } from './helpers';

// API reached through the Vite dev proxy origin so the session cookie set by /auth/login
// round-trips to the same context the seeding requests use.
const API_ORIGIN = 'https://localhost:46258';

/** Seeds a supplier with two quotations (one line each) so the composer has real data to source
 *  bid items from. */
async function seedSupplierWithQuotations(
  api: APIRequestContext,
): Promise<{ id: number; name: string }> {
  const loginResp = await api.post('/api/auth/login', {
    data: { email: ADMIN.email, password: ADMIN.password },
  });
  expect(loginResp.ok(), `login failed: ${loginResp.status()}`).toBeTruthy();

  const name = `E2E Composer Supplier ${Date.now()}`;
  const createResp = await api.post('/api/suppliers', {
    data: { supplierName: name, phone: '555-0177', email: 'e2e-composer-supplier@example.com', address: '1 Composer Way' },
  });
  expect(createResp.ok(), `create supplier failed: ${createResp.status()}`).toBeTruthy();
  const supplier = (await createResp.json()) as { id: number };

  const uploadResp = await api.post('/api/files', {
    multipart: {
      file: {
        name: 'composer-quote.txt',
        mimeType: 'text/plain',
        buffer: Buffer.from('Sample quotation file for the composer e2e test.'),
      },
    },
  });
  expect(uploadResp.ok(), `file upload failed: ${uploadResp.status()}`).toBeTruthy();
  const file = (await uploadResp.json()) as { id: number };

  for (const ref of ['Quote A', 'Quote B']) {
    const quoteResp = await api.post('/api/quotations', {
      data: {
        supplierId: supplier.id,
        fileId: file.id,
        quoteReference: ref,
        quoteDate: new Date().toISOString(),
        currency: 'ZMW',
        lineItems: [{ description: `${ref} widget`, quantity: 2, unitCost: 10 }],
      },
    });
    expect(quoteResp.ok(), `create quotation failed: ${quoteResp.status()}`).toBeTruthy();
  }

  return { id: supplier.id, name };
}

test('supplier bid composer: create a standalone bid and source lines from two quotations', async ({
  page,
}) => {
  const api = await request.newContext({ baseURL: API_ORIGIN, ignoreHTTPSErrors: true });
  let supplier: { id: number; name: string };
  try {
    supplier = await seedSupplierWithQuotations(api);
  } finally {
    await api.dispose();
  }

  await login(page);

  await page.getByRole('link', { name: 'Supplier Bids' }).click();
  await expect(page).toHaveURL(/\/supplier-bids$/);
  await page.getByRole('button', { name: '+ New bid' }).click();
  await expect(page).toHaveURL(/\/supplier-bids\/new$/);

  await page.selectOption('#bid-composer-supplier', { label: supplier.name });
  await expect(page.getByRole('heading', { name: `${supplier.name} — bid items` })).toBeVisible();

  // Open "Quote A", add its one line.
  await page.locator('.bid-card', { hasText: 'Quote A' }).click();
  await expect(page.getByRole('dialog', { name: 'Quotation line items' })).toBeVisible();
  await page.locator('input[type="checkbox"][aria-label="Add Quote A widget to bid"]').click();
  await expect(page.locator('input[type="checkbox"][aria-label="Remove Quote A widget from bid"]')).toBeChecked();
  await page.getByRole('button', { name: 'Close' }).click();

  // Open "Quote B", add its one line.
  await page.locator('.bid-card', { hasText: 'Quote B' }).click();
  await expect(page.getByRole('dialog', { name: 'Quotation line items' })).toBeVisible();
  await page.locator('input[type="checkbox"][aria-label="Add Quote B widget to bid"]').click();
  await expect(page.locator('input[type="checkbox"][aria-label="Remove Quote B widget from bid"]')).toBeChecked();
  await page.getByRole('button', { name: 'Close' }).click();

  // Both lines now show in the right column; "N lines in this bid" chip reflects each quotation.
  await expect(page.getByRole('cell', { name: 'Quote A widget' })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Quote B widget' })).toBeVisible();
  await expect(page.locator('.bid-card', { hasText: 'Quote A' }).getByText('1 line in this bid')).toBeVisible();

  // Edit the quantity of the first line (save-on-blur).
  const qtyInputs = page.locator('table.admin-table tbody input[type="number"]');
  await qtyInputs.first().fill('5');
  await qtyInputs.first().blur();
  await expect(page.getByTestId('bid-item-line-total').first()).toContainText('50');

  // Remove the second line.
  await page.getByRole('row', { name: /Quote B widget/ }).getByRole('button', { name: 'Remove' }).click();
  await expect(page.getByRole('cell', { name: 'Quote B widget' })).toHaveCount(0);

  // Done -> back to the bids library, where the bid now shows 1 item.
  await page.getByRole('button', { name: 'Done' }).click();
  await expect(page).toHaveURL(/\/supplier-bids$/);
  const bidRow = page.locator('tr', { has: page.getByRole('cell', { name: supplier.name }) });
  await expect(bidRow.getByRole('cell', { name: '1', exact: true })).toBeVisible();
});
