import { useCallback, useEffect, useState } from 'react';
import { getErrorMessage } from '../../api/errorMessage';
import {
  createPurchaseOrderType,
  deletePurchaseOrderType,
  listPurchaseOrderTypes,
  updatePurchaseOrderType,
  type PurchaseOrderTypeDto,
} from '../../api/purchaseOrderTypesApi';
import { listRoles, type Role } from '../../api/rolesApi';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { Toast } from '../../components/Toast';
import type { ToastMessage } from '../../components/Toast';
import { PoTypeFormModal } from './PoTypeFormModal';
import './admin.css';

export function PoTypesScreen() {
  const [poTypes, setPoTypes] = useState<PurchaseOrderTypeDto[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [editingPoType, setEditingPoType] = useState<PurchaseOrderTypeDto | null | undefined>(undefined);
  const [isLoadingRoles, setIsLoadingRoles] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [deletingPoType, setDeletingPoType] = useState<PurchaseOrderTypeDto | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [toast, setToast] = useState<ToastMessage | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      setPoTypes(await listPurchaseOrderTypes());
    } catch (err) {
      setLoadError(getErrorMessage(err, 'Failed to load PO types.'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const openCreate = async () => {
    setFormError(null);
    setEditingPoType(null);
    setIsLoadingRoles(true);
    try {
      setRoles(await listRoles());
    } catch (err) {
      setFormError(getErrorMessage(err, 'Failed to load roles.'));
    } finally {
      setIsLoadingRoles(false);
    }
  };

  const openEdit = async (poType: PurchaseOrderTypeDto) => {
    setFormError(null);
    setEditingPoType(poType);
    setIsLoadingRoles(true);
    try {
      setRoles(await listRoles());
    } catch (err) {
      setFormError(getErrorMessage(err, 'Failed to load roles.'));
    } finally {
      setIsLoadingRoles(false);
    }
  };

  const closeForm = () => setEditingPoType(undefined);

  const handleSubmit = async (values: {
    name: string;
    isActive: boolean;
    approvalSteps: { requiredRoleId?: number; sequenceOrder: number }[];
    allowedCreatorRoleIds: number[];
  }) => {
    setIsSaving(true);
    setFormError(null);
    try {
      if (editingPoType) {
        await updatePurchaseOrderType(editingPoType.id, {
          name: values.name,
          isActive: values.isActive,
          approvalSteps: values.approvalSteps,
          allowedCreatorRoleIds: values.allowedCreatorRoleIds,
        });
        setToast({ kind: 'success', text: 'PO Type updated.' });
      } else {
        await createPurchaseOrderType({
          name: values.name,
          isActive: values.isActive,
          approvalSteps: values.approvalSteps,
          allowedCreatorRoleIds: values.allowedCreatorRoleIds,
        });
        setToast({ kind: 'success', text: 'PO Type created.' });
      }
      closeForm();
      await load();
    } catch (err) {
      setFormError(getErrorMessage(err, 'Failed to save PO type.'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingPoType) return;
    setIsDeleting(true);
    try {
      await deletePurchaseOrderType(deletingPoType.id);
      setToast({ kind: 'success', text: 'PO Type deleted.' });
      setDeletingPoType(null);
      await load();
    } catch (err) {
      setToast({ kind: 'error', text: getErrorMessage(err, 'Failed to delete PO type.') });
      setDeletingPoType(null);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <section className="admin-screen">
      <div className="admin-header">
        <h2>PO Types</h2>
        <button type="button" className="btn btn-primary" onClick={() => void openCreate()}>
          New type
        </button>
      </div>

      <div className="admin-panel">
        {isLoading ? (
          <div className="admin-loading">Loading PO types…</div>
        ) : loadError ? (
          <div className="admin-error" role="alert">
            {loadError}
          </div>
        ) : poTypes.length === 0 ? (
          <div className="admin-empty">No PO types found.</div>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Status</th>
                <th>Steps</th>
                <th>Creator Roles</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {poTypes.map((poType) => (
                <tr key={poType.id}>
                  <td>{poType.name}</td>
                  <td>
                    <span className={poType.isActive ? 'badge badge-success' : 'badge badge-muted'}>
                      {poType.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td>{poType.approvalSteps.length}</td>
                  <td>
                    {poType.allowedCreatorRoleNames.length === 0 ? (
                      '—'
                    ) : (
                      <div className="role-chip-list">
                        {poType.allowedCreatorRoleNames.map((roleName, idx) => (
                          <span key={idx} className="role-chip">
                            {roleName}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td>
                    <div className="row-actions">
                      <button
                        type="button"
                        className="btn btn-small btn-secondary"
                        onClick={() => void openEdit(poType)}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="btn btn-small btn-danger"
                        onClick={() => setDeletingPoType(poType)}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {editingPoType !== undefined && (
        <PoTypeFormModal
          poType={editingPoType ?? undefined}
          roles={roles}
          isLoadingRoles={isLoadingRoles}
          isSaving={isSaving}
          error={formError}
          onSubmit={handleSubmit}
          onCancel={closeForm}
        />
      )}

      {deletingPoType && (
        <ConfirmDialog
          title="Delete PO Type"
          message={`Delete "${deletingPoType.name}"? This cannot be undone.`}
          confirmLabel="Delete"
          isBusy={isDeleting}
          onConfirm={handleDelete}
          onCancel={() => setDeletingPoType(null)}
        />
      )}

      <div className="toast-stack">
        <Toast toast={toast} onDismiss={() => setToast(null)} />
      </div>
    </section>
  );
}
