import { useCallback, useEffect, useMemo, useState } from 'react';
import { createQuotation, listQuotations } from '../api/quotationsApi';
import type { QuotationListQuery, QuotationSummary } from '../api/quotationsApi';
import type { CreateQuotationRequest } from '../api/quotationsApi';
import { listSuppliers } from '../api/suppliersApi';
import type { Supplier } from '../api/suppliersApi';
import { listCurrencies } from '../api/currenciesApi';
import type { Currency } from '../api/currenciesApi';
import { getErrorMessage } from '../api/errorMessage';
import { Toast } from '../components/Toast';
import type { ToastMessage } from '../components/Toast';
import { QuotationFormModal } from './QuotationFormModal';
import { formatDate } from '../utils/format';
import './admin/admin.css';

type UsedFilter = '' | 'used' | 'unused';
type ExpiredFilter = '' | 'expired' | 'active';

function FilePreviewModal({
  quotation,
  onClose,
}: {
  quotation: QuotationSummary;
  onClose: () => void;
}) {
  const ext = quotation.originalFileName?.split('.').pop()?.toLowerCase() ?? '';
  const isPdf = ext === 'pdf';
  const isImage = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext);
  const canPreview = isPdf || isImage;

  return (
    <div
      className="modal-overlay"
      role="presentation"
      onClick={onClose}
      style={{ alignItems: 'center', padding: '1.5rem' }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Preview: ${quotation.originalFileName ?? 'file'}`}
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-lg)',
          width: '90vw',
          maxWidth: '900px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0.85rem 1.25rem',
            borderBottom: '1px solid var(--color-border)',
          }}
        >
          <span style={{ fontWeight: 600, fontSize: '0.92rem' }}>
            {quotation.originalFileName ?? 'File preview'}
          </span>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <a
              href={quotation.fileUrl}
              target="_blank"
              rel="noreferrer"
              className="btn btn-secondary btn-small"
            >
              Open file
            </a>
            <button type="button" className="btn btn-secondary btn-small" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {canPreview ? (
            isPdf ? (
              <iframe
                src={quotation.fileUrl}
                title={quotation.originalFileName ?? 'PDF'}
                style={{ flex: 1, border: 0, minHeight: '70vh' }}
              />
            ) : (
              <div
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '1.5rem',
                  overflow: 'auto',
                }}
              >
                <img
                  src={quotation.fileUrl}
                  alt={quotation.originalFileName ?? 'quotation file'}
                  style={{ maxWidth: '100%', maxHeight: '75vh', objectFit: 'contain' }}
                />
              </div>
            )
          ) : (
            <div
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.75rem',
                padding: '3rem',
                color: 'var(--color-text-muted)',
              }}
            >
              <p style={{ margin: 0 }}>
                This file type cannot be previewed inline.
              </p>
              <a
                href={quotation.fileUrl}
                target="_blank"
                rel="noreferrer"
                className="btn btn-primary"
              >
                Open file
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function QuotationsScreen() {
  const [quotations, setQuotations] = useState<QuotationSummary[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [currencies, setCurrencies] = useState<Currency[]>([]);

  const [supplierFilter, setSupplierFilter] = useState<number | ''>('');
  const [expiredFilter, setExpiredFilter] = useState<ExpiredFilter>('');
  const [usedFilter, setUsedFilter] = useState<UsedFilter>('');
  const [searchText, setSearchText] = useState('');

  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [previewQuotation, setPreviewQuotation] = useState<QuotationSummary | null>(null);

  const [toast, setToast] = useState<ToastMessage | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const query: QuotationListQuery = {
        supplierId: supplierFilter || undefined,
        isExpired: expiredFilter === '' ? undefined : expiredFilter === 'expired',
        isUsed: usedFilter === '' ? undefined : usedFilter === 'used',
      };
      setQuotations(await listQuotations(query));
    } catch (err) {
      setLoadError(getErrorMessage(err, 'Failed to load quotations.'));
    } finally {
      setIsLoading(false);
    }
  }, [supplierFilter, expiredFilter, usedFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    listSuppliers({ page: 1, pageSize: 200 })
      .then((result) => setSuppliers(result.items))
      .catch(() => setSuppliers([]));
    listCurrencies({ isActive: true })
      .then(setCurrencies)
      .catch(() => setCurrencies([]));
  }, []);

  const filtered = useMemo(() => {
    if (!searchText.trim()) return quotations;
    const term = searchText.toLowerCase();
    return quotations.filter(
      (q) =>
        q.supplierName.toLowerCase().includes(term) ||
        (q.description ?? '').toLowerCase().includes(term) ||
        (q.quoteReference ?? '').toLowerCase().includes(term) ||
        (q.notes ?? '').toLowerCase().includes(term),
    );
  }, [quotations, searchText]);

  const openCreate = () => {
    setFormError(null);
    setIsFormOpen(true);
  };

  const closeForm = () => setIsFormOpen(false);

  const handleSubmit = async (request: CreateQuotationRequest) => {
    setIsSaving(true);
    setFormError(null);
    try {
      await createQuotation(request);
      setToast({ kind: 'success', text: 'Quotation created.' });
      closeForm();
      await load();
    } catch (err) {
      setFormError(getErrorMessage(err, 'Failed to save the quotation.'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="admin-screen admin-screen--wide">
      <div className="admin-header">
        <h2>Quotations</h2>
        <div className="admin-filters">
          <input
            type="search"
            placeholder="Search supplier, reference, notes…"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{ minWidth: '220px' }}
          />

          <label htmlFor="quotation-supplier-filter">Supplier</label>
          <select
            id="quotation-supplier-filter"
            value={supplierFilter}
            onChange={(e) => setSupplierFilter(e.target.value ? Number(e.target.value) : '')}
          >
            <option value="">All</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.supplierName}
              </option>
            ))}
          </select>

          <label htmlFor="quotation-expired-filter">Expiry</label>
          <select
            id="quotation-expired-filter"
            value={expiredFilter}
            onChange={(e) => setExpiredFilter(e.target.value as ExpiredFilter)}
          >
            <option value="">All</option>
            <option value="active">Active / no expiry</option>
            <option value="expired">Expired</option>
          </select>

          <label htmlFor="quotation-used-filter">Usage</label>
          <select
            id="quotation-used-filter"
            value={usedFilter}
            onChange={(e) => setUsedFilter(e.target.value as UsedFilter)}
          >
            <option value="">All</option>
            <option value="used">Used</option>
            <option value="unused">Unused</option>
          </select>
        </div>
        <button type="button" className="btn btn-primary" onClick={openCreate}>
          New Quotation
        </button>
      </div>

      <div className="admin-panel">
        {isLoading ? (
          <div className="admin-loading">Loading quotations…</div>
        ) : loadError ? (
          <div className="admin-error" role="alert">
            {loadError}
          </div>
        ) : filtered.length === 0 ? (
          <div className="admin-empty">
            {searchText && quotations.length > 0 ? 'No quotations match your search.' : 'No quotations found.'}
          </div>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>Supplier</th>
                <th>Description</th>
                <th>Reference</th>
                <th>Quote date</th>
                <th>Currency</th>
                <th>Expiry</th>
                <th>Lines</th>
                <th>Status</th>
                <th>File</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((q) => (
                <tr key={q.id}>
                  <td>{q.supplierName}</td>
                  <td>{q.description ?? '—'}</td>
                  <td>{q.quoteReference ?? '—'}</td>
                  <td>{formatDate(q.quoteDate)}</td>
                  <td>{q.currency}</td>
                  <td>
                    {q.expiresAtUtc ? (
                      q.isExpired ? (
                        <span className="badge badge-danger">Expired {formatDate(q.expiresAtUtc)}</span>
                      ) : (
                        <span className="badge badge-warning">{formatDate(q.expiresAtUtc)}</span>
                      )
                    ) : (
                      <span className="badge badge-muted">No expiry</span>
                    )}
                  </td>
                  <td>{q.lineItemCount}</td>
                  <td>
                    <span className={q.isUsed ? 'badge badge-success' : 'badge badge-muted'}>
                      {q.isUsed ? 'Used' : 'Unused'}
                    </span>
                  </td>
                  <td>
                    {q.fileUrl ? (
                      <button
                        type="button"
                        className="btn-link"
                        onClick={() => setPreviewQuotation(q)}
                      >
                        Preview
                      </button>
                    ) : (
                      '—'
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {isFormOpen && (
        <QuotationFormModal
          suppliers={suppliers}
          currencies={currencies}
          isSaving={isSaving}
          error={formError}
          onSubmit={handleSubmit}
          onCancel={closeForm}
        />
      )}

      {previewQuotation && (
        <FilePreviewModal
          quotation={previewQuotation}
          onClose={() => setPreviewQuotation(null)}
        />
      )}

      <div className="toast-stack">
        <Toast toast={toast} onDismiss={() => setToast(null)} />
      </div>
    </section>
  );
}
