import { useState } from 'react';
import type { FormEvent } from 'react';
import type { Supplier } from '../api/suppliersApi';

export interface SupplierFormValues {
  supplierName: string;
  phone: string;
  email: string;
  address: string;
}

interface SupplierFormModalProps {
  /** Present when editing; absent when creating. */
  supplier?: Supplier;
  isSaving: boolean;
  error: string | null;
  onSubmit: (values: SupplierFormValues) => void;
  onCancel: () => void;
}

export function SupplierFormModal({ supplier, isSaving, error, onSubmit, onCancel }: SupplierFormModalProps) {
  const [supplierName, setSupplierName] = useState(supplier?.supplierName ?? '');
  const [phone, setPhone] = useState(supplier?.phone ?? '');
  const [email, setEmail] = useState(supplier?.email ?? '');
  const [address, setAddress] = useState(supplier?.address ?? '');
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedName = supplierName.trim();
    const trimmedPhone = phone.trim();
    const trimmedEmail = email.trim();
    const trimmedAddress = address.trim();

    if (!trimmedName || !trimmedPhone || !trimmedEmail || !trimmedAddress) {
      setValidationError('All fields are required.');
      return;
    }

    setValidationError(null);
    onSubmit({
      supplierName: trimmedName,
      phone: trimmedPhone,
      email: trimmedEmail,
      address: trimmedAddress,
    });
  };

  return (
    <div className="modal-overlay" role="presentation" onClick={onCancel}>
      <div
        className="modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="supplier-form-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="supplier-form-title">{supplier ? 'Edit supplier' : 'New supplier'}</h3>
        <form className="admin-form" onSubmit={handleSubmit}>
          {error && (
            <div className="admin-error" role="alert">
              {error}
            </div>
          )}

          <div className="form-field">
            <label htmlFor="supplier-name">Name</label>
            <input
              id="supplier-name"
              type="text"
              value={supplierName}
              onChange={(e) => setSupplierName(e.target.value)}
              disabled={isSaving}
              autoFocus
            />
          </div>

          <div className="form-field">
            <label htmlFor="supplier-phone">Phone</label>
            <input
              id="supplier-phone"
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              disabled={isSaving}
            />
          </div>

          <div className="form-field">
            <label htmlFor="supplier-email">Email</label>
            <input
              id="supplier-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isSaving}
            />
          </div>

          <div className="form-field">
            <label htmlFor="supplier-address">Address</label>
            <textarea
              id="supplier-address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              disabled={isSaving}
              rows={3}
            />
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
