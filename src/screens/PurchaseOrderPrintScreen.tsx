import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getPurchaseOrder } from '../api/purchaseOrdersApi';
import type { PurchaseOrderDetail } from '../api/purchaseOrdersApi';
import { getErrorMessage } from '../api/errorMessage';
import { StatusBadge } from '../components/StatusBadge';
import { formatDate, formatDateTime, formatMoney, formatMoneyVector } from '../utils/format';
import './admin/admin.css';
import './print.css';

/**
 * Print/export view for a single PO: every field laid out for paper, with a Print button that
 * triggers window.print(). The print stylesheet (print.css) hides the persistent app shell
 * (header + sidebar, see src/shell/AppShell.tsx / shell.css for the .app-header/.app-sidebar
 * class names) so only this screen's content reaches the printed page.
 */
export function PurchaseOrderPrintScreen() {
  const { id } = useParams<{ id: string }>();
  const poId = Number(id);

  const [po, setPo] = useState<PurchaseOrderDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const detail = await getPurchaseOrder(poId);
      setPo(detail);
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

  if (isLoading) {
    return (
      <section className="po-print">
        <div className="admin-panel">
          <div className="admin-loading">Loading purchase order…</div>
        </div>
      </section>
    );
  }

  if (loadError || !po) {
    return (
      <section className="po-print">
        <Link to="/purchase-orders" className="po-back-link po-print-hide">
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

  return (
    <section className="po-print">
      <div className="po-print-toolbar po-print-hide">
        <Link to={`/purchase-orders/${po.id}`} className="po-back-link">
          ← Back to purchase order
        </Link>
        <button type="button" className="btn btn-primary" onClick={() => window.print()}>
          Print
        </button>
      </div>

      <div className="po-detail-header">
        <h2>{po.poNumber}</h2>
        <StatusBadge status={po.status} />
      </div>

      <div className="admin-panel" style={{ padding: '1rem' }}>
        <div className="po-meta">
          <div className="po-meta-item">
            <span className="po-meta-label">Company</span>
            <span>{po.companyName}</span>
          </div>
          {po.targetCompanyName && (
            <div className="po-meta-item">
              <span className="po-meta-label">For (target branch)</span>
              <span>{po.targetCompanyName}</span>
            </div>
          )}
          {po.purchaseOrderTypeName && (
            <div className="po-meta-item">
              <span className="po-meta-label">Type</span>
              <span>{po.purchaseOrderTypeName}</span>
            </div>
          )}
          <div className="po-meta-item">
            <span className="po-meta-label">Issuer</span>
            <span>{po.issuerUserName}</span>
          </div>
          <div className="po-meta-item">
            <span className="po-meta-label">Currency</span>
            <span>{po.currency}</span>
          </div>
          <div className="po-meta-item">
            <span className="po-meta-label">Created</span>
            <span>{formatDateTime(po.createdAtUtc)}</span>
          </div>
          <div className="po-meta-item">
            <span className="po-meta-label">Awarded</span>
            <span>{formatDateTime(po.awardedAtUtc)}</span>
          </div>
          <div className="po-meta-item">
            <span className="po-meta-label">Paid</span>
            <span>{formatDate(po.paidAtUtc)}</span>
          </div>
          <div className="po-meta-item">
            <span className="po-meta-label">Delivered</span>
            <span>{formatDate(po.deliveredAtUtc)}</span>
          </div>
        </div>

        {po.notes && (
          <p className="form-hint" style={{ marginTop: '0.75rem' }}>
            Notes: {po.notes}
          </p>
        )}
      </div>

      {/* Totals */}
      <div className="admin-panel po-section" style={{ padding: '1rem' }}>
        <h3>Totals</h3>
        {po.hasMultiCurrencyTotals ? (
          <div className="po-totals">
            <div className="po-total-item po-total-grand">
              <span className="po-meta-label">Total (by currency)</span>
              <span className="po-total-value">{formatMoneyVector(po.totals)}</span>
            </div>
          </div>
        ) : (
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
              <span className="po-total-value">{formatMoney(po.totalAmount, po.currency)}</span>
            </div>
          </div>
        )}
      </div>

      {/* Line items */}
      <div className="admin-panel po-section" style={{ padding: '1rem' }}>
        <h3>Line Items</h3>
        {po.lineItems.length === 0 ? (
          <div className="admin-empty">No line items.</div>
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
              {po.lineItems.map((li) => (
                <tr key={li.id}>
                  <td>{li.description}</td>
                  <td>{li.quantity}</td>
                  <td>{formatMoney(li.unitCost, li.currency)}</td>
                  <td>{formatMoney(li.discountAmount, li.currency)}</td>
                  <td>{formatMoney(li.taxAmount, li.currency)}</td>
                  <td>{formatMoney(li.lineTotal, li.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Supplier bids */}
      {po.supplierBids.length > 0 && (
        <div className="admin-panel po-section" style={{ padding: '1rem' }}>
          <h3>Supplier Bids</h3>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Supplier</th>
                <th>Total</th>
                <th>Items</th>
                <th>Awarded</th>
              </tr>
            </thead>
            <tbody>
              {po.supplierBids.map((bid) => (
                <tr key={bid.id}>
                  <td>{bid.supplierName}</td>
                  <td>{formatMoneyVector(bid.totals)}</td>
                  <td>{bid.itemCount}</td>
                  <td>{bid.id === po.awardedSupplierBidId ? 'Yes' : 'No'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Approvals */}
      <div className="admin-panel po-section" style={{ padding: '1rem' }}>
        <h3>Approvals</h3>
        {po.approvals.length === 0 ? (
          <div className="admin-empty">No approvals defined.</div>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>Target</th>
                <th>Status</th>
                <th>Actor</th>
                <th>Date</th>
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
                    <td>
                      <StatusBadge status={approval.status} />
                    </td>
                    <td>{approval.approvedByUserName ?? '—'}</td>
                    <td>{formatDateTime(approval.approvedAtUtc)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
