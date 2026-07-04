# PO Composition Redesign — Frontend Spec

**Status:** Approved — ready for implementation  
**Date:** 2026-07-04  
**Companion spec:** `2026-07-04-po-composition-redesign-backend-spec.md`  
**Source design doc:** `2026-07-04-po-detail-bid-composition-design.md`

---

## Context

This spec covers all React/TypeScript changes for the PO composition redesign. Read the source
design doc first for the full rationale. The short version: one unified screen replaces both the
current `PurchaseOrderComposerScreen` (edit) and `PurchaseOrderDetailScreen` (read-only). All PO
lines come from supplier bids; manual direct-entry lines are removed.

**Coordinate with the backend dev** — several API shapes change (see backend spec). Don't start
frontend work until the backend changes are deployed to the dev environment, or mock the new
shapes locally while the backend is in progress.

---

## 1. Route and screen structure

| Route | Screen | Notes |
|---|---|---|
| `/purchase-orders` | `PurchaseOrdersScreen` | No change |
| `/purchase-orders/new` | `PurchaseOrderComposerScreen` (create form only) | Keep the `isNew` branch; strip the `PurchaseOrderEditor` sub-component entirely |
| `/purchase-orders/:id` | `PurchaseOrderDetailScreen` (unified, all statuses) | This becomes the new two-column screen |
| `/purchase-orders/:id/edit` | Redirect → `/purchase-orders/:id` | Already implemented; keep as-is |
| `/purchase-orders/:id/print` | `PurchaseOrderPrintScreen` | No change |

`PurchaseOrderComposerScreen` shrinks to only the "new PO" header form (company, target branch,
currency, type, notes → "Create draft"). After creation it navigates to `/purchase-orders/:id` as
today.

---

## 2. Layout

```
← Back to purchase orders                             [Print / Export PDF]  [Cancel PO]

[ Bid A (Draft) ✕ ] [ Bid B (Awarded) ] [ Bid C (Draft) ✕ ] [ + Add bid ]
  ↑ horizontally scrollable row; awarded bid sorted first

┌──────────────────────────────────┬──────────────────────────────────┐
│  Column 1 — PO Preview           │  Column 2 — Quotations           │
│                                  │  (vertically scrollable)         │
│  Reflects whichever bid is       │                                  │
│  selected in the row above.      │  [+ Add a quotation]             │
│                                  │  (Draft + selected bid is Draft) │
│  Header meta (read-only):        │                                  │
│    Company, Issuer, Currency,    │  ┌────────────────────────────┐  │
│    Target, Type, Notes           │  │ Quotation card             │  │
│  (editable fields if PO Draft)   │  │  QTY-001 · expires 2026-08 │  │
│                                  │  │  ☑ Item A   10 × 500.00    │  │
│  Line items table:               │  │  ☑ Item B   5  × 200.00    │  │
│    Description, Qty*, Unit Cost, │  │  ☐ Item C   2  × 100.00    │  │
│    Discount, Tax, Line Total     │  │  [Remove]                  │  │
│    (* qty editable if Draft)     │  └────────────────────────────┘  │
│                                  │                                  │
│  Totals (currency vector)        │  ┌────────────────────────────┐  │
│                                  │  │ Quotation card             │  │
│  Approvals table                 │  └────────────────────────────┘  │
│  (inline approve/reject if       │                                  │
│   non-Draft and actionable)      │                                  │
│                                  │                                  │
│  [Award this bid] / [Unaward]    │                                  │
│  (Draft + selected bid is Draft) │                                  │
└──────────────────────────────────┴──────────────────────────────────┘
```

**Column widths:** col 1 takes ~55-60% of the available width; col 2 takes the remainder.
Both columns scroll independently on overflow. The bid row above is fixed/sticky.

---

## 3. Column 1 — PO Preview

Column 1 always reflects the **currently selected bid** from the row. Switching the selected bid
swaps the content. This is a preview of "if this bid is awarded, this is the PO."

### Layout (same structure for Draft and non-Draft — only editability changes)

#### Header meta

Display all PO header fields: Company (read-only always), Issuer, Currency, Target branch, PO
Type, Notes.

When **PO is Draft**, these are editable (dropdowns for currency/target/type, textarea for notes)
with a "Save header" button — same as today. When **not Draft**, they display as plain text. Same
visual layout either way; the editable version simply renders `<select>` / `<textarea>` in the
same spots where the read-only version renders text.

#### Line items

Display the **selected bid's items** (not `po.lineItems` — see note below). Columns: Description,
Qty, Unit Cost, Discount, Tax, Line Total.

- **Qty field:** when the selected bid is `Draft` and the PO is Draft, render an `<input type="number">` in-place for quantity (calls `updateBidItem` on blur/submit, quantity only — other fields are not editable here). All other fields are always read-only display.
- When not editable: plain text cells, same layout.

> **Note on PO line items:** `po.lineItems` (from `PurchaseOrderLineItem` table) are NOT shown on
> this screen. They are created at approval time as an audit/accounting record and are only shown
> on `PurchaseOrderPrintScreen`. This screen always shows bid composition data.

#### Totals

Currency vector totals for the selected bid (reuse existing `formatMoneyVector` + `po-totals` layout).

#### Approvals table

Shown below the line items. Same as the current `PurchaseOrderCard` approvals section:
- All approval rows, status badges, approver names.
- When the user has an actionable approval (non-Draft PO, their turn in sequence), show the
  inline approve/reject textarea + buttons.
- "Awaiting: [target]" message for chain members who are in sequence but not yet their turn.

#### Award / Unaward button

A single button at the bottom of column 1, visible only when PO is Draft and selected bid is Draft.

| Condition | Label | Action |
|---|---|---|
| `po.awardedSupplierBidId` is null OR `≠ selectedBidId` | **Award this bid** | `POST /purchase-orders/:id/awarded-bid` |
| `po.awardedSupplierBidId === selectedBidId` | **Unaward** | `DELETE /purchase-orders/:id/awarded-bid` |

After either action, refresh PO data. Awarding locks the bid row (attach/detach disabled).
Unawarding unlocks it (attach/detach re-enabled).

---

## 4. Column 2 — Quotations working set

Column 2 shows the quotations that contribute lines to the **selected bid**.

### Auto-population

On bid selection, derive the working set from the bid's items: `distinct(item.sourceQuotationId)`
across all `selectedBidDetail.items`. Fetch each quotation detail as needed (see caching, section 9).

If the selected bid has no items yet, column 2 is empty (show empty state: "No quotations added
yet — use the button below to add one").

### Quotation cards

Each card shows:
- Quotation reference, date, expiry (with `badge-danger` if expired), currency
- Line items table with a checkbox per line
  - **Checked** = this line is in the selected bid (`item.sourceQuotationLineItemId` matches)
  - Checking: call `addBidItem(selectedBidId, { sourceQuotationLineItemId, description, quantity, unitCost })` — copy `description`, `quantity`, `unitCost` from the quotation line
  - Unchecking: call `deleteBidItem(selectedBidId, bidItemId)`
  - Checkboxes are `disabled` (not hidden) when the selected bid is not `Draft`
- **"Remove" button** — visible only when selected bid is Draft:
  - Zero checked lines → remove card instantly (no confirmation)
  - One or more checked lines → `ConfirmDialog` ("This will remove N line item(s) from this bid."); confirming deletes each bid item then removes the card

### "Add a quotation" button

Visible only when selected bid is Draft. Opens the "Add a quotation" modal (section 7).

---

## 5. Bid row

The horizontal scrollable row above the two columns.

### Bid card

Each card shows:
- Supplier name
- Per-currency total vector
- Item count
- `Draft` badge when `supplierBid.status === 'Draft'`
- `Awarded` badge when `supplierBid.id === po.awardedSupplierBidId`
- **Remove (✕) button** — visible when: PO is Draft **and** `po.awardedSupplierBidId` is null
  (no bid awarded yet). Calls `detachSupplierBid`.

### Selection

Clicking a card selects it. The selected card gets a visual highlight (`po-bid-card--selected`).
Awarded bid is sorted first. Default selection: awarded bid if one exists, otherwise first card.

### "+ Add bid" button

Visible when PO is Draft and no bid is yet awarded. Opens the "Add supplier bid" modal (section 6).

---

## 6. "Add supplier bid" modal

Single modal with two steps:

**Step 1 — Pick a supplier**

Typeahead / searchable dropdown of all suppliers. Filter out suppliers who already have a bid
attached to this PO (avoids the duplicate-supplier conflict).

**Step 2 — Choose existing or new**

After picking a supplier, show:
- A list of that supplier's existing **unattached** bids (those with `purchaseOrderId === null`),
  shown as selectable rows (supplier name, item count, total, Draft badge).
- A prominent **"Start a new bid for {Supplier}"** option at the top or bottom of the list.

Actions:
- Selecting an existing bid → call `attachBidToPurchaseOrder(bidId, po.id)` → close modal → new
  card appears in bid row, selected.
- "Start new" → call `createBid(po.id, { supplierId })` → close modal → new empty bid card
  appears selected.

---

## 7. "Add a quotation" modal

Triggered from the "+ Add a quotation" button in column 2.

### Required: share with `SupplierBidComposerContent`

**This modal's left column and `SupplierBidComposerContent`'s left column do the same job**
(paginated, searchable quotation browser scoped to a supplier). Do not build two separate
implementations. Extract a shared component — suggested name: `QuotationBrowserPanel` — and have
both places use it.

`SupplierBidComposerContent.tsx` is at `src/screens/SupplierBidComposerContent.tsx`. Study its
existing left-column implementation before building the new component; the new component adds
pagination and a preview pane but the core browse logic is the same.

### Layout

```
┌─────────────────────────┬─────────────────────────┐
│ Left — search + results  │ Right — preview          │
│                          │                          │
│ [Search…]                │ (select a row)           │
│                          │                          │
│ ┌──────────────────────┐ │ Reference, date, expiry  │
│ │ QTY-001  2026-06-01  │ │ Currency                 │
│ │ QTY-002  Expired ⚠   │ │ Line items table         │
│ │ QTY-003  2026-09-15  │ │ Subtotal / Tax / Total   │
│ └──────────────────────┘ │ File preview (PDF/image) │
│                          │                          │
│ [← 1 2 3 →]              │                          │
└─────────────────────────┴─────────────────────────┘
                                         [Cancel] [Add quotation]
```

### Left column (the `QuotationBrowserPanel` component)

- Search bar (debounced ~300ms, resets to page 1 on change).
- Paginated results table: QuoteReference, Supplier, Date, Expiry (with `badge-danger` if
  expired). Default page size: 10 (suited to a modal).
- Scoped to the selected bid's supplier (`supplierId` filter).
- Quotations already present in column 2's working set are excluded from results.
- Uses the updated paginated `GET /api/quotations` endpoint (backend spec section 5).
- Uses the existing `Pagination` component for page controls.

### Right column — preview

On selecting a row, show a read-only quotation detail preview:
- Reference, quote date, expiry badge, currency
- Line items table (description, qty, unit cost, line total)
- Subtotal / tax / total
- File preview: PDF renders inline in an `<iframe>`; images render in an `<img>`; other types
  show an "Open file" link (same pattern as `QuotationsScreen`'s existing preview)

Both columns have independent loading states (results table and preview pane each show their own
spinner/skeleton).

### Confirm action

**"Add quotation"** button (disabled until a row is selected). Confirming adds just the quotation
*card* to column 2 — no lines are pre-checked. The card appears with all lines unchecked; the user
then checks the lines they want.

---

## 8. Draft-only gating — full list

The following are visible/enabled only when the **selected bid** is `Draft` (and the PO itself is
not yet submitted):

- "+ Add bid" button in the bid row
- Remove (✕) on bid cards (additionally requires: `po.awardedSupplierBidId === null`)
- Quotation line checkboxes in column 2 (rendered but `disabled` otherwise — keep visible for
  post-hoc auditability)
- "+ Add a quotation" button
- "Remove" button on quotation cards
- Quantity inputs in column 1
- "Award this bid" / "Unaward" button
- Header edit fields (currency, target branch, notes)

Always visible regardless of status: bid row, column 1 preview (read-only), column 2 quotation
cards with their lines (checkboxes just disabled).

---

## 9. Caching

Introduce a small module-level TTL cache at `src/utils/requestCache.ts`. Shape:

```ts
// Map<cacheKey, { data: unknown; fetchedAt: number }>
// TTL: 60 000 ms
```

Helper:

```ts
export async function cachedFetch<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlMs = 60_000,
): Promise<T>
```

**Cache these calls:**
- `getQuotation(id)` — key: `quotation-${id}`
- "Add a quotation" modal results — key: `quotations-${supplierId}-p${page}-ps${pageSize}-${search}`

**Do not cache:**
- Bid items (`getBid`) — mutate on every checkbox action; always fetch fresh or update
  optimistically from the mutation response.
- PO detail (`getPurchaseOrder`) — same reason.

No manual invalidation needed. A ~60s staleness window is acceptable because nothing on this
screen edits quotations (that happens on `QuotationsScreen` only).

---

## 10. Callers to update for paginated `GET /api/quotations`

The backend is changing `GET /api/quotations` to return `PagedResult<QuotationSummary>` instead of
`QuotationSummary[]`. **Every existing caller must be updated in the same change:**

| File | What to update |
|---|---|
| `src/api/quotationsApi.ts` | Change `listQuotations` return type to `PagedResult<QuotationSummary>`; add `page`, `pageSize`, `search` to `QuotationListQuery` |
| `src/screens/QuotationsScreen.tsx` | Switch from flat-array rendering to paginated rendering (reuse existing `Pagination` component + `PagedQuery` pattern from `SuppliersScreen`) |
| `src/screens/SupplierBidComposerContent.tsx` | Update to handle paginated response — this will change anyway as part of the shared-component refactor (section 7) |

---

## 11. Things to remove

Clean these up as part of this change — they become dead code:

| What | Where |
|---|---|
| Line Items add/edit/delete form | `PurchaseOrderComposerScreen` (`PurchaseOrderEditor`) |
| `addLineItem`, `updateLineItem`, `deleteLineItem` | `src/api/purchaseOrdersApi.ts` |
| `attachSupplierBid` `isPrimary` param | `src/api/purchaseOrdersApi.ts` (remove param; always attaches non-primary now) |
| `setPrimarySupplierBid` | `src/api/purchaseOrdersApi.ts` |
| `BidManager` component | `src/components/BidManager.tsx` (unused since last refactor) |
| `PurchaseOrderEditor` sub-component | `PurchaseOrderComposerScreen.tsx` (keep only the `isNew` create form) |
| Old "Attached Supplier Bids" table | Already removed in previous refactor |

---

## 12. Loading, empty, and error states

Follow the existing per-screen convention throughout:

- **Initial PO load:** full-screen spinner/skeleton (existing pattern in `PurchaseOrderDetailScreen`)
- **Bid detail fetch** (when switching selected bid): spinner in col 1's line items area; col 2
  shows its existing content or its own spinner
- **Modal results table:** spinner/skeleton in the results region on initial fetch and on each
  page/search change
- **Modal preview pane:** independent spinner when a different row is selected
- **Empty states:**
  - Bid row: "No bids attached yet — add one to get started."
  - Column 2: "No quotations added yet — use the button below to add one."
  - Modal results: "No quotations found for this supplier." / "No results for '{query}'."
- **Toasts on failure** for: attach/detach bid, check/uncheck a line, quantity update,
  award/un-award, add/remove quotation card — same `Toast` component and `kind: 'error'` pattern
  used elsewhere.

---

## 13. E2E tests

The following existing e2e specs will break and need rewriting:

- Any spec that creates a PO with manual line items (direct-entry path is gone)
- Any spec that calls `set-primary` (endpoint removed; use `awarded-bid` instead)
- The `BidManager` interaction tests (component removed)

Rewrite these to use the new flow: attach bid → check quotation lines → award → submit.
