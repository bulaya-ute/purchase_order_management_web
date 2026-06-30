import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import type { Supplier } from '../api/suppliersApi';
import type { Currency } from '../api/currenciesApi';
import type { CreateQuotationLineItemRequest, CreateQuotationRequest } from '../api/quotationsApi';
import { FileUpload } from '../components/FileUpload';
import type { UploadedFile } from '../api/filesApi';
import { ConfirmDialog } from '../components/ConfirmDialog';

interface QuotationLineFormRow {
  description: string;
  quantity: string;
  unitCost: string;
}

const EMPTY_LINE: QuotationLineFormRow = { description: '', quantity: '', unitCost: '' };

interface QuotationFormModalProps {
  suppliers: Supplier[];
  currencies: Currency[];
  /** Pre-scoped supplier (e.g. opened from the bid composer for a known supplier) — hides the picker. */
  fixedSupplierId?: number;
  isSaving: boolean;
  error: string | null;
  onSubmit: (request: CreateQuotationRequest) => void;
  onCancel: () => void;
}

/**
 * Create-only form for the standalone quotation library (no edit — captured quotations are
 * immutable; re-upload a new one instead). Mandatory file upload, supplier + currency pickers,
 * optional reference/expiry/notes, and a repeatable line-item editor (>=1 row required).
 */
export function QuotationFormModal({
  suppliers,
  currencies,
  fixedSupplierId,
  isSaving,
  error,
  onSubmit,
  onCancel,
}: QuotationFormModalProps) {
  const [supplierId, setSupplierId] = useState(fixedSupplierId ? String(fixedSupplierId) : '');
  const [uploadedFile, setUploadedFile] = useState<UploadedFile | null>(null);
  const [description, setDescription] = useState('');
  const [quoteReference, setQuoteReference] = useState('');
  const [quoteDate, setQuoteDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [expiresAt, setExpiresAt] = useState('');
  const [currency, setCurrency] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<QuotationLineFormRow[]>([{ ...EMPTY_LINE }]);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [showStubModal, setShowStubModal] = useState(false);

  useEffect(() => {
    if (!currency && currencies.length > 0) {
      setCurrency(currencies[0].code);
    }
  }, [currencies, currency]);

  const updateLine = (index: number, patch: Partial<QuotationLineFormRow>) => {
    setLines((prev) => prev.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  };

  const addLineRow = () => setLines((prev) => [...prev, { ...EMPTY_LINE }]);

  const removeLineRow = (index: number) =>
    setLines((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev));

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!supplierId) {
      setValidationError('Supplier is required.');
      return;
    }
    if (!uploadedFile) {
      setValidationError('A quotation file must be uploaded first.');
      return;
    }
    if (!quoteDate) {
      setValidationError('Quote date is required.');
      return;
    }
    if (!currency) {
      setValidationError('Currency is required.');
      return;
    }

    const lineItems: CreateQuotationLineItemRequest[] = [];
    for (const line of lines) {
      const description = line.description.trim();
      if (!description) continue;
      const quantity = Number(line.quantity);
      const unitCost = Number(line.unitCost);
      if (!Number.isFinite(quantity) || quantity <= 0) {
        setValidationError('Each line item needs a quantity greater than 0.');
        return;
      }
      if (!Number.isFinite(unitCost) || unitCost < 0) {
        setValidationError('Each line item needs a unit cost of 0 or more.');
        return;
      }
      lineItems.push({ description, quantity, unitCost });
    }

    if (lineItems.length === 0) {
      setValidationError('Add at least one line item.');
      return;
    }

    setValidationError(null);
    const quoteDateIso = new Date(`${quoteDate}T00:00:00.000Z`).toISOString();
    const expiresAtIso = expiresAt ? new Date(`${expiresAt}T00:00:00.000Z`).toISOString() : null;
    onSubmit({
      supplierId: Number(supplierId),
      fileId: uploadedFile.id,
      description: description.trim() || null,
      quoteReference: quoteReference.trim() || null,
      quoteDate: quoteDateIso,
      expiresAtUtc: expiresAtIso,
      currency,
      notes: notes.trim() || null,
      lineItems,
    });
  };

  return (
    <div className="modal-overlay" role="presentation" onClick={onCancel}>
      <div
        className="modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="quotation-form-title"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '640px', maxHeight: '90vh', overflowY: 'auto' }}
      >
        <h3 id="quotation-form-title">New Quotation</h3>

        <form className="admin-form" onSubmit={handleSubmit}>
          {error && (
            <div className="admin-error" role="alert">
              {error}
            </div>
          )}

          {!fixedSupplierId && (
            <div className="form-field">
              <label htmlFor="quotation-supplier">Supplier</label>
              <select
                id="quotation-supplier"
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
                disabled={isSaving}
              >
                <option value="">Select a supplier…</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.supplierName}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="form-field">
            <label htmlFor="quotation-file">Quotation file (required)</label>
            <FileUpload
              label="Quotation file"
              onUploaded={setUploadedFile}
              onClear={() => setUploadedFile(null)}
              disabled={isSaving}
            />
          </div>

          <div className="modal-actions" style={{ marginTop: 0, justifyContent: 'flex-start' }}>
            <button
              type="button"
              className="btn btn-secondary"
              disabled={!uploadedFile}
              onClick={() => setShowStubModal(true)}
            >
              Populate from file
            </button>
          </div>

          <div className="form-field">
            <label htmlFor="quotation-description">Description</label>
            <input
              id="quotation-description"
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isSaving}
              placeholder="Brief description of what was quoted"
            />
          </div>

          <div className="po-meta">
            <div className="form-field">
              <label htmlFor="quotation-reference">Quote reference</label>
              <input
                id="quotation-reference"
                type="text"
                value={quoteReference}
                onChange={(e) => setQuoteReference(e.target.value)}
                disabled={isSaving}
              />
            </div>
            <div className="form-field">
              <label htmlFor="quotation-date">Quote date</label>
              <input
                id="quotation-date"
                type="date"
                value={quoteDate}
                onChange={(e) => setQuoteDate(e.target.value)}
                disabled={isSaving}
              />
            </div>
            <div className="form-field">
              <label htmlFor="quotation-expiry">Expires at</label>
              <input
                id="quotation-expiry"
                type="date"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                disabled={isSaving}
              />
            </div>
            <div className="form-field">
              <label htmlFor="quotation-currency">Currency</label>
              <select
                id="quotation-currency"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                disabled={isSaving}
              >
                {currencies.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.code} — {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-field">
            <label htmlFor="quotation-notes">Notes</label>
            <textarea
              id="quotation-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={isSaving}
              rows={2}
            />
          </div>

          <h4>Line items</h4>
          {lines.map((line, index) => (
            <div className="po-meta" key={index}>
              <div className="form-field">
                <label htmlFor={`quotation-line-description-${index}`}>Description</label>
                <input
                  id={`quotation-line-description-${index}`}
                  type="text"
                  value={line.description}
                  onChange={(e) => updateLine(index, { description: e.target.value })}
                  disabled={isSaving}
                />
              </div>
              <div className="form-field">
                <label htmlFor={`quotation-line-quantity-${index}`}>Quantity</label>
                <input
                  id={`quotation-line-quantity-${index}`}
                  type="number"
                  min="0"
                  step="any"
                  value={line.quantity}
                  onChange={(e) => updateLine(index, { quantity: e.target.value })}
                  disabled={isSaving}
                />
              </div>
              <div className="form-field">
                <label htmlFor={`quotation-line-unit-cost-${index}`}>Unit cost</label>
                <input
                  id={`quotation-line-unit-cost-${index}`}
                  type="number"
                  min="0"
                  step="any"
                  value={line.unitCost}
                  onChange={(e) => updateLine(index, { unitCost: e.target.value })}
                  disabled={isSaving}
                />
              </div>
              <div className="form-field">
                <label aria-hidden="true">&nbsp;</label>
                <button
                  type="button"
                  className="btn btn-small btn-danger"
                  disabled={isSaving || lines.length <= 1}
                  onClick={() => removeLineRow(index)}
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
          <div className="modal-actions" style={{ marginTop: 0, justifyContent: 'flex-start' }}>
            <button type="button" className="btn btn-secondary" onClick={addLineRow} disabled={isSaving}>
              Add line
            </button>
          </div>

          {validationError && <span className="form-error">{validationError}</span>}

          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={isSaving}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={isSaving || !uploadedFile}>
              {isSaving ? 'Saving…' : 'Save quotation'}
            </button>
          </div>
        </form>

        {showStubModal && (
          <ConfirmDialog
            title="Feature coming soon"
            message="Populate from file (AI-assisted extraction) is not implemented yet. Please enter the quotation details manually for now."
            confirmLabel="OK"
            cancelLabel="Close"
            onConfirm={() => setShowStubModal(false)}
            onCancel={() => setShowStubModal(false)}
          />
        )}
      </div>
    </div>
  );
}
