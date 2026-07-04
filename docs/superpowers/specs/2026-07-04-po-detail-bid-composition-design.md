# PO Detail Screen Redesign: Bid-Only Composition

**Status:** Draft — under discussion, not yet approved
**Date:** 2026-07-04

## Background

Today, `PurchaseOrderDetailScreen` (read-only) and `PurchaseOrderComposerScreen` (Draft editing) are
separate screens, and a Draft PO can acquire line items two ways: manual direct entry
(`POST/PUT/DELETE /purchase-orders/:id/line-items`) or via an awarded Supplier Bid. This doc
redesigns the PO detail/edit experience so that **all PO lines must originate from a Supplier Bid**,
which in turn must be sourced from Quotation lines (already enforced for bid items as of the
"quotation-sourced lines only" change).

## Findings from the current backend (`purchase_order_management_api`)

- **When line items actually materialize:** not at Draft→Open (submit). It happens at final
  approval — `ApprovalService.CompletePurchaseOrderApprovalAsync` (`ApprovalService.cs:210-249`)
  runs when the last pending `Approval` clears, flips status to `Approved`, and only then copies
  `SupplierBidItem` rows into `PurchaseOrderLineItem` rows, keyed off `po.AwardedSupplierBidId`.
  `SubmitAsync` (`PurchaseOrderService.cs:512-546`) just requires a bid attached + (awarded bid OR
  existing line items) + approvals defined, then flips to `Open` — no copying there.

- **Two disconnected "which bid wins" mechanisms exist today:**
  - `PurchaseOrderSupplierBid.IsPrimary` — set via `PATCH .../supplier-bids/:bidId/set-primary`,
    which is what the *current* `BidComparisonPanel` "Award this bid" button calls.
  - `PurchaseOrder.AwardedSupplierBidId` — set via `POST .../awarded-bid`, which is what
    `CompletePurchaseOrderApprovalAsync` actually reads to decide which bid's items to copy.

  Setting one doesn't set the other. Awarding a bid from the current detail screen (`set-primary`)
  may never cause line items to materialize at approval, since nothing sets `AwardedSupplierBidId`.
  This redesign collapses these into one mechanism (see Backend Changes, #3).

- **`SupplierBid` has no status/draft flag today** — just "attached to a PO or not" (nullable
  `PurchaseOrderId`). `BidService.AddItemAsync` / `UpdateItemAsync` (and by the same pattern,
  delete/seed) do **not** check the owning PO's status at all, despite comments elsewhere in the
  codebase stating "composition is frozen once it leaves Draft." A bid's items can technically
  still be edited via the API even after its PO has left Draft. Since `PurchaseOrderLineItem`
  already serves as the frozen snapshot taken at approval time (nothing re-reads the source bid
  after that), fixing this doesn't require bid versioning/forking — just closing the gap so the
  bid itself can't drift after its PO leaves Draft.

- **`GET /api/quotations` has no pagination or search today** — `QuotationListQuery` only supports
  `supplierId` / `isExpired` / `isUsed`; `listQuotations` returns a flat `QuotationSummary[]`, not a
  `PagedResult<T>`. A supplier can accumulate hundreds of quotations over months/years, so the new
  "Add a quotation" modal (section 6) needs this to become paginated and server-searched, mirroring
  the existing `SuppliersScreen` pattern (`search` query param + `PagedResult<T>`).

## Decisions made in discussion

1. **Multi-bid comparison is retained.** A Draft PO can have several candidate bids attached at
   once (one per supplier — the existing "duplicate supplier" check already prevents two bids from
   the same supplier on one PO). The scrollable row shows all attached bids; exactly one is
   ultimately awarded.
2. **Bid draft/lock is a stored status on `SupplierBid` itself**, not derived by joining to the
   owning PO. Trigger: *every* bid attached to a PO flips from Draft to locked at the exact moment
   that PO's `SubmitAsync` runs (Draft→Open) — not just the eventual awarded one. A standalone
   (unattached) bid stays Draft indefinitely.
3. **Manual PO line items are removed at the backend, not just hidden in the UI.** The direct-entry
   line-item endpoints and the "direct-entry PO" concept go away entirely; every PO becomes
   bid-based.
4. **The PO Preview card (column 1) follows whichever bid is selected in the row** — selecting a
   bid shows/edits *that* bid's composition as a live "if awarded, this is the PO" preview.
   Switching the selection swaps the preview. This is what makes side-by-side comparison possible.
   A separate, explicit "Award this bid" action is what actually commits which bid becomes THE bid
   — selecting a card to view/edit it commits nothing.
5. **Column 2 is a curated working set, not a full dump of the supplier's quotations.** On
   selecting a bid, column 2 auto-populates with only the quotations already referenced by that
   bid's *current* items (derived, so reopening an existing bid doesn't lose your place). An
   explicit "Add a quotation" action (modal) brings another quotation card into the working set; an
   explicit "Remove" takes one back out.
6. **Removing a quotation that still has checked lines cascade-deletes those bid items, behind a
   confirmation dialog.** If it has zero checked lines, removal is instant with no confirmation —
   matches the app's existing destructive-action pattern (`ConfirmDialog`) elsewhere.
7. **The "Add a quotation" modal's left column is a paginated, server-searched table** (not a
   client-side full-fetch + `scoreMatch` filter), using the existing `Pagination` component,
   because a supplier's quotation history can run into the hundreds over time.

## 1. Screen consolidation

The two-column layout **replaces both** the current `PurchaseOrderComposerScreen` edit-phase and
the current `PurchaseOrderDetailScreen` — one screen, all statuses, gated by Draft-ness. The
separate "new PO" header form (company, target branch, currency, type) stays as-is; submitting it
still lands you on this screen for the rest of the PO's life. `PurchaseOrderPrintScreen` is
untouched (still a distinct print view).

## 2. Layout

```
[ Bid A (Draft) ✕ ] [ Bid B ✕ ] [ Bid C (Draft) ✕ ] [ + Add bid ]   ← horizontally scrollable row
┌─────────────────────────┬───────────────────────────┐
│  PO Preview / Bid         │  Quotations (col 2)        │
│  editor (col 1)           │  vertically scrollable       │
│                           │                             │
│  - reflects whichever     │  [+ Add a quotation]         │
│    bid is selected above  │                             │
│  - qty-only editing       │  ┌───────────────────────┐  │
│  - "Award this bid" CTA   │  │ Quotation card         │  │
│                           │  │  - lines w/ checkboxes │  │
│                           │  │  - [Remove] button     │  │
│                           │  └───────────────────────┘  │
│                           │  ┌───────────────────────┐  │
│                           │  │ Quotation card         │  │
│                           │  └───────────────────────┘  │
└─────────────────────────┴───────────────────────────┘
```

Each bid card in the row shows: supplier name, per-currency total vector, item count, a **"Draft"
badge** when `SupplierBid.Status == Draft`, an **"Awarded"** badge on the awarded bid, and a
**remove (✕) button**.

## 3. Interaction model

### Bid row
- Selecting a bid card = "I'm viewing/editing this candidate." It does **not** commit anything.
- The remove (✕) button on a card calls `detachSupplierBid`. Visible/enabled only while the PO is
  Draft **and** no bid in the row has been awarded yet (matches the existing "once a primary/awarded
  bid exists, the set is locked" rule — see Backend Changes, #3).
- **"Award this bid"** is the one explicit commit action, calling `SelectAwardedBidAsync`
  (`POST .../awarded-bid`) exclusively — see Backend Changes, #3 for why this replaces the current
  split `set-primary`/`awarded-bid` mechanism.
- Once awarded, the bid row and attach/detach lock entirely.

### Column 1 (PO Preview)
- Re-renders live from the selected bid's items.
- Quantity fields edit `SupplierBidItem.Quantity` directly (existing `updateBidItem`, quantity-only
  — same restriction as today's composer). Editable only while the selected bid is `Draft`.

### Column 2 (Quotations working set)
- Auto-populated with the distinct quotations referenced by the selected bid's current items.
- **"Add a quotation"** button (visible only while the selected bid is `Draft`) opens the modal in
  section 6.
- Each quotation card shows its line items with a checkbox per line (checking calls `addBidItem`
  against the selected bid; unchecking calls `deleteBidItem`) and a **"Remove"** button for the
  whole card.
  - Checkboxes are `disabled` (rendered, not hidden) whenever the selected bid is not `Draft`, so
    the composition remains visible/auditable after the fact.
  - "Remove" on a card with zero checked lines: instant, no confirmation.
  - "Remove" on a card with one or more checked lines: shows a `ConfirmDialog` ("This will remove N
    line item(s) from this bid"); confirming calls `deleteBidItem` for each, then drops the card.
    Visible only while the selected bid is `Draft`.

## 4. "Add supplier bid" modal

Build both paths in one modal:

1. **Pick a supplier** (typeahead, filtered to exclude suppliers who already have a bid attached
   to this PO — sidesteps the existing "duplicate supplier" conflict instead of erroring after the
   fact).
2. Once picked, show that supplier's existing **unattached** bids (if any) as selectable rows,
   alongside a prominent "**Start a new bid for {Supplier}**" option.
   - Existing unattached bids are always safe to reuse here: since a bid only ever belongs to one
     PO (nullable FK, not many-to-many) and locks the moment its owning PO leaves Draft, anything
     showing up as "unattached" is guaranteed to still be Draft/editable.
   - Picking an existing one calls `attachBidToPurchaseOrder`; "start new" calls `createBid`.
     Either way the modal closes and the new/attached bid is selected in the row.

## 5. "Add a quotation" modal

Triggered from column 2. Two-column layout:

- **Left column:** a search bar plus a **paginated table** of results (reusing the existing
  `Pagination` component, small default page size suited to a modal, e.g. 10), scoped to the
  selected bid's supplier. Search text is debounced (~300ms) before firing a server request;
  changing the search text resets to page 1 (mirrors `SuppliersScreen`). Quotations already present
  in column 2's working set are excluded from the results — no point offering to re-add what's
  already there. Expired quotations are shown, not hidden, with the existing
  `badge-danger` treatment (nothing in the backend blocks sourcing a bid item from an expired
  quotation today, so the UI stays consistent with that).
- **Right column:** preview of the currently-selected row — reference, quote date, expiry badge,
  currency, line items table, subtotal/tax/discount/grand total, and the file preview (PDF/image
  inline, same as `QuotationsScreen`'s existing preview capability).
- **Confirm** button, disabled until a row is selected. Confirming adds just the quotation *card* to
  column 2 — it does not pre-check any lines; that happens back in column 2 itself.

This modal's left-column browsing (paginated list scoped to one supplier) does the same job as
`SupplierBidComposerContent`'s existing left column, just with a preview pane and pagination added
— worth building as a shared component both places use (see Open Items).

## 6. Draft-only gating (full list)

Visible/enabled only when the **selected bid** is `Draft` (and the PO is still open for
composition):

- "+ Add bid" affordance in the row
- Remove (✕) button on bid cards (also requires: no bid yet awarded)
- Quotation line checkboxes in column 2 (rendered, but `disabled` otherwise)
- "Add a quotation" / "Remove" quotation-card buttons in column 2
- Quantity inputs in column 1
- "Award this bid" button
- Header fields (currency, target branch, notes) — as today

Always visible regardless of status: the bid row itself (read-only history of what was compared,
including the Draft/Awarded badges), column 1's preview (read-only once not Draft), column 2
(quotation cards and their lines, checkboxes just disabled) — so you can still see *why* a bid was
chosen, post-hoc.

## 7. Caching

This codebase has no caching layer today (no state library, no request-cache utility anywhere), so
this introduces a new small, self-contained pattern: a module-level TTL cache (e.g.
`utils/requestCache.ts`, a `Map` keyed by a request signature storing `{ data, fetchedAtUtc }`).

- **Cached, TTL ~60s:**
  - The "Add a quotation" modal's paginated/searched results — key = `supplierId + page + pageSize +
    search`.
  - Individual quotation detail fetches (`getQuotation(id)`) used by the right-column preview and by
    column 2's card rendering.
- **Not cached:** bid items — these mutate constantly as lines get checked/unchecked, so always
  fetch fresh or update optimistically from the mutation response.
- Pure time-based expiry, no manual invalidation hooks — acceptable since nothing on this screen
  edits quotations (that only happens on the separate `QuotationsScreen`), so a ~60s staleness
  window is a reasonable trade-off, not a correctness risk.

## 8. Loading, empty, and error states

- Modal's initial paginated fetch: loading state in the results table (skeleton/spinner), same
  region used for subsequent page/search changes.
- Preview pane: its own loading state when a different row is selected, independent of the results
  table's loading state.
- Empty states: supplier has zero quotations at all ("No quotations yet for this supplier"); search
  yields nothing for the current query/page.
- Toasts on failure for: add/remove quotation, check/uncheck a line, quantity update, award, add/
  remove bid — matching the existing per-screen toast convention.

## 9. Backend changes to hand to the API team

1. `SupplierBid.Status` (new column) — e.g. `Draft` / `Locked` (name negotiable). Enforce in
   `AddItemAsync`, `UpdateItemAsync`, `DeleteItemAsync`, `SeedItemsFromQuotationAsync` — reject if
   not `Draft`.
2. Trigger: **every** bid attached to a PO flips `Draft → Locked` at the moment that PO's
   `SubmitAsync` runs (Draft→Open) — not just the awarded one.
3. Remove `PurchaseOrderSupplierBid.IsPrimary` and the `PATCH .../set-primary` endpoint.
   `PurchaseOrder.AwardedSupplierBidId` (via `POST .../awarded-bid`) becomes the sole award
   mechanism.
4. Remove the direct-entry PO line-item endpoints (`POST/PUT/DELETE .../purchase-orders/:id/line-items`)
   and the "direct-entry PO" concept. `PurchaseOrderLineItem.SourceSupplierBidItemId` could become
   non-nullable as a follow-up cleanup (optional — leaving it nullable but always-populated is
   lower risk).
5. `GET /api/quotations` needs `page`, `pageSize`, and `search` query params, returning
   `PagedResult<QuotationSummary>` instead of a flat array — mirrors the existing `SuppliersScreen`
   server-side search pattern. `supplierId`/`isExpired`/`isUsed` filters stay as-is, combined with
   the new params.
6. **Not changing:** `hasMultiCurrencyTotals`/`totals` vector logic — that's about whether a bid's
   items span multiple currencies, orthogonal to direct-vs-bid-based, and stays exactly as-is.
7. Data cleanup needed: dev-seed Draft POs with zero attached bids (e.g. PO-0001, PO-0005,
   PO-0009, PO-0013, PO-0014 in the seed data observed) have nothing to migrate since they never
   had manual lines — but worth double-checking there's no dev/prod data with actual manual line
   items that'd need a real migration plan.

## Open items / risks

- e2e tests (`e2e/`) almost certainly exercise the old composer's manual-line-item flow and the old
  `set-primary` action — those will need rewriting regardless of who does the backend work.
- The existing standalone bid-creation flow (`SupplierBidComposerContent`, used by
  `/supplier-bids/new` and its modal) does the same "browse a supplier's quotations" job as the new
  "Add a quotation" modal. Worth unifying into one shared component rather than maintaining two —
  flagging as a nice-to-have, not a blocker.
- `GET /api/quotations` becoming paginated is itself a breaking response-shape change
  (`QuotationSummary[]` → `PagedResult<QuotationSummary>`) — every existing caller
  (`QuotationsScreen`, `SupplierBidComposerContent`) needs updating in the same change, not just the
  new modal.

## Status

Awaiting review. Not yet approved — no implementation should start from this doc until it's
confirmed.
