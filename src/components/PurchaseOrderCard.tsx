import { StatusBadge } from './StatusBadge';
import type { PurchaseOrderDetail } from '../api/purchaseOrdersApi';
import type { ApprovalDto } from '../api/approvalsApi';
import { formatDate, formatDateTime, formatMoney, formatMoneyVector } from '../utils/format';
import '../screens/admin/admin.css';

export interface PurchaseOrderCardProps {
  po: PurchaseOrderDetail;
  /** Approval action state — only rendered when the user can act. */
  actionableIds: Set<number>;
  commentByApproval: Record<number, string>;
  onCommentChange: (approvalId: number, comment: string) => void;
  onApprovalAction: (approval: ApprovalDto, action: 'approve' | 'reject') => void;
  busyApprovalId: number | null;
  isApproveBlocked: boolean;
  /** The current user — for "in chain but not my turn" message. */
  currentUser: { id: number; roles: string[] } | null;
}

/** Returns true if the current user is matched by this approval definition. */
function userMatchesApproval(
  approval: ApprovalDto,
  currentUser: { id: number; roles: string[] } | null,
): boolean {
  if (currentUser === null) return false;
  if (approval.requiredUserId !== null) return approval.requiredUserId === currentUser.id;
  if (approval.requiredRoleName !== null)
    return currentUser.roles.includes(approval.requiredRoleName);
  return false;
}

export function PurchaseOrderCard({
  po,
  actionableIds,
  commentByApproval,
  onCommentChange,
  onApprovalAction,
  busyApprovalId,
  isApproveBlocked,
  currentUser,
}: PurchaseOrderCardProps) {
  // First pending approval by sequenceOrder — used for "awaiting" message.
  const firstPendingApproval = [...po.approvals]
    .filter((a) => a.status === 'Pending')
    .sort((a, b) => a.sequenceOrder - b.sequenceOrder)[0];
  const firstPendingTarget = firstPendingApproval
    ? (firstPendingApproval.requiredUserName ?? firstPendingApproval.requiredRoleName ?? 'next approver')
    : null;

  return (
    <div className="admin-panel po-document">
      {/* Document header */}
      <div className="po-document-header">
        <div>
          <div className="po-document-po-number">{po.poNumber}</div>
          <div style={{ marginTop: '0.35rem' }}>
            <StatusBadge status={po.status} />
          </div>
        </div>
        <div className="po-meta-label" style={{ textAlign: 'right' }}>
          Created {formatDate(po.createdAtUtc)}
        </div>
      </div>

      {/* Meta grid */}
      <div className="po-meta">
        <div className="po-meta-item">
          <span className="po-meta-label">Company</span>
          <span>{po.companyName}</span>
        </div>
        <div className="po-meta-item">
          <span className="po-meta-label">Issuer</span>
          <span>
            {po.issuerUserName}{' '}
            <span className="po-meta-label">(#{po.issuerUserId})</span>
          </span>
        </div>
        <div className="po-meta-item">
          <span className="po-meta-label">Currency</span>
          <span>{po.currency}</span>
        </div>
        {po.targetCompanyName && (
          <div className="po-meta-item">
            <span className="po-meta-label">For</span>
            <span>{po.targetCompanyName}</span>
          </div>
        )}
        {po.purchaseOrderTypeName && (
          <div className="po-meta-item">
            <span className="po-meta-label">Type</span>
            <span>{po.purchaseOrderTypeName}</span>
          </div>
        )}
      </div>

      {/* Milestone chips */}
      <div className="po-chips">
        <span className={`po-chip ${po.paidAtUtc ? 'po-chip-set' : ''}`}>
          {po.paidAtUtc ? `Paid ${formatDate(po.paidAtUtc)}` : 'Not paid'}
        </span>
        <span className={`po-chip ${po.deliveredAtUtc ? 'po-chip-set' : ''}`}>
          {po.deliveredAtUtc ? `Delivered ${formatDate(po.deliveredAtUtc)}` : 'Not delivered'}
        </span>
      </div>

      {/* Notes */}
      {po.notes && (
        <p className="po-meta-label" style={{ margin: 0, fontStyle: 'italic', fontSize: '0.88rem', color: 'var(--color-text-muted)' }}>
          {po.notes}
        </p>
      )}

      <hr style={{ border: 'none', borderTop: '1px solid var(--color-border)', margin: 0 }} />

      {/* Line items */}
      <div>
        <h3 style={{ margin: '0 0 0.75rem', fontSize: '1rem' }}>Line Items</h3>
        {po.lineItems.length === 0 ? (
          <div className="admin-empty" style={{ padding: '1rem 0' }}>
            {po.supplierBids.length > 0
              ? 'Line items are generated when the PO is approved.'
              : 'No line items.'}
          </div>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>Description</th>
                <th>Qty</th>
                <th>Unit Cost</th>
                <th>Discount</th>
                <th>Tax</th>
                <th>Line Total</th>
              </tr>
            </thead>
            <tbody>
              {po.lineItems.map((li) => (
                <tr key={li.id}>
                  <td>{li.description}</td>
                  <td>{li.quantity}</td>
                  <td>{formatMoney(li.unitCost, po.currency)}</td>
                  <td>{formatMoney(li.discountAmount, po.currency)}</td>
                  <td>{formatMoney(li.taxAmount, po.currency)}</td>
                  <td>{formatMoney(li.lineTotal, po.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Totals */}
        {po.lineItems.length > 0 && (
          <div className="po-totals" style={{ justifyContent: 'flex-end', marginTop: '0.75rem' }}>
            {po.hasMultiCurrencyTotals ? (
              <div className="po-total-item po-total-grand">
                <span className="po-meta-label">Total (by currency)</span>
                <span className="po-total-value" data-testid="po-total">
                  {formatMoneyVector(po.totals)}
                </span>
              </div>
            ) : (
              <>
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
                  <span className="po-total-value" data-testid="po-total">
                    {formatMoney(po.totalAmount, po.currency)}
                  </span>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      <hr style={{ border: 'none', borderTop: '1px solid var(--color-border)', margin: 0 }} />

      {/* Approvals */}
      <div>
        <h3 style={{ margin: '0 0 0.75rem', fontSize: '1rem' }}>Approvals</h3>
        {po.approvals.length === 0 ? (
          <div className="admin-empty" style={{ padding: '1rem 0' }}>
            No approvals defined.
          </div>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>Target</th>
                <th>Sequence</th>
                <th>Status</th>
                <th>Approved at</th>
                <th>Actor</th>
                <th>Comment</th>
              </tr>
            </thead>
            <tbody>
              {po.approvals.map((approval) => {
                const target =
                  approval.requiredUserName ?? approval.requiredRoleName ?? '—';
                const canAct = actionableIds.has(approval.id);
                const isInChain = userMatchesApproval(approval, currentUser);
                const isNotMyTurn =
                  isInChain && !canAct && approval.status === 'Pending';

                return (
                  <tr key={approval.id}>
                    <td>{target}</td>
                    <td>{approval.sequenceOrder}</td>
                    <td>
                      <StatusBadge status={approval.status} />
                      {canAct && (
                        <div className="approval-act">
                          <textarea
                            placeholder="Comment (optional)"
                            value={commentByApproval[approval.id] ?? ''}
                            onChange={(e) => onCommentChange(approval.id, e.target.value)}
                          />
                          {isApproveBlocked && (
                            <span className="form-error" style={{ fontSize: '0.8rem' }}>
                              A primary Supplier Bid must be set before approving.
                            </span>
                          )}
                          <div className="approval-act-buttons">
                            <button
                              type="button"
                              className="btn btn-small btn-primary"
                              disabled={busyApprovalId === approval.id || isApproveBlocked}
                              title={
                                isApproveBlocked
                                  ? 'Set a primary Supplier Bid first'
                                  : undefined
                              }
                              onClick={() => onApprovalAction(approval, 'approve')}
                            >
                              Approve
                            </button>
                            <button
                              type="button"
                              className="btn btn-small btn-danger"
                              disabled={busyApprovalId === approval.id}
                              onClick={() => onApprovalAction(approval, 'reject')}
                            >
                              Reject
                            </button>
                          </div>
                        </div>
                      )}
                      {isNotMyTurn && firstPendingTarget && (
                        <p className="po-meta-label" style={{ margin: '0.3rem 0 0', fontSize: '0.78rem' }}>
                          Awaiting: {firstPendingTarget}
                        </p>
                      )}
                    </td>
                    <td>{formatDateTime(approval.approvedAtUtc)}</td>
                    <td>{approval.approvedByUserName ?? '—'}</td>
                    <td>{approval.comment ?? '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
