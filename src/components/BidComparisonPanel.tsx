import { useEffect, useState } from 'react';
import { getBid } from '../api/bidsApi';
import type { SupplierBidDetail } from '../api/bidsApi';
import type { PurchaseOrderDetail } from '../api/purchaseOrdersApi';
import { formatMoney, formatMoneyVector } from '../utils/format';
import '../screens/admin/admin.css';

export interface BidComparisonPanelProps {
  po: PurchaseOrderDetail;
  canAward: boolean;
  busyPrimaryBidId: number | null;
  onAward: (supplierBidId: number) => void;
  pendingApprovalCount: number;
  firstPendingTarget: string | null;
  isApproveBlocked: boolean;
}

export function BidComparisonPanel({
  po,
  canAward,
  busyPrimaryBidId,
  onAward,
  pendingApprovalCount,
  firstPendingTarget,
  isApproveBlocked,
}: BidComparisonPanelProps) {
  const attached = po.attachedSupplierBids ?? [];

  // Awarded bid first, then alternatives.
  const sortedAttached = [...attached].sort((a, b) => {
    if (a.isPrimary && !b.isPrimary) return -1;
    if (!a.isPrimary && b.isPrimary) return 1;
    return 0;
  });

  // Initial selection: awarded bid if locked, otherwise the first attached bid.
  const initialBidId = sortedAttached[0]?.supplierBidId ?? 0;
  const [selectedBidId, setSelectedBidId] = useState<number>(initialBidId);
  const [selectedBidDetail, setSelectedBidDetail] = useState<SupplierBidDetail | null>(null);
  const [isLoadingBid, setIsLoadingBid] = useState(false);

  // Map bid id → summary for the card header info before detail loads.
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
      .catch(() => {
        // Non-fatal — the preview just stays blank.
      })
      .finally(() => {
        if (!cancelled) setIsLoadingBid(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedBidId]);

  if (sortedAttached.length === 0) return null;

  const isSelectedPrimary =
    sortedAttached.find((b) => b.supplierBidId === selectedBidId)?.isPrimary ?? false;

  // Group selected bid items by source quotation.
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

  return (
    <div className="admin-panel" style={{ padding: '1rem' }}>
      <h3 style={{ margin: '0 0 0.75rem', fontSize: '1rem' }}>Supplier Bids</h3>

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
                <span className="badge badge-success">Awarded</span>
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
            </div>
          );
        })}
      </div>

      {/* Preview row: line items + source quotations */}
      <div className="po-bid-preview-row">
        {/* Left: line items */}
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

              {/* Totals */}
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

              {/* Award button */}
              {canAward && !isSelectedPrimary && (
                <div style={{ marginTop: '0.75rem' }}>
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={busyPrimaryBidId === selectedBidId}
                    onClick={() => onAward(selectedBidId)}
                  >
                    Award this bid
                  </button>
                </div>
              )}
            </>
          ) : null}
        </div>

        {/* Right: source quotations */}
        <div className="po-bid-quotations">
          <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.88rem', fontWeight: 600 }}>
            Source Quotations
          </h4>
          {selectedBidDetail && quotationGroups.size > 0 ? (
            Array.from(quotationGroups.entries()).map(([qId, info]) => (
              <div key={qId} className="po-bid-quotation-card">
                <div style={{ fontWeight: 600 }}>Quotation #{qId}</div>
                <div className="po-meta-label">
                  Reference: {info.reference ?? '—'}
                </div>
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

      {/* Approval status summary */}
      {pendingApprovalCount > 0 && (
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
