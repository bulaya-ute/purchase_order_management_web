import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import type { Role } from '../../api/rolesApi';

interface RoleFormModalProps {
  /** Roles the acting user is allowed to set as the new role's parent (their seniority ceiling + descendants). */
  allowedParents: Role[];
  isLoadingAllowedParents: boolean;
  isSaving: boolean;
  error: string | null;
  onSubmit: (values: { name: string; parentRoleId: number }) => void;
  onCancel: () => void;
}

export function RoleFormModal({
  allowedParents,
  isLoadingAllowedParents,
  isSaving,
  error,
  onSubmit,
  onCancel,
}: RoleFormModalProps) {
  const [name, setName] = useState('');
  const [parentRoleId, setParentRoleId] = useState<string>('');
  const [validationError, setValidationError] = useState<string | null>(null);

  // allowedParents arrives asynchronously after the modal opens; default the select once loaded.
  useEffect(() => {
    if (!parentRoleId && allowedParents[0]) {
      setParentRoleId(String(allowedParents[0].id));
    }
  }, [allowedParents, parentRoleId]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setValidationError('Name is required.');
      return;
    }
    if (!parentRoleId) {
      setValidationError('A parent role is required.');
      return;
    }
    setValidationError(null);
    onSubmit({ name: trimmed, parentRoleId: Number(parentRoleId) });
  };

  return (
    <div className="modal-overlay" role="presentation" onClick={onCancel}>
      <div
        className="modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="role-form-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="role-form-title">New role</h3>

        {isLoadingAllowedParents ? (
          <p>Loading allowed parent roles…</p>
        ) : allowedParents.length === 0 ? (
          <>
            <p>
              You don't hold a role that allows creating new roles. Ask an administrator to grant
              you a role first.
            </p>
            <div className="modal-actions">
              <button type="button" className="btn btn-secondary" onClick={onCancel}>
                Close
              </button>
            </div>
          </>
        ) : (
          <form className="admin-form" onSubmit={handleSubmit}>
            {error && <div className="admin-error" role="alert">{error}</div>}

            <div className="form-field">
              <label htmlFor="role-name">Name</label>
              <input
                id="role-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={isSaving}
                autoFocus
              />
            </div>

            <div className="form-field">
              <label htmlFor="role-parent">Parent role</label>
              <select
                id="role-parent"
                value={parentRoleId}
                onChange={(e) => setParentRoleId(e.target.value)}
                disabled={isSaving}
              >
                {allowedParents.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.name}
                  </option>
                ))}
              </select>
              <span className="form-hint">
                Only roles within your seniority ceiling are shown.
              </span>
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
        )}
      </div>
    </div>
  );
}
