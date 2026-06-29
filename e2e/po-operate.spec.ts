import { test, expect, request, type APIRequestContext } from '@playwright/test';
import { ADMIN, login } from './helpers';

// API reached through the Vite dev proxy origin so the session cookie set by /auth/login
// round-trips to the same context the seeding requests use.
const API_ORIGIN = 'https://localhost:46258';

/**
 * Seeds a direct-entry PO with one line item and a single user-targeted approval, then submits
 * it (Draft -> Open). Returns the PO id. Rerunnable: each run creates a fresh PO.
 */
async function seedSubmittedPo(api: APIRequestContext): Promise<number> {
  const loginResp = await api.post('/api/auth/login', {
    data: { email: ADMIN.email, password: ADMIN.password },
  });
  expect(loginResp.ok(), `login failed: ${loginResp.status()}`).toBeTruthy();

  const createResp = await api.post('/api/purchase-orders', {
    data: { companyId: 1, currency: 'USD' },
  });
  expect(createResp.ok(), `create PO failed: ${createResp.status()}`).toBeTruthy();
  const po = (await createResp.json()) as { id: number };

  const lineResp = await api.post(`/api/purchase-orders/${po.id}/line-items`, {
    data: { description: 'E2E widget', quantity: 2, unitCost: 50 },
  });
  expect(lineResp.ok(), `add line item failed: ${lineResp.status()}`).toBeTruthy();

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
