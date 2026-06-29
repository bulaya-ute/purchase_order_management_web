import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  addApprovalDefinition,
  addLineItem,
  createPurchaseOrder,
  deleteApprovalDefinition,
  deleteLineItem,
  getPurchaseOrder,
  submitPurchaseOrder,
  updateLineItem,
  updatePurchaseOrder,
} from '../api/purchaseOrdersApi';
import type { PurchaseOrderDetail, PurchaseOrderLineItem } from '../api/purchaseOrdersApi';
import type { ApprovalDto } from '../api/approvalsApi';
import { listAllCompanies } from '../api/companiesApi';
import type { Company } from '../api/companiesApi';
import { listUsers } from '../api/usersApi';
import type { User } from '../api/usersApi';
import { listRoles } from '../api/rolesApi';
import type { Role } from '../api/rolesApi';
import { getErrorMessage } from '../api/errorMessage';
import { BidManager } from '../components/BidManager';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { StatusBadge } from '../components/StatusBadge';
import { Toast } from '../components/Toast';
import type { ToastMessage } from '../components/Toast';
import { formatMoney } from '../utils/format';
import './admin/admin.css';

const CURRENCIES = ['USD', 'EUR', 'GBP', 'KES', 'ZAR', 'NGN'];

interface LineItemFormState {
  description: string;
  quantity: string;
  unitCost: string;
  discountPercentage: string;
  taxPercentage: string;
}

const EMPTY_LINE_ITEM_FORM: LineItemFormState = {
  description: '',
  quantity: '',
  unitCost: '',
  discountPercentage: '',
  taxPercentage: '',
};

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

export function PurchaseOrderComposerScreen() {
  const { id } = useParams<{ id: string }>();
  const isNew = id === undefined;
  const poId = id !== undefined ? Number(id) : undefined;
  const navigate = useNavigate();

  const [toast, setToast] = useState<ToastMessage | null>(null);

  // ----- New PO header form -----
  const [companies, setCompanies] = useState<Company[]>([]);
  const [companyId, setCompanyId] = useState<string>('');
  const [currency, setCurrency] = useState('USD');
  const [notes, setNotes] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  useEffect(() => {
    if (!isNew) return;
    listAllCompanies()
      .then(setCompanies)
      .catch(() => setCompanies([]));
  }, [isNew]);

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!companyId) {
      setCreateError('Company is required.');
      return;
    }
    setIsCreating(true);
    setCreateError(null);
    try {
      const created = await createPurchaseOrder({
        companyId: Number(companyId),
        currency,
        notes: notes.trim() || null,
      });
      navigate(`/purchase-orders/${created.id}/edit`, { replace: true });
    } catch (err) {
      setCreateError(getErrorMessage(err, 'Failed to create the draft purchase order.'));
    } finally {
      setIsCreating(false);
    }
  };

  if (isNew) {
    return (
      <section className="admin-screen">
        <div className="admin-header">
          <h2>New Purchase Order</h2>
          <Link to="/purchase-orders" className="po-back-link">
            ← Back to purchase orders
          </Link>
        </div>

        <div className="admin-panel" style={{ padding: '1rem' }}>
          <form className="admin-form" onSubmit={handleCreate}>
            {createError && (
              <div className="admin-error" role="alert">
                {createError}
              </div>
            )}

            <div className="form-field">
              <label htmlFor="po-company">Company</label>
              <select
                id="po-company"
                value={companyId}
                onChange={(e) => setCompanyId(e.target.value)}
                disabled={isCreating}
              >
                <option value="">Select a company…</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-field">
              <label htmlFor="po-currency">Currency</label>
              <select
                id="po-currency"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                disabled={isCreating}
              >
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-field">
              <label htmlFor="po-notes">Notes</label>
              <textarea
                id="po-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                disabled={isCreating}
                rows={3}
              />
            </div>

            <div className="modal-actions" style={{ marginTop: 0 }}>
              <button type="submit" className="btn btn-primary" disabled={isCreating}>
                {isCreating ? 'Creating…' : 'Create draft'}
              </button>
            </div>
          </form>
        </div>

        <div className="toast-stack">
          <Toast toast={toast} onDismiss={() => setToast(null)} />
        </div>
      </section>
    );
  }

  return <PurchaseOrderEditor poId={poId as number} />;
}

interface PurchaseOrderEditorProps {
  poId: number;
}

function PurchaseOrderEditor({ poId }: PurchaseOrderEditorProps) {
  const navigate = useNavigate();

  const [po, setPo] = useState<PurchaseOrderDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  // Header edit (notes/currency).
  const [headerCurrency, setHeaderCurrency] = useState('USD');
  const [headerNotes, setHeaderNotes] = useState('');
  const [isSavingHeader, setIsSavingHeader] = useState(false);
  const [headerError, setHeaderError] = useState<string | null>(null);

  // Line items.
  const [lineForm, setLineForm] = useState<LineItemFormState>(EMPTY_LINE_ITEM_FORM);
  const [editingLineId, setEditingLineId] = useState<number | null>(null);
  const [lineError, setLineError] = useState<string | null>(null);
  const [isSavingLine, setIsSavingLine] = useState(false);
  const [deletingLine, setDeletingLine] = useState<PurchaseOrderLineItem | null>(null);
  const [isDeletingLine, setIsDeletingLine] = useState(false);

  // Approvals.
  const [roles, setRoles] = useState<Role[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [approvalForm, setApprovalForm] = useState<ApprovalFormState>(EMPTY_APPROVAL_FORM);
  const [approvalError, setApprovalError] = useState<string | null>(null);
  const [isSavingApproval, setIsSavingApproval] = useState(false);
  const [deletingApproval, setDeletingApproval] = useState<ApprovalDto | null>(null);
  const [isDeletingApproval, setIsDeletingApproval] = useState(false);

  // Submit.
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const detail = await getPurchaseOrder(poId);
      setPo(detail);
      setHeaderCurrency(detail.currency);
      setHeaderNotes(detail.notes ?? '');
    } catch (err) {
      setLoadError(getErrorMessage(err, 'Failed to load the purchase order.'));
    } finally {
      setIsLoading(false);
    }
  }, [poId]);

  // Refreshes PO data (e.g. after awarding a bid) without flipping the full-screen loading
  // state, which would otherwise unmount the bid preview modal mid-interaction.
  const refreshSilently = useCallback(async () => {
    try {
      const detail = await getPurchaseOrder(poId);
      setPo(detail);
    } catch {
      // Best-effort refresh; surfaced errors from the triggering action already toast.
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
    listRoles()
      .then(setRoles)
      .catch(() => setRoles([]));
    listUsers({ page: 1, pageSize: 100 })
      .then((result) => setUsers(result.items))
      .catch(() => setUsers([]));
  }, []);

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

  const isDraft = po.status === 'Draft';

  if (!isDraft) {
    return (
      <section className="po-detail">
        <Link to="/purchase-orders" className="po-back-link">
          ← Back to purchase orders
        </Link>
        <div className="po-detail-header">
          <h2>{po.poNumber}</h2>
          <StatusBadge status={po.status} />
        </div>
        <div className="admin-panel" style={{ padding: '1rem' }}>
          <div className="admin-empty">
            Composition is locked once a purchase order leaves Draft. View it on the{' '}
            <Link to={`/purchase-orders/${po.id}`}>detail screen</Link> instead.
          </div>
        </div>
      </section>
    );
  }

  const handleSaveHeader = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSavingHeader(true);
    setHeaderError(null);
    try {
      const updated = await updatePurchaseOrder(po.id, {
        currency: headerCurrency,
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

  const resetLineForm = () => {
    setLineForm(EMPTY_LINE_ITEM_FORM);
    setEditingLineId(null);
    setLineError(null);
  };

  const startEditLine = (li: PurchaseOrderLineItem) => {
    setEditingLineId(li.id);
    setLineForm({
      description: li.description,
      quantity: String(li.quantity),
      unitCost: String(li.unitCost),
      discountPercentage: li.discountPercentage != null ? String(li.discountPercentage) : '',
      taxPercentage: li.taxPercentage != null ? String(li.taxPercentage) : '',
    });
    setLineError(null);
  };

  const handleSubmitLine = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const description = lineForm.description.trim();
    const quantity = Number(lineForm.quantity);
    const unitCost = Number(lineForm.unitCost);
    const discountPercentage =
      lineForm.discountPercentage.trim() === '' ? null : Number(lineForm.discountPercentage);
    const taxPercentage =
      lineForm.taxPercentage.trim() === '' ? null : Number(lineForm.taxPercentage);

    if (!description) {
      setLineError('Description is required.');
      return;
    }
    if (!Number.isFinite(quantity) || quantity <= 0) {
      setLineError('Quantity must be greater than 0.');
      return;
    }
    if (!Number.isFinite(unitCost) || unitCost < 0) {
      setLineError('Unit cost must be 0 or more.');
      return;
    }

    setIsSavingLine(true);
    setLineError(null);
    try {
      if (editingLineId !== null) {
        const existing = po.lineItems.find((li) => li.id === editingLineId);
        await updateLineItem(po.id, editingLineId, {
          description,
          quantity,
          unitCost,
          discountPercentage,
          taxPercentage,
          rowVersion: existing?.rowVersion,
        });
        setToast({ kind: 'success', text: 'Line item updated.' });
      } else {
        await addLineItem(po.id, {
          description,
          quantity,
          unitCost,
          discountPercentage,
          taxPercentage,
        });
        setToast({ kind: 'success', text: 'Line item added.' });
      }
      resetLineForm();
      await load();
    } catch (err) {
      setLineError(getErrorMessage(err, 'Failed to save the line item.'));
    } finally {
      setIsSavingLine(false);
    }
  };

  const handleDeleteLine = async () => {
    if (!deletingLine) return;
    setIsDeletingLine(true);
    try {
      await deleteLineItem(po.id, deletingLine.id);
      setToast({ kind: 'success', text: 'Line item removed.' });
      setDeletingLine(null);
      await load();
    } catch (err) {
      setToast({ kind: 'error', text: getErrorMessage(err, 'Failed to remove the line item.') });
      setDeletingLine(null);
    } finally {
      setIsDeletingLine(false);
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
      await addApprovalDefinition(po.id, {
        requiredRoleId,
        requiredUserId,
        sequenceOrder,
      });
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

  const handleSubmitPo = async () => {
    setIsSubmitting(true);
    try {
      const submitted = await submitPurchaseOrder(po.id);
      setToast({ kind: 'success', text: 'Purchase order submitted.' });
      setConfirmSubmit(false);
      navigate(`/purchase-orders/${submitted.id}`);
    } catch (err) {
      setToast({ kind: 'error', text: getErrorMessage(err, 'Failed to submit the purchase order.') });
      setConfirmSubmit(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="po-detail">
      <Link to="/purchase-orders" className="po-back-link">
        ← Back to purchase orders
      </Link>

      <div className="po-detail-header">
        <h2>{po.poNumber}</h2>
        <StatusBadge status={po.status} />
      </div>

      {/* Header */}
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

          <div className="form-field">
            <label htmlFor="po-edit-currency">Currency</label>
            <select
              id="po-edit-currency"
              value={headerCurrency}
              onChange={(e) => setHeaderCurrency(e.target.value)}
              disabled={isSavingHeader}
            >
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
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
        </form>
      </div>

      {/* Live totals */}
      <div className="admin-panel po-section" style={{ padding: '1rem' }}>
        <h3>Totals</h3>
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
      </div>

      {/* Line items (direct-entry) */}
      <div className="admin-panel po-section" style={{ padding: '1rem' }}>
        <h3>Line Items</h3>
        {po.lineItems.length === 0 ? (
          <div className="admin-empty">No line items yet. Add one below.</div>
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
                <th aria-label="Actions" />
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
                  <td>
                    <div className="row-actions">
                      <button
                        type="button"
                        className="btn btn-small btn-secondary"
                        onClick={() => startEditLine(li)}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="btn btn-small btn-danger"
                        onClick={() => setDeletingLine(li)}
                      >
                        Remove
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <form className="admin-form" onSubmit={handleSubmitLine} style={{ marginTop: '0.75rem' }}>
          {lineError && (
            <div className="admin-error" role="alert">
              {lineError}
            </div>
          )}
          <div className="po-meta">
            <div className="form-field">
              <label htmlFor="line-description">Description</label>
              <input
                id="line-description"
                type="text"
                value={lineForm.description}
                onChange={(e) => setLineForm((f) => ({ ...f, description: e.target.value }))}
                disabled={isSavingLine}
              />
            </div>
            <div className="form-field">
              <label htmlFor="line-quantity">Quantity</label>
              <input
                id="line-quantity"
                type="number"
                min="0"
                step="any"
                value={lineForm.quantity}
                onChange={(e) => setLineForm((f) => ({ ...f, quantity: e.target.value }))}
                disabled={isSavingLine}
              />
            </div>
            <div className="form-field">
              <label htmlFor="line-unit-cost">Unit cost</label>
              <input
                id="line-unit-cost"
                type="number"
                min="0"
                step="any"
                value={lineForm.unitCost}
                onChange={(e) => setLineForm((f) => ({ ...f, unitCost: e.target.value }))}
                disabled={isSavingLine}
              />
            </div>
            <div className="form-field">
              <label htmlFor="line-discount">Discount %</label>
              <input
                id="line-discount"
                type="number"
                min="0"
                max="100"
                step="any"
                value={lineForm.discountPercentage}
                onChange={(e) =>
                  setLineForm((f) => ({ ...f, discountPercentage: e.target.value }))
                }
                disabled={isSavingLine}
              />
            </div>
            <div className="form-field">
              <label htmlFor="line-tax">Tax %</label>
              <input
                id="line-tax"
                type="number"
                min="0"
                max="100"
                step="any"
                value={lineForm.taxPercentage}
                onChange={(e) => setLineForm((f) => ({ ...f, taxPercentage: e.target.value }))}
                disabled={isSavingLine}
              />
            </div>
          </div>
          <div className="modal-actions" style={{ marginTop: 0, justifyContent: 'flex-start' }}>
            <button type="submit" className="btn btn-primary" disabled={isSavingLine}>
              {isSavingLine
                ? 'Saving…'
                : editingLineId !== null
                  ? 'Update line item'
                  : 'Add line item'}
            </button>
            {editingLineId !== null && (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={resetLineForm}
                disabled={isSavingLine}
              >
                Cancel edit
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Bid-based composition */}
      <div className="admin-panel po-section" style={{ padding: '1rem' }}>
        <h3>Supplier bids &amp; comparison</h3>
        <p className="form-hint">
          A PO is composed via direct-entry lines (above) OR supplier bids. Select a winning bid
          to mark it for award — its items are copied into the PO once it is fully approved.
        </p>
        <BidManager
          purchaseOrderId={po.id}
          currency={po.currency}
          awardedSupplierBidId={po.awardedSupplierBidId}
          onAwarded={() => void refreshSilently()}
        />
      </div>

      {/* Approvals */}
      <div className="admin-panel po-section" style={{ padding: '1rem' }}>
        <h3>Approvals</h3>
        <p className="form-hint">
          Same sequence number can be acted on in parallel; a higher sequence is blocked until all
          lower-sequence approvals are approved.
        </p>
        {po.approvals.length === 0 ? (
          <div className="admin-empty">No approvals defined yet.</div>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>Target</th>
                <th>Sequence</th>
                <th>Status</th>
                <th aria-label="Actions" />
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
                return (
                  <tr key={approval.id}>
                    <td>{target}</td>
                    <td>{approval.sequenceOrder}</td>
                    <td>
                      <StatusBadge status={approval.status} />
                    </td>
                    <td>
                      <div className="row-actions">
                        <button
                          type="button"
                          className="btn btn-small btn-danger"
                          onClick={() => setDeletingApproval(approval)}
                        >
                          Remove
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

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
                  setApprovalForm((f) => ({
                    ...f,
                    targetKind: e.target.value as ApprovalTargetKind,
                  }))
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
                onChange={(e) =>
                  setApprovalForm((f) => ({ ...f, sequenceOrder: e.target.value }))
                }
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
      </div>

      {/* Submit */}
      <div className="admin-panel po-section" style={{ padding: '1rem' }}>
        <h3>Submit</h3>
        <div className="po-actions">
          <button
            type="button"
            className="btn btn-primary"
            disabled={!isDraft || isSubmitting}
            onClick={() => setConfirmSubmit(true)}
          >
            Submit
          </button>
        </div>
      </div>

      {deletingLine && (
        <ConfirmDialog
          title="Remove line item"
          message={`Remove "${deletingLine.description}" from this purchase order?`}
          confirmLabel="Remove"
          isBusy={isDeletingLine}
          onConfirm={handleDeleteLine}
          onCancel={() => setDeletingLine(null)}
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

      <div className="toast-stack">
        <Toast toast={toast} onDismiss={() => setToast(null)} />
      </div>
    </section>
  );
}
