import { useState } from 'react';
import type { FormEvent } from 'react';
import type { User } from '../../api/usersApi';

interface ResetPasswordModalProps {
  user: User;
  isSaving: boolean;
  error: string | null;
  onSubmit: (newPassword: string) => void;
  onCancel: () => void;
}

export function ResetPasswordModal({ user, isSaving, error, onSubmit, onCancel }: ResetPasswordModalProps) {
  const [newPassword, setNewPassword] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (newPassword.trim().length < 8) {
      setValidationError('Password must be at least 8 characters.');
      return;
    }
    setValidationError(null);
    onSubmit(newPassword.trim());
  };

  return (
    <div className="modal-overlay" role="presentation" onClick={onCancel}>
      <div
        className="modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="reset-password-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="reset-password-title">Reset password for {user.fullName}</h3>
        <form className="admin-form" onSubmit={handleSubmit}>
          {error && <div className="admin-error" role="alert">{error}</div>}

          <div className="form-field">
            <label htmlFor="reset-new-password">New password</label>
            <input
              id="reset-new-password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              disabled={isSaving}
              autoComplete="new-password"
              autoFocus
            />
            <span className="form-hint">At least 8 characters.</span>
            {validationError && <span className="form-error">{validationError}</span>}
          </div>

          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={isSaving}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={isSaving}>
              {isSaving ? 'Saving…' : 'Reset password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
