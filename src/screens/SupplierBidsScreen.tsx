import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { listBids } from '../api/bidsApi';
import type { SupplierBidSummary } from '../api/bidsApi';
import { listSuppliers } from '../api/suppliersApi';
import type { Supplier } from '../api/suppliersApi';
import { getErrorMessage } from '../api/errorMessage';
import { formatMoneyVector } from '../utils/format';
import './admin/admin.css';

const PAGE_SIZE = 20;

/**
 * Paginated library view over every supplier bid (attached or not): supplier, item count,
 * per-currency total vector, and attached-PO/unattached status. Filters by supplier, unattached
 * status, and a client-side supplier-name search. "+ New bid" hands off to the dedicated
 * composer screen, which is the only place bid items get added.
 */
export function SupplierBidsScreen() {
  const navigate = useNavigate();

  const [bids, setBids] = useState<SupplierBidSummary[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [supplierFilter, setSupplierFilter] = useState<number | ''>('');
  const [unattachedOnly, setUnattachedOnly] = useState(false);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [page, setPage] = useState(1);

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

  const handleSearchSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  };

  const filteredBids = search
    ? bids.filter((b) => b.supplierName.toLowerCase().includes(search.toLowerCase()))
    : bids;

  const totalCount = filteredBids.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const pageBids = filteredBids.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

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

          <form onSubmit={handleSearchSubmit} role="search" style={{ display: 'flex', gap: '0.5rem' }}>
            <label htmlFor="bid-search" style={{ alignSelf: 'center' }}>
              Search
            </label>
            <input
              id="bid-search"
              type="search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Supplier name…"
            />
            <button type="submit" className="btn btn-small btn-secondary">
              Search
            </button>
          </form>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => navigate('/supplier-bids/new')}>
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

            <div className="admin-pagination">
              <span>
                Page {page} of {totalPages} ({totalCount} total)
              </span>
              <button
                type="button"
                className="btn btn-small"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
              >
                Previous
              </button>
              <button
                type="button"
                className="btn btn-small"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
              >
                Next
              </button>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
