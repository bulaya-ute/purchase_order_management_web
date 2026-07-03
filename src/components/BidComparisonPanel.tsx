import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getBid } from '../api/bidsApi';
import type { SupplierBidDetail, SupplierBidSummary } from '../api/bidsApi';
import type { PurchaseOrderDetail } from '../api/purchaseOrdersApi';
import { formatMoney, formatMoneyVector } from '../utils/format';
import '../screens/admin/admin.css';

export interface BidComparisonPanelProps {
  po: PurchaseOrderDetail;
  canAward: boolean;
  /** Covers both award and detach operations — only one runs at a time. */
  busyBidId: number | null;
  onAward: (supplierBidId: number) => void;
  pendingApprovalCount: number;
  firstPendingTarget: string | null;
  isApproveBlocked: boolean;
  // Draft-mode management props (omit for read-only detail view)
  isDraft?: boolean;
  availableBids?: SupplierBidSummary[];
  onAttach?: (bidId: number) => void;
  onDetach?: (supplierBidId: number) => void;
  isAttaching?: boolean;
  attachError?: string | null;
}

export function BidComparisonPanel({
  po,
  canAward,
  busyBidId,
  onAward,
  pendingApprovalCount,
  firstPendingTarget,
  isApproveBlocked,
  isDraft = false,
  availableBids = [],
  onAttach,
  onDetach,
  isAttaching = false,
  attachError = null,
}: BidComparisonPanelProps) {
  const attached = po.attachedSupplierBids ?? [];
  const isLocked = attached.some((b) => b.isPrimary);

  const sortedAttached = [...attached].sort((a, b) => {
    if (a.isPrimary && !b.isPrimary) return -1;
    if (!a.isPrimary && b.isPrimary) return 1;
    return 0;
  });

  const initialBidId = sortedAttached[0]?.supplierBidId ?? 0;
  const [selectedBidId, setSelectedBidId] = useState<number>(initialBidId);
  const [selectedBidDetail, setSelectedBidDetail] = useState<SupplierBidDetail | null>(null);
  const [isLoadingBid, setIsLoadingBid] = useState(false);
  const [attachBidId, setAttachBidId] = useState('');

  const bidSummaryMap = new Map(po.supplierBids.map((b) => [b.id, b]));

  useEffect(() => {
    if (!selectedBidId) return;
    let cancelled = false;
    setIsLoadingBid(true);
    setSelectedBidDetail(null);
    getBid(selectedBidId)
      .then((detail) => {
        if (!cancelled) setSelectedBidDetail(detail);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setIsLoadingBid(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedBidId]);

  const isSelectedPrimary =
    sortedAttached.find((b) => b.supplierBidId === selectedBidId)?.isPrimary ?? false;

  const quotationGroups: Map<number, { reference: string | null; count: number }> = new Map();
  if (selectedBidDetail) {
    for (const item of selectedBidDetail.items) {
      const existing = quotationGroups.get(item.sourceQuotationId);
      if (existing) {
        existing.count += 1;
      } else {
        quotationGroups.set(item.sourceQuotationId, {
          reference: item.sourceQuotationReference,
          count: 1,
        });
      }
    }
  }

  const handleAttach = () => {
    if (attachBidId) {
      onAttach?.(Number(attachBidId));
      setAttachBidId('');
    }
  };

  return (
    <div className="admin-panel" style={{ padding: '1rem' }}>
      <h3 style={{ margin: '0 0 0.75rem', fontSize: '1rem' }}>Supplier Bids</h3>

      {sortedAttached.length === 0 ? (
        <div className="admin-empty" style={{ padding: '0.75rem 0' }}>
          No bids attached{isDraft ? ' yet' : ''}.
        </div>
      ) : (
        <>
          {/* Bid card row */}
          <div className="po-bid-cards" role="radiogroup" aria-label="Supplier bids">
            {sortedAttached.map((attachedBid) => {
              const summary = bidSummaryMap.get(attachedBid.supplierBidId);
              const isSelected = attachedBid.supplierBidId === selectedBidId;
              return (
                <div
                  key={attachedBid.supplierBidId}
                  className={[
                    'po-bid-card',
                    isSelected ? 'po-bid-card--selected' : '',
                    attachedBid.isPrimary ? 'po-bid-card--awarded' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  onClick={() => setSelectedBidId(attachedBid.supplierBidId)}
                  role="radio"
                  aria-checked={isSelected}
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setSelectedBidId(attachedBid.supplierBidId);
                    }
                  }}
                >
                  <div className="po-bid-card-supplier">
                    {summary?.supplierName ?? `Bid #${attachedBid.supplierBidId}`}
                  </div>
                  {attachedBid.isPrimary && (
                    <span className="badge badge-success">
                      {isDraft ? 'Primary' : 'Awarded'}
                    </span>
                  )}
                  <div className="po-bid-card-total">
                    {summary ? formatMoneyVector(summary.totals) : '—'}
                  </div>
                  <div className="po-bid-card-meta">
                    {summary?.itemCount ?? 0} item{summary?.itemCount === 1 ? '' : 's'}
                    {' · '}
                    {summary?.quotationCount ?? 0} quotation
                    {summary?.quotationCount === 1 ? '' : 's'}
                  </div>
                  {isDraft && !isLocked && (
                    <button
                      type="button"
                      className="btn btn-small btn-danger"
                      style={{ marginTop: '0.5rem', width: '100%' }}
                      disabled={busyBidId === attachedBid.supplierBidId}
                      onClick={(e) => {
                        e.stopPropagation();
                        onDetach?.(attachedBid.supplierBidId);
                      }}
                    >
                      {busyBidId === attachedBid.supplierBidId ? 'Detaching…' : 'Detach'}
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {/* Preview row: line items + source quotations */}
          <div className="po-bid-preview-row">
            <div className="po-bid-preview">
              {isLoadingBid ? (
                <div className="admin-loading" style={{ padding: '1rem 0' }}>
                  Loading bid details…
                </div>
              ) : selectedBidDetail ? (
                <>
                  {selectedBidDetail.items.length === 0 ? (
                    <div className="admin-empty" style={{ padding: '1rem 0' }}>
                      No items in this bid.
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
                        {selectedBidDetail.items.map((item) => (
                          <tr key={item.id}>
                            <td>
                              {item.description}
                              {item.sourceQuotationReference && (
                                <span
                                  className="po-meta-label"
                                  style={{ display: 'block', fontSize: '0.75rem' }}
                                  title={`From quotation: ${item.sourceQuotationReference}`}
                                >
                                  {item.sourceQuotationReference}
                                </span>
                              )}
                            </td>
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

                  <div
                    className="po-totals"
                    style={{ justifyContent: 'flex-end', marginTop: '0.75rem' }}
                  >
                    <div className="po-total-item po-total-grand">
                      <span className="po-meta-label">Total</span>
                      <span className="po-total-value">
                        {formatMoneyVector(selectedBidDetail.totals)}
                      </span>
                    </div>
                  </div>

                  {canAward && !isSelectedPrimary && (
                    <div style={{ marginTop: '0.75rem' }}>
                      <button
                        type="button"
                        className="btn btn-primary"
                        disabled={busyBidId === selectedBidId}
                        onClick={() => onAward(selectedBidId)}
                      >
                        {isDraft ? 'Set as primary' : 'Award this bid'}
                      </button>
                    </div>
                  )}
                </>
              ) : null}
            </div>

            <div className="po-bid-quotations">
              <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.88rem', fontWeight: 600 }}>
                Source Quotations
              </h4>
              {selectedBidDetail && quotationGroups.size > 0 ? (
                Array.from(quotationGroups.entries()).map(([qId, info]) => (
                  <div key={qId} className="po-bid-quotation-card">
                    <div style={{ fontWeight: 600 }}>Quotation #{qId}</div>
                    <div className="po-meta-label">Reference: {info.reference ?? '—'}</div>
                    <div className="po-meta-label">
                      {info.count} item{info.count === 1 ? '' : 's'} from this quotation
                    </div>
                  </div>
                ))
              ) : selectedBidDetail ? (
                <div className="po-meta-label" style={{ fontSize: '0.85rem' }}>
                  No source quotations.
                </div>
              ) : null}
            </div>
          </div>
        </>
      )}

      {/* Draft-mode attach controls */}
      {isDraft && !isLocked && (
        <div
          style={{
            marginTop: sortedAttached.length > 0 ? '1rem' : '0.5rem',
            paddingTop: sortedAttached.length > 0 ? '1rem' : 0,
            borderTop: sortedAttached.length > 0 ? '1px solid var(--color-border)' : 'none',
          }}
        >
          {attachError && (
            <div className="admin-error" role="alert" style={{ marginBottom: '0.5rem' }}>
              {attachError}
            </div>
          )}
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end' }}>
            <div className="form-field" style={{ flex: 1, margin: 0 }}>
              <label htmlFor="attach-bid-select" style={{ fontSize: '0.85rem' }}>
                Attach a supplier bid
              </label>
              <select
                id="attach-bid-select"
                value={attachBidId}
                onChange={(e) => setAttachBidId(e.target.value)}
                disabled={isAttaching}
              >
                <option value="">Select a bid…</option>
                {availableBids.map((b) => (
                  <option key={b.id} value={b.id}>
                    Bid #{b.id} — {b.supplierName}
                    {b.itemCount > 0 ? ` (${b.itemCount} item${b.itemCount !== 1 ? 's' : ''})` : ''}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              className="btn btn-primary"
              style={{ flexShrink: 0 }}
              disabled={!attachBidId || isAttaching}
              onClick={handleAttach}
            >
              {isAttaching ? 'Attaching…' : 'Attach'}
            </button>
          </div>
          {availableBids.length === 0 && (
            <p className="form-hint" style={{ marginTop: '0.5rem' }}>
              No unattached bids available.{' '}
              <Link to="/supplier-bids/new">Create a new bid</Link> in the Supplier Bids library
              first.
            </p>
          )}
        </div>
      )}

      {/* Approval status summary (non-Draft only) */}
      {!isDraft && pendingApprovalCount > 0 && (
        <div className="po-bid-approval-status">
          <span>
            {pendingApprovalCount} pending approval
            {pendingApprovalCount > 1 ? 's' : ''}
          </span>
          {isApproveBlocked && firstPendingTarget && (
            <span className="form-hint">
              {' · '}Awaiting approval from {firstPendingTarget} before this bid can be awarded
            </span>
          )}
        </div>
      )}
    </div>
  );
}
