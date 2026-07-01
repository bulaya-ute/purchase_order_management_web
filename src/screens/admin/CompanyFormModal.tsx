import { useState } from 'react';
import type { FormEvent } from 'react';
import type { Company } from '../../api/companiesApi';

interface CompanyFormModalProps {
  /** Present when editing; absent when creating. */
  company?: Company;
  /** Candidate parents — the full company list minus the company being edited (and its descendants are not excluded client-side; the API validates cycles). */
  companies: Company[];
  /** Pre-selects the parent company picker when creating from a tree node's "Add child" button. */
  defaultParentCompanyId?: number;
  isSaving: boolean;
  error: string | null;
  onSubmit: (values: { name: string; parentCompanyId: number | null }) => void;
  onCancel: () => void;
}

export function CompanyFormModal({
  company,
  companies,
  defaultParentCompanyId,
  isSaving,
  error,
  onSubmit,
  onCancel,
}: CompanyFormModalProps) {
  const [name, setName] = useState(company?.name ?? '');
  const [parentCompanyId, setParentCompanyId] = useState<string>(() => {
    if (company?.parentCompanyId != null) return String(company.parentCompanyId);
    if (defaultParentCompanyId != null) return String(defaultParentCompanyId);
    return '';
  });
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setValidationError('Name is required.');
      return;
    }
    setValidationError(null);
    onSubmit({
      name: trimmed,
      parentCompanyId: parentCompanyId === '' ? null : Number(parentCompanyId),
    });
  };

  const otherCompanies = companies.filter((c) => c.id !== company?.id);

  return (
    <div className="modal-overlay" role="presentation" onClick={onCancel}>
      <div
        className="modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="company-form-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="company-form-title">{company ? 'Edit company' : 'New company'}</h3>
        <form className="admin-form" onSubmit={handleSubmit}>
          {error && <div className="admin-error" role="alert">{error}</div>}

          <div className="form-field">
            <label htmlFor="company-name">Name</label>
            <input
              id="company-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isSaving}
              autoFocus
            />
            {validationError && <span className="form-error">{validationError}</span>}
          </div>

          <div className="form-field">
            <label htmlFor="company-parent">Parent company</label>
            <select
              id="company-parent"
              value={parentCompanyId}
              onChange={(e) => setParentCompanyId(e.target.value)}
              disabled={isSaving}
            >
              <option value="">None (top-level)</option>
              {otherCompanies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={isSaving}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={isSaving}>
              {isSaving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
