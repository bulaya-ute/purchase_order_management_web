import { test, expect, request, type APIRequestContext } from '@playwright/test';
import { ADMIN, login } from './helpers';

// API reached through the Vite dev proxy origin so the session cookie set by /auth/login
// round-trips to the same context the seeding requests use.
const API_ORIGIN = 'https://localhost:46258';

/**
 * Seeds a bid-based PO — a supplier, a quotation, a bid sourcing one line from that quotation,
 * awarded and attached — plus a single user-targeted approval, then submits it (Draft -> Open).
 * Returns the PO id. Rerunnable: each run creates fresh entities.
 *
 * Manual/direct-entry PO line items no longer exist (removed from the API); every PO is
 * bid-based, so seeding one for a UI test now requires this full chain.
 */
async function seedSubmittedPo(api: APIRequestContext): Promise<number> {
  const loginResp = await api.post('/api/auth/login', {
    data: { email: ADMIN.email, password: ADMIN.password },
  });
  expect(loginResp.ok(), `login failed: ${loginResp.status()}`).toBeTruthy();

  const supplierResp = await api.post('/api/suppliers', {
    data: {
      supplierName: `E2E Operate Supplier ${Date.now()}`,
      phone: '555-0166',
      email: 'e2e-operate-supplier@example.com',
      address: '1 Operate Way',
    },
  });
  expect(supplierResp.ok(), `create supplier failed: ${supplierResp.status()}`).toBeTruthy();
  const supplier = (await supplierResp.json()) as { id: number };

  const fileResp = await api.post('/api/files', {
    multipart: {
      file: {
        name: 'operate-quote.txt',
        mimeType: 'text/plain',
        buffer: Buffer.from('Sample quotation file for the operate e2e test.'),
      },
    },
  });
  expect(fileResp.ok(), `file upload failed: ${fileResp.status()}`).toBeTruthy();
  const file = (await fileResp.json()) as { id: number };

  const quotationResp = await api.post('/api/quotations', {
    data: {
      supplierId: supplier.id,
      fileId: file.id,
      quoteReference: 'Operate Quote',
      quoteDate: new Date().toISOString(),
      currency: 'ZMW',
      lineItems: [{ description: 'E2E widget', quantity: 2, unitCost: 50 }],
    },
  });
  expect(quotationResp.ok(), `create quotation failed: ${quotationResp.status()}`).toBeTruthy();
  const quotation = (await quotationResp.json()) as {
    lineItems: { id: number; description: string; quantity: number; unitCost: number }[];
  };
  const quotationLine = quotation.lineItems[0];

  // ZMW is the only active currency seeded — USD exists but is inactive and is rejected server-side.
  const createResp = await api.post('/api/purchase-orders', {
    data: { companyId: 1, currency: 'ZMW' },
  });
  expect(createResp.ok(), `create PO failed: ${createResp.status()}`).toBeTruthy();
  const po = (await createResp.json()) as { id: number };

  const bidResp = await api.post(`/api/purchase-orders/${po.id}/bids`, {
    data: { supplierId: supplier.id },
  });
  expect(bidResp.ok(), `create bid failed: ${bidResp.status()}`).toBeTruthy();
  const bid = (await bidResp.json()) as { id: number };

  // createBid only sets SupplierBid.PurchaseOrderId — it doesn't register the
  // PurchaseOrderSupplierBids attachment row that Submit's "has attached bids" check reads.
  const attachResp = await api.post(`/api/purchase-orders/${po.id}/supplier-bids`, {
    data: { supplierBidId: bid.id },
  });
  expect(attachResp.ok(), `attach bid failed: ${attachResp.status()}`).toBeTruthy();

  const itemResp = await api.post(`/api/supplier-bids/${bid.id}/items`, {
    data: {
      description: quotationLine.description,
      quantity: quotationLine.quantity,
      unitCost: quotationLine.unitCost,
      sourceQuotationLineItemId: quotationLine.id,
    },
  });
  expect(itemResp.ok(), `add bid item failed: ${itemResp.status()}`).toBeTruthy();

  const awardResp = await api.post(`/api/purchase-orders/${po.id}/awarded-bid`, {
    data: { supplierBidId: bid.id },
  });
  expect(awardResp.ok(), `award bid failed: ${awardResp.status()}`).toBeTruthy();

  const approvalResp = await api.post(`/api/purchase-orders/${po.id}/approvals`, {
    data: { requiredUserId: 1, sequenceOrder: 0 },
  });
  expect(approvalResp.ok(), `add approval failed: ${approvalResp.status()}`).toBeTruthy();

  const submitResp = await api.post(`/api/purchase-orders/${po.id}/submit`);
  expect(submitResp.ok(), `submit failed: ${submitResp.status()}`).toBeTruthy();

  return po.id;
}

test('approve a PO via the UI, record milestones, and confirm cancel is blocked once paid', async ({
  page,
}) => {
  const api = await request.newContext({ baseURL: API_ORIGIN, ignoreHTTPSErrors: true });
  let poId: number;
  try {
    poId = await seedSubmittedPo(api);
  } finally {
    await api.dispose();
  }

  await login(page);

  // Approvals inbox shows the seeded PO as an actionable approval, linking to its detail.
  await page.getByRole('link', { name: 'Approvals' }).click();
  await expect(page).toHaveURL(/\/approvals/);
  const poDetailLink = page.locator(`a[href="/purchase-orders/${poId}"]`).first();
  await expect(poDetailLink).toBeVisible();

  // Open the PO detail from the inbox row link.
  await poDetailLink.click();
  await expect(page).toHaveURL(new RegExp(`/purchase-orders/${poId}$`));
  await expect(page.getByRole('heading', { name: /^PO-/ })).toBeVisible();

  // Total should be quantity(2) x unitCost(50) = 100.
  await expect(page.getByTestId('po-total')).toContainText('100');

  // Approve via the inline control in the approvals panel.
  await page.getByRole('button', { name: 'Approve', exact: true }).click();
  await expect(page.getByText('Approval recorded.')).toBeVisible();

  // Status becomes Approved (header badge).
  await expect(page.locator('.po-detail-header').getByText('Approved')).toBeVisible();

  // Mark Paid + Mark Delivered, asserting the milestone chips flip.
  await page.getByRole('button', { name: 'Mark Paid' }).click();
  await expect(page.getByText('Marked as paid.')).toBeVisible();
  await expect(page.locator('.po-chip.po-chip-set', { hasText: 'Paid' })).toBeVisible();

  await page.getByRole('button', { name: 'Mark Delivered' }).click();
  await expect(page.getByText('Marked as delivered.')).toBeVisible();
  await expect(page.locator('.po-chip.po-chip-set', { hasText: 'Delivered' })).toBeVisible();

  // Cancel is no longer offered once the PO is paid.
  await expect(page.getByRole('button', { name: 'Cancel PO' })).toHaveCount(0);
});
