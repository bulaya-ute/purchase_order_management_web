import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import type { Role } from '../../api/rolesApi';
import type { PurchaseOrderTypeDto } from '../../api/purchaseOrderTypesApi';

interface ApprovalStepForm {
  requiredRoleId: number;
  sequenceOrder: number;
}

interface PoTypeFormModalProps {
  poType: PurchaseOrderTypeDto | undefined;
  roles: Role[];
  isLoadingRoles: boolean;
  isSaving: boolean;
  error: string | null;
  onSubmit: (values: {
    name: string;
    isActive: boolean;
    approvalSteps: { requiredRoleId?: number; sequenceOrder: number }[];
    allowedCreatorRoleIds: number[];
  }) => void;
  onCancel: () => void;
}

export function PoTypeFormModal({
  poType,
  roles,
  isLoadingRoles,
  isSaving,
  error,
  onSubmit,
  onCancel,
}: PoTypeFormModalProps) {
  const [name, setName] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [approvalSteps, setApprovalSteps] = useState<ApprovalStepForm[]>([]);
  const [allowedCreatorRoleIds, setAllowedCreatorRoleIds] = useState<number[]>([]);
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    if (poType) {
      setName(poType.name);
      setIsActive(poType.isActive);
      setApprovalSteps(
        poType.approvalSteps
          .filter((step) => step.requiredRoleId !== null)
          .map((step) => ({
            requiredRoleId: step.requiredRoleId!,
            sequenceOrder: step.sequenceOrder,
          })),
      );
      setAllowedCreatorRoleIds(poType.allowedCreatorRoleIds);
    }
  }, [poType]);

  const handleAddStep = () => {
    const newSequence = approvalSteps.length > 0 ? Math.max(...approvalSteps.map((s) => s.sequenceOrder)) + 1 : 1;
    setApprovalSteps([
      ...approvalSteps,
      {
        requiredRoleId: roles[0]?.id ?? 0,
        sequenceOrder: newSequence,
      },
    ]);
  };

  const handleRemoveStep = (index: number) => {
    setApprovalSteps(approvalSteps.filter((_, i) => i !== index));
  };

  const handleStepRoleChange = (index: number, roleId: number) => {
    const updated = [...approvalSteps];
    updated[index].requiredRoleId = roleId;
    setApprovalSteps(updated);
  };

  const handleCreatorRoleToggle = (roleId: number) => {
    setAllowedCreatorRoleIds((prev) =>
      prev.includes(roleId) ? prev.filter((id) => id !== roleId) : [...prev, roleId],
    );
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedName = name.trim();

    if (!trimmedName) {
      setValidationError('Name is required.');
      return;
    }

    if (approvalSteps.length === 0) {
      setValidationError('At least one approval step is required.');
      return;
    }

    if (allowedCreatorRoleIds.length === 0) {
      setValidationError('At least one allowed creator role is required.');
      return;
    }

    setValidationError(null);
    onSubmit({
      name: trimmedName,
      isActive,
      approvalSteps: approvalSteps.map((step, index) => ({
        requiredRoleId: step.requiredRoleId,
        sequenceOrder: index + 1,
      })),
      allowedCreatorRoleIds,
    });
  };

  const isEditing = !!poType;

  if (isLoadingRoles && !isEditing) {
    return (
      <div className="modal-overlay" role="presentation" onClick={onCancel}>
        <div
          className="modal-card"
          role="dialog"
          aria-modal="true"
          aria-labelledby="po-type-form-title"
          onClick={(e) => e.stopPropagation()}
        >
          <h3 id="po-type-form-title">New PO Type</h3>
          <p>Loading roles…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay" role="presentation" onClick={onCancel}>
      <div
        className="modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="po-type-form-title"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto' }}
      >
        <h3 id="po-type-form-title">{isEditing ? 'Edit PO Type' : 'New PO Type'}</h3>

        <form className="admin-form" onSubmit={handleSubmit}>
          {error && <div className="admin-error" role="alert">{error}</div>}

          <div className="form-field">
            <label htmlFor="po-type-name">Name</label>
            <input
              id="po-type-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isSaving}
              autoFocus
            />
          </div>

          <div className="form-field form-field-checkbox">
            <input
              id="po-type-active"
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              disabled={isSaving}
            />
            <label htmlFor="po-type-active">Active</label>
          </div>

          <div className="form-field">
            <label>Approval Steps</label>
            {approvalSteps.length === 0 ? (
              <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
                No approval steps yet.
              </p>
            ) : (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.5rem',
                }}
              >
                {approvalSteps.map((step, index) => (
                  <div
                    key={index}
                    style={{
                      display: 'flex',
                      gap: '0.5rem',
                      alignItems: 'center',
                      padding: '0.5rem',
                      backgroundColor: 'var(--color-surface-muted)',
                      borderRadius: 'var(--radius)',
                    }}
                  >
                    <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', minWidth: '2rem' }}>
                      Step {index + 1}
                    </span>
                    <select
                      value={step.requiredRoleId}
                      onChange={(e) => handleStepRoleChange(index, Number(e.target.value))}
                      disabled={isSaving}
                      style={{ flex: 1 }}
                    >
                      {roles.map((role) => (
                        <option key={role.id} value={role.id}>
                          {role.name}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="btn btn-small btn-danger"
                      onClick={() => handleRemoveStep(index)}
                      disabled={isSaving}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
            <button
              type="button"
              className="btn btn-small btn-secondary"
              onClick={handleAddStep}
              disabled={isSaving || roles.length === 0}
              style={{ marginTop: '0.5rem' }}
            >
              Add step
            </button>
          </div>

          <div className="form-field">
            <label>Allowed Creator Roles</label>
            {roles.length === 0 ? (
              <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
                No roles available.
              </p>
            ) : (
              <div className="role-multiselect">
                {roles.map((role) => (
                  <div key={role.id} className="role-multiselect-option">
                    <input
                      id={`creator-role-${role.id}`}
                      type="checkbox"
                      checked={allowedCreatorRoleIds.includes(role.id)}
                      onChange={() => handleCreatorRoleToggle(role.id)}
                      disabled={isSaving}
                    />
                    <label htmlFor={`creator-role-${role.id}`} style={{ margin: 0, cursor: 'pointer' }}>
                      {role.name}
                    </label>
                  </div>
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
