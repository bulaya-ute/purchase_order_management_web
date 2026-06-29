/** Mirrors PurchaseOrderManagement.Api.Dtos.Common.PagedResult<T>. Page is 1-based. */
export interface PagedResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalCount: number;
}

/** Mirrors PurchaseOrderManagement.Api.Dtos.Common.PagedQuery. */
export interface PagedQuery {
  page?: number;
  pageSize?: number;
}

/** Builds a query string from a flat object of optional values, omitting undefined/null/empty. */
export function buildQueryString(params: object): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params) as [string, string | number | boolean | undefined | null][]) {
    if (value !== undefined && value !== null && value !== '') {
      search.set(key, String(value));
    }
  }
  const qs = search.toString();
  return qs ? `?${qs}` : '';
}
