import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import type { Currency } from '../../api/currenciesApi';

interface CurrencyFormModalProps {
  currency: Currency | undefined;
  isSaving: boolean;
  error: string | null;
  onSubmit: (values: { code: string; name: string; isActive: boolean }) => void;
  onCancel: () => void;
}

export function CurrencyFormModal({
  currency,
  isSaving,
  error,
  onSubmit,
  onCancel,
}: CurrencyFormModalProps) {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    if (currency) {
      setCode(currency.code);
      setName(currency.name);
      setIsActive(currency.isActive);
    }
  }, [currency]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedName = name.trim();
    const trimmedCode = code.trim();

    if (!trimmedCode) {
      setValidationError('Code is required.');
      return;
    }
    if (trimmedCode.length !== 3) {
      setValidationError('Code must be exactly 3 characters.');
      return;
    }
    if (!trimmedName) {
      setValidationError('Name is required.');
      return;
    }

    setValidationError(null);
    onSubmit({ code: trimmedCode.toUpperCase(), name: trimmedName, isActive });
  };

  const isEditing = !!currency;

  return (
    <div className="modal-overlay" role="presentation" onClick={onCancel}>
      <div
        className="modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="currency-form-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="currency-form-title">{isEditing ? 'Edit currency' : 'New currency'}</h3>

        <form className="admin-form" onSubmit={handleSubmit}>
          {error && <div className="admin-error" role="alert">{error}</div>}

          <div className="form-field">
            <label htmlFor="currency-code">Code (3 characters)</label>
            <input
              id="currency-code"
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              disabled={isSaving || isEditing}
              maxLength={3}
              autoFocus={!isEditing}
              placeholder="e.g., ZMW"
            />
          </div>

          <div className="form-field">
            <label htmlFor="currency-name">Name</label>
            <input
              id="currency-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isSaving}
              autoFocus={isEditing}
            />
          </div>

          <div className="form-field form-field-checkbox">
            <input
              id="currency-active"
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              disabled={isSaving}
            />
            <label htmlFor="currency-active">Active</label>
          </div>

          {validationError && <span className="form-error">{validationError}</span>}

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
