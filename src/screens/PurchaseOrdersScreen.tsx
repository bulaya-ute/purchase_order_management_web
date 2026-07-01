import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listPurchaseOrders } from '../api/purchaseOrdersApi';
import type { PurchaseOrderStatus, PurchaseOrderSummary } from '../api/purchaseOrdersApi';
import { listAllCompanies } from '../api/companiesApi';
import type { Company } from '../api/companiesApi';
import { getErrorMessage } from '../api/errorMessage';
import { Pagination } from '../components/Pagination';
import { StatusBadge } from '../components/StatusBadge';
import { formatDate, formatMoney } from '../utils/format';
import './admin/admin.css';

const STATUSES: PurchaseOrderStatus[] = ['Draft', 'Open', 'Approved', 'Rejected', 'Cancelled'];

export function PurchaseOrdersScreen() {
  const [orders, setOrders] = useState<PurchaseOrderSummary[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [totalCount, setTotalCount] = useState(0);
  const [statusFilter, setStatusFilter] = useState<PurchaseOrderStatus | ''>('');
  const [companyFilter, setCompanyFilter] = useState<number | ''>('');
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const result = await listPurchaseOrders({
        page,
        pageSize,
        status: statusFilter || undefined,
        companyId: companyFilter || undefined,
      });
      setOrders(result.items);
      setTotalCount(result.totalCount);
    } catch (err) {
      setLoadError(getErrorMessage(err, 'Failed to load purchase orders.'));
    } finally {
      setIsLoading(false);
    }
  }, [page, pageSize, statusFilter, companyFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  // Companies for the optional filter; failure here shouldn't break the list.
  useEffect(() => {
    listAllCompanies()
      .then(setCompanies)
      .catch(() => setCompanies([]));
  }, []);

  return (
    <section className="admin-screen admin-screen--wide">
      <div className="admin-header">
        <h2>Purchase Orders</h2>
        <Link to="/purchase-orders/new" className="btn btn-primary">
          New PO
        </Link>
      </div>

      <div className="admin-filters">
        <label htmlFor="po-status-filter">Status</label>
        <select
          id="po-status-filter"
          value={statusFilter}
          onChange={(e) => {
            setPage(1);
            setStatusFilter(e.target.value as PurchaseOrderStatus | '');
          }}
        >
          <option value="">All</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>

        <label htmlFor="po-company-filter">Company</label>
        <select
          id="po-company-filter"
          value={companyFilter}
          onChange={(e) => {
            setPage(1);
            setCompanyFilter(e.target.value ? Number(e.target.value) : '');
          }}
        >
          <option value="">All</option>
          {companies.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <div className="admin-panel">
        {isLoading ? (
          <div className="admin-loading">Loading purchase orders…</div>
        ) : loadError ? (
          <div className="admin-error" role="alert">
            {loadError}
          </div>
        ) : orders.length === 0 ? (
          <div className="admin-empty">No purchase orders match these filters.</div>
        ) : (
          <>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>PO number</th>
                  <th>Company</th>
                  <th>For</th>
                  <th>Status</th>
                  <th>Total</th>
                  <th>Issuer</th>
                  <th>Created</th>
                  <th>Milestones</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((po) => (
                  <tr key={po.id}>
                    <td>
                      <Link to={`/purchase-orders/${po.id}`}>{po.poNumber}</Link>
                    </td>
                    <td>{po.companyName}</td>
                    <td>{po.targetCompanyName ?? '—'}</td>
                    <td>
                      <StatusBadge status={po.status} />
                    </td>
                    <td>{formatMoney(po.totalAmount, po.currency)}</td>
                    <td>{po.issuerUserName}</td>
                    <td>{formatDate(po.createdAtUtc)}</td>
                    <td>
                      <div className="po-chips">
                        {po.paidAtUtc && <span className="po-chip po-chip-set">Paid</span>}
                        {po.deliveredAtUtc && (
                          <span className="po-chip po-chip-set">Delivered</span>
                        )}
                        {!po.paidAtUtc && !po.deliveredAtUtc && (
                          <span className="po-meta-label">—</span>
                        )}
                      </div>
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
    </section>
  );
}
