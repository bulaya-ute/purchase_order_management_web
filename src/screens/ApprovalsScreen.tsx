import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getMyApprovals } from '../api/approvalsApi';
import type { MyApprovalDto } from '../api/approvalsApi';
import { getErrorMessage } from '../api/errorMessage';
import { formatMoney } from '../utils/format';
import './admin/admin.css';

export function ApprovalsScreen() {
  const [approvals, setApprovals] = useState<MyApprovalDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    setLoadError(null);
    getMyApprovals()
      .then((items) => {
        if (active) setApprovals(items);
      })
      .catch((err) => {
        if (active) setLoadError(getErrorMessage(err, 'Failed to load your approvals.'));
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <section className="admin-screen">
      <div className="admin-header">
        <h2>Approvals</h2>
      </div>

      <div className="admin-panel">
        {isLoading ? (
          <div className="admin-loading">Loading approvals…</div>
        ) : loadError ? (
          <div className="admin-error" role="alert">
            {loadError}
          </div>
        ) : approvals.length === 0 ? (
          <div className="admin-empty">Nothing awaiting your approval right now.</div>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>PO number</th>
                <th>Company</th>
                <th>Amount</th>
                <th>Sequence</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {approvals.map((a) => (
                <tr key={a.id}>
                  <td>
                    <Link to={`/purchase-orders/${a.purchaseOrderId}`}>{a.poNumber}</Link>
                  </td>
                  <td>{a.companyName}</td>
                  <td>{formatMoney(a.totalAmount, a.currency)}</td>
                  <td>{a.sequenceOrder}</td>
                  <td>
                    <div className="row-actions">
                      <Link
                        to={`/purchase-orders/${a.purchaseOrderId}`}
                        className="btn btn-small btn-secondary"
                      >
                        Review
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
