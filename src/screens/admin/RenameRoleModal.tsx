import { useState } from 'react';
import type { FormEvent } from 'react';
import type { Role } from '../../api/rolesApi';

interface RenameRoleModalProps {
  role: Role;
  isSaving: boolean;
  error: string | null;
  onSubmit: (name: string) => void;
  onCancel: () => void;
}

export function RenameRoleModal({ role, isSaving, error, onSubmit, onCancel }: RenameRoleModalProps) {
  const [name, setName] = useState(role.name);
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setValidationError('Name is required.');
      return;
    }
    setValidationError(null);
    onSubmit(trimmed);
  };

  return (
    <div className="modal-overlay" role="presentation" onClick={onCancel}>
      <div
        className="modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="rename-role-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="rename-role-title">Rename role</h3>
        <form className="admin-form" onSubmit={handleSubmit}>
          {error && <div className="admin-error" role="alert">{error}</div>}

          <div className="form-field">
            <label htmlFor="rename-role-name">Name</label>
            <input
              id="rename-role-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isSaving}
              autoFocus
            />
            {validationError && <span className="form-error">{validationError}</span>}
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
