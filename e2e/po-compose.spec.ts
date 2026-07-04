import { test, expect, request, type APIRequestContext } from '@playwright/test';
import { ADMIN, login } from './helpers';

// API reached through the Vite dev proxy origin so the session cookie set by /auth/login
// round-trips to the same context the seeding requests use.
const API_ORIGIN = 'https://localhost:46258';

/** Seeds a supplier with one quotation so the PO detail screen's composer has data to source
 *  bid lines from. */
async function seedSupplierWithQuotation(api: APIRequestContext): Promise<{ id: number; name: string }> {
  const loginResp = await api.post('/api/auth/login', {
    data: { email: ADMIN.email, password: ADMIN.password },
  });
  expect(loginResp.ok(), `login failed: ${loginResp.status()}`).toBeTruthy();

  const name = `E2E Compose Supplier ${Date.now()}`;
  const supplierResp = await api.post('/api/suppliers', {
    data: { supplierName: name, phone: '555-0155', email: 'e2e-compose-supplier@example.com', address: '1 Compose Way' },
  });
  expect(supplierResp.ok(), `create supplier failed: ${supplierResp.status()}`).toBeTruthy();
  const supplier = (await supplierResp.json()) as { id: number };

  const fileResp = await api.post('/api/files', {
    multipart: {
      file: {
        name: 'compose-quote.txt',
        mimeType: 'text/plain',
        buffer: Buffer.from('Sample quotation file for the compose e2e test.'),
      },
    },
  });
  expect(fileResp.ok(), `file upload failed: ${fileResp.status()}`).toBeTruthy();
  const file = (await fileResp.json()) as { id: number };

  const quotationResp = await api.post('/api/quotations', {
    data: {
      supplierId: supplier.id,
      fileId: file.id,
      quoteReference: 'Compose Quote',
      quoteDate: new Date().toISOString(),
      currency: 'ZMW',
      lineItems: [{ description: 'E2E composed widget', quantity: 3, unitCost: 20 }],
    },
  });
  expect(quotationResp.ok(), `create quotation failed: ${quotationResp.status()}`).toBeTruthy();

  return { id: supplier.id, name };
}

test('compose a bid-based PO end to end: draft -> bid -> quotation -> award -> approval -> submit', async ({
  page,
}) => {
  const api = await request.newContext({ baseURL: API_ORIGIN, ignoreHTTPSErrors: true });
  let supplier: { id: number; name: string };
  try {
    supplier = await seedSupplierWithQuotation(api);
  } finally {
    await api.dispose();
  }

  await login(page);

  // PO list -> New PO.
  await page.getByRole('link', { name: 'Purchase Orders' }).click();
  await expect(page).toHaveURL(/\/purchase-orders$/);
  await page.getByRole('link', { name: 'New PO' }).click();
  await expect(page).toHaveURL(/\/purchase-orders\/new$/);

  // Header: company "Head Office", currency ZMW (the only active currency seeded), then create
  // the draft. Creation navigates straight to the unified detail screen (no more /edit route).
  await page.selectOption('#po-company', { label: 'Head Office' });
  await page.selectOption('#po-currency', 'ZMW');
  await page.getByRole('button', { name: 'Create draft' }).click();
  await expect(page).toHaveURL(/\/purchase-orders\/\d+$/);
  await expect(page.getByRole('heading', { name: /^PO-/ })).toBeVisible();

  // Add a supplier bid: "+ Add bid" -> pick supplier -> start a new bid.
  await page.getByRole('button', { name: '+ Add bid' }).click();
  const addBidDialog = page.getByRole('dialog', { name: 'Add supplier bid' });
  await addBidDialog.getByRole('combobox', { name: 'Supplier' }).selectOption({ label: supplier.name });
  await addBidDialog.getByRole('button', { name: /Start a new bid/ }).click();
  await expect(page.getByText('New supplier bid started.')).toBeVisible();

  // Add a quotation to the bid's working set, then check its one line.
  await page.getByRole('button', { name: '+ Add a quotation' }).click();
  await page.getByText('Compose Quote').click();
  await page.getByRole('button', { name: 'Add quotation' }).click();
  const widgetRow = page.locator('tr', { hasText: 'E2E composed widget' });
  await expect(widgetRow).toBeVisible();
  await widgetRow.locator('input[type="checkbox"]').click();
  await expect(widgetRow.locator('input[type="checkbox"]')).toBeChecked();

  // Line appears in column 1 (PO Preview); total = qty(3) x unitCost(20) = 60.
  await expect(page.getByTestId('po-total')).toContainText('60');

  // Award the bid.
  await page.getByRole('button', { name: 'Award this bid' }).click();
  await expect(page.getByText('Bid awarded.')).toBeVisible();

  // Define one approval targeting the current (admin) user, sequence 0.
  await page.selectOption('#approval-target-kind', 'user');
  await page.selectOption('#approval-user', { label: 'Super Admin' });
  await page.fill('#approval-sequence', '0');
  await page.getByRole('button', { name: 'Add approval' }).click();
  await expect(page.getByText('Approval added.')).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Super Admin' })).toBeVisible();

  // Submit: Draft -> Open.
  await page.getByRole('button', { name: 'Submit', exact: true }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Submit' }).click();

  await expect(page.locator('.po-detail-header').getByText('Open')).toBeVisible();
  await expect(page.getByTestId('po-total')).toContainText('60');
});
