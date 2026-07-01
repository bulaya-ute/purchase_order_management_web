import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getMyApprovals } from '../api/approvalsApi';
import type { MyApprovalDto } from '../api/approvalsApi';
import { listPurchaseOrders } from '../api/purchaseOrdersApi';
import type { PurchaseOrderSummary } from '../api/purchaseOrdersApi';
import { useAuth } from '../auth/useAuth';
import { formatDate, formatMoney } from '../utils/format';
import './admin/admin.css';

const OUTGOING_LIMIT = 10;

export function DashboardScreen() {
  const { user } = useAuth();

  const [outgoing, setOutgoing] = useState<PurchaseOrderSummary[]>([]);
  const [incoming, setIncoming] = useState<MyApprovalDto[]>([]);
  const [outgoingError, setOutgoingError] = useState<string | null>(null);
  const [incomingError, setIncomingError] = useState<string | null>(null);
  const [outgoingLoading, setOutgoingLoading] = useState(true);
  const [incomingLoading, setIncomingLoading] = useState(true);

  useEffect(() => {
    listPurchaseOrders({ page: 1, pageSize: 100 })
      .then((result) => {
        const mine = result.items
          .filter((po) => po.issuerUserId === user?.id)
          .slice(0, OUTGOING_LIMIT);
        setOutgoing(mine);
      })
      .catch(() => setOutgoingError('Failed to load your purchase orders.'))
      .finally(() => setOutgoingLoading(false));

    getMyApprovals()
      .then(setIncoming)
      .catch(() => setIncomingError('Failed to load pending approvals.'))
      .finally(() => setIncomingLoading(false));
  }, [user?.id]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem',  }}>
      <h2 style={{ margin: 0 }}>Home</h2>

      {/* Outgoing POs */}
      <div>
        <div className="admin-header" style={{ marginBottom: '0.5rem' }}>
          <h3 style={{ margin: 0 }}>My Purchase Orders</h3>
          <Link to="/purchase-orders" className="btn btn-secondary btn-small">
            View all
          </Link>
        </div>
        <div className="admin-panel">
          {outgoingLoading ? (
            <div className="admin-loading">Loading…</div>
          ) : outgoingError ? (
            <div className="admin-error" role="alert">
              {outgoingError}
            </div>
          ) : outgoing.length === 0 ? (
            <div className="admin-empty">
              No purchase orders yet.{' '}
              <Link to="/purchase-orders/new">Create one</Link>
            </div>
          ) : (
            <table className="admin-table">
              <thead>
                <tr>
                  <th>PO #</th>
                  <th>Company</th>
                  <th>Status</th>
                  <th>Total</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {outgoing.map((po) => (
                  <tr key={po.id}>
                    <td>
                      <Link to={`/purchase-orders/${po.id}`}>{po.poNumber}</Link>
                    </td>
                    <td>{po.companyName}</td>
                    <td>
                      <span
                        className={
                          po.status === 'Approved'
                            ? 'badge badge-success'
                            : po.status === 'Rejected' || po.status === 'Cancelled'
                              ? 'badge badge-danger'
                              : po.status === 'Open'
                                ? 'badge badge-info'
                                : 'badge badge-muted'
                        }
                      >
                        {po.status}
                      </span>
                    </td>
                    <td>{formatMoney(po.totalAmount, po.currency)}</td>
                    <td>{formatDate(po.createdAtUtc)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Incoming approvals */}
      <div>
        <div className="admin-header" style={{ marginBottom: '0.5rem' }}>
          <h3 style={{ margin: 0 }}>Awaiting My Approval</h3>
          <Link to="/approvals" className="btn btn-secondary btn-small">
            View all
          </Link>
        </div>
        <div className="admin-panel">
          {incomingLoading ? (
            <div className="admin-loading">Loading…</div>
          ) : incomingError ? (
            <div className="admin-error" role="alert">
              {incomingError}
            </div>
          ) : incoming.length === 0 ? (
            <div className="admin-empty">No pending approvals.</div>
          ) : (
            <table className="admin-table">
              <thead>
                <tr>
                  <th>PO #</th>
                  <th>Company</th>
                  <th>Total</th>
                  <th>Role</th>
                </tr>
              </thead>
              <tbody>
                {incoming.map((a) => (
                  <tr key={a.id}>
                    <td>
                      <Link to={`/purchase-orders/${a.purchaseOrderId}`}>{a.poNumber}</Link>
                    </td>
                    <td>{a.companyName}</td>
                    <td>{formatMoney(a.totalAmount, a.currency)}</td>
                    <td>{a.requiredRoleName ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
