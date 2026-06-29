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
