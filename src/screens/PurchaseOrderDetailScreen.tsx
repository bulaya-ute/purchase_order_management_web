import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  cancelPurchaseOrder,
  deliverPurchaseOrder,
  getPurchaseOrder,
  payPurchaseOrder,
  setPrimarySupplierBid,
} from '../api/purchaseOrdersApi';
import type { PurchaseOrderDetail } from '../api/purchaseOrdersApi';
import {
  approveApproval,
  getMyApprovals,
  rejectApproval,
} from '../api/approvalsApi';
import type { ApprovalDto } from '../api/approvalsApi';
import { getErrorMessage } from '../api/errorMessage';
import { BidComparisonPanel } from '../components/BidComparisonPanel';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { PurchaseOrderCard } from '../components/PurchaseOrderCard';
import { Toast } from '../components/Toast';
import type { ToastMessage } from '../components/Toast';
import { useAuth } from '../auth/useAuth';
import './admin/admin.css';

export function PurchaseOrderDetailScreen() {
  const { id } = useParams<{ id: string }>();
  const poId = Number(id);
  const { user: currentUser } = useAuth();

  const [po, setPo] = useState<PurchaseOrderDetail | null>(null);
  const [actionableIds, setActionableIds] = useState<Set<number>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  // Inline approve/reject UI state, keyed by approval id.
  const [commentByApproval, setCommentByApproval] = useState<Record<number, string>>({});
  const [busyApprovalId, setBusyApprovalId] = useState<number | null>(null);
  const [busyPrimaryBidId, setBusyPrimaryBidId] = useState<number | null>(null);

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
      setToast({
        kind: 'error',
        text: getErrorMessage(err, 'Failed to cancel the purchase order.'),
      });
      setConfirmCancel(false);
    } finally {
      setIsCancelling(false);
    }
  };

  const handleSetPrimary = async (supplierBidId: number) => {
    setBusyPrimaryBidId(supplierBidId);
    try {
      await setPrimarySupplierBid(poId, supplierBidId);
      setToast({ kind: 'success', text: 'Primary supplier bid set. The bid list is now locked.' });
      await load();
    } catch (err) {
      setToast({ kind: 'error', text: getErrorMessage(err, 'Failed to set the primary bid.') });
    } finally {
      setBusyPrimaryBidId(null);
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

  // Supplier bid panel derived state.
  const isLocked = (po.attachedSupplierBids ?? []).some((b) => b.isPrimary);
  const isCreator = currentUser?.id === po.issuerUserId;

  // Any approver in the chain (not just current-stage) — for canAward.
  const isAnyApproverInChain = po.approvals.some((a) => {
    if (a.requiredUserId !== null) return a.requiredUserId === currentUser?.id;
    if (a.requiredRoleName !== null)
      return (currentUser?.roles ?? []).includes(a.requiredRoleName);
    return false;
  });

  const canAward = !isLocked && (isCreator || isAnyApproverInChain);

  // Approve is blocked when there are attached bids but no primary has been set.
  const hasAttachedBids = (po.attachedSupplierBids ?? []).length > 0;
  const isApproveBlocked = hasAttachedBids && !isLocked;

  // Pending approval count for the summary badge.
  const pendingApprovalCount = po.approvals.filter((a) => a.status === 'Pending').length;

  // First pending approver for the "blocked" message.
  const firstPendingApproval = [...po.approvals]
    .filter((a) => a.status === 'Pending')
    .sort((a, b) => a.sequenceOrder - b.sequenceOrder)[0];
  const firstPendingTarget = firstPendingApproval
    ? (firstPendingApproval.requiredUserName ??
      firstPendingApproval.requiredRoleName ??
      'next approver')
    : null;

  return (
    <section className="po-detail">
      <Link to="/purchase-orders" className="po-back-link">
        ← Back to purchase orders
      </Link>

      {/* Actions bar */}
      {(canRecordMilestones || canCancel) && (
        <div className="po-actions-bar">
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
      )}

      {/* Bid comparison panel */}
      {(po.attachedSupplierBids ?? []).length > 0 && (
        <BidComparisonPanel
          po={po}
          canAward={canAward}
          busyPrimaryBidId={busyPrimaryBidId}
          onAward={handleSetPrimary}
          pendingApprovalCount={pendingApprovalCount}
          firstPendingTarget={firstPendingTarget}
          isApproveBlocked={isApproveBlocked}
        />
      )}

      {/* Document card */}
      <PurchaseOrderCard
        po={po}
        actionableIds={actionableIds}
        commentByApproval={commentByApproval}
        onCommentChange={(id, val) =>
          setCommentByApproval((prev) => ({ ...prev, [id]: val }))
        }
        onApprovalAction={handleApprovalAction}
        busyApprovalId={busyApprovalId}
        isApproveBlocked={isApproveBlocked}
        currentUser={currentUser}
      />

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
