import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  cancelPurchaseOrder,
  deliverPurchaseOrder,
  getPurchaseOrder,
  payPurchaseOrder,
} from '../api/purchaseOrdersApi';
import type { PurchaseOrderDetail } from '../api/purchaseOrdersApi';
import {
  approveApproval,
  getMyApprovals,
  rejectApproval,
} from '../api/approvalsApi';
import type { ApprovalDto } from '../api/approvalsApi';
import { getErrorMessage } from '../api/errorMessage';
import { BidCard } from '../components/BidCard';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { StatusBadge } from '../components/StatusBadge';
import { Toast } from '../components/Toast';
import type { ToastMessage } from '../components/Toast';
import { formatDate, formatMoney, formatMoneyVector } from '../utils/format';
import './admin/admin.css';

export function PurchaseOrderDetailScreen() {
  const { id } = useParams<{ id: string }>();
  const poId = Number(id);

  const [po, setPo] = useState<PurchaseOrderDetail | null>(null);
  const [actionableIds, setActionableIds] = useState<Set<number>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  // Inline approve/reject UI state, keyed by approval id.
  const [commentByApproval, setCommentByApproval] = useState<Record<number, string>>({});
  const [busyApprovalId, setBusyApprovalId] = useState<number | null>(null);

  const [isMilestoneBusy, setIsMilestoneBusy] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      // Actionability comes straight from /approvals/mine (server enforces eligibility +
      // sequence gating); we just match ids — no client-side sequence logic.
      const [detail, mine] = await Promise.all([getPurchaseOrder(poId), getMyApprovals()]);
      setPo(detail);
      setActionableIds(new Set(mine.map((m) => m.id)));
    } catch (err) {
      setLoadError(getErrorMessage(err, 'Failed to load the purchase order.'));
    } finally {
      setIsLoading(false);
    }
  }, [poId]);

  useEffect(() => {
    if (Number.isNaN(poId)) {
      setLoadError('Invalid purchase order id.');
      setIsLoading(false);
      return;
    }
    void load();
  }, [load, poId]);

  const handleApprovalAction = async (approval: ApprovalDto, action: 'approve' | 'reject') => {
    setBusyApprovalId(approval.id);
    const comment = commentByApproval[approval.id]?.trim() || undefined;
    try {
      if (action === 'approve') {
        await approveApproval(approval.id, { comment, rowVersion: approval.rowVersion });
        setToast({ kind: 'success', text: 'Approval recorded.' });
      } else {
        await rejectApproval(approval.id, { comment, rowVersion: approval.rowVersion });
        setToast({ kind: 'success', text: 'Rejection recorded.' });
      }
      await load();
    } catch (err) {
      setToast({ kind: 'error', text: getErrorMessage(err, 'Failed to act on the approval.') });
    } finally {
      setBusyApprovalId(null);
    }
  };

  const runMilestone = async (
    fn: (id: number) => Promise<PurchaseOrderDetail>,
    successText: string,
    failText: string,
  ) => {
    setIsMilestoneBusy(true);
    try {
      const updated = await fn(poId);
      setPo(updated);
      setToast({ kind: 'success', text: successText });
    } catch (err) {
      setToast({ kind: 'error', text: getErrorMessage(err, failText) });
    } finally {
      setIsMilestoneBusy(false);
    }
  };

  const handleCancel = async () => {
    setIsCancelling(true);
    try {
      const updated = await cancelPurchaseOrder(poId);
      setPo(updated);
      setToast({ kind: 'success', text: 'Purchase order cancelled.' });
      setConfirmCancel(false);
    } catch (err) {
      setToast({ kind: 'error', text: getErrorMessage(err, 'Failed to cancel the purchase order.') });
      setConfirmCancel(false);
    } finally {
      setIsCancelling(false);
    }
  };

  if (isLoading) {
    return (
      <section className="po-detail">
        <div className="admin-panel">
          <div className="admin-loading">Loading purchase order…</div>
        </div>
      </section>
    );
  }

  if (loadError || !po) {
    return (
      <section className="po-detail">
        <Link to="/purchase-orders" className="po-back-link">
          ← Back to purchase orders
        </Link>
        <div className="admin-panel">
          <div className="admin-error" role="alert">
            {loadError ?? 'Purchase order not found.'}
          </div>
        </div>
      </section>
    );
  }

  // Cancel allowed from Draft/Open/Approved and only while not yet paid (docs/03).
  const canCancel =
    (po.status === 'Draft' || po.status === 'Open' || po.status === 'Approved') && !po.paidAtUtc;
  const canRecordMilestones = po.status === 'Approved';

  return (
    <section className="po-detail">
      <Link to="/purchase-orders" className="po-back-link">
        ← Back to purchase orders
      </Link>

      <div className="po-detail-header">
        <h2>{po.poNumber}</h2>
        <StatusBadge status={po.status} />
        <Link to={`/purchase-orders/${po.id}/print`} className="btn btn-secondary">
          Print / Export PDF
        </Link>
      </div>

      <div className="admin-panel" style={{ padding: '1rem' }}>
        <div className="po-meta">
          <div className="po-meta-item">
            <span className="po-meta-label">Company</span>
            <span>{po.companyName}</span>
          </div>
          <div className="po-meta-item">
            <span className="po-meta-label">Issuer</span>
            <span>{po.issuerUserName}</span>
          </div>
          <div className="po-meta-item">
            <span className="po-meta-label">Currency</span>
            <span>{po.currency}</span>
          </div>
          {po.targetCompanyName && (
            <div className="po-meta-item">
              <span className="po-meta-label">For</span>
              <span>{po.targetCompanyName}</span>
            </div>
          )}
          {po.purchaseOrderTypeName && (
            <div className="po-meta-item">
              <span className="po-meta-label">Type</span>
              <span>{po.purchaseOrderTypeName}</span>
            </div>
          )}
          <div className="po-meta-item">
            <span className="po-meta-label">Created</span>
            <span>{formatDate(po.createdAtUtc)}</span>
          </div>
        </div>

        <div className="po-chips" style={{ marginTop: '1rem' }}>
          <span className={`po-chip ${po.paidAtUtc ? 'po-chip-set' : ''}`}>
            {po.paidAtUtc ? `Paid ${formatDate(po.paidAtUtc)}` : 'Not paid'}
          </span>
          <span className={`po-chip ${po.deliveredAtUtc ? 'po-chip-set' : ''}`}>
            {po.deliveredAtUtc ? `Delivered ${formatDate(po.deliveredAtUtc)}` : 'Not delivered'}
          </span>
        </div>
      </div>

      {/* Totals */}
      <div className="admin-panel po-section" style={{ padding: '1rem' }}>
        <h3>Totals</h3>
        {po.hasMultiCurrencyTotals ? (
          <div className="po-totals">
            <div className="po-total-item po-total-grand">
              <span className="po-meta-label">Total (by currency)</span>
              <span className="po-total-value" data-testid="po-total">
                {formatMoneyVector(po.totals)}
              </span>
            </div>
          </div>
        ) : (
          <div className="po-totals">
            <div className="po-total-item">
              <span className="po-meta-label">Subtotal</span>
              <span className="po-total-value">{formatMoney(po.subtotal, po.currency)}</span>
            </div>
            <div className="po-total-item">
              <span className="po-meta-label">Tax</span>
              <span className="po-total-value">{formatMoney(po.taxAmount, po.currency)}</span>
            </div>
            <div className="po-total-item po-total-grand">
              <span className="po-meta-label">Total</span>
              <span className="po-total-value" data-testid="po-total">
                {formatMoney(po.totalAmount, po.currency)}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      {(canRecordMilestones || canCancel) && (
        <div className="admin-panel po-section" style={{ padding: '1rem' }}>
          <h3>Actions</h3>
          <div className="po-actions">
            {canRecordMilestones && !po.paidAtUtc && (
              <button
                type="button"
                className="btn btn-primary"
                disabled={isMilestoneBusy}
                onClick={() =>
                  void runMilestone(payPurchaseOrder, 'Marked as paid.', 'Failed to mark paid.')
                }
              >
                Mark Paid
              </button>
            )}
            {canRecordMilestones && !po.deliveredAtUtc && (
              <button
                type="button"
                className="btn btn-primary"
                disabled={isMilestoneBusy}
                onClick={() =>
                  void runMilestone(
                    deliverPurchaseOrder,
                    'Marked as delivered.',
                    'Failed to mark delivered.',
                  )
                }
              >
                Mark Delivered
              </button>
            )}
            {canCancel && (
              <button
                type="button"
                className="btn btn-danger"
                disabled={isMilestoneBusy}
                onClick={() => setConfirmCancel(true)}
              >
                Cancel PO
              </button>
            )}
          </div>
        </div>
      )}

      {/* Supplier bids (read-only) */}
      {po.supplierBids.length > 0 && (
        <div className="admin-panel po-section" style={{ padding: '1rem' }}>
          <h3>Supplier Bids</h3>
          <div className="bid-card-grid">
            {po.supplierBids.map((bid) => (
              <BidCard
                key={bid.id}
                bid={bid}
                isAwarded={bid.id === po.awardedSupplierBidId}
              />
            ))}
          </div>
        </div>
      )}

      {/* Line items */}
      <div className="admin-panel po-section" style={{ padding: '1rem' }}>
        <h3>Line Items</h3>
        {po.lineItems.length === 0 ? (
          <div className="admin-empty">
            No line items yet.
            {po.supplierBids.length > 0
              ? ' For a bid-based PO these are created once it is approved.'
              : ''}
          </div>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>Description</th>
                <th>Qty</th>
                <th>Unit cost</th>
                <th>Discount</th>
                <th>Tax</th>
                <th>Line total</th>
              </tr>
            </thead>
            <tbody>
              {po.lineItems.map((li) => (
                <tr key={li.id}>
                  <td>{li.description}</td>
                  <td>{li.quantity}</td>
                  <td>{formatMoney(li.unitCost, po.currency)}</td>
                  <td>{formatMoney(li.discountAmount, po.currency)}</td>
                  <td>{formatMoney(li.taxAmount, po.currency)}</td>
                  <td>{formatMoney(li.lineTotal, po.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Approvals */}
      <div className="admin-panel po-section" style={{ padding: '1rem' }}>
        <h3>Approvals</h3>
        {po.approvals.length === 0 ? (
          <div className="admin-empty">No approvals defined.</div>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>Target</th>
                <th>Sequence</th>
                <th>Status</th>
                <th>Actor</th>
                <th>Comment</th>
              </tr>
            </thead>
            <tbody>
              {po.approvals.map((approval) => {
                const target =
                  approval.requiredUserName ??
                  approval.requiredRoleName ??
                  (approval.requiredUserId
                    ? `User #${approval.requiredUserId}`
                    : approval.requiredRoleId
                      ? `Role #${approval.requiredRoleId}`
                      : '—');
                const canAct = actionableIds.has(approval.id);
                return (
                  <tr key={approval.id}>
                    <td>{target}</td>
                    <td>{approval.sequenceOrder}</td>
                    <td>
                      <StatusBadge status={approval.status} />
                      {canAct && (
                        <div className="approval-act">
                          <textarea
                            placeholder="Comment (optional)"
                            value={commentByApproval[approval.id] ?? ''}
                            onChange={(e) =>
                              setCommentByApproval((prev) => ({
                                ...prev,
                                [approval.id]: e.target.value,
                              }))
                            }
                          />
                          <div className="approval-act-buttons">
                            <button
                              type="button"
                              className="btn btn-small btn-primary"
                              disabled={busyApprovalId === approval.id}
                              onClick={() => void handleApprovalAction(approval, 'approve')}
                            >
                              Approve
                            </button>
                            <button
                              type="button"
                              className="btn btn-small btn-danger"
                              disabled={busyApprovalId === approval.id}
                              onClick={() => void handleApprovalAction(approval, 'reject')}
                            >
                              Reject
                            </button>
                          </div>
                        </div>
                      )}
                    </td>
                    <td>{approval.approvedByUserName ?? '—'}</td>
                    <td>{approval.comment ?? '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {confirmCancel && (
        <ConfirmDialog
          title="Cancel purchase order"
          message={`Cancel ${po.poNumber}? This is terminal and cannot be undone.`}
          confirmLabel="Cancel PO"
          cancelLabel="Keep PO"
          isBusy={isCancelling}
          onConfirm={handleCancel}
          onCancel={() => setConfirmCancel(false)}
        />
      )}

      <div className="toast-stack">
        <Toast toast={toast} onDismiss={() => setToast(null)} />
      </div>
    </section>
  );
}
