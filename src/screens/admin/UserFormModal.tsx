import { useState } from 'react';
import type { FormEvent } from 'react';
import type { Company } from '../../api/companiesApi';
import type { Role } from '../../api/rolesApi';
import type { User } from '../../api/usersApi';

export interface UserFormValues {
  fullName: string;
  email: string;
  companyId: number;
  isActive: boolean;
  password?: string;
  roleIds: number[];
}

interface UserFormModalProps {
  /** Present when editing; absent when creating. */
  user?: User;
  companies: Company[];
  roles: Role[];
  isSaving: boolean;
  error: string | null;
  onSubmit: (values: UserFormValues) => void;
  onCancel: () => void;
}

export function UserFormModal({
  user,
  companies,
  roles,
  isSaving,
  error,
  onSubmit,
  onCancel,
}: UserFormModalProps) {
  const [fullName, setFullName] = useState(user?.fullName ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [companyId, setCompanyId] = useState<string>(
    user ? String(user.companyId) : companies[0] ? String(companies[0].id) : '',
  );
  const [isActive, setIsActive] = useState(user?.isActive ?? true);
  const [password, setPassword] = useState('');
  const [roleIds, setRoleIds] = useState<number[]>(user?.roles.map((r) => r.id) ?? []);
  const [validationError, setValidationError] = useState<string | null>(null);

  const toggleRole = (roleId: number) => {
    setRoleIds((prev) =>
      prev.includes(roleId) ? prev.filter((id) => id !== roleId) : [...prev, roleId],
    );
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmedName = fullName.trim();
    const trimmedEmail = email.trim();

    if (!trimmedName || !trimmedEmail || !companyId) {
      setValidationError('Full name, email, and company are required.');
      return;
    }
    if (!user && password.trim().length < 8) {
      setValidationError('Password must be at least 8 characters.');
      return;
    }

    setValidationError(null);
    onSubmit({
      fullName: trimmedName,
      email: trimmedEmail,
      companyId: Number(companyId),
      isActive,
      roleIds,
      ...(user ? {} : { password: password.trim() }),
    });
  };

  return (
    <div className="modal-overlay" role="presentation" onClick={onCancel}>
      <div
        className="modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="user-form-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="user-form-title">{user ? 'Edit user' : 'New user'}</h3>
        <form className="admin-form" onSubmit={handleSubmit}>
          {error && <div className="admin-error" role="alert">{error}</div>}

          <div className="form-field">
            <label htmlFor="user-fullname">Full name</label>
            <input
              id="user-fullname"
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              disabled={isSaving}
              autoFocus
            />
          </div>

          <div className="form-field">
            <label htmlFor="user-email">Email</label>
            <input
              id="user-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isSaving}
            />
          </div>

          <div className="form-field">
            <label htmlFor="user-company">Company</label>
            <select
              id="user-company"
              value={companyId}
              onChange={(e) => setCompanyId(e.target.value)}
              disabled={isSaving}
            >
              {companies.length === 0 && <option value="">No companies available</option>}
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {!user && (
            <div className="form-field">
              <label htmlFor="user-password">Initial password</label>
              <input
                id="user-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isSaving}
                autoComplete="new-password"
              />
              <span className="form-hint">At least 8 characters.</span>
            </div>
          )}

          <div className="form-field form-field-checkbox">
            <input
              id="user-active"
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              disabled={isSaving}
            />
            <label htmlFor="user-active">Active</label>
          </div>

          <div className="form-field">
            <span>Roles</span>
            {roles.length === 0 ? (
              <span className="form-hint">No roles available.</span>
            ) : (
              <div className="role-multiselect">
                {roles.map((role) => (
                  <label key={role.id} className="role-multiselect-option">
                    <input
                      type="checkbox"
                      checked={roleIds.includes(role.id)}
                      onChange={() => toggleRole(role.id)}
                      disabled={isSaving}
                    />
                    {role.name}
                  </label>
                ))}
              </div>
            )}
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
