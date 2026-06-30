import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { createStandaloneBid, getBid, listBids } from '../api/bidsApi';
import type { SupplierBidDetail, SupplierBidSummary } from '../api/bidsApi';
import { listSuppliers } from '../api/suppliersApi';
import type { Supplier } from '../api/suppliersApi';
import { getErrorMessage } from '../api/errorMessage';
import { BidCard } from '../components/BidCard';
import { Toast } from '../components/Toast';
import type { ToastMessage } from '../components/Toast';
import { formatMoney, formatMoneyVector } from '../utils/format';
import './admin/admin.css';

/**
 * Master-detail library view over every supplier bid (attached or not). Left column: filterable
 * card list + "+ New Bid" shortcut (creates a standalone bid via createStandaloneBid). Right
 * column: full detail of the selected bid, including a link to its attached PO if any.
 */
export function SupplierBidsScreen() {
  const [bids, setBids] = useState<SupplierBidSummary[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [supplierFilter, setSupplierFilter] = useState<number | ''>('');
  const [unattachedOnly, setUnattachedOnly] = useState(false);

  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [selectedBid, setSelectedBid] = useState<SupplierBidDetail | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const [showNewBidForm, setShowNewBidForm] = useState(false);
  const [newBidSupplierId, setNewBidSupplierId] = useState('');
  const [newBidNotes, setNewBidNotes] = useState('');
  const [isCreatingBid, setIsCreatingBid] = useState(false);
  const [createBidError, setCreateBidError] = useState<string | null>(null);

  const [toast, setToast] = useState<ToastMessage | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const result = await listBids({
        supplierId: supplierFilter || undefined,
        unattachedOnly: unattachedOnly || undefined,
      });
      setBids(result);
    } catch (err) {
      setLoadError(getErrorMessage(err, 'Failed to load supplier bids.'));
    } finally {
      setIsLoading(false);
    }
  }, [supplierFilter, unattachedOnly]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    listSuppliers({ page: 1, pageSize: 200 })
      .then((result) => setSuppliers(result.items))
      .catch(() => setSuppliers([]));
  }, []);

  const loadDetail = useCallback(async (id: number) => {
    setIsLoadingDetail(true);
    setDetailError(null);
    try {
      const detail = await getBid(id);
      setSelectedBid(detail);
    } catch (err) {
      setDetailError(getErrorMessage(err, 'Failed to load the bid.'));
    } finally {
      setIsLoadingDetail(false);
    }
  }, []);

  useEffect(() => {
    if (selectedId !== null) {
      void loadDetail(selectedId);
    } else {
      setSelectedBid(null);
    }
  }, [selectedId, loadDetail]);

  const handleCreateBid = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!newBidSupplierId) {
      setCreateBidError('Choose a supplier.');
      return;
    }
    setIsCreatingBid(true);
    setCreateBidError(null);
    try {
      const created = await createStandaloneBid({
        supplierId: Number(newBidSupplierId),
        notes: newBidNotes.trim() || null,
      });
      setToast({ kind: 'success', text: 'Bid created.' });
      setNewBidSupplierId('');
      setNewBidNotes('');
      setShowNewBidForm(false);
      await load();
      setSelectedId(created.id);
    } catch (err) {
      setCreateBidError(getErrorMessage(err, 'Failed to create the bid.'));
    } finally {
      setIsCreatingBid(false);
    }
  };

  return (
    <section className="admin-screen">
      <div className="admin-header">
        <h2>Supplier Bids</h2>
        <div className="admin-filters">
          <label htmlFor="bid-supplier-filter">Supplier</label>
          <select
            id="bid-supplier-filter"
            value={supplierFilter}
            onChange={(e) => setSupplierFilter(e.target.value ? Number(e.target.value) : '')}
          >
            <option value="">All</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.supplierName}
              </option>
            ))}
          </select>

          <label htmlFor="bid-unattached-filter">
            <input
              id="bid-unattached-filter"
              type="checkbox"
              checked={unattachedOnly}
              onChange={(e) => setUnattachedOnly(e.target.checked)}
              style={{ marginRight: '0.35rem' }}
            />
            Unattached only
          </label>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => setShowNewBidForm((v) => !v)}>
          {showNewBidForm ? 'Cancel' : '+ New Bid'}
        </button>
      </div>

      {showNewBidForm && (
        <div className="admin-panel" style={{ padding: '1rem', marginBottom: '1rem' }}>
          <form className="admin-form" onSubmit={handleCreateBid}>
            {createBidError && (
              <div className="admin-error" role="alert">
                {createBidError}
              </div>
            )}
            <div className="po-meta">
              <div className="form-field">
                <label htmlFor="new-bid-supplier">Supplier</label>
                <select
                  id="new-bid-supplier"
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
                <label htmlFor="new-bid-notes">Notes</label>
                <input
                  id="new-bid-notes"
                  type="text"
                  value={newBidNotes}
                  onChange={(e) => setNewBidNotes(e.target.value)}
                  disabled={isCreatingBid}
                />
              </div>
            </div>
            <div className="modal-actions" style={{ marginTop: 0, justifyContent: 'flex-start' }}>
              <button type="submit" className="btn btn-primary" disabled={isCreatingBid}>
                {isCreatingBid ? 'Creating…' : 'Create bid'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
        <div className="admin-panel" style={{ flex: '1 1 380px', padding: '1rem', maxHeight: '70vh', overflowY: 'auto' }}>
          {isLoading ? (
            <div className="admin-loading">Loading bids…</div>
          ) : loadError ? (
            <div className="admin-error" role="alert">
              {loadError}
            </div>
          ) : bids.length === 0 ? (
            <div className="admin-empty">No supplier bids found.</div>
          ) : (
            <div className="bid-card-grid">
              {bids.map((bid) => (
                <BidCard
                  key={bid.id}
                  bid={bid}
                  isAwarded={false}
                  onClick={() => setSelectedId(bid.id)}
                />
              ))}
            </div>
          )}
        </div>

        <div className="admin-panel" style={{ flex: '2 1 480px', padding: '1rem', minHeight: '200px' }}>
          {selectedId === null ? (
            <div className="admin-empty">Select a bid to view its detail.</div>
          ) : isLoadingDetail ? (
            <div className="admin-loading">Loading bid…</div>
          ) : detailError || !selectedBid ? (
            <div className="admin-error" role="alert">
              {detailError ?? 'Bid not found.'}
            </div>
          ) : (
            <>
              <h3>{selectedBid.supplierName}</h3>
              <div className="po-meta" style={{ marginBottom: '0.5rem' }}>
                <div className="po-meta-item">
                  <span className="po-meta-label">Total</span>
                  <span className="po-total-value">{formatMoneyVector(selectedBid.totals)}</span>
                </div>
                <div className="po-meta-item">
                  <span className="po-meta-label">Items</span>
                  <span>{selectedBid.itemCount}</span>
                </div>
              </div>

              {selectedBid.purchaseOrderId !== null ? (
                <Link to={`/purchase-orders/${selectedBid.purchaseOrderId}`} className="btn btn-secondary">
                  View attached PO
                </Link>
              ) : (
                <span className="badge badge-muted">Unattached</span>
              )}

              {selectedBid.notes && (
                <p className="form-hint" style={{ marginTop: '0.75rem' }}>
                  {selectedBid.notes}
                </p>
              )}

              <h4 style={{ marginTop: '1rem' }}>Bid items</h4>
              {selectedBid.items.length === 0 ? (
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
                    </tr>
                  </thead>
                  <tbody>
                    {selectedBid.items.map((item) => (
                      <tr key={item.id}>
                        <td>{item.description}</td>
                        <td>{item.quantity}</td>
                        <td>{formatMoney(item.unitCost, item.currency)}</td>
                        <td>{formatMoney(item.discountAmount, item.currency)}</td>
                        <td>{formatMoney(item.taxAmount, item.currency)}</td>
                        <td>{formatMoney(item.lineTotal, item.currency)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </>
          )}
        </div>
      </div>

      <div className="toast-stack">
        <Toast toast={toast} onDismiss={() => setToast(null)} />
      </div>
    </section>
  );
}
