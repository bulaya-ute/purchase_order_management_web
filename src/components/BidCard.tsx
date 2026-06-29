import type { SupplierBidSummary } from '../api/bidsApi';
import { formatDateTime, formatMoney } from '../utils/format';

interface BidCardProps {
  bid: SupplierBidSummary;
  currency: string;
  isAwarded: boolean;
  onClick?: () => void;
}

/**
 * Bid comparison card: supplier name, bid total, item/quotation counts, an expiry badge when any
 * of the bid's quotations have lapsed, and an Awarded marker. Shared between the read-only PO
 * detail view and the interactive composer (where clicking opens the bid preview/editor).
 */
export function BidCard({ bid, currency, isAwarded, onClick }: BidCardProps) {
  const content = (
    <>
      <span className="bid-card-name">{bid.supplierName}</span>
      <span className="bid-card-total">{formatMoney(bid.bidTotal, currency)}</span>
      <span className="bid-card-meta">
        {bid.itemCount} item{bid.itemCount === 1 ? '' : 's'} · {bid.quotationCount} quotation
        {bid.quotationCount === 1 ? '' : 's'}
      </span>
      <div className="bid-card-badges">
        {isAwarded && <span className="badge badge-success">Awarded</span>}
        {bid.hasExpiredQuotation ? (
          <span className="badge badge-danger">Expired quotation</span>
        ) : bid.earliestQuotationExpiryUtc ? (
          <span className="badge badge-warning">
            Expires {formatDateTime(bid.earliestQuotationExpiryUtc)}
          </span>
        ) : null}
      </div>
    </>
  );

  if (!onClick) {
    return <div className={`bid-card ${isAwarded ? 'bid-card-awarded' : ''}`}>{content}</div>;
  }

  return (
    <button
      type="button"
      className={`bid-card bid-card-clickable ${isAwarded ? 'bid-card-awarded' : ''}`}
      onClick={onClick}
    >
      {content}
    </button>
  );
}
