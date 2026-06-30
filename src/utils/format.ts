/**
 * Money formatter that respects the PO's ISO 4217 currency. Falls back to a plain
 * 2-decimal number with the raw currency code if the runtime doesn't recognise it.
 */
export function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

/**
 * Renders a per-currency money vector (e.g. PurchaseOrderDto.Totals, SupplierBidDto.Totals) as a
 * joined string like "ZMW 322.50 + USD 100.00". Totals across different currencies are never
 * summed/converted — this is the one place that formatting happens, so every screen renders a
 * multi-currency vector identically. Returns an em dash for an empty vector.
 */
export function formatMoneyVector(totals: { currency: string; totalAmount: number }[]): string {
  if (totals.length === 0) {
    return '—';
  }
  return totals.map((t) => formatMoney(t.totalAmount, t.currency)).join(' + ');
}

/** Formats a UTC ISO timestamp as a locale date (no time). Returns an em dash for null. */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) {
    return '—';
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return '—';
  }
  return date.toLocaleDateString();
}

/** Formats a UTC ISO timestamp as a locale date + time. Returns an em dash for null. */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) {
    return '—';
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return '—';
  }
  return date.toLocaleString();
}
