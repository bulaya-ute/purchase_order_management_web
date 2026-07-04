import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { listBids } from '../api/bidsApi';
import { SupplierBidComposerModal } from './SupplierBidComposerModal';
import type { SupplierBidSummary } from '../api/bidsApi';
import { listSuppliers } from '../api/suppliersApi';
import type { Supplier } from '../api/suppliersApi';
import { getErrorMessage } from '../api/errorMessage';
import { Pagination } from '../components/Pagination';
import { formatMoneyVector } from '../utils/format';
import { scoreMatch } from '../utils/search';
import './admin/admin.css';

/**
 * Paginated library view over every supplier bid (attached or not): supplier, item count,
 * per-currency total vector, and attached-PO/unattached status. Filters by supplier, unattached
 * status, and a client-side supplier-name search. "+ New bid" hands off to the dedicated
 * composer screen, which is the only place bid items get added.
 */
export function SupplierBidsScreen() {
  const [showComposer, setShowComposer] = useState(false);

  const [bids, setBids] = useState<SupplierBidSummary[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [supplierFilter, setSupplierFilter] = useState<number | ''>('');
  const [unattachedOnly, setUnattachedOnly] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

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

  const filteredBids = useMemo(() => {
    const scored = bids.map((b) => ({
      item: b,
      score: scoreMatch(search, [b.supplierName]),
    }));
    if (scored[0]?.score === -1) return bids; // empty query sentinel
    return scored
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((x) => x.item);
  }, [bids, search]);

  const totalCount = filteredBids.length;
  const pageBids = filteredBids.slice((page - 1) * pageSize, page * pageSize);

  return (
    <section className="admin-screen">
      <div className="admin-header">
        <h2>Supplier Bids</h2>
        <div className="admin-filters">
          <label htmlFor="bid-supplier-filter">Supplier</label>
          <select
            id="bid-supplier-filter"
            value={supplierFilter}
            onChange={(e) => {
              setSupplierFilter(e.target.value ? Number(e.target.value) : '');
              setPage(1);
            }}
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
              onChange={(e) => {
                setUnattachedOnly(e.target.checked);
                setPage(1);
              }}
              style={{ marginRight: '0.35rem' }}
            />
            Unattached only
          </label>

          <input
            id="bid-search"
            type="search"
            aria-label="Search supplier bids"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search supplier…"
          />
        </div>
        <button type="button" className="btn btn-primary" onClick={() => setShowComposer(true)}>
          + New bid
        </button>
      </div>

      <div className="admin-panel">
        {isLoading ? (
          <div className="admin-loading">Loading bids…</div>
        ) : loadError ? (
          <div className="admin-error" role="alert">
            {loadError}
          </div>
        ) : pageBids.length === 0 ? (
          <div className="admin-empty">No supplier bids found.</div>
        ) : (
          <>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Supplier</th>
                  <th>Items</th>
                  <th>Total</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {pageBids.map((bid) => (
                  <tr key={bid.id}>
                    <td>{bid.supplierName}</td>
                    <td>{bid.itemCount}</td>
                    <td>{formatMoneyVector(bid.totals)}</td>
                    <td>
                      {bid.purchaseOrderId !== null ? (
                        <Link to={`/purchase-orders/${bid.purchaseOrderId}`} className="badge badge-info">
                          Attached to PO
                        </Link>
                      ) : (
                        <span className="badge badge-muted">Unattached</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <Pagination
              page={page}
              pageSize={pageSize}
              totalCount={totalCount}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
            />
          </>
        )}
      </div>

      {showComposer && (
        <SupplierBidComposerModal
          onClose={() => setShowComposer(false)}
          onDone={() => {
            setShowComposer(false);
            void load();
          }}
        />
      )}
    </section>
  );
}
