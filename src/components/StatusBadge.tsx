import type { PurchaseOrderStatus } from '../api/purchaseOrdersApi';
import type { ApprovalStatus } from '../api/approvalsApi';

/** Maps a PO or approval status string to its themed badge modifier class. */
const STATUS_CLASS: Record<PurchaseOrderStatus | ApprovalStatus, string> = {
  Draft: 'badge-muted',
  Open: 'badge-info',
  Approved: 'badge-success',
  Rejected: 'badge-danger',
  Cancelled: 'badge-muted',
  Pending: 'badge-info',
  Skipped: 'badge-muted',
};

interface StatusBadgeProps {
  status: PurchaseOrderStatus | ApprovalStatus;
}

/** Coloured pill for a PO or approval status, reusing the shared .badge styles. */
export function StatusBadge({ status }: StatusBadgeProps) {
  return <span className={`badge ${STATUS_CLASS[status] ?? 'badge-muted'}`}>{status}</span>;
}
