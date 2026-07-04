import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  addApprovalDefinition,
  attachSupplierBid,
  cancelPurchaseOrder,
  deleteApprovalDefinition,
  deliverPurchaseOrder,
  detachSupplierBid,
  getPurchaseOrder,
  payPurchaseOrder,
  setAwardedBid,
  submitPurchaseOrder,
  unawardPurchaseOrder,
  updatePurchaseOrder,
} from '../api/purchaseOrdersApi';
import type { PurchaseOrderDetail } from '../api/purchaseOrdersApi';
import { createBid, addBidItem, deleteBidItem, getBid, updateBidItem } from '../api/bidsApi';
import type { SupplierBidDetail } from '../api/bidsApi';
import { getQuotation } from '../api/quotationsApi';
import type { Quotation, QuotationSummary } from '../api/quotationsApi';
import {
  approveApproval,
  getMyApprovals,
  rejectApproval,
} from '../api/approvalsApi';
import type { ApprovalDto } from '../api/approvalsApi';
import { getPurchaseOrderType } from '../api/purchaseOrderTypesApi';
import type { PurchaseOrderTypeDto } from '../api/purchaseOrderTypesApi';
import { listAllCompanies } from '../api/companiesApi';
import type { Company } from '../api/companiesApi';
import { listCurrencies } from '../api/currenciesApi';
import type { Currency } from '../api/currenciesApi';
import { listRoles } from '../api/rolesApi';
import type { Role } from '../api/rolesApi';
import { listUsers } from '../api/usersApi';
import type { User } from '../api/usersApi';
import { getErrorMessage } from '../api/errorMessage';
import { useAuth } from '../auth/useAuth';
import { AddSupplierBidModal } from '../components/AddSupplierBidModal';
import { AddQuotationModal } from '../components/AddQuotationModal';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { StatusBadge } from '../components/StatusBadge';
import { Toast } from '../components/Toast';
import type { ToastMessage } from '../components/Toast';
import { formatDate, formatMoney, formatMoneyVector } from '../utils/format';
import './admin/admin.css';

type ApprovalTargetKind = 'role' | 'user';

interface ApprovalFormState {
  targetKind: ApprovalTargetKind;
  roleId: string;
  userId: string;
  sequenceOrder: string;
}

const EMPTY_APPROVAL_FORM: ApprovalFormState = {
  targetKind: 'role',
  roleId: '',
  userId: '',
  sequenceOrder: '0',
};

export function PurchaseOrderDetailScreen() {
  const { id } = useParams<{ id: string }>();
  const poId = Number(id);
  const { user: currentUser } = useAuth();

  const [po, setPo] = useState<PurchaseOrderDetail | null>(null);
  const [actionableIds, setActionableIds] = useState<Set<number>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  // ----- Bid row / selection -----
  const [selectedBidId, setSelectedBidId] = useState<number | null>(null);
  const [selectedBidDetail, setSelectedBidDetail] = useState<SupplierBidDetail | null>(null);
  const [isLoadingBid, setIsLoadingBid] = useState(false);
  const [workingSetIds, setWorkingSetIds] = useState<number[]>([]);
  const [quotationsById, setQuotationsById] = useState<Map<number, Quotation>>(new Map());
  const [busyBidId, setBusyBidId] = useState<number | null>(null);
  const [isAddBidModalOpen, setIsAddBidModalOpen] = useState(false);
  const [isBidActionBusy, setIsBidActionBusy] = useState(false);
  const [isAwardBusy, setIsAwardBusy] = useState(false);

  // ----- Column 2: quotations -----
  const [isAddQuotationModalOpen, setIsAddQuotationModalOpen] = useState(false);
  const [togglingLineId, setTogglingLineId] = useState<number | null>(null);
  const [confirmRemoveQuotation, setConfirmRemoveQuotation] = useState<{
    id: number;
    count: number;
  } | null>(null);
  const [isRemovingQuotation, setIsRemovingQuotation] = useState(false);

  // ----- Header edit (Draft only) -----
  const [companies, setCompanies] = useState<Company[]>([]);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [headerCurrency, setHeaderCurrency] = useState('');
  const [headerTargetCompanyId, setHeaderTargetCompanyId] = useState('');
  const [headerNotes, setHeaderNotes] = useState('');
  const [isSavingHeader, setIsSavingHeader] = useState(false);
  const [headerError, setHeaderError] = useState<string | null>(null);

  // ----- Approvals (definitions + inline act) -----
  const [poType, setPoType] = useState<PurchaseOrderTypeDto | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [approvalForm, setApprovalForm] = useState<ApprovalFormState>(EMPTY_APPROVAL_FORM);
  const [approvalError, setApprovalError] = useState<string | null>(null);
  const [isSavingApproval, setIsSavingApproval] = useState(false);
  const [deletingApproval, setDeletingApproval] = useState<ApprovalDto | null>(null);
  const [isDeletingApproval, setIsDeletingApproval] = useState(false);
  const [commentByApproval, setCommentByApproval] = useState<Record<number, string>>({});
  const [busyApprovalId, setBusyApprovalId] = useState<number | null>(null);

  // ----- Submit / milestones / cancel -----
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isMilestoneBusy, setIsMilestoneBusy] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const [detail, mine] = await Promise.all([getPurchaseOrder(poId), getMyApprovals()]);
      setPo(detail);
      setActionableIds(new Set(mine.map((m) => m.id)));
      setHeaderCurrency(detail.currency);
      setHeaderTargetCompanyId(detail.targetCompanyId != null ? String(detail.targetCompanyId) : '');
      setHeaderNotes(detail.notes ?? '');
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

  useEffect(() => {
    listAllCompanies().then(setCompanies).catch(() => setCompanies([]));
    listCurrencies({ isActive: true }).then(setCurrencies).catch(() => setCurrencies([]));
    listRoles().then(setRoles).catch(() => setRoles([]));
    listUsers({ page: 1, pageSize: 100 })
      .then((result) => setUsers(result.items))
      .catch(() => setUsers([]));
  }, []);

  useEffect(() => {
    if (po?.purchaseOrderTypeId == null) {
      setPoType(null);
      return;
    }
    getPurchaseOrderType(po.purchaseOrderTypeId).then(setPoType).catch(() => setPoType(null));
  }, [po?.purchaseOrderTypeId]);

  // Default/keep-valid bid selection whenever the PO's bid list changes.
  useEffect(() => {
    if (!po) return;
    const ids = po.supplierBids.map((b) => b.id);
    if (selectedBidId !== null && ids.includes(selectedBidId)) return;
    const defaultId =
      po.awardedSupplierBidId !== null && ids.includes(po.awardedSupplierBidId)
        ? po.awardedSupplierBidId
        : (ids[0] ?? null);
    setSelectedBidId(defaultId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [po]);

  // Load the selected bid and seed its working set exactly once per selection change.
  useEffect(() => {
    if (selectedBidId === null) {
      setSelectedBidDetail(null);
      setWorkingSetIds([]);
      return;
    }
    let cancelled = false;
    setIsLoadingBid(true);
    getBid(selectedBidId)
      .then((detail) => {
        if (cancelled) return;
        setSelectedBidDetail(detail);
        setWorkingSetIds([...new Set(detail.items.map((i) => i.sourceQuotationId))]);
      })
      .catch(() => {
        if (!cancelled) setSelectedBidDetail(null);
      })
      .finally(() => {
        if (!cancelled) setIsLoadingBid(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedBidId]);

  // Fetch (cached) detail for any working-set quotation not yet loaded.
  useEffect(() => {
    const missing = workingSetIds.filter((id) => !quotationsById.has(id));
    if (missing.length === 0) return;
    let cancelled = false;
    Promise.all(missing.map((id) => getQuotation(id)))
      .then((loaded) => {
        if (cancelled) return;
        setQuotationsById((prev) => {
          const next = new Map(prev);
          for (const q of loaded) next.set(q.id, q);
          return next;
        });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [workingSetIds, quotationsById]);

  const refreshSelectedBid = useCallback(async () => {
    if (selectedBidId === null) return;
    try {
      const detail = await getBid(selectedBidId);
      setSelectedBidDetail(detail);
      // Keep the bid row's card (item count, totals) in sync without a full PO reload.
      setPo((prev) =>
        prev
          ? {
              ...prev,
              supplierBids: prev.supplierBids.map((b) =>
                b.id === detail.id
                  ? { ...b, itemCount: detail.itemCount, totals: detail.totals, status: detail.status }
                  : b,
              ),
            }
          : prev,
      );
    } catch (err) {
      setToast({ kind: 'error', text: getErrorMessage(err, 'Failed to refresh the bid.') });
    }
  }, [selectedBidId]);

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

  const isDraftPo = po.status === 'Draft';
  const isSelectedBidDraft = selectedBidDetail?.status === 'Draft';
  const canEditComposition = isDraftPo && isSelectedBidDraft;
  const isAwarded = po.awardedSupplierBidId === selectedBidId && selectedBidId !== null;
  const canManageBidRow = isDraftPo && po.awardedSupplierBidId === null;

  const canCancel = (po.status === 'Open' || po.status === 'Approved') && !po.paidAtUtc;
  const canRecordMilestones = po.status === 'Approved';

  const hasAttachedBids = po.supplierBids.length > 0;
  const isApproveBlocked = hasAttachedBids && po.awardedSupplierBidId === null;

  const excludeSupplierIds = new Set(po.supplierBids.map((b) => b.supplierId));
  const excludeQuotationIds = new Set(workingSetIds);

  const sortedBids = [...po.supplierBids].sort((a, b) => {
    if (a.id === po.awardedSupplierBidId) return -1;
    if (b.id === po.awardedSupplierBidId) return 1;
    return 0;
  });

  // ----- Handlers -----

  const handleSaveHeader = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSavingHeader(true);
    setHeaderError(null);
    try {
      const updated = await updatePurchaseOrder(po.id, {
        currency: headerCurrency,
        targetCompanyId: headerTargetCompanyId ? Number(headerTargetCompanyId) : null,
        notes: headerNotes.trim() || null,
        rowVersion: po.rowVersion,
      });
      setPo(updated);
      setToast({ kind: 'success', text: 'Header saved.' });
    } catch (err) {
      setHeaderError(getErrorMessage(err, 'Failed to save header changes.'));
    } finally {
      setIsSavingHeader(false);
    }
  };

  const handleAttachExistingBid = async (bidId: number) => {
    setIsBidActionBusy(true);
    try {
      const updated = await attachSupplierBid(po.id, bidId);
      setPo(updated);
      setSelectedBidId(bidId);
      setIsAddBidModalOpen(false);
      setToast({ kind: 'success', text: 'Supplier bid attached.' });
    } catch (err) {
      setToast({ kind: 'error', text: getErrorMessage(err, 'Failed to attach the supplier bid.') });
    } finally {
      setIsBidActionBusy(false);
    }
  };

  const handleStartNewBid = async (supplierId: number) => {
    setIsBidActionBusy(true);
    try {
      const created = await createBid(po.id, { supplierId });
      // createBid only sets SupplierBid.PurchaseOrderId — it doesn't add the
      // PurchaseOrderSupplierBids junction row that Submit's "has attached bids" check
      // reads. attachSupplierBid is safe to call here too (it doesn't require the bid to be
      // unattached first) and is what actually registers the attachment.
      await attachSupplierBid(po.id, created.id);
      await load();
      setSelectedBidId(created.id);
      setIsAddBidModalOpen(false);
      setToast({ kind: 'success', text: 'New supplier bid started.' });
    } catch (err) {
      setToast({ kind: 'error', text: getErrorMessage(err, 'Failed to start a new bid.') });
    } finally {
      setIsBidActionBusy(false);
    }
  };

  const handleDetachBid = async (bidId: number) => {
    setBusyBidId(bidId);
    try {
      await detachSupplierBid(po.id, bidId);
      if (selectedBidId === bidId) setSelectedBidId(null);
      await load();
      setToast({ kind: 'success', text: 'Supplier bid detached.' });
    } catch (err) {
      setToast({ kind: 'error', text: getErrorMessage(err, 'Failed to detach the supplier bid.') });
    } finally {
      setBusyBidId(null);
    }
  };

  const handleToggleAward = async () => {
    if (selectedBidId === null) return;
    setIsAwardBusy(true);
    try {
      const updated = isAwarded
        ? await unawardPurchaseOrder(po.id)
        : await setAwardedBid(po.id, selectedBidId);
      setPo(updated);
      setToast({ kind: 'success', text: isAwarded ? 'Bid unawarded.' : 'Bid awarded.' });
    } catch (err) {
      setToast({ kind: 'error', text: getErrorMessage(err, 'Failed to update the award.') });
    } finally {
      setIsAwardBusy(false);
    }
  };

  const handleQuantityBlur = async (itemId: number, value: string) => {
    if (!selectedBidDetail) return;
    const quantity = Number(value);
    const existing = selectedBidDetail.items.find((i) => i.id === itemId);
    if (!existing || !Number.isFinite(quantity) || quantity <= 0 || quantity === existing.quantity) {
      return;
    }
    try {
      await updateBidItem(selectedBidDetail.id, itemId, {
        description: existing.description,
        quantity,
        unitCost: existing.unitCost,
        currency: existing.currency,
        discountPercentage: existing.discountPercentage,
        taxPercentage: existing.taxPercentage,
        rowVersion: existing.rowVersion,
      });
      await refreshSelectedBid();
    } catch (err) {
      setToast({ kind: 'error', text: getErrorMessage(err, 'Failed to update the quantity.') });
      await refreshSelectedBid();
    }
  };

  const handleToggleLine = async (quotation: Quotation, lineId: number, checked: boolean) => {
    if (!selectedBidDetail) return;
    setTogglingLineId(lineId);
    try {
      if (checked) {
        const line = quotation.lineItems.find((li) => li.id === lineId);
        if (!line) return;
        await addBidItem(selectedBidDetail.id, {
          description: line.description,
          quantity: line.quantity,
          unitCost: line.unitCost,
          sourceQuotationLineItemId: line.id,
        });
      } else {
        const existing = selectedBidDetail.items.find((i) => i.sourceQuotationLineItemId === lineId);
        if (!existing) return;
        await deleteBidItem(selectedBidDetail.id, existing.id);
      }
      await refreshSelectedBid();
    } catch (err) {
      setToast({ kind: 'error', text: getErrorMessage(err, 'Failed to update the bid line.') });
    } finally {
      setTogglingLineId(null);
    }
  };

  const handleAddQuotation = (quotation: QuotationSummary) => {
    setWorkingSetIds((ids) => (ids.includes(quotation.id) ? ids : [...ids, quotation.id]));
    setIsAddQuotationModalOpen(false);
  };

  const handleRequestRemoveQuotation = (quotationId: number) => {
    const count =
      selectedBidDetail?.items.filter((i) => i.sourceQuotationId === quotationId).length ?? 0;
    if (count === 0) {
      setWorkingSetIds((ids) => ids.filter((id) => id !== quotationId));
      return;
    }
    setConfirmRemoveQuotation({ id: quotationId, count });
  };

  const handleConfirmRemoveQuotation = async () => {
    if (!confirmRemoveQuotation || !selectedBidDetail) return;
    setIsRemovingQuotation(true);
    try {
      const items = selectedBidDetail.items.filter(
        (i) => i.sourceQuotationId === confirmRemoveQuotation.id,
      );
      for (const item of items) {
        await deleteBidItem(selectedBidDetail.id, item.id);
      }
      setWorkingSetIds((ids) => ids.filter((id) => id !== confirmRemoveQuotation.id));
      await refreshSelectedBid();
      setToast({ kind: 'success', text: 'Quotation removed from the bid.' });
      setConfirmRemoveQuotation(null);
    } catch (err) {
      setToast({ kind: 'error', text: getErrorMessage(err, 'Failed to remove the quotation.') });
    } finally {
      setIsRemovingQuotation(false);
    }
  };

  const handleSubmitApproval = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const sequenceOrder = Number(approvalForm.sequenceOrder);
    if (!Number.isFinite(sequenceOrder) || sequenceOrder < 0) {
      setApprovalError('Sequence order must be 0 or more.');
      return;
    }
    const requiredRoleId =
      approvalForm.targetKind === 'role' && approvalForm.roleId ? Number(approvalForm.roleId) : null;
    const requiredUserId =
      approvalForm.targetKind === 'user' && approvalForm.userId ? Number(approvalForm.userId) : null;
    if (!requiredRoleId && !requiredUserId) {
      setApprovalError('Choose a role or a specific user.');
      return;
    }
    setIsSavingApproval(true);
    setApprovalError(null);
    try {
      await addApprovalDefinition(po.id, { requiredRoleId, requiredUserId, sequenceOrder });
      setToast({ kind: 'success', text: 'Approval added.' });
      setApprovalForm(EMPTY_APPROVAL_FORM);
      await load();
    } catch (err) {
      setApprovalError(getErrorMessage(err, 'Failed to add the approval.'));
    } finally {
      setIsSavingApproval(false);
    }
  };

  const handleDeleteApproval = async () => {
    if (!deletingApproval) return;
    setIsDeletingApproval(true);
    try {
      await deleteApprovalDefinition(po.id, deletingApproval.id);
      setToast({ kind: 'success', text: 'Approval removed.' });
      setDeletingApproval(null);
      await load();
    } catch (err) {
      setToast({ kind: 'error', text: getErrorMessage(err, 'Failed to remove the approval.') });
      setDeletingApproval(null);
    } finally {
      setIsDeletingApproval(false);
    }
  };

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

  const handleSubmitPo = async () => {
    setIsSubmitting(true);
    try {
      const submitted = await submitPurchaseOrder(po.id);
      setPo(submitted);
      setToast({ kind: 'success', text: 'Purchase order submitted.' });
      setConfirmSubmit(false);
    } catch (err) {
      setToast({ kind: 'error', text: getErrorMessage(err, 'Failed to submit the purchase order.') });
      setConfirmSubmit(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const runMilestone = async (
    fn: (id: number) => Promise<PurchaseOrderDetail>,
    successText: string,
    failText: string,
  ) => {
    setIsMilestoneBusy(true);
    try {
      setPo(await fn(poId));
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
      setPo(await cancelPurchaseOrder(poId));
      setToast({ kind: 'success', text: 'Purchase order cancelled.' });
      setConfirmCancel(false);
    } catch (err) {
      setToast({ kind: 'error', text: getErrorMessage(err, 'Failed to cancel the purchase order.') });
      setConfirmCancel(false);
    } finally {
      setIsCancelling(false);
    }
  };

  const firstPendingApproval = [...po.approvals]
    .filter((a) => a.status === 'Pending')
    .sort((a, b) => a.sequenceOrder - b.sequenceOrder)[0];
  const firstPendingTarget = firstPendingApproval
    ? (firstPendingApproval.requiredUserName ?? firstPendingApproval.requiredRoleName ?? 'next approver')
    : null;

  const canSubmit =
    isDraftPo &&
    hasAttachedBids &&
    po.awardedSupplierBidId !== null &&
    po.approvals.length > 0 &&
    !isSubmitting;

  return (
    <section className="po-detail">
      <Link to="/purchase-orders" className="po-back-link">
        ← Back to purchase orders
      </Link>

      <div className="po-detail-header">
        <h2>
          {po.poNumber} <StatusBadge status={po.status} />
        </h2>
        <div className="po-actions-bar">
          <Link to={`/purchase-orders/${po.id}/print`} className="btn btn-secondary btn-small">
            Print / Export PDF
          </Link>
          {canRecordMilestones && !po.paidAtUtc && (
            <button
              type="button"
              className="btn btn-primary"
              disabled={isMilestoneBusy}
              onClick={() => void runMilestone(payPurchaseOrder, 'Marked as paid.', 'Failed to mark paid.')}
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
                void runMilestone(deliverPurchaseOrder, 'Marked as delivered.', 'Failed to mark delivered.')
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

      {/* Bid row */}
      <div className="admin-panel" style={{ padding: '1rem' }}>
        <h3 style={{ margin: '0 0 0.75rem', fontSize: '1rem' }}>Supplier Bids</h3>
        {sortedBids.length === 0 ? (
          <div className="admin-empty">No bids attached yet — add one to get started.</div>
        ) : (
          <div className="po-bid-cards" role="radiogroup" aria-label="Supplier bids">
            {sortedBids.map((bid) => {
              const isSelected = bid.id === selectedBidId;
              const isBidAwarded = bid.id === po.awardedSupplierBidId;
              return (
                <div
                  key={bid.id}
                  className={[
                    'po-bid-card',
                    isSelected ? 'po-bid-card--selected' : '',
                    isBidAwarded ? 'po-bid-card--awarded' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  onClick={() => setSelectedBidId(bid.id)}
                  role="radio"
                  aria-checked={isSelected}
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setSelectedBidId(bid.id);
                    }
                  }}
                >
                  <div className="po-bid-card-supplier">{bid.supplierName}</div>
                  <div className="bid-card-badges">
                    {bid.status === 'Draft' && <span className="badge badge-muted">Draft</span>}
                    {isBidAwarded && <span className="badge badge-success">Awarded</span>}
                  </div>
                  <div className="po-bid-card-total">{formatMoneyVector(bid.totals)}</div>
                  <div className="po-bid-card-meta">
                    {bid.itemCount} item{bid.itemCount === 1 ? '' : 's'}
                  </div>
                  {canManageBidRow && (
                    <button
                      type="button"
                      className="btn btn-small btn-danger"
                      style={{ marginTop: '0.5rem', width: '100%' }}
                      disabled={busyBidId === bid.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        void handleDetachBid(bid.id);
                      }}
                    >
                      {busyBidId === bid.id ? 'Removing…' : 'Remove'}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
        {canManageBidRow && (
          <button
            type="button"
            className="btn btn-secondary"
            style={{ marginTop: '0.75rem' }}
            onClick={() => setIsAddBidModalOpen(true)}
          >
            + Add bid
          </button>
        )}
      </div>

      {/* Two columns */}
      <div className="po-columns" style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
        {/* Column 1: PO Preview */}
        <div style={{ flex: '3 1 0' }}>
          <div className="admin-panel po-section" style={{ padding: '1rem' }}>
            <h3>Header</h3>
            <form className="admin-form" onSubmit={handleSaveHeader}>
              {headerError && (
                <div className="admin-error" role="alert">
                  {headerError}
                </div>
              )}
              <div className="po-meta">
                <div className="po-meta-item">
                  <span className="po-meta-label">Company</span>
                  <span>{po.companyName}</span>
                </div>
                <div className="po-meta-item">
                  <span className="po-meta-label">Issuer</span>
                  <span>{po.issuerUserName}</span>
                </div>
              </div>

              {isDraftPo ? (
                <>
                  <div className="form-field">
                    <label htmlFor="po-edit-target-company">Target branch (optional)</label>
                    <select
                      id="po-edit-target-company"
                      value={headerTargetCompanyId}
                      onChange={(e) => setHeaderTargetCompanyId(e.target.value)}
                      disabled={isSavingHeader}
                    >
                      <option value="">None</option>
                      {companies.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-field">
                    <label htmlFor="po-edit-currency">Currency</label>
                    <select
                      id="po-edit-currency"
                      value={headerCurrency}
                      onChange={(e) => setHeaderCurrency(e.target.value)}
                      disabled={isSavingHeader}
                    >
                      {currencies.map((c) => (
                        <option key={c.code} value={c.code}>
                          {c.code} — {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-field">
                    <label htmlFor="po-edit-notes">Notes</label>
                    <textarea
                      id="po-edit-notes"
                      value={headerNotes}
                      onChange={(e) => setHeaderNotes(e.target.value)}
                      disabled={isSavingHeader}
                      rows={3}
                    />
                  </div>
                  <div className="modal-actions" style={{ marginTop: 0, justifyContent: 'flex-start' }}>
                    <button type="submit" className="btn btn-secondary" disabled={isSavingHeader}>
                      {isSavingHeader ? 'Saving…' : 'Save header'}
                    </button>
                  </div>
                </>
              ) : (
                <div className="po-meta">
                  {po.targetCompanyName && (
                    <div className="po-meta-item">
                      <span className="po-meta-label">For</span>
                      <span>{po.targetCompanyName}</span>
                    </div>
                  )}
                  <div className="po-meta-item">
                    <span className="po-meta-label">Currency</span>
                    <span>{po.currency}</span>
                  </div>
                  {po.purchaseOrderTypeName && (
                    <div className="po-meta-item">
                      <span className="po-meta-label">Type</span>
                      <span>{po.purchaseOrderTypeName}</span>
                    </div>
                  )}
                  {po.notes && (
                    <div className="po-meta-item">
                      <span className="po-meta-label">Notes</span>
                      <span>{po.notes}</span>
                    </div>
                  )}
                </div>
              )}

              <div className="po-chips">
                <span className={`po-chip ${po.paidAtUtc ? 'po-chip-set' : ''}`}>
                  {po.paidAtUtc ? `Paid ${formatDate(po.paidAtUtc)}` : 'Not paid'}
                </span>
                <span className={`po-chip ${po.deliveredAtUtc ? 'po-chip-set' : ''}`}>
                  {po.deliveredAtUtc ? `Delivered ${formatDate(po.deliveredAtUtc)}` : 'Not delivered'}
                </span>
              </div>
            </form>
          </div>

          <div className="admin-panel po-section" style={{ padding: '1rem' }}>
            <h3>Line Items</h3>
            {isLoadingBid ? (
              <div className="admin-loading">Loading bid…</div>
            ) : !selectedBidDetail ? (
              <div className="admin-empty">Select a bid above to preview its composition.</div>
            ) : selectedBidDetail.items.length === 0 ? (
              <div className="admin-empty">No line items yet — add quotation lines from the right.</div>
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
                  {selectedBidDetail.items.map((item) => (
                    <tr key={item.id}>
                      <td>
                        {item.description}
                        {item.sourceQuotationReference && (
                          <span
                            className="po-meta-label"
                            style={{ display: 'block', fontSize: '0.75rem' }}
                          >
                            {item.sourceQuotationReference}
                          </span>
                        )}
                      </td>
                      <td>
                        {canEditComposition ? (
                          <input
                            type="number"
                            min="0"
                            step="any"
                            defaultValue={item.quantity}
                            style={{ width: '5rem' }}
                            onBlur={(e) => void handleQuantityBlur(item.id, e.target.value)}
                          />
                        ) : (
                          item.quantity
                        )}
                      </td>
                      <td>{formatMoney(item.unitCost, item.currency)}</td>
                      <td>{formatMoney(item.discountAmount, item.currency)}</td>
                      <td>{formatMoney(item.taxAmount, item.currency)}</td>
                      <td>{formatMoney(item.lineTotal, item.currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {selectedBidDetail && (
              <div className="po-totals" style={{ justifyContent: 'flex-end', marginTop: '0.75rem' }}>
                <div className="po-total-item po-total-grand">
                  <span className="po-meta-label">Total</span>
                  <span className="po-total-value" data-testid="po-total">{formatMoneyVector(selectedBidDetail.totals)}</span>
                </div>
              </div>
            )}

            {canEditComposition && selectedBidId !== null && (
              <div className="modal-actions" style={{ justifyContent: 'flex-start' }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={isAwardBusy}
                  onClick={() => void handleToggleAward()}
                >
                  {isAwardBusy ? 'Working…' : isAwarded ? 'Unaward' : 'Award this bid'}
                </button>
              </div>
            )}
          </div>

          <div className="admin-panel po-section" style={{ padding: '1rem' }}>
            <h3>Approvals</h3>
            <p className="form-hint">
              Same sequence number can be acted on in parallel; a higher sequence is blocked until
              all lower-sequence approvals are approved.
            </p>

            {po.purchaseOrderTypeId != null && (
              <>
                <p className="form-hint">
                  This PO uses the <strong>{po.purchaseOrderTypeName}</strong> type — its approval
                  chain is fixed and cannot be edited here.
                </p>
                {poType && poType.approvalSteps.length > 0 && (
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Target</th>
                        <th>Sequence</th>
                      </tr>
                    </thead>
                    <tbody>
                      {poType.approvalSteps.map((step) => (
                        <tr key={step.id}>
                          <td>
                            {step.requiredUserName ?? step.requiredRoleName ?? '—'}
                          </td>
                          <td>{step.sequenceOrder}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </>
            )}

            {po.approvals.length === 0 ? (
              <div className="admin-empty">No approvals defined yet.</div>
            ) : (
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Target</th>
                    <th>Sequence</th>
                    <th>Status</th>
                    <th>Actor</th>
                    <th>Comment</th>
                    {isDraftPo && po.purchaseOrderTypeId == null && <th aria-label="Actions" />}
                  </tr>
                </thead>
                <tbody>
                  {po.approvals.map((approval) => {
                    const target = approval.requiredUserName ?? approval.requiredRoleName ?? '—';
                    const canAct = actionableIds.has(approval.id);
                    const isInChain =
                      currentUser !== null &&
                      (approval.requiredUserId === currentUser.id ||
                        (approval.requiredRoleName !== null &&
                          currentUser.roles.includes(approval.requiredRoleName)));
                    const isNotMyTurn = isInChain && !canAct && approval.status === 'Pending';

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
                              {isApproveBlocked && (
                                <span className="form-error" style={{ fontSize: '0.8rem' }}>
                                  An awarded Supplier Bid must be set before approving.
                                </span>
                              )}
                              <div className="approval-act-buttons">
                                <button
                                  type="button"
                                  className="btn btn-small btn-primary"
                                  disabled={busyApprovalId === approval.id || isApproveBlocked}
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
                          {isNotMyTurn && firstPendingTarget && (
                            <p className="po-meta-label" style={{ margin: '0.3rem 0 0', fontSize: '0.78rem' }}>
                              Awaiting: {firstPendingTarget}
                            </p>
                          )}
                        </td>
                        <td>{approval.approvedByUserName ?? '—'}</td>
                        <td>{approval.comment ?? '—'}</td>
                        {isDraftPo && po.purchaseOrderTypeId == null && (
                          <td>
                            <button
                              type="button"
                              className="btn btn-small btn-danger"
                              onClick={() => setDeletingApproval(approval)}
                            >
                              Remove
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}

            {isDraftPo && po.purchaseOrderTypeId == null && (
              <form className="admin-form" onSubmit={handleSubmitApproval} style={{ marginTop: '0.75rem' }}>
                {approvalError && (
                  <div className="admin-error" role="alert">
                    {approvalError}
                  </div>
                )}
                <div className="po-meta">
                  <div className="form-field">
                    <label htmlFor="approval-target-kind">Target type</label>
                    <select
                      id="approval-target-kind"
                      value={approvalForm.targetKind}
                      onChange={(e) =>
                        setApprovalForm((f) => ({ ...f, targetKind: e.target.value as ApprovalTargetKind }))
                      }
                      disabled={isSavingApproval}
                    >
                      <option value="role">Role</option>
                      <option value="user">Specific user</option>
                    </select>
                  </div>
                  {approvalForm.targetKind === 'role' ? (
                    <div className="form-field">
                      <label htmlFor="approval-role">Role</label>
                      <select
                        id="approval-role"
                        value={approvalForm.roleId}
                        onChange={(e) => setApprovalForm((f) => ({ ...f, roleId: e.target.value }))}
                        disabled={isSavingApproval}
                      >
                        <option value="">Select a role…</option>
                        {roles.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <div className="form-field">
                      <label htmlFor="approval-user">User</label>
                      <select
                        id="approval-user"
                        value={approvalForm.userId}
                        onChange={(e) => setApprovalForm((f) => ({ ...f, userId: e.target.value }))}
                        disabled={isSavingApproval}
                      >
                        <option value="">Select a user…</option>
                        {users.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.fullName}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  <div className="form-field">
                    <label htmlFor="approval-sequence">Sequence order</label>
                    <input
                      id="approval-sequence"
                      type="number"
                      min="0"
                      step="1"
                      value={approvalForm.sequenceOrder}
                      onChange={(e) => setApprovalForm((f) => ({ ...f, sequenceOrder: e.target.value }))}
                      disabled={isSavingApproval}
                    />
                  </div>
                </div>
                <div className="modal-actions" style={{ marginTop: 0, justifyContent: 'flex-start' }}>
                  <button type="submit" className="btn btn-primary" disabled={isSavingApproval}>
                    {isSavingApproval ? 'Adding…' : 'Add approval'}
                  </button>
                </div>
              </form>
            )}
          </div>

          {isDraftPo && (
            <div className="admin-panel po-section" style={{ padding: '1rem' }}>
              <h3>Submit</h3>
              {!canSubmit && (
                <p className="form-hint" style={{ color: 'var(--color-danger, #c0392b)' }}>
                  At least one supplier bid must be attached, awarded, and have approvals defined
                  before this PO can be submitted.
                </p>
              )}
              <button
                type="button"
                className="btn btn-primary"
                disabled={!canSubmit}
                onClick={() => setConfirmSubmit(true)}
              >
                Submit
              </button>
            </div>
          )}
        </div>

        {/* Column 2: Quotations working set */}
        <div style={{ flex: '2 1 0' }}>
          <div className="admin-panel" style={{ padding: '1rem' }}>
            <h3 style={{ marginTop: 0 }}>Quotations</h3>
            {canEditComposition && (
              <button
                type="button"
                className="btn btn-secondary"
                style={{ marginBottom: '0.75rem' }}
                onClick={() => setIsAddQuotationModalOpen(true)}
              >
                + Add a quotation
              </button>
            )}

            {!selectedBidDetail ? null : workingSetIds.length === 0 ? (
              <div className="admin-empty">No quotations added yet — use the button above to add one.</div>
            ) : (
              workingSetIds.map((qId) => {
                const quotation = quotationsById.get(qId);
                if (!quotation) {
                  return (
                    <div key={qId} className="admin-loading" style={{ marginBottom: '0.75rem' }}>
                      Loading quotation…
                    </div>
                  );
                }
                const checkedLineIds = new Set(
                  selectedBidDetail.items
                    .filter((i) => i.sourceQuotationId === qId)
                    .map((i) => i.sourceQuotationLineItemId),
                );
                return (
                  <div key={qId} className="bid-card" style={{ marginBottom: '0.75rem' }}>
                    <div className="bid-card-name">{quotation.quoteReference ?? `Quote #${quotation.id}`}</div>
                    <div className="bid-card-meta">
                      {quotation.expiresAtUtc ? `Expires ${formatDate(quotation.expiresAtUtc)}` : 'No expiry'}
                      {quotation.isExpired && <span className="badge badge-danger" style={{ marginLeft: '0.4rem' }}>Expired</span>}
                    </div>
                    <table className="admin-table" style={{ marginTop: '0.5rem' }}>
                      <thead>
                        <tr>
                          <th aria-label="In bid" />
                          <th>Description</th>
                          <th>Qty</th>
                          <th>Unit cost</th>
                        </tr>
                      </thead>
                      <tbody>
                        {quotation.lineItems.map((line) => {
                          const isChecked = checkedLineIds.has(line.id);
                          return (
                            <tr key={line.id}>
                              <td>
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  disabled={!canEditComposition || togglingLineId === line.id}
                                  onChange={(e) => void handleToggleLine(quotation, line.id, e.target.checked)}
                                  aria-label={`${isChecked ? 'Remove' : 'Add'} ${line.description}`}
                                />
                              </td>
                              <td>{line.description}</td>
                              <td>{line.quantity}</td>
                              <td>{formatMoney(line.unitCost, quotation.currency)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    {canEditComposition && (
                      <button
                        type="button"
                        className="btn btn-small btn-danger"
                        style={{ marginTop: '0.5rem' }}
                        onClick={() => handleRequestRemoveQuotation(qId)}
                      >
                        Remove
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {isAddBidModalOpen && (
        <AddSupplierBidModal
          excludeSupplierIds={excludeSupplierIds}
          onAttachExisting={(bidId) => void handleAttachExistingBid(bidId)}
          onStartNew={(supplierId) => void handleStartNewBid(supplierId)}
          isBusy={isBidActionBusy}
          onClose={() => setIsAddBidModalOpen(false)}
        />
      )}

      {isAddQuotationModalOpen && selectedBidDetail && (
        <AddQuotationModal
          supplierId={selectedBidDetail.supplierId}
          excludeQuotationIds={excludeQuotationIds}
          onAdd={handleAddQuotation}
          isAdding={false}
          onClose={() => setIsAddQuotationModalOpen(false)}
        />
      )}

      {confirmRemoveQuotation && (
        <ConfirmDialog
          title="Remove quotation"
          message={`This will remove ${confirmRemoveQuotation.count} line item${confirmRemoveQuotation.count === 1 ? '' : 's'} from this bid.`}
          confirmLabel="Remove"
          isBusy={isRemovingQuotation}
          onConfirm={handleConfirmRemoveQuotation}
          onCancel={() => setConfirmRemoveQuotation(null)}
        />
      )}

      {deletingApproval && (
        <ConfirmDialog
          title="Remove approval"
          message="Remove this required approval from the purchase order?"
          confirmLabel="Remove"
          isBusy={isDeletingApproval}
          onConfirm={handleDeleteApproval}
          onCancel={() => setDeletingApproval(null)}
        />
      )}

      {confirmSubmit && (
        <ConfirmDialog
          title="Submit purchase order"
          message={`Submit ${po.poNumber}? Composition will be locked and approvals will become active.`}
          confirmLabel="Submit"
          isBusy={isSubmitting}
          onConfirm={handleSubmitPo}
          onCancel={() => setConfirmSubmit(false)}
        />
      )}

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
