import { useCallback, useEffect, useRef, useState } from 'react';
import {
  addBidItem,
  createBid,
  createStandaloneBid,
  deleteBidItem,
  getBid,
  updateBidItem,
} from '../api/bidsApi';
import type { SupplierBidDetail } from '../api/bidsApi';
import { getQuotation, listQuotations } from '../api/quotationsApi';
import type { Quotation, QuotationSummary } from '../api/quotationsApi';
import { listSuppliers } from '../api/suppliersApi';
import type { Supplier } from '../api/suppliersApi';
import { getErrorMessage } from '../api/errorMessage';
import { Toast } from '../components/Toast';
import type { ToastMessage } from '../components/Toast';
import { formatDate, formatMoney, formatMoneyVector } from '../utils/format';
import './admin/admin.css';

export interface SupplierBidComposerContentProps {
  /** If provided, the created bid is immediately attached to this PO. */
  purchaseOrderId?: number | null;
  /** Called when the user clicks Done (bid created successfully, or abandoned). */
  onDone: () => void;
  /** Called when the user clicks Cancel/Close without completing a bid. */
  onCancel: () => void;
}

/**
 * Shared content for the bid-creation flow: pick a supplier (creates a fresh bid immediately),
 * then add line items sourced from that supplier's quotations via a per-quotation line-picker
 * modal. The right column shows the bid's live items with inline quantity editing and removal.
 *
 * Navigation is delegated to the caller via onDone / onCancel so this component can be used
 * both as a routed screen and as a full-screen overlay modal.
 */
export function SupplierBidComposerContent({
  purchaseOrderId,
  onDone,
  onCancel,
}: SupplierBidComposerContentProps) {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [supplierId, setSupplierId] = useState('');
  const [bid, setBid] = useState<SupplierBidDetail | null>(null);
  const [isCreatingBid, setIsCreatingBid] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  // Guards against rapid supplier switching double-creating a bid for the same selection.
  const creationInFlight = useRef(false);

  const [quotations, setQuotations] = useState<QuotationSummary[]>([]);
  // Each quotation's line items, keyed by quotation id, fetched alongside the summary list so the
  // "N lines in this bid" chip can cross-reference sourceQuotationLineItemId without waiting for
  // the picker modal to be opened.
  const [quotationLineIds, setQuotationLineIds] = useState<Map<number, Set<number>>>(new Map());
  const [isLoadingQuotations, setIsLoadingQuotations] = useState(false);

  const [openQuotationId, setOpenQuotationId] = useState<number | null>(null);

  const [toast, setToast] = useState<ToastMessage | null>(null);

  useEffect(() => {
    listSuppliers({ page: 1, pageSize: 200 })
      .then((result) => setSuppliers(result.items))
      .catch(() => setSuppliers([]));
  }, []);

  const loadQuotations = useCallback(async (forSupplierId: number) => {
    setIsLoadingQuotations(true);
    try {
      const summaries = await listQuotations({ supplierId: forSupplierId });
      setQuotations(summaries);
      const details = await Promise.all(summaries.map((q) => getQuotation(q.id)));
      setQuotationLineIds(
        new Map(details.map((d) => [d.id, new Set(d.lineItems.map((li) => li.id))])),
      );
    } catch {
      setQuotations([]);
      setQuotationLineIds(new Map());
    } finally {
      setIsLoadingQuotations(false);
    }
  }, []);

  const refreshBid = useCallback(async (bidId: number) => {
    try {
      const detail = await getBid(bidId);
      setBid(detail);
    } catch (err) {
      setToast({ kind: 'error', text: getErrorMessage(err, 'Failed to refresh the bid.') });
    }
  }, []);

  const handleSupplierChange = async (value: string) => {
    setSupplierId(value);
    setBid(null);
    setQuotations([]);
    setCreateError(null);
    if (!value || creationInFlight.current) return;

    creationInFlight.current = true;
    setIsCreatingBid(true);
    try {
      const newSupplierId = Number(value);
      const created = purchaseOrderId
        ? await createBid(purchaseOrderId, { supplierId: newSupplierId })
        : await createStandaloneBid({ supplierId: newSupplierId });
      setBid(created);
      void loadQuotations(newSupplierId);
    } catch (err) {
      setCreateError(getErrorMessage(err, 'Failed to create the bid.'));
    } finally {
      setIsCreatingBid(false);
      creationInFlight.current = false;
    }
  };

  const handleQuantityBlur = async (itemId: number, value: string) => {
    if (!bid) return;
    const quantity = Number(value);
    const existing = bid.items.find((i) => i.id === itemId);
    if (!existing || !Number.isFinite(quantity) || quantity <= 0 || quantity === existing.quantity) {
      return;
    }
    try {
      await updateBidItem(bid.id, itemId, {
        description: existing.description,
        quantity,
        unitCost: existing.unitCost,
        currency: existing.currency,
        discountPercentage: existing.discountPercentage,
        taxPercentage: existing.taxPercentage,
        rowVersion: existing.rowVersion,
      });
      await refreshBid(bid.id);
    } catch (err) {
      setToast({ kind: 'error', text: getErrorMessage(err, 'Failed to update the quantity.') });
      await refreshBid(bid.id);
    }
  };

  const handleRemoveItem = async (itemId: number) => {
    if (!bid) return;
    try {
      await deleteBidItem(bid.id, itemId);
      await refreshBid(bid.id);
    } catch (err) {
      setToast({ kind: 'error', text: getErrorMessage(err, 'Failed to remove the line.') });
    }
  };

  return (
    <section className="admin-screen admin-screen--wide">
      <div className="admin-header">
        <h2>New Supplier Bid</h2>
        <button type="button" className="po-back-link btn-link" onClick={onCancel}>
          ← Cancel
        </button>
      </div>

      <div className="admin-panel" style={{ padding: '1rem' }}>
        {createError && (
          <div className="admin-error" role="alert">
            {createError}
          </div>
        )}
        <div className="form-field" style={{ maxWidth: '320px' }}>
          <label htmlFor="bid-composer-supplier">Supplier</label>
          <select
            id="bid-composer-supplier"
            value={supplierId}
            onChange={(e) => void handleSupplierChange(e.target.value)}
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
        {isCreatingBid && <div className="form-hint">Creating bid…</div>}
      </div>

      {bid && (
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
          {/* Left column: quotations to source lines from. */}
          <div className="admin-panel" style={{ flex: '1 1 360px', padding: '1rem' }}>
            <h3 style={{ marginTop: 0 }}>Quotations</h3>
            {isLoadingQuotations ? (
              <div className="admin-loading">Loading quotations…</div>
            ) : quotations.length === 0 ? (
              <div className="admin-empty">No quotations captured for this supplier yet.</div>
            ) : (
              <div className="bid-card-grid">
                {quotations.map((q) => {
                  const lineIds = quotationLineIds.get(q.id);
                  const linesInBid = bid.items.filter(
                    (item) =>
                      item.sourceQuotationLineItemId !== null &&
                      lineIds?.has(item.sourceQuotationLineItemId),
                  ).length;
                  return (
                    <button
                      key={q.id}
                      type="button"
                      className="bid-card bid-card-clickable"
                      onClick={() => setOpenQuotationId(q.id)}
                    >
                      <span className="bid-card-name">{q.quoteReference ?? `Quote #${q.id}`}</span>
                      <span className="bid-card-meta">{formatDate(q.quoteDate)}</span>
                      <div className="bid-card-badges">
                        {q.isExpired && <span className="badge badge-danger">Expired</span>}
                        {linesInBid > 0 && (
                          <span className="badge badge-info">
                            {linesInBid} line{linesInBid === 1 ? '' : 's'} in this bid
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right column: live bid items. */}
          <div className="admin-panel" style={{ flex: '2 1 560px', padding: '1rem' }}>
            <h3 style={{ marginTop: 0 }}>{bid.supplierName} — bid items</h3>
            <div className="po-meta" style={{ marginBottom: '0.75rem' }}>
              <div className="po-meta-item">
                <span className="po-meta-label">Total</span>
                <span className="po-total-value">{formatMoneyVector(bid.totals)}</span>
              </div>
              <div className="po-meta-item">
                <span className="po-meta-label">Items</span>
                <span>{bid.itemCount}</span>
              </div>
            </div>

            {bid.items.length === 0 ? (
              <div className="admin-empty">No bid items yet. Add lines from a quotation on the left.</div>
            ) : (
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Description</th>
                    <th>Qty</th>
                    <th>Unit</th>
                    <th>Line total</th>
                    <th aria-label="Actions" />
                  </tr>
                </thead>
                <tbody>
                  {bid.items.map((item) => (
                    <tr key={item.id}>
                      <td>{item.description}</td>
                      <td>
                        <input
                          type="number"
                          min="0"
                          step="any"
                          defaultValue={item.quantity}
                          style={{ width: '5rem' }}
                          onBlur={(e) => void handleQuantityBlur(item.id, e.target.value)}
                        />
                      </td>
                      <td>{formatMoney(item.unitCost, item.currency)}</td>
                      <td data-testid="bid-item-line-total">{formatMoney(item.lineTotal, item.currency)}</td>
                      <td>
                        <button
                          type="button"
                          className="btn btn-small btn-danger"
                          onClick={() => void handleRemoveItem(item.id)}
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            <div className="modal-actions">
              <button type="button" className="btn btn-primary" onClick={onDone}>
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {openQuotationId !== null && bid && (
        <QuotationLinePickerModal
          quotationId={openQuotationId}
          bid={bid}
          onClose={() => setOpenQuotationId(null)}
          onChanged={() => void refreshBid(bid.id)}
          onToast={setToast}
        />
      )}

      <div className="toast-stack">
        <Toast toast={toast} onDismiss={() => setToast(null)} />
      </div>
    </section>
  );
}

interface QuotationLinePickerModalProps {
  quotationId: number;
  bid: SupplierBidDetail;
  onClose: () => void;
  onChanged: () => void;
  onToast: (toast: ToastMessage) => void;
}

function QuotationLinePickerModal({
  quotationId,
  bid,
  onClose,
  onChanged,
  onToast,
}: QuotationLinePickerModalProps) {
  const [quotation, setQuotation] = useState<Quotation | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [togglingLineId, setTogglingLineId] = useState<number | null>(null);

  useEffect(() => {
    setIsLoading(true);
    setLoadError(null);
    getQuotation(quotationId)
      .then(setQuotation)
      .catch((err) => setLoadError(getErrorMessage(err, 'Failed to load the quotation.')))
      .finally(() => setIsLoading(false));
  }, [quotationId]);

  const bidItemBySourceLineId = new Map(
    bid.items
      .filter((item) => item.sourceQuotationLineItemId !== null)
      .map((item) => [item.sourceQuotationLineItemId as number, item]),
  );

  const handleToggle = async (lineId: number, checked: boolean) => {
    if (!quotation) return;
    setTogglingLineId(lineId);
    try {
      if (checked) {
        const line = quotation.lineItems.find((li) => li.id === lineId);
        if (!line) return;
        await addBidItem(bid.id, {
          description: line.description,
          quantity: line.quantity,
          unitCost: line.unitCost,
          sourceQuotationLineItemId: line.id,
        });
      } else {
        const existingItem = bidItemBySourceLineId.get(lineId);
        if (!existingItem) return;
        await deleteBidItem(bid.id, existingItem.id);
      }
      onChanged();
    } catch (err) {
      onToast({ kind: 'error', text: getErrorMessage(err, 'Failed to update the bid line.') });
    } finally {
      setTogglingLineId(null);
    }
  };

  return (
    <div className="modal-overlay" role="presentation" onClick={onClose}>
      <div
        className="modal-card bid-preview-card"
        role="dialog"
        aria-modal="true"
        aria-label="Quotation line items"
        onClick={(e) => e.stopPropagation()}
      >
        {isLoading ? (
          <div className="admin-loading">Loading quotation…</div>
        ) : loadError || !quotation ? (
          <div className="admin-error" role="alert">
            {loadError ?? 'Quotation not found.'}
          </div>
        ) : (
          <>
            <h3>{quotation.quoteReference ?? `Quote #${quotation.id}`}</h3>
            <div className="po-meta" style={{ marginBottom: '0.5rem' }}>
              <div className="po-meta-item">
                <span className="po-meta-label">Quote date</span>
                <span>{formatDate(quotation.quoteDate)}</span>
              </div>
              <div className="po-meta-item">
                <span className="po-meta-label">Currency</span>
                <span>{quotation.currency}</span>
              </div>
              {quotation.isExpired && <span className="badge badge-danger">Expired</span>}
            </div>

            {quotation.lineItems.length === 0 ? (
              <div className="admin-empty">This quotation has no line items.</div>
            ) : (
              <table className="admin-table">
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
                    const isInBid = bidItemBySourceLineId.has(line.id);
                    return (
                      <tr key={line.id}>
                        <td>
                          <input
                            type="checkbox"
                            checked={isInBid}
                            disabled={togglingLineId === line.id}
                            onChange={(e) => void handleToggle(line.id, e.target.checked)}
                            aria-label={`${isInBid ? 'Remove' : 'Add'} ${line.description} ${isInBid ? 'from' : 'to'} bid`}
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
            )}

            <div className="modal-actions">
              <button type="button" className="btn btn-secondary" onClick={onClose}>
                Close
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
