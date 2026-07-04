import { useCallback, useEffect, useState } from 'react';
import { getQuotation, listQuotations } from '../api/quotationsApi';
import type { Quotation, QuotationSummary } from '../api/quotationsApi';
import { cachedFetch } from '../utils/requestCache';
import { getErrorMessage } from '../api/errorMessage';
import { Pagination } from './Pagination';
import { formatDate, formatMoney } from '../utils/format';
import '../screens/admin/admin.css';

const PAGE_SIZE = 10;
const SEARCH_DEBOUNCE_MS = 300;

export interface QuotationBrowserPanelProps {
  supplierId: number;
  /** Quotations already present elsewhere (e.g. a bid's working set) — excluded from results. */
  excludeQuotationIds?: ReadonlySet<number>;
  /** Label for the single action button below the preview pane. */
  actionLabel: string;
  onAction: (quotation: QuotationSummary) => void;
  isActionBusy?: boolean;
}

/**
 * Shared paginated, searched quotation browser scoped to one supplier: a results table on the
 * left, a read-only detail preview on the right. Used by the "Add a quotation" modal and by
 * SupplierBidComposerContent — both need the same browse behavior, just a different action.
 */
export function QuotationBrowserPanel({
  supplierId,
  excludeQuotationIds,
  actionLabel,
  onAction,
  isActionBusy = false,
}: QuotationBrowserPanelProps) {
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const [results, setResults] = useState<QuotationSummary[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [preview, setPreview] = useState<Quotation | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);

  // Debounce the search box; changing the settled search text resets to page 1.
  useEffect(() => {
    const handle = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [searchInput]);

  const load = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const key = `quotations-${supplierId}-p${page}-ps${PAGE_SIZE}-${search}`;
      const result = await cachedFetch(key, () =>
        listQuotations({ supplierId, page, pageSize: PAGE_SIZE, search: search || undefined }),
      );
      setResults(result.items);
      setTotalCount(result.totalCount);
    } catch (err) {
      setLoadError(getErrorMessage(err, 'Failed to load quotations.'));
    } finally {
      setIsLoading(false);
    }
  }, [supplierId, page, search]);

  useEffect(() => {
    void load();
  }, [load]);

  const visibleResults = excludeQuotationIds
    ? results.filter((q) => !excludeQuotationIds.has(q.id))
    : results;

  useEffect(() => {
    if (selectedId === null) {
      setPreview(null);
      return;
    }
    let cancelled = false;
    setIsPreviewLoading(true);
    getQuotation(selectedId)
      .then((detail) => {
        if (!cancelled) setPreview(detail);
      })
      .catch(() => {
        if (!cancelled) setPreview(null);
      })
      .finally(() => {
        if (!cancelled) setIsPreviewLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  const selectedSummary = visibleResults.find((q) => q.id === selectedId) ?? null;

  return (
    <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
      {/* Left: search + paginated results */}
      <div style={{ flex: '1 1 360px', minWidth: 0 }}>
        <input
          type="search"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Search reference, description, notes…"
          style={{
            width: '100%',
            padding: '0.45rem 0.65rem',
            fontSize: '0.88rem',
            marginBottom: '0.75rem',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius)',
            background: 'var(--color-bg)',
            color: 'var(--color-text)',
          }}
        />

        {isLoading ? (
          <div className="admin-loading">Loading quotations…</div>
        ) : loadError ? (
          <div className="admin-error" role="alert">
            {loadError}
          </div>
        ) : visibleResults.length === 0 ? (
          <div className="admin-empty">
            {search ? `No results for "${search}".` : 'No quotations found for this supplier.'}
          </div>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>Reference</th>
                <th>Date</th>
                <th>Expiry</th>
              </tr>
            </thead>
            <tbody>
              {visibleResults.map((q) => (
                <tr
                  key={q.id}
                  onClick={() => setSelectedId(q.id)}
                  aria-selected={selectedId === q.id}
                  style={{
                    cursor: 'pointer',
                    background: selectedId === q.id ? 'var(--color-surface-muted)' : undefined,
                  }}
                >
                  <td>{q.quoteReference ?? `Quote #${q.id}`}</td>
                  <td>{formatDate(q.quoteDate)}</td>
                  <td>
                    {q.isExpired ? (
                      <span className="badge badge-danger">Expired</span>
                    ) : q.expiresAtUtc ? (
                      <span className="badge badge-warning">{formatDate(q.expiresAtUtc)}</span>
                    ) : (
                      <span className="badge badge-muted">No expiry</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {!isLoading && !loadError && totalCount > 0 && (
          <Pagination
            page={page}
            pageSize={PAGE_SIZE}
            totalCount={totalCount}
            onPageChange={setPage}
            onPageSizeChange={() => {}}
            pageSizeOptions={[PAGE_SIZE]}
          />
        )}
      </div>

      {/* Right: read-only preview */}
      <div style={{ flex: '1 1 320px', minWidth: 0 }}>
        {selectedId === null ? (
          <div className="admin-empty">Select a quotation to preview it.</div>
        ) : isPreviewLoading ? (
          <div className="admin-loading">Loading preview…</div>
        ) : preview ? (
          <>
            <h4 style={{ marginTop: 0 }}>{preview.quoteReference ?? `Quote #${preview.id}`}</h4>
            <div className="po-meta" style={{ marginBottom: '0.5rem' }}>
              <div className="po-meta-item">
                <span className="po-meta-label">Quote date</span>
                <span>{formatDate(preview.quoteDate)}</span>
              </div>
              <div className="po-meta-item">
                <span className="po-meta-label">Currency</span>
                <span>{preview.currency}</span>
              </div>
              {preview.isExpired && <span className="badge badge-danger">Expired</span>}
            </div>

            {preview.lineItems.length === 0 ? (
              <div className="admin-empty">No line items.</div>
            ) : (
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Description</th>
                    <th>Qty</th>
                    <th>Unit cost</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.lineItems.map((line) => (
                    <tr key={line.id}>
                      <td>{line.description}</td>
                      <td>{line.quantity}</td>
                      <td>{formatMoney(line.unitCost, preview.currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            <div className="po-totals" style={{ justifyContent: 'flex-end', marginTop: '0.5rem' }}>
              <div className="po-total-item po-total-grand">
                <span className="po-meta-label">Grand total</span>
                <span className="po-total-value">{formatMoney(preview.grandTotal, preview.currency)}</span>
              </div>
            </div>

            {preview.file && (
              <div style={{ marginTop: '0.75rem' }}>
                {['pdf'].includes(preview.file.originalFileName?.split('.').pop()?.toLowerCase() ?? '') ? (
                  <iframe
                    src={preview.file.url}
                    title={preview.file.originalFileName ?? 'PDF'}
                    style={{ width: '100%', height: '260px', border: '1px solid var(--color-border)' }}
                  />
                ) : ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(
                    preview.file.originalFileName?.split('.').pop()?.toLowerCase() ?? '',
                  ) ? (
                  <img
                    src={preview.file.url}
                    alt={preview.file.originalFileName ?? 'quotation file'}
                    style={{ maxWidth: '100%', maxHeight: '220px', objectFit: 'contain' }}
                  />
                ) : (
                  <a href={preview.file.url} target="_blank" rel="noreferrer" className="btn-link">
                    Open file
                  </a>
                )}
              </div>
            )}

            <div className="modal-actions" style={{ justifyContent: 'flex-start' }}>
              <button
                type="button"
                className="btn btn-primary"
                disabled={isActionBusy}
                onClick={() => selectedSummary && onAction(selectedSummary)}
              >
                {isActionBusy ? 'Working…' : actionLabel}
              </button>
            </div>
          </>
        ) : (
          <div className="admin-error" role="alert">
            Failed to load this quotation.
          </div>
        )}
      </div>
    </div>
  );
}
