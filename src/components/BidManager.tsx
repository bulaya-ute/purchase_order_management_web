import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import {
  addBidItem,
  attachBidToPurchaseOrder,
  createBid,
  deleteBidItem,
  getBid,
  listBids,
  listBidsForPurchaseOrder,
  seedBidItemsFromQuotation,
  updateBidItem,
} from '../api/bidsApi';
import type { SupplierBidDetail, SupplierBidItem, SupplierBidSummary } from '../api/bidsApi';
import { createQuotation, listQuotations } from '../api/quotationsApi';
import type { CreateQuotationLineItemRequest, QuotationSummary } from '../api/quotationsApi';
import { setAwardedBid } from '../api/purchaseOrdersApi';
import { listSuppliers } from '../api/suppliersApi';
import type { Supplier } from '../api/suppliersApi';
import { listCurrencies } from '../api/currenciesApi';
import type { Currency } from '../api/currenciesApi';
import { getErrorMessage } from '../api/errorMessage';
import { BidCard } from './BidCard';
import { ConfirmDialog } from './ConfirmDialog';
import { FileUpload } from './FileUpload';
import type { UploadedFile } from '../api/filesApi';
import { Toast } from './Toast';
import type { ToastMessage } from './Toast';
import { formatDate, formatMoney, formatMoneyVector } from '../utils/format';

interface BidManagerProps {
  purchaseOrderId: number;
  awardedSupplierBidId: number | null;
  /** Called after an award succeeds so the parent can refresh the PO (awardedSupplierBidId etc). */
  onAwarded: () => void;
}

interface BidItemFormState {
  description: string;
  quantity: string;
  unitCost: string;
  currency: string;
  discountPercentage: string;
  taxPercentage: string;
}

const emptyBidItemForm = (currency: string): BidItemFormState => ({
  description: '',
  quantity: '',
  unitCost: '',
  currency,
  discountPercentage: '',
  taxPercentage: '',
});

interface QuotationLineFormRow {
  description: string;
  quantity: string;
  unitCost: string;
}

const EMPTY_QUOTATION_LINE: QuotationLineFormRow = { description: '', quantity: '', unitCost: '' };

/**
 * Bid-based composition manager for the PO composer: add competing supplier bids (either created
 * fresh or attached from the standalone bids library), drill into a bid to manage its quotations +
 * editable bid items, and select the winning bid. Only meaningful while the PO is Draft (the
 * composer only renders this while isDraft is true).
 */
export function BidManager({ purchaseOrderId, awardedSupplierBidId, onAwarded }: BidManagerProps) {
  const [bids, setBids] = useState<SupplierBidSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [newBidSupplierId, setNewBidSupplierId] = useState('');
  const [newBidNotes, setNewBidNotes] = useState('');
  const [isCreatingBid, setIsCreatingBid] = useState(false);
  const [createBidError, setCreateBidError] = useState<string | null>(null);

  // Attach-existing-bid control.
  const [unattachedBids, setUnattachedBids] = useState<SupplierBidSummary[]>([]);
  const [isLoadingUnattached, setIsLoadingUnattached] = useState(false);
  const [attachSupplierId, setAttachSupplierId] = useState('');
  const [attachBidId, setAttachBidId] = useState('');
  const [isAttaching, setIsAttaching] = useState(false);
  const [attachError, setAttachError] = useState<string | null>(null);

  const [openBidId, setOpenBidId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const result = await listBidsForPurchaseOrder(purchaseOrderId);
      setBids(result);
    } catch (err) {
      setLoadError(getErrorMessage(err, 'Failed to load supplier bids.'));
    } finally {
      setIsLoading(false);
    }
  }, [purchaseOrderId]);

  const loadUnattached = useCallback(async () => {
    setIsLoadingUnattached(true);
    try {
      const result = await listBids({
        unattachedOnly: true,
        supplierId: attachSupplierId ? Number(attachSupplierId) : undefined,
      });
      setUnattachedBids(result);
    } catch {
      setUnattachedBids([]);
    } finally {
      setIsLoadingUnattached(false);
    }
  }, [attachSupplierId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void loadUnattached();
  }, [loadUnattached]);

  useEffect(() => {
    listSuppliers({ page: 1, pageSize: 200 })
      .then((result) => setSuppliers(result.items))
      .catch(() => setSuppliers([]));
  }, []);

  const handleCreateBid = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!newBidSupplierId) {
      setCreateBidError('Choose a supplier.');
      return;
    }
    setIsCreatingBid(true);
    setCreateBidError(null);
    try {
      const created = await createBid(purchaseOrderId, {
        supplierId: Number(newBidSupplierId),
        notes: newBidNotes.trim() || null,
      });
      setToast({ kind: 'success', text: 'Bid added.' });
      setNewBidSupplierId('');
      setNewBidNotes('');
      await load();
      await loadUnattached();
      setOpenBidId(created.id);
    } catch (err) {
      setCreateBidError(getErrorMessage(err, 'Failed to add the bid.'));
    } finally {
      setIsCreatingBid(false);
    }
  };

  const handleAttachBid = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!attachBidId) {
      setAttachError('Choose a bid to attach.');
      return;
    }
    setIsAttaching(true);
    setAttachError(null);
    try {
      await attachBidToPurchaseOrder(Number(attachBidId), purchaseOrderId);
      setToast({ kind: 'success', text: 'Bid attached.' });
      setAttachBidId('');
      await load();
      await loadUnattached();
    } catch (err) {
      setAttachError(getErrorMessage(err, 'Failed to attach the bid.'));
    } finally {
      setIsAttaching(false);
    }
  };

  const handleAward = async (supplierBidId: number) => {
    try {
      await setAwardedBid(purchaseOrderId, supplierBidId);
      setToast({ kind: 'success', text: 'Bid selected as winner.' });
      onAwarded();
      await load();
    } catch (err) {
      setToast({ kind: 'error', text: getErrorMessage(err, 'Failed to select the winning bid.') });
    }
  };

  return (
    <div>
      {loadError && (
        <div className="admin-error" role="alert">
          {loadError}
        </div>
      )}

      {isLoading ? (
        <div className="admin-loading">Loading bids…</div>
      ) : bids.length === 0 ? (
        <div className="admin-empty">No supplier bids yet. Add or attach one below.</div>
      ) : (
        <div className="bid-card-grid">
          {bids.map((bid) => (
            <BidCard
              key={bid.id}
              bid={bid}
              isAwarded={bid.id === awardedSupplierBidId}
              onClick={() => setOpenBidId(bid.id)}
            />
          ))}
        </div>
      )}

      <div className="po-meta" style={{ marginTop: '0.75rem', alignItems: 'flex-start' }}>
        {/* + New Bid shortcut */}
        <form className="admin-form" onSubmit={handleCreateBid} style={{ flex: '1 1 280px' }}>
          <h4 style={{ marginTop: 0 }}>
            + New bid
            <span style={{ fontWeight: 400, fontSize: '0.78rem', marginLeft: '0.5rem' }}>
              or{' '}
              <Link to={`/supplier-bids/new?purchaseOrderId=${purchaseOrderId}`}>
                open the full bid composer
              </Link>
            </span>
          </h4>
          {createBidError && (
            <div className="admin-error" role="alert">
              {createBidError}
            </div>
          )}
          <div className="form-field">
            <label htmlFor="bid-supplier">Supplier</label>
            <select
              id="bid-supplier"
              value={newBidSupplierId}
              onChange={(e) => setNewBidSupplierId(e.target.value)}
              disabled={isCreatingBid}
            >
              <option value="">Select a supplier…</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.supplierName}
                </option>
              ))}
            </select>
          </div>
          <div className="form-field">
            <label htmlFor="bid-notes">Notes</label>
            <input
              id="bid-notes"
              type="text"
              value={newBidNotes}
              onChange={(e) => setNewBidNotes(e.target.value)}
              disabled={isCreatingBid}
            />
          </div>
          <div className="modal-actions" style={{ marginTop: 0, justifyContent: 'flex-start' }}>
            <button type="submit" className="btn btn-primary" disabled={isCreatingBid}>
              {isCreatingBid ? 'Adding…' : 'Add bid'}
            </button>
          </div>
        </form>

        {/* Attach existing bid */}
        <form className="admin-form" onSubmit={handleAttachBid} style={{ flex: '1 1 280px' }}>
          <h4 style={{ marginTop: 0 }}>Attach existing bid</h4>
          {attachError && (
            <div className="admin-error" role="alert">
              {attachError}
            </div>
          )}
          <div className="form-field">
            <label htmlFor="attach-bid-supplier">Supplier</label>
            <select
              id="attach-bid-supplier"
              value={attachSupplierId}
              onChange={(e) => {
                setAttachSupplierId(e.target.value);
                setAttachBidId('');
              }}
              disabled={isAttaching}
            >
              <option value="">All suppliers</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.supplierName}
                </option>
              ))}
            </select>
          </div>
          <div className="form-field">
            <label htmlFor="attach-bid-id">Unattached bid</label>
            <select
              id="attach-bid-id"
              value={attachBidId}
              onChange={(e) => setAttachBidId(e.target.value)}
              disabled={isAttaching || isLoadingUnattached}
            >
              <option value="">
                {isLoadingUnattached ? 'Loading…' : 'Select an unattached bid…'}
              </option>
              {unattachedBids.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.supplierName} — {formatMoneyVector(b.totals)}
                </option>
              ))}
            </select>
          </div>
          <div className="modal-actions" style={{ marginTop: 0, justifyContent: 'flex-start' }}>
            <button type="submit" className="btn btn-secondary" disabled={isAttaching}>
              {isAttaching ? 'Attaching…' : 'Attach bid'}
            </button>
          </div>
        </form>
      </div>

      {openBidId !== null && (
        <BidPreview
          bidId={openBidId}
          isAwarded={openBidId === awardedSupplierBidId}
          onAward={() => void handleAward(openBidId)}
          onClose={() => setOpenBidId(null)}
          onChanged={() => void load()}
        />
      )}

      <div className="toast-stack">
        <Toast toast={toast} onDismiss={() => setToast(null)} />
      </div>
    </div>
  );
}

interface BidPreviewProps {
  bidId: number;
  isAwarded: boolean;
  onAward: () => void;
  onClose: () => void;
  /** Called after a mutation that affects the bid's summary stats (item add/remove/seed). */
  onChanged: () => void;
}

function BidPreview({ bidId, isAwarded, onAward, onClose, onChanged }: BidPreviewProps) {
  const [bid, setBid] = useState<SupplierBidDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const [currencies, setCurrencies] = useState<Currency[]>([]);

  // All of this supplier's quotations (not just ones tied to this bid) — a bid can source lines
  // from any quotation captured for that supplier.
  const [quotations, setQuotations] = useState<QuotationSummary[]>([]);
  const [isLoadingQuotations, setIsLoadingQuotations] = useState(true);

  const [itemForm, setItemForm] = useState<BidItemFormState>(emptyBidItemForm(''));
  const [editingItemId, setEditingItemId] = useState<number | null>(null);
  const [itemError, setItemError] = useState<string | null>(null);
  const [isSavingItem, setIsSavingItem] = useState(false);
  const [deletingItem, setDeletingItem] = useState<SupplierBidItem | null>(null);
  const [isDeletingItem, setIsDeletingItem] = useState(false);

  const [showQuotationForm, setShowQuotationForm] = useState(false);
  const [showStubModal, setShowStubModal] = useState(false);
  const [lastQuotationId, setLastQuotationId] = useState<number | null>(null);
  const [isSeeding, setIsSeeding] = useState(false);

  useEffect(() => {
    listCurrencies({ isActive: true })
      .then((result) => {
        setCurrencies(result);
        setItemForm((f) => (f.currency ? f : emptyBidItemForm(result[0]?.code ?? '')));
      })
      .catch(() => setCurrencies([]));
  }, []);

  const loadBid = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const detail = await getBid(bidId);
      setBid(detail);
    } catch (err) {
      setLoadError(getErrorMessage(err, 'Failed to load the bid.'));
    } finally {
      setIsLoading(false);
    }
  }, [bidId]);

  useEffect(() => {
    void loadBid();
  }, [loadBid]);

  const loadQuotations = useCallback(async (supplierId: number) => {
    setIsLoadingQuotations(true);
    try {
      const result = await listQuotations({ supplierId });
      setQuotations(result);
    } catch {
      setQuotations([]);
    } finally {
      setIsLoadingQuotations(false);
    }
  }, []);

  const bidSupplierId = bid?.supplierId;
  useEffect(() => {
    if (bidSupplierId !== undefined) {
      void loadQuotations(bidSupplierId);
    }
  }, [bidSupplierId, loadQuotations]);

  const resetItemForm = () => {
    setItemForm(emptyBidItemForm(currencies[0]?.code ?? ''));
    setEditingItemId(null);
    setItemError(null);
  };

  const startEditItem = (item: SupplierBidItem) => {
    setEditingItemId(item.id);
    setItemForm({
      description: item.description,
      quantity: String(item.quantity),
      unitCost: String(item.unitCost),
      currency: item.currency,
      discountPercentage: item.discountPercentage != null ? String(item.discountPercentage) : '',
      taxPercentage: item.taxPercentage != null ? String(item.taxPercentage) : '',
    });
    setItemError(null);
  };

  const handleSubmitItem = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const description = itemForm.description.trim();
    const quantity = Number(itemForm.quantity);
    const unitCost = Number(itemForm.unitCost);
    const discountPercentage =
      itemForm.discountPercentage.trim() === '' ? null : Number(itemForm.discountPercentage);
    const taxPercentage =
      itemForm.taxPercentage.trim() === '' ? null : Number(itemForm.taxPercentage);

    if (!description) {
      setItemError('Description is required.');
      return;
    }
    if (!Number.isFinite(quantity) || quantity <= 0) {
      setItemError('Quantity must be greater than 0.');
      return;
    }
    if (!Number.isFinite(unitCost) || unitCost < 0) {
      setItemError('Unit cost must be 0 or more.');
      return;
    }
    if (!itemForm.currency) {
      setItemError('Currency is required.');
      return;
    }

    setIsSavingItem(true);
    setItemError(null);
    try {
      if (editingItemId !== null) {
        const existing = bid?.items.find((i) => i.id === editingItemId);
        await updateBidItem(bidId, editingItemId, {
          description,
          quantity,
          unitCost,
          currency: itemForm.currency,
          discountPercentage,
          taxPercentage,
          rowVersion: existing?.rowVersion,
        });
        setToast({ kind: 'success', text: 'Bid item updated.' });
      } else {
        await addBidItem(bidId, {
          description,
          quantity,
          unitCost,
          currency: itemForm.currency,
          discountPercentage,
          taxPercentage,
        });
        setToast({ kind: 'success', text: 'Bid item added.' });
      }
      resetItemForm();
      await loadBid();
      onChanged();
    } catch (err) {
      setItemError(getErrorMessage(err, 'Failed to save the bid item.'));
    } finally {
      setIsSavingItem(false);
    }
  };

  const handleDeleteItem = async () => {
    if (!deletingItem) return;
    setIsDeletingItem(true);
    try {
      await deleteBidItem(bidId, deletingItem.id);
      setToast({ kind: 'success', text: 'Bid item removed.' });
      setDeletingItem(null);
      await loadBid();
      onChanged();
    } catch (err) {
      setToast({ kind: 'error', text: getErrorMessage(err, 'Failed to remove the bid item.') });
      setDeletingItem(null);
    } finally {
      setIsDeletingItem(false);
    }
  };

  const handleQuotationSaved = (quotationId: number) => {
    setLastQuotationId(quotationId);
    setShowQuotationForm(false);
    if (bid) void loadQuotations(bid.supplierId);
    onChanged();
  };

  const handleSeedFromQuotation = async (quotationId: number) => {
    setIsSeeding(true);
    try {
      const refreshed = await seedBidItemsFromQuotation(bidId, { quotationId });
      setBid(refreshed);
      setToast({ kind: 'success', text: 'Bid items seeded from the quotation.' });
      onChanged();
    } catch (err) {
      setToast({ kind: 'error', text: getErrorMessage(err, 'Failed to seed bid items.') });
    } finally {
      setIsSeeding(false);
    }
  };

  return (
    <div className="modal-overlay" role="presentation" onClick={onClose}>
      <div
        className="modal-card bid-preview-card"
        role="dialog"
        aria-modal="true"
        aria-label="Bid preview"
        onClick={(e) => e.stopPropagation()}
      >
        {isLoading ? (
          <div className="admin-loading">Loading bid…</div>
        ) : loadError || !bid ? (
          <div className="admin-error" role="alert">
            {loadError ?? 'Bid not found.'}
          </div>
        ) : (
          <>
            <h3>{bid.supplierName}</h3>
            <div className="po-meta" style={{ marginBottom: '0.5rem' }}>
              <div className="po-meta-item">
                <span className="po-meta-label">Bid total</span>
                <span className="po-total-value">{formatMoneyVector(bid.totals)}</span>
              </div>
              <div className="po-meta-item">
                <span className="po-meta-label">Items</span>
                <span>{bid.itemCount}</span>
              </div>
            </div>

            {isAwarded && <span className="badge badge-success">Awarded</span>}

            {/* Bid items */}
            <h4>Bid items</h4>
            {bid.items.length === 0 ? (
              <div className="admin-empty">No bid items yet.</div>
            ) : (
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Description</th>
                    <th>Qty</th>
                    <th>Unit</th>
                    <th>Discount</th>
                    <th>Tax</th>
                    <th>Line total</th>
                    <th aria-label="Actions" />
                  </tr>
                </thead>
                <tbody>
                  {bid.items.map((item) => (
                    <tr key={item.id}>
                      <td>{item.description}</td>
                      <td>{item.quantity}</td>
                      <td>{formatMoney(item.unitCost, item.currency)}</td>
                      <td>{formatMoney(item.discountAmount, item.currency)}</td>
                      <td>{formatMoney(item.taxAmount, item.currency)}</td>
                      <td data-testid="bid-item-line-total">
                        {formatMoney(item.lineTotal, item.currency)}
                      </td>
                      <td>
                        <div className="row-actions">
                          <button
                            type="button"
                            className="btn btn-small btn-secondary"
                            onClick={() => startEditItem(item)}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="btn btn-small btn-danger"
                            onClick={() => setDeletingItem(item)}
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

            <form className="admin-form" onSubmit={handleSubmitItem} style={{ marginTop: '0.5rem' }}>
              {itemError && (
                <div className="admin-error" role="alert">
                  {itemError}
                </div>
              )}
              <div className="po-meta">
                <div className="form-field">
                  <label htmlFor="bid-item-description">Description</label>
                  <input
                    id="bid-item-description"
                    type="text"
                    value={itemForm.description}
                    onChange={(e) => setItemForm((f) => ({ ...f, description: e.target.value }))}
                    disabled={isSavingItem}
                  />
                </div>
                <div className="form-field">
                  <label htmlFor="bid-item-quantity">Quantity</label>
                  <input
                    id="bid-item-quantity"
                    type="number"
                    min="0"
                    step="any"
                    value={itemForm.quantity}
                    onChange={(e) => setItemForm((f) => ({ ...f, quantity: e.target.value }))}
                    disabled={isSavingItem}
                  />
                </div>
                <div className="form-field">
                  <label htmlFor="bid-item-unit-cost">Unit cost</label>
                  <input
                    id="bid-item-unit-cost"
                    type="number"
                    min="0"
                    step="any"
                    value={itemForm.unitCost}
                    onChange={(e) => setItemForm((f) => ({ ...f, unitCost: e.target.value }))}
                    disabled={isSavingItem}
                  />
                </div>
                <div className="form-field">
                  <label htmlFor="bid-item-currency">Currency</label>
                  <select
                    id="bid-item-currency"
                    value={itemForm.currency}
                    onChange={(e) => setItemForm((f) => ({ ...f, currency: e.target.value }))}
                    disabled={isSavingItem}
                  >
                    {currencies.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.code} — {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-field">
                  <label htmlFor="bid-item-discount">Discount %</label>
                  <input
                    id="bid-item-discount"
                    type="number"
                    min="0"
                    max="100"
                    step="any"
                    value={itemForm.discountPercentage}
                    onChange={(e) =>
                      setItemForm((f) => ({ ...f, discountPercentage: e.target.value }))
                    }
                    disabled={isSavingItem}
                  />
                </div>
                <div className="form-field">
                  <label htmlFor="bid-item-tax">Tax %</label>
                  <input
                    id="bid-item-tax"
                    type="number"
                    min="0"
                    max="100"
                    step="any"
                    value={itemForm.taxPercentage}
                    onChange={(e) => setItemForm((f) => ({ ...f, taxPercentage: e.target.value }))}
                    disabled={isSavingItem}
                  />
                </div>
              </div>
              <div className="modal-actions" style={{ marginTop: 0, justifyContent: 'flex-start' }}>
                <button type="submit" className="btn btn-primary" disabled={isSavingItem}>
                  {isSavingItem
                    ? 'Saving…'
                    : editingItemId !== null
                      ? 'Update item'
                      : 'Add item'}
                </button>
                {editingItemId !== null && (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={resetItemForm}
                    disabled={isSavingItem}
                  >
                    Cancel edit
                  </button>
                )}
              </div>
            </form>

            {/* Quotations — all of this supplier's quotations, since a bid can source lines from
                any of them (not just ones captured specifically for this bid). */}
            <h4 style={{ marginTop: '1rem' }}>Supplier quotations</h4>
            {isLoadingQuotations ? (
              <div className="admin-loading">Loading quotations…</div>
            ) : quotations.length === 0 ? (
              <div className="admin-empty">No quotations captured for this supplier yet.</div>
            ) : (
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Reference</th>
                    <th>Quote date</th>
                    <th>Currency</th>
                    <th>Expiry</th>
                    <th>Lines</th>
                    <th>File</th>
                    <th aria-label="Actions" />
                  </tr>
                </thead>
                <tbody>
                  {quotations.map((q) => (
                    <tr key={q.id}>
                      <td>{q.quoteReference ?? '—'}</td>
                      <td>{formatDate(q.quoteDate)}</td>
                      <td>{q.currency}</td>
                      <td>
                        {q.expiresAtUtc ? (
                          q.isExpired ? (
                            <span className="badge badge-danger">
                              Expired {formatDate(q.expiresAtUtc)}
                            </span>
                          ) : (
                            <span className="badge badge-warning">
                              {formatDate(q.expiresAtUtc)}
                            </span>
                          )
                        ) : (
                          '—'
                        )}
                      </td>
                      <td>{q.lineItemCount}</td>
                      <td>
                        <a href={q.fileUrl} target="_blank" rel="noreferrer">
                          {q.originalFileName ?? 'View file'}
                        </a>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="btn btn-small btn-secondary"
                          disabled={isSeeding}
                          onClick={() => void handleSeedFromQuotation(q.id)}
                        >
                          {isSeeding ? 'Seeding…' : 'Seed bid items'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {!showQuotationForm ? (
              <div className="modal-actions" style={{ marginTop: '0.5rem', justifyContent: 'flex-start' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowQuotationForm(true)}
                >
                  Capture quotation
                </button>
              </div>
            ) : (
              <QuotationCaptureForm
                supplierId={bid.supplierId}
                currencies={currencies}
                onSaved={handleQuotationSaved}
                onCancel={() => setShowQuotationForm(false)}
                onStub={() => setShowStubModal(true)}
              />
            )}

            {lastQuotationId !== null && (
              <div className="admin-empty" style={{ textAlign: 'left' }}>
                Quotation saved.{' '}
                <button
                  type="button"
                  className="btn btn-link"
                  disabled={isSeeding}
                  onClick={() => void handleSeedFromQuotation(lastQuotationId)}
                >
                  Seed bid items from this quotation
                </button>
              </div>
            )}

            <div className="modal-actions">
              {!isAwarded && (
                <button type="button" className="btn btn-primary" onClick={onAward}>
                  Select as winner
                </button>
              )}
              <button type="button" className="btn btn-secondary" onClick={onClose}>
                Close
              </button>
            </div>
          </>
        )}

        {deletingItem && (
          <ConfirmDialog
            title="Remove bid item"
            message={`Remove "${deletingItem.description}" from this bid?`}
            confirmLabel="Remove"
            isBusy={isDeletingItem}
            onConfirm={handleDeleteItem}
            onCancel={() => setDeletingItem(null)}
          />
        )}

        {showStubModal && (
          <ConfirmDialog
            title="Feature coming soon"
            message="Populate from file (AI-assisted extraction) is not implemented yet. Please enter the quotation details manually for now."
            confirmLabel="OK"
            cancelLabel="Close"
            onConfirm={() => setShowStubModal(false)}
            onCancel={() => setShowStubModal(false)}
          />
        )}

        <div className="toast-stack">
          <Toast toast={toast} onDismiss={() => setToast(null)} />
        </div>
      </div>
    </div>
  );
}

interface QuotationCaptureFormProps {
  supplierId: number;
  currencies: Currency[];
  onSaved: (quotationId: number) => void;
  onCancel: () => void;
  onStub: () => void;
}

function QuotationCaptureForm({
  supplierId,
  currencies,
  onSaved,
  onCancel,
  onStub,
}: QuotationCaptureFormProps) {
  const [uploadedFile, setUploadedFile] = useState<UploadedFile | null>(null);
  const [quoteReference, setQuoteReference] = useState('');
  const [quoteDate, setQuoteDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [expiresAt, setExpiresAt] = useState('');
  const [currency, setCurrency] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<QuotationLineFormRow[]>([{ ...EMPTY_QUOTATION_LINE }]);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!currency && currencies.length > 0) {
      setCurrency(currencies[0].code);
    }
  }, [currencies, currency]);

  const updateLine = (index: number, patch: Partial<QuotationLineFormRow>) => {
    setLines((prev) => prev.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  };

  const addLineRow = () => setLines((prev) => [...prev, { ...EMPTY_QUOTATION_LINE }]);

  const removeLineRow = (index: number) =>
    setLines((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev));

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!uploadedFile) {
      setError('A quotation file must be uploaded first.');
      return;
    }
    if (!quoteDate) {
      setError('Quote date is required.');
      return;
    }
    if (!currency) {
      setError('Currency is required.');
      return;
    }

    const lineItems: CreateQuotationLineItemRequest[] = [];
    for (const line of lines) {
      const description = line.description.trim();
      if (!description) continue;
      const quantity = Number(line.quantity);
      const unitCost = Number(line.unitCost);
      if (!Number.isFinite(quantity) || quantity <= 0) {
        setError('Each line item needs a quantity greater than 0.');
        return;
      }
      if (!Number.isFinite(unitCost) || unitCost < 0) {
        setError('Each line item needs a unit cost of 0 or more.');
        return;
      }
      lineItems.push({ description, quantity, unitCost });
    }

    if (lineItems.length === 0) {
      setError('Add at least one line item.');
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      const quoteDateIso = new Date(`${quoteDate}T00:00:00.000Z`).toISOString();
      const expiresAtIso = expiresAt
        ? new Date(`${expiresAt}T00:00:00.000Z`).toISOString()
        : null;
      const created = await createQuotation({
        supplierId,
        fileId: uploadedFile.id,
        quoteReference: quoteReference.trim() || null,
        quoteDate: quoteDateIso,
        expiresAtUtc: expiresAtIso,
        currency,
        notes: notes.trim() || null,
        lineItems,
      });
      onSaved(created.id);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to save the quotation.'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form className="admin-form" onSubmit={handleSubmit} style={{ marginTop: '0.5rem' }}>
      {error && (
        <div className="admin-error" role="alert">
          {error}
        </div>
      )}

      <div className="form-field">
        <label htmlFor="quotation-file">Quotation file (required)</label>
        <FileUpload
          label="Quotation file"
          onUploaded={setUploadedFile}
          onClear={() => setUploadedFile(null)}
          disabled={isSaving}
        />
      </div>

      <div className="modal-actions" style={{ marginTop: 0, justifyContent: 'flex-start' }}>
        <button
          type="button"
          className="btn btn-secondary"
          disabled={!uploadedFile}
          onClick={onStub}
        >
          Populate from file
        </button>
      </div>

      <div className="po-meta">
        <div className="form-field">
          <label htmlFor="quotation-reference">Quote reference</label>
          <input
            id="quotation-reference"
            type="text"
            value={quoteReference}
            onChange={(e) => setQuoteReference(e.target.value)}
            disabled={isSaving}
          />
        </div>
        <div className="form-field">
          <label htmlFor="quotation-date">Quote date</label>
          <input
            id="quotation-date"
            type="date"
            value={quoteDate}
            onChange={(e) => setQuoteDate(e.target.value)}
            disabled={isSaving}
          />
        </div>
        <div className="form-field">
          <label htmlFor="quotation-expiry">Expires at</label>
          <input
            id="quotation-expiry"
            type="date"
            value={expiresAt}
            onChange={(e) => setExpiresAt(e.target.value)}
            disabled={isSaving}
          />
        </div>
        <div className="form-field">
          <label htmlFor="quotation-currency">Currency</label>
          <select
            id="quotation-currency"
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            disabled={isSaving}
          >
            {currencies.map((c) => (
              <option key={c.code} value={c.code}>
                {c.code} — {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="form-field">
        <label htmlFor="quotation-notes">Notes</label>
        <textarea
          id="quotation-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          disabled={isSaving}
          rows={2}
        />
      </div>

      <h4>Line items</h4>
      {lines.map((line, index) => (
        <div className="po-meta" key={index}>
          <div className="form-field">
            <label htmlFor={`quotation-line-description-${index}`}>Description</label>
            <input
              id={`quotation-line-description-${index}`}
              type="text"
              value={line.description}
              onChange={(e) => updateLine(index, { description: e.target.value })}
              disabled={isSaving}
            />
          </div>
          <div className="form-field">
            <label htmlFor={`quotation-line-quantity-${index}`}>Quantity</label>
            <input
              id={`quotation-line-quantity-${index}`}
              type="number"
              min="0"
              step="any"
              value={line.quantity}
              onChange={(e) => updateLine(index, { quantity: e.target.value })}
              disabled={isSaving}
            />
          </div>
          <div className="form-field">
            <label htmlFor={`quotation-line-unit-cost-${index}`}>Unit cost</label>
            <input
              id={`quotation-line-unit-cost-${index}`}
              type="number"
              min="0"
              step="any"
              value={line.unitCost}
              onChange={(e) => updateLine(index, { unitCost: e.target.value })}
              disabled={isSaving}
            />
          </div>
          <div className="form-field">
            <label aria-hidden="true">&nbsp;</label>
            <button
              type="button"
              className="btn btn-small btn-danger"
              disabled={isSaving || lines.length <= 1}
              onClick={() => removeLineRow(index)}
            >
              Remove
            </button>
          </div>
        </div>
      ))}
      <div className="modal-actions" style={{ marginTop: 0, justifyContent: 'flex-start' }}>
        <button type="button" className="btn btn-secondary" onClick={addLineRow} disabled={isSaving}>
          Add line
        </button>
      </div>

      <div className="modal-actions" style={{ marginTop: 0, justifyContent: 'flex-start' }}>
        <button type="submit" className="btn btn-primary" disabled={isSaving || !uploadedFile}>
          {isSaving ? 'Saving…' : 'Save quotation'}
        </button>
        <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={isSaving}>
          Cancel
        </button>
      </div>
    </form>
  );
}
