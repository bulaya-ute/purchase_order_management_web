import { useEffect, useState } from 'react';
import { listBids } from '../api/bidsApi';
import type { SupplierBidSummary } from '../api/bidsApi';
import { listSuppliers } from '../api/suppliersApi';
import type { Supplier } from '../api/suppliersApi';
import { getErrorMessage } from '../api/errorMessage';
import { formatMoneyVector } from '../utils/format';
import '../screens/admin/admin.css';

export interface AddSupplierBidModalProps {
  /** Suppliers who already have a bid attached to this PO — excluded from the picker. */
  excludeSupplierIds: ReadonlySet<number>;
  onAttachExisting: (bidId: number) => void;
  onStartNew: (supplierId: number) => void;
  isBusy: boolean;
  onClose: () => void;
}

export function AddSupplierBidModal({
  excludeSupplierIds,
  onAttachExisting,
  onStartNew,
  isBusy,
  onClose,
}: AddSupplierBidModalProps) {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [supplierId, setSupplierId] = useState('');

  const [unattachedBids, setUnattachedBids] = useState<SupplierBidSummary[]>([]);
  const [isLoadingBids, setIsLoadingBids] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    listSuppliers({ page: 1, pageSize: 200 })
      .then((result) => setSuppliers(result.items))
      .catch(() => setSuppliers([]));
  }, []);

  useEffect(() => {
    if (!supplierId) {
      setUnattachedBids([]);
      return;
    }
    setIsLoadingBids(true);
    setLoadError(null);
    listBids({ supplierId: Number(supplierId), unattachedOnly: true })
      .then(setUnattachedBids)
      .catch((err) => setLoadError(getErrorMessage(err, 'Failed to load existing bids.')))
      .finally(() => setIsLoadingBids(false));
  }, [supplierId]);

  const availableSuppliers = suppliers.filter((s) => !excludeSupplierIds.has(s.id));

  return (
    <div className="modal-overlay" role="presentation" onClick={onClose}>
      <div
        className="modal-card"
        role="dialog"
        aria-modal="true"
        aria-label="Add supplier bid"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ marginTop: 0 }}>Add a supplier bid</h3>

        <div className="form-field">
          <label htmlFor="add-bid-supplier">Supplier</label>
          <select
            id="add-bid-supplier"
            value={supplierId}
            onChange={(e) => setSupplierId(e.target.value)}
            disabled={isBusy}
          >
            <option value="">Select a supplier…</option>
            {availableSuppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.supplierName}
              </option>
            ))}
          </select>
        </div>

        {supplierId && (
          <>
            {loadError && (
              <div className="admin-error" role="alert">
                {loadError}
              </div>
            )}

            <button
              type="button"
              className="btn btn-primary"
              style={{ width: '100%', marginBottom: '0.75rem' }}
              disabled={isBusy}
              onClick={() => onStartNew(Number(supplierId))}
            >
              {isBusy ? 'Working…' : `Start a new bid for ${suppliers.find((s) => s.id === Number(supplierId))?.supplierName ?? 'this supplier'}`}
            </button>

            {isLoadingBids ? (
              <div className="admin-loading">Loading existing bids…</div>
            ) : unattachedBids.length > 0 ? (
              <>
                <p className="form-hint">Or use an existing unattached bid:</p>
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Bid</th>
                      <th>Items</th>
                      <th>Total</th>
                      <th aria-label="Actions" />
                    </tr>
                  </thead>
                  <tbody>
                    {unattachedBids.map((bid) => (
                      <tr key={bid.id}>
                        <td>
                          Bid #{bid.id}{' '}
                          {bid.status === 'Draft' && <span className="badge badge-muted">Draft</span>}
                        </td>
                        <td>{bid.itemCount}</td>
                        <td>{formatMoneyVector(bid.totals)}</td>
                        <td>
                          <button
                            type="button"
                            className="btn btn-small btn-secondary"
                            disabled={isBusy}
                            onClick={() => onAttachExisting(bid.id)}
                          >
                            Use this bid
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            ) : null}
          </>
        )}

        <div className="modal-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={isBusy}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
