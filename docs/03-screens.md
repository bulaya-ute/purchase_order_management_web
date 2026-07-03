# Screen Inventory

## LoginScreen

**Route:** `/login` (public only)

**File:** `src/screens/LoginScreen.tsx`

Renders a centered login card with email and password inputs. On submit, calls `POST /api/auth/login`. On success, navigates to the originally-requested route (preserved in router state by `ProtectedRoute`) or falls back to `/`. A 401 response shows "Invalid email or password." Any other error shows a generic message.

### API calls

| Method | Path | Body | Response |
|---|---|---|---|
| POST | `/api/auth/login` | `{ email, password }` | `CurrentUser` |

### Key UX

- Both fields are required (native HTML validation).
- The submit button is disabled during submission.
- Autofill attributes: `autoComplete="username"` and `autoComplete="current-password"`.

---

## DashboardScreen

**Route:** `/`

**File:** `src/screens/DashboardScreen.tsx`

Home screen showing two tables: "My Purchase Orders" (up to 10 POs issued by the current user) and "Awaiting My Approval" (current user's pending approvals). Both load in parallel on mount. Each has its own independent loading/error state.

### API calls

| Method | Path | Query params | Response |
|---|---|---|---|
| GET | `/api/purchase-orders` | `page=1&pageSize=100` | `PagedResult<PurchaseOrderSummary>` |
| GET | `/api/approvals/mine` | — | `MyApprovalDto[]` |

"My Purchase Orders" is filtered client-side by `issuerUserId === currentUser.id` and limited to the first 10.

---

## PurchaseOrdersScreen

**Route:** `/purchase-orders`

**File:** `src/screens/PurchaseOrdersScreen.tsx`

Paginated list of all purchase orders. Server-side filtering by status and company. Companies are fetched on mount (via `listAllCompanies`, which walks all pages) for the company filter dropdown.

### API calls

| Method | Path | Query params | Response |
|---|---|---|---|
| GET | `/api/purchase-orders` | `page, pageSize, status?, companyId?` | `PagedResult<PurchaseOrderSummary>` |
| GET | `/api/companies` | walked internally by `listAllCompanies` | `PagedResult<Company>` |

### Key response shape used

`PurchaseOrderSummary` — see `src/api/purchaseOrdersApi.ts`:
- `id`, `poNumber`, `companyId`, `companyName`, `targetCompanyName`, `issuerUserName`, `currency`, `status`, `notes`, `totalAmount`, `paidAtUtc`, `deliveredAtUtc`, `createdAtUtc`

### Key UX

- Status filter and company filter are dropdown selects; changing either resets to page 1.
- Uses the `Pagination` component with default page sizes `[10, 25, 50, 100]`; default page size is 25.
- PO number column links to `/purchase-orders/:id`.
- Paid/Delivered milestones shown as `po-chip` pills.

---

## PurchaseOrderDetailScreen

**Route:** `/purchase-orders/:id`

**File:** `src/screens/PurchaseOrderDetailScreen.tsx`

Read-only view of a submitted PO. The screen fetches the PO detail and the current user's actionable approvals in parallel. Composed of two sub-components plus an actions bar.

### API calls

| Method | Path | Response |
|---|---|---|
| GET | `/api/purchase-orders/:id` | `PurchaseOrderDetail` |
| GET | `/api/approvals/mine` | `MyApprovalDto[]` |
| POST | `/api/approvals/:approvalId/approve` | `ApprovalDto` |
| POST | `/api/approvals/:approvalId/reject` | `ApprovalDto` |
| POST | `/api/purchase-orders/:id/pay` | `PurchaseOrderDetail` |
| POST | `/api/purchase-orders/:id/deliver` | `PurchaseOrderDetail` |
| POST | `/api/purchase-orders/:id/cancel` | `PurchaseOrderDetail` |
| PATCH | `/api/purchase-orders/:id/supplier-bids/:bidId/set-primary` | `void` |

### BidComparisonPanel (`src/components/BidComparisonPanel.tsx`)

Shown when the PO has at least one attached supplier bid. Displays:

- A row of **bid selector cards** (`role="radiogroup"`): one card per attached bid, showing supplier name, per-currency total vector, item count, and an "Awarded" badge on the primary bid. Clicking a card selects it.
- A **line item preview table** for the selected bid, loaded from `GET /api/supplier-bids/:id` when the selection changes. Shows description, quantity, unit cost, discount, tax, and line total. Quotation references appear as sub-labels under the description.
- A **bid totals row** below the table.
- An **"Award this bid" button** (shown when `canAward` and the selected bid is not yet primary) — calls `PATCH /api/purchase-orders/:poId/supplier-bids/:bidId/set-primary`.
- A **Source Quotations panel** (right side): groups the selected bid's items by `sourceQuotationId` and shows quotation reference and item count.
- An **approval status summary** at the bottom: pending approval count and a "blocked" hint when approvals must happen before awarding.

`canAward` is true when the bid list is not yet locked (no primary set) and the current user is either the PO issuer or is in the approval chain.

`isApproveBlocked` is true when there are attached bids but no primary has been set. When this is true, the approve button in `PurchaseOrderCard` is disabled.

### PurchaseOrderCard (`src/components/PurchaseOrderCard.tsx`)

Document-style card with:
- Header: PO number, `StatusBadge`, "Print / Export PDF" link, created date.
- Meta grid: Company, Issuer, Currency, optional Target Branch, optional Type.
- Milestone chips: Paid date / Not paid, Delivered date / Not delivered.
- Notes (italic, if present).
- Line items table (description, qty, unit cost, discount, tax, line total). For bid-based POs, a hint that "Line items are generated when the PO is approved."
- Totals: single-currency subtotal/tax/total, or multi-currency vector when `hasMultiCurrencyTotals` is true.
- Approvals table: target, sequence, status badge, approved-at, actor, comment. For actionable approvals (ids from `/approvals/mine`), an inline textarea + Approve/Reject buttons. For approvals the user is in but that are not their turn, shows "Awaiting: {next approver}".

### Key UX

- The actions bar shows "Mark Paid", "Mark Delivered", and "Cancel PO" when the PO is `Approved`.
- Cancel requires a `ConfirmDialog`.
- The `BidComparisonPanel` fetches bid detail on demand (when a card is clicked) without resetting the full-page loading state.

---

## PurchaseOrderComposerScreen

**Route:** `/purchase-orders/new` and `/purchase-orders/:id/edit`

**File:** `src/screens/PurchaseOrderComposerScreen.tsx`

Two-phase screen. When the route is `/purchase-orders/new`, it shows a creation form (company, optional target branch, optional type, currency, notes). Submitting creates a Draft PO and immediately redirects to `/purchase-orders/:id/edit`.

The edit phase (`PurchaseOrderEditor`) is a multi-section form for Draft POs:

1. **Header** — editable currency, target branch, and notes (company and issuer are read-only). `PUT /api/purchase-orders/:id`.
2. **Totals** — live display of current subtotal/tax/total (or multi-currency vector).
3. **Line Items** — table of existing items + inline add/edit form. `POST` to add, `PUT` to update, `DELETE` to remove.
4. **Supplier Bids and Comparison** — `BidManager` component (see components doc). Manages bid creation, attachment, quotation capture, and bid item seeding.
5. **Attached Supplier Bids** — junction-table management: attach a bid, set as primary, detach. Once a primary is set the list is locked.
6. **Approvals** — for POs without a type: add/remove approval definitions (role or specific user, sequence order). For typed POs: shows the fixed approval steps read-only. Live status of generated approvals always shown.
7. **Submit** — `POST /api/purchase-orders/:id/submit`. Requires at least one attached bid. Navigates to detail screen after submit.

If the PO is not a Draft, the editor displays a locked message and a link to the detail screen.

### API calls (edit phase)

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/purchase-orders/:id` | Load PO |
| PUT | `/api/purchase-orders/:id` | Update header |
| POST | `/api/purchase-orders/:id/line-items` | Add line item |
| PUT | `/api/purchase-orders/:id/line-items/:lineItemId` | Update line item |
| DELETE | `/api/purchase-orders/:id/line-items/:lineItemId` | Delete line item |
| POST | `/api/purchase-orders/:id/approvals` | Add approval |
| DELETE | `/api/purchase-orders/:id/approvals/:approvalId` | Delete approval |
| POST | `/api/purchase-orders/:id/submit` | Submit PO |
| POST | `/api/purchase-orders/:id/supplier-bids` | Attach bid to PO |
| DELETE | `/api/purchase-orders/:id/supplier-bids/:bidId` | Detach bid |
| PATCH | `/api/purchase-orders/:id/supplier-bids/:bidId/set-primary` | Set primary bid |
| POST | `/api/purchase-orders/:id/awarded-bid` | Award a bid |
| GET | `/api/supplier-bids` | Load all bids (for attach dropdown) |
| GET | `/api/roles` | Load roles (for approval form) |
| GET | `/api/users` | Load users (for approval form) |
| GET | `/api/companies` | Load companies (header form) |
| GET | `/api/currencies` | Load active currencies |
| GET | `/api/purchase-order-types` | Load types (creation form) |
| GET | `/api/purchase-order-types/:id` | Load type's approval steps |

### Key UX

- The PO type dropdown on the creation form is filtered to types the current user's roles permit them to create (`allowedCreatorRoleIds` empty = no restriction).
- The default currency is `ZMW`; falls back to the first active currency if ZMW is not present.
- Row versions (`rowVersion`) are sent on all PUT requests to enable optimistic concurrency checking.
- The submit button is disabled when no supplier bids are attached.

---

## PurchaseOrderPrintScreen

**Route:** `/purchase-orders/:id/print`

**File:** `src/screens/PurchaseOrderPrintScreen.tsx`

Print/PDF export view. Fetches the same `PurchaseOrderDetail` as the detail screen and renders all fields in a document layout. Includes a "Print" button that calls `window.print()`. The companion `src/screens/print.css` stylesheet hides the app shell (`app-header`, `app-sidebar`) using `@media print`, and also hides toolbar elements with `.po-print-hide`, so only the document content reaches the printed page.

### API calls

| Method | Path | Response |
|---|---|---|
| GET | `/api/purchase-orders/:id` | `PurchaseOrderDetail` |

---

## ApprovalsScreen

**Route:** `/approvals`

**File:** `src/screens/ApprovalsScreen.tsx`

Shows the current user's pending approvals (their inbox). Loads once on mount. Displays PO number (link to detail), company, total amount, and sequence order for each pending approval. A "Review" button also links to the PO detail where the user can approve or reject inline.

### API calls

| Method | Path | Response |
|---|---|---|
| GET | `/api/approvals/mine` | `MyApprovalDto[]` |

### Key response shape

`MyApprovalDto`:
- `id`, `purchaseOrderId`, `poNumber`, `companyName`, `totalAmount`, `currency`, `requiredRoleId`, `requiredRoleName`, `requiredUserId`, `sequenceOrder`, `rowVersion`

---

## SuppliersScreen

**Route:** `/suppliers`

**File:** `src/screens/SuppliersScreen.tsx`

CRUD screen for suppliers. Paginated list with a form-submit search (sends `search` query param to the API). Create/Edit open a `SupplierFormModal`; Delete shows a `ConfirmDialog`.

### API calls

| Method | Path | Notes |
|---|---|---|
| GET | `/api/suppliers` | `?page&pageSize&search?` |
| POST | `/api/suppliers` | Create |
| PUT | `/api/suppliers/:id` | Update |
| DELETE | `/api/suppliers/:id` | Delete |

### Key UX

The search is server-side: the user types in an input, submits the form, and the `search` state is updated. Only then does the list reload. Changing the search resets to page 1.

---

## QuotationsScreen

**Route:** `/quotations`

**File:** `src/screens/QuotationsScreen.tsx`

List of all quotations with three server-side filters (supplier, expired, used) and a client-side live relevance search across supplier name, description, quote reference, and notes. File preview modal supports inline rendering of PDFs and images; other file types offer an "Open file" link.

### API calls

| Method | Path | Notes |
|---|---|---|
| GET | `/api/quotations` | `?supplierId?&isExpired?&isUsed?` |
| POST | `/api/quotations` | Create via `QuotationFormModal` |
| GET | `/api/suppliers` | For supplier filter dropdown |
| GET | `/api/currencies` | For the form's currency picker |

### Key UX

- Expired quotations show a `badge-danger` pill; quotations expiring in the future show `badge-warning`.
- Used/Unused status shown as `badge-success`/`badge-muted`.
- The search input filters the already-fetched list client-side using `scoreMatch`.
- File preview modal uses `fileUrl` from the API response directly — no client-side URL construction.

---

## SupplierBidsScreen

**Route:** `/supplier-bids`

**File:** `src/screens/SupplierBidsScreen.tsx`

Library view of all supplier bids. Server-side filters: supplier and unattached-only. Client-side live search by supplier name using `scoreMatch`. Client-side pagination over the filtered result. "+ New bid" opens `SupplierBidComposerModal` as a full-screen overlay.

### API calls

| Method | Path | Notes |
|---|---|---|
| GET | `/api/supplier-bids` | `?supplierId?&unattachedOnly?` |
| GET | `/api/suppliers` | For the filter dropdown |

### Key UX

- Client-side pagination: the full bid list is fetched, filtered/scored, then sliced by page.
- Attached bids show a link badge to the PO; unattached bids show a muted badge.

---

## SupplierBidComposerScreen

**Route:** `/supplier-bids/new?purchaseOrderId=:poId`

**File:** `src/screens/SupplierBidComposerScreen.tsx`

Routed wrapper around `SupplierBidComposerContent`. Reads an optional `purchaseOrderId` from the query string. After completing or cancelling, navigates to `/purchase-orders/:poId/edit` if a PO id was provided, otherwise to `/supplier-bids`.

### SupplierBidComposerContent (`src/screens/SupplierBidComposerContent.tsx`)

The actual bid-creation flow, shared by the screen and `SupplierBidComposerModal`. Composed in two columns after a supplier is selected:

**Left column — Quotations:**
- Lists all quotations for the selected supplier.
- Each quotation is a clickable `BidCard`-style button showing reference, description, date, expiry badge, and "Used X/N lines" count.
- Live search within the quotation list using `scoreMatch`.
- Clicking a quotation card opens `QuotationLinePickerModal`.

**Right column — Bid items:**
- Shows the current bid's line items in a table.
- Quantity is an editable input; changes are saved on blur (`PUT /api/supplier-bids/:id/items/:itemId`).
- Remove button calls `DELETE /api/supplier-bids/:id/items/:itemId`.

**QuotationLinePickerModal:**
- Shows all line items for a quotation with checkboxes.
- Checking a line calls `POST /api/supplier-bids/:id/items` (adds the line to the bid).
- Unchecking calls `DELETE /api/supplier-bids/:id/items/:itemId`.

### API calls

| Method | Path | Notes |
|---|---|---|
| GET | `/api/suppliers` | Supplier dropdown |
| POST | `/api/supplier-bids` | Create standalone bid (no PO) |
| POST | `/api/purchase-orders/:poId/bids` | Create bid attached to PO |
| GET | `/api/supplier-bids/:id` | Refresh bid after changes |
| GET | `/api/quotations` | `?supplierId=:id` |
| GET | `/api/quotations/:id` | Load quotation + line items for picker |
| POST | `/api/supplier-bids/:id/items` | Add line item from quotation |
| PUT | `/api/supplier-bids/:id/items/:itemId` | Update quantity |
| DELETE | `/api/supplier-bids/:id/items/:itemId` | Remove line item |

### Key UX

- Selecting a supplier immediately creates a bid via the API (before the user has added any items). This is intentional — the bid id is needed to add items.
- A `creationInFlight` ref guards against double-creation from rapid supplier switching.
- Bid items can only be added from quotations, not entered manually, in this composer. (Manual entry exists in the `BidManager` component's edit path for existing items only.)

### SupplierBidComposerModal (`src/screens/SupplierBidComposerModal.tsx`)

A `position: fixed, inset: 0` overlay that wraps `SupplierBidComposerContent`. Used from `SupplierBidsScreen`. Escape key and the Close button call `onClose`.

---

## Admin Screens

All admin screens follow the same CRUD pattern: load list on mount, open a form modal to create/edit, show a `ConfirmDialog` before destructive operations, display `Toast` for action results.

### CompaniesScreen

**Route:** `/admin/companies`

**File:** `src/screens/admin/CompaniesScreen.tsx`

Supports table view (paginated, page size 20) and tree view. Tree view is built client-side from the flat `Company[]` list using `buildCompanyTree`. "+ Add child" in the tree view pre-fills the parent.

| Method | Path |
|---|---|
| GET | `/api/companies` (paginated) |
| GET | `/api/companies` (all, via `listAllCompanies`) |
| POST | `/api/companies` |
| PUT | `/api/companies/:id` |
| DELETE | `/api/companies/:id` |

### UsersScreen

**Route:** `/admin/users`

**File:** `src/screens/admin/UsersScreen.tsx`

Paginated user list (page size 20), filterable by company. Edit opens `UserFormModal` (fullName, email, companyId, isActive, roleIds). Delete shows `ConfirmDialog`. "Reset password" opens `ResetPasswordModal`.

| Method | Path |
|---|---|
| GET | `/api/users` | `?page&pageSize&companyId?` |
| POST | `/api/users` |
| PUT | `/api/users/:id` |
| DELETE | `/api/users/:id` |
| POST | `/api/users/:id/reset-password` |
| GET | `/api/companies` (via `listAllCompanies`) |
| GET | `/api/roles` |

### RolesScreen

**Route:** `/admin/roles`

**File:** `src/screens/admin/RolesScreen.tsx`

Role hierarchy displayed as a tree (`RoleTreeView`). Create opens `RoleFormModal`, which loads `GET /api/roles/allowed-parents` to restrict which roles the current user can create under. Rename opens `RenameRoleModal`. System roles cannot be deleted (enforced by the backend).

| Method | Path |
|---|---|
| GET | `/api/roles` |
| GET | `/api/roles/allowed-parents` |
| POST | `/api/roles` |
| PUT | `/api/roles/:id` |
| DELETE | `/api/roles/:id` |

### CurrenciesScreen

**Route:** `/admin/currencies`

**File:** `src/screens/admin/CurrenciesScreen.tsx`

List of currencies with a "Show inactive" checkbox. Create/Edit via `CurrencyFormModal`. There is no delete endpoint — currencies are activated/deactivated via the `isActive` flag.

| Method | Path |
|---|---|
| GET | `/api/currencies` | `?isActive=true` when "Show inactive" is off |
| POST | `/api/currencies` |
| PUT | `/api/currencies/:code` |

### PoTypesScreen

**Route:** `/admin/po-types`

**File:** `src/screens/admin/PoTypesScreen.tsx`

Manages purchase order type presets. Each type defines a fixed approval chain and an optional set of roles whose members are the only ones allowed to create POs of that type. Edit opens `PoTypeFormModal`. Delete shows `ConfirmDialog`.

| Method | Path |
|---|---|
| GET | `/api/purchase-order-types` |
| POST | `/api/purchase-order-types` |
| PUT | `/api/purchase-order-types/:id` |
| DELETE | `/api/purchase-order-types/:id` |
| GET | `/api/roles` |

---

## ProfileScreen

**Route:** `/profile`

**File:** `src/screens/ProfileScreen.tsx`

Displays the current user's profile information from `AuthContext`. No API calls beyond what `AuthProvider` already made.
