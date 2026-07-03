# Reusable Component Catalog

All components in `src/components/`. Components are not styled with CSS Modules — they use the shared CSS classes from `src/screens/admin/admin.css` and `src/index.css`.

---

## BidCard

**File:** `src/components/BidCard.tsx`

Displays a supplier bid as a compact card, used in the bid-comparison grid and the `BidManager` component. Renders as a `<div>` when no `onClick` is provided, or as a `<button>` when one is — so the same component works in read-only contexts (the detail screen's panel) and interactive contexts (the composer).

### Props

```ts
interface BidCardProps {
  bid: SupplierBidSummary;
  isAwarded: boolean;
  onClick?: () => void;
}
```

| Prop | Type | Description |
|---|---|---|
| `bid` | `SupplierBidSummary` | The bid to display |
| `isAwarded` | `boolean` | When true, adds `bid-card-awarded` class (success border) and an "Awarded" badge |
| `onClick` | `() => void` (optional) | If provided, the card is rendered as a `<button>` with `bid-card-clickable` class |

### Content

- Supplier name (bold)
- Per-currency total vector via `formatMoneyVector`
- Item count and quotation count ("N items · N quotations")
- Badges: "Awarded" (green), "Unattached" (muted, when `bid.purchaseOrderId === null`), "Expired quotation" (danger), or expiry date (warning)

### Example

```tsx
<BidCard
  bid={summaryObj}
  isAwarded={summaryObj.id === po.awardedSupplierBidId}
  onClick={() => setOpenBidId(summaryObj.id)}
/>
```

---

## BidComparisonPanel

**File:** `src/components/BidComparisonPanel.tsx`

The bid comparison UI on the `PurchaseOrderDetailScreen`. Fetches full bid details on demand when the user selects a card. See the screen documentation for a detailed description.

### Props

```ts
export interface BidComparisonPanelProps {
  po: PurchaseOrderDetail;
  canAward: boolean;
  busyPrimaryBidId: number | null;
  onAward: (supplierBidId: number) => void;
  pendingApprovalCount: number;
  firstPendingTarget: string | null;
  isApproveBlocked: boolean;
}
```

| Prop | Type | Description |
|---|---|---|
| `po` | `PurchaseOrderDetail` | Full PO detail including `attachedSupplierBids` and `supplierBids` |
| `canAward` | `boolean` | Whether the current user can click "Award this bid" |
| `busyPrimaryBidId` | `number \| null` | Id of a bid currently being awarded (disables its button) |
| `onAward` | `(id: number) => void` | Called when the user clicks "Award this bid" |
| `pendingApprovalCount` | `number` | Used for the approval status summary |
| `firstPendingTarget` | `string \| null` | Name/role of the first pending approver |
| `isApproveBlocked` | `boolean` | When true, shows a hint that a primary bid must be set first |

### Behaviour

- Returns `null` when there are no attached bids.
- Bid cards use `role="radiogroup"` / `role="radio"` with keyboard support (Enter/Space).
- The preview section calls `GET /api/supplier-bids/:id` each time the selection changes. While loading, shows `.admin-loading`; on error, shows a blank preview (non-fatal).
- The "Award this bid" button is hidden when the selected bid is already the primary.

---

## BidManager

**File:** `src/components/BidManager.tsx`

Complex interactive component used inside `PurchaseOrderComposerScreen` for managing bids attached to a Draft PO. Provides:

- A grid of `BidCard` tiles for existing bids (clicking opens `BidPreview`).
- A "+ New bid" mini-form (supplier picker + notes) that calls `POST /api/purchase-orders/:poId/bids`.
- An "Attach existing bid" form that loads unattached bids and calls `POST /api/supplier-bids/:id/attach`.
- `BidPreview` (internal component) — a `modal-card` overlay that shows the bid's items, inline edit form for existing items, all of the supplier's quotations, a "Capture quotation" form (`QuotationCaptureForm`), a "Seed bid items" button, and a "Select as winner" button.

The `QuotationCaptureForm` (also internal to `BidManager`) handles file upload + quotation field entry. It includes a "Populate from file" button that opens a stub modal ("Feature coming soon") — this is a placeholder with no backend call.

### Props

```ts
interface BidManagerProps {
  purchaseOrderId: number;
  awardedSupplierBidId: number | null;
  onAwarded: () => void;
}
```

| Prop | Type | Description |
|---|---|---|
| `purchaseOrderId` | `number` | PO to manage bids for |
| `awardedSupplierBidId` | `number \| null` | Current awarded bid (for the Awarded badge) |
| `onAwarded` | `() => void` | Called after awarding so the parent can silently refresh the PO |

---

## ConfirmDialog

**File:** `src/components/ConfirmDialog.tsx`

Small modal confirmation prompt for destructive actions (delete, cancel, reset password). The backdrop click dismisses via `onCancel`.

### Props

```ts
interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmLabel?: string;     // defaults to 'Confirm'
  cancelLabel?: string;      // defaults to 'Cancel'
  isBusy?: boolean;          // disables both buttons and changes confirm label to 'Working…'
  onConfirm: () => void;
  onCancel: () => void;
}
```

### Accessibility

- `role="alertdialog"`, `aria-modal="true"`, `aria-labelledby="confirm-dialog-title"`.
- The Cancel button comes before the Confirm button (tab order follows DOM order).

### Example

```tsx
{deletingItem && (
  <ConfirmDialog
    title="Delete supplier"
    message={`Delete "${deletingItem.supplierName}"?`}
    confirmLabel="Delete"
    isBusy={isDeleting}
    onConfirm={handleDelete}
    onCancel={() => setDeletingItem(null)}
  />
)}
```

---

## FileUpload

**File:** `src/components/FileUpload.tsx`

Controlled file picker that uploads immediately on file selection via `POST /api/files` (multipart/form-data). Notifies the parent only after the upload succeeds.

### Props

```ts
interface FileUploadProps {
  onUploaded: (file: UploadedFile) => void;
  onClear?: () => void;
  disabled?: boolean;
  accept?: string;
  label?: string;            // defaults to 'Attach file'
}
```

| Prop | Type | Description |
|---|---|---|
| `onUploaded` | `(file: UploadedFile) => void` | Called with the API-resolved file object after a successful upload |
| `onClear` | `() => void` (optional) | Called when the user picks a new file, before the new upload starts |
| `disabled` | `boolean` | Disables the input |
| `accept` | `string` | `accept` attribute passed to `<input type="file">` |
| `label` | `string` | `aria-label` for the input |

### Behaviour

- Shows file name and size after selection, "Uploading…" while in flight.
- After a successful upload, shows a "View" link using `uploaded.url` (API-resolved, not constructed client-side).
- Shows an inline error on upload failure.
- Does **not** set `Content-Type` on the request — the browser computes it including the multipart boundary.

---

## Pagination

**File:** `src/components/Pagination.tsx`

See the full description in `02-architecture.md`. Used by `PurchaseOrdersScreen`, `SuppliersScreen`, `UsersScreen`, and `SupplierBidsScreen`.

### Props

```ts
interface PaginationProps {
  page: number;
  pageSize: number;
  totalCount: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  pageSizeOptions?: number[];    // defaults to [10, 25, 50, 100]
}
```

### Example

```tsx
<Pagination
  page={page}
  pageSize={pageSize}
  totalCount={totalCount}
  onPageChange={setPage}
  onPageSizeChange={setPageSize}
/>
```

---

## PurchaseOrderCard

**File:** `src/components/PurchaseOrderCard.tsx`

Document-style card rendering the full PO, including inline approval actions. See `PurchaseOrderDetailScreen` in `03-screens.md` for the full description.

### Props

```ts
export interface PurchaseOrderCardProps {
  po: PurchaseOrderDetail;
  actionableIds: Set<number>;
  commentByApproval: Record<number, string>;
  onCommentChange: (approvalId: number, comment: string) => void;
  onApprovalAction: (approval: ApprovalDto, action: 'approve' | 'reject') => void;
  busyApprovalId: number | null;
  isApproveBlocked: boolean;
  currentUser: { id: number; roles: string[] } | null;
}
```

| Prop | Type | Description |
|---|---|---|
| `po` | `PurchaseOrderDetail` | Full PO including `lineItems`, `approvals`, `supplierBids` |
| `actionableIds` | `Set<number>` | Set of approval ids the current user can act on (from `/approvals/mine`) |
| `commentByApproval` | `Record<number, string>` | Controlled comment text keyed by approval id |
| `onCommentChange` | function | Comment input handler |
| `onApprovalAction` | function | Approve or reject handler |
| `busyApprovalId` | `number \| null` | Disables buttons for the approval currently being processed |
| `isApproveBlocked` | `boolean` | Disables the Approve button and shows an error hint |
| `currentUser` | `{ id, roles } \| null` | Used to determine "in chain but not my turn" messaging |

### Accessibility

The inline approval action section uses a `<textarea>` for the comment and `<button>` for Approve/Reject. The Approve button has a `title` attribute when `isApproveBlocked` explains the reason for being disabled.

---

## StatusBadge

**File:** `src/components/StatusBadge.tsx`

Maps a PO or approval status string to a coloured pill badge.

### Props

```ts
interface StatusBadgeProps {
  status: PurchaseOrderStatus | ApprovalStatus;
}
```

`PurchaseOrderStatus` values: `'Draft'`, `'Open'`, `'Approved'`, `'Rejected'`, `'Cancelled'`

`ApprovalStatus` values: `'Pending'`, `'Approved'`, `'Rejected'`, `'Skipped'`

### Class mapping

| Status | Class |
|---|---|
| `Draft` | `badge-muted` |
| `Open` | `badge-info` |
| `Approved` | `badge-success` |
| `Rejected` | `badge-danger` |
| `Cancelled` | `badge-muted` |
| `Pending` | `badge-info` |
| `Skipped` | `badge-muted` |

### Example

```tsx
<StatusBadge status={po.status} />
```

---

## ThemeToggle

**File:** `src/components/ThemeToggle.tsx`

Three-button `role="group"` selector for the theme preference (System / Light / Dark). The active button has `aria-pressed="true"` and the `is-active` CSS class. Calls `useTheme().setPreference()` on click. Rendered in the `AppShell` header.

---

## Toast

**File:** `src/components/Toast.tsx`

Transient success/error banner for feedback on mutating actions. Each screen maintains its own `toast: ToastMessage | null` state and renders one `Toast`. Only one toast is visible at a time.

### Props

```ts
interface ToastProps {
  toast: ToastMessage | null;
  onDismiss: () => void;
}

interface ToastMessage {
  kind: 'success' | 'error';
  text: string;
}
```

When `toast` is null, the component renders nothing. Renders with `role="status"` and a dismiss button. The container class is `toast-${kind}` (i.e. `toast-success` or `toast-error`).

### Typical screen-level pattern

```tsx
const [toast, setToast] = useState<ToastMessage | null>(null);

// In an action handler:
setToast({ kind: 'success', text: 'Supplier deleted.' });
// or:
setToast({ kind: 'error', text: getErrorMessage(err, 'Failed to delete.') });

// In JSX:
<div className="toast-stack">
  <Toast toast={toast} onDismiss={() => setToast(null)} />
</div>
```
