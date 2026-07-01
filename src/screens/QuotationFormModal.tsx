import { useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent, KeyboardEvent } from 'react';
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

function formatAmount(value: number): string {
  return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Create-only form for the standalone quotation library (no edit — captured quotations are
 * immutable; re-upload a new one instead). Mandatory file upload, supplier + currency pickers,
 * optional reference/expiry/notes, tax/discount rates, and a table-based line-item editor
 * (>=1 row required) with live totals.
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
  const [taxRate, setTaxRate] = useState('');
  const [discountRate, setDiscountRate] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<QuotationLineFormRow[]>([]);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [showStubModal, setShowStubModal] = useState(false);

  // Add-line form state
  const [addDesc, setAddDesc] = useState('');
  const [addQty, setAddQty] = useState('1');
  const [addUnitCost, setAddUnitCost] = useState('');
  const [addLineError, setAddLineError] = useState<string | null>(null);

  const addDescRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!currency && currencies.length > 0) {
      setCurrency(currencies[0].code);
    }
  }, [currencies, currency]);

  const totals = useMemo(() => {
    const subtotal = lines.reduce((s, l) => s + Number(l.quantity) * Number(l.unitCost), 0);
    const taxRateNum = taxRate === '' ? null : Number(taxRate);
    const discountRateNum = discountRate === '' || discountRate === '0' ? 0 : Number(discountRate);
    const taxAmount = taxRateNum === null ? 0 : (subtotal * taxRateNum) / 100;
    const taxedTotal = subtotal + taxAmount;
    const discountAmount = discountRateNum === 0 ? 0 : (taxedTotal * discountRateNum) / 100;
    const grandTotal = taxedTotal - discountAmount;
    return { subtotal, taxRateNum, taxAmount, discountRateNum, discountAmount, grandTotal };
  }, [lines, taxRate, discountRate]);

  const handleAddLine = () => {
    const descTrimmed = addDesc.trim();
    const qtyNum = Number(addQty);
    const costNum = Number(addUnitCost);

    if (!descTrimmed) {
      setAddLineError('Description is required.');
      return;
    }
    if (!Number.isFinite(qtyNum) || qtyNum <= 0) {
      setAddLineError('Quantity must be greater than 0.');
      return;
    }
    if (!Number.isFinite(costNum) || costNum < 0) {
      setAddLineError('Unit cost must be 0 or more.');
      return;
    }

    setLines((prev) => [
      ...prev,
      { description: descTrimmed, quantity: String(qtyNum), unitCost: String(costNum) },
    ]);
    setAddDesc('');
    setAddQty('1');
    setAddUnitCost('');
    setAddLineError(null);
    addDescRef.current?.focus();
  };

  const handleAddLineKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddLine();
    }
  };

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
      const lineDescription = line.description.trim();
      if (!lineDescription) continue;
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
      lineItems.push({ description: lineDescription, quantity, unitCost });
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
      taxRate: totals.taxRateNum,
      discountRate: totals.discountRateNum === 0 ? null : totals.discountRateNum,
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
        style={{ maxWidth: 'min(90vw, 860px)', maxHeight: '90vh', overflowY: 'auto' }}
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

          {/* Header row: Quote reference, Quote date, Expires at, Currency */}
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

          {/* Tax & discount row */}
          <div className="po-meta">
            <div className="form-field">
              <label htmlFor="quotation-tax-rate">Tax rate (%)</label>
              <input
                id="quotation-tax-rate"
                type="number"
                min="0"
                max="100"
                step="any"
                placeholder="e.g. 16"
                value={taxRate}
                onChange={(e) => setTaxRate(e.target.value)}
                disabled={isSaving}
              />
              <span className="form-hint">Leave blank if tax is pre-included in unit costs</span>
            </div>
            <div className="form-field">
              <label htmlFor="quotation-discount-rate">Discount rate (%)</label>
              <input
                id="quotation-discount-rate"
                type="number"
                min="0"
                max="100"
                step="any"
                placeholder="e.g. 5"
                value={discountRate}
                onChange={(e) => setDiscountRate(e.target.value)}
                disabled={isSaving}
              />
              <span className="form-hint">Leave blank or 0 for no discount</span>
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

          {/* Line items card */}
          <div className="admin-panel">
            {lines.length === 0 ? (
              <p className="admin-empty">No lines added yet.</p>
            ) : (
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Description</th>
                    <th>Qty</th>
                    <th>Unit Cost</th>
                    <th>Line Total</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line, index) => {
                    const lineTotal = Number(line.quantity) * Number(line.unitCost);
                    return (
                      <tr key={index}>
                        <td>{line.description}</td>
                        <td>{line.quantity}</td>
                        <td>{line.unitCost}</td>
                        <td>{formatAmount(lineTotal)}</td>
                        <td>
                          <button
                            type="button"
                            className="role-tree-icon-btn danger"
                            aria-label={`Remove line: ${line.description}`}
                            disabled={isSaving || lines.length <= 1}
                            onClick={() => removeLineRow(index)}
                          >
                            &#10005;
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}

            {lines.length > 0 && (
              <div className="po-totals" style={{ padding: '0.75rem 0.85rem' }}>
                <div className="po-total-item">
                  <span className="po-meta-label">Subtotal</span>
                  <span className="po-total-value">{formatAmount(totals.subtotal)}</span>
                </div>
                <div className="po-total-item">
                  <span className="po-meta-label">Tax</span>
                  <span className="po-total-value">
                    {totals.taxRateNum === null
                      ? 'pre-included'
                      : totals.taxRateNum === 0
                        ? 'none'
                        : `${totals.taxRateNum}%: ${formatAmount(totals.taxAmount)}`}
                  </span>
                </div>
                {totals.discountRateNum !== 0 && (
                  <div className="po-total-item">
                    <span className="po-meta-label">Discount</span>
                    <span className="po-total-value">
                      {totals.discountRateNum}%: -{formatAmount(totals.discountAmount)}
                    </span>
                  </div>
                )}
                <div className="po-total-item po-total-grand">
                  <span className="po-meta-label">Grand Total</span>
                  <span className="po-total-value">{formatAmount(totals.grandTotal)}</span>
                </div>
              </div>
            )}
          </div>

          {/* Add-line form */}
          <div>
            <h4 style={{ margin: '0 0 0.5rem' }}>Add line</h4>
            <div className="po-meta">
              <div className="form-field">
                <label htmlFor="add-line-description">Description</label>
                <input
                  id="add-line-description"
                  ref={addDescRef}
                  type="text"
                  value={addDesc}
                  onChange={(e) => setAddDesc(e.target.value)}
                  onKeyDown={handleAddLineKeyDown}
                  disabled={isSaving}
                />
              </div>
              <div className="form-field">
                <label htmlFor="add-line-qty">Qty</label>
                <input
                  id="add-line-qty"
                  type="number"
                  min="0"
                  step="any"
                  value={addQty}
                  onChange={(e) => setAddQty(e.target.value)}
                  onKeyDown={handleAddLineKeyDown}
                  disabled={isSaving}
                />
              </div>
              <div className="form-field">
                <label htmlFor="add-line-unit-cost">Unit Cost</label>
                <input
                  id="add-line-unit-cost"
                  type="number"
                  min="0"
                  step="any"
                  value={addUnitCost}
                  onChange={(e) => setAddUnitCost(e.target.value)}
                  onKeyDown={handleAddLineKeyDown}
                  disabled={isSaving}
                />
              </div>
            </div>
            {addLineError && <span className="form-error">{addLineError}</span>}
            <div className="modal-actions" style={{ marginTop: '0.5rem', justifyContent: 'flex-start' }}>
              <button type="button" className="btn btn-secondary" onClick={handleAddLine} disabled={isSaving}>
                Add line
              </button>
            </div>
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
