import { useCallback, useEffect, useState } from 'react';
import { getErrorMessage } from '../../api/errorMessage';
import { createRole, deleteRole, listAllowedParentRoles, listRoles, renameRole } from '../../api/rolesApi';
import type { Role } from '../../api/rolesApi';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { Toast } from '../../components/Toast';
import type { ToastMessage } from '../../components/Toast';
import { RenameRoleModal } from './RenameRoleModal';
import { RoleFormModal } from './RoleFormModal';
import { buildRoleTree } from './roleTree';
import type { RoleTreeNode } from './roleTree';
import { RoleTreeView } from './RoleTreeView';
import './admin.css';

export function RolesScreen() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [isCreating, setIsCreating] = useState(false);
  const [allowedParents, setAllowedParents] = useState<Role[]>([]);
  const [isLoadingAllowedParents, setIsLoadingAllowedParents] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [renamingRole, setRenamingRole] = useState<RoleTreeNode | null>(null);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameError, setRenameError] = useState<string | null>(null);

  const [deletingRole, setDeletingRole] = useState<RoleTreeNode | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [toast, setToast] = useState<ToastMessage | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      setRoles(await listRoles());
    } catch (err) {
      setLoadError(getErrorMessage(err, 'Failed to load roles.'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const tree = buildRoleTree(roles);

  const openCreate = async () => {
    setFormError(null);
    setIsCreating(true);
    setIsLoadingAllowedParents(true);
    try {
      setAllowedParents(await listAllowedParentRoles());
    } catch (err) {
      setFormError(getErrorMessage(err, 'Failed to load allowed parent roles.'));
    } finally {
      setIsLoadingAllowedParents(false);
    }
  };

  const handleCreate = async (values: { name: string; parentRoleId: number }) => {
    setIsSaving(true);
    setFormError(null);
    try {
      await createRole(values);
      setToast({ kind: 'success', text: 'Role created.' });
      setIsCreating(false);
      await load();
    } catch (err) {
      setFormError(getErrorMessage(err, 'Failed to create role.'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleRename = async (name: string) => {
    if (!renamingRole) return;
    setIsRenaming(true);
    setRenameError(null);
    try {
      await renameRole(renamingRole.id, { name });
      setToast({ kind: 'success', text: 'Role renamed.' });
      setRenamingRole(null);
      await load();
    } catch (err) {
      setRenameError(getErrorMessage(err, 'Failed to rename role.'));
    } finally {
      setIsRenaming(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingRole) return;
    setIsDeleting(true);
    try {
      await deleteRole(deletingRole.id);
      setToast({ kind: 'success', text: 'Role deleted.' });
      setDeletingRole(null);
      await load();
    } catch (err) {
      setToast({ kind: 'error', text: getErrorMessage(err, 'Failed to delete role.') });
      setDeletingRole(null);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <section className="admin-screen">
      <div className="admin-header">
        <h2>Roles</h2>
        <button type="button" className="btn btn-primary" onClick={() => void openCreate()}>
          New role
        </button>
      </div>

      <div className="admin-panel">
        {isLoading ? (
          <div className="admin-loading">Loading roles…</div>
        ) : loadError ? (
          <div className="admin-error" role="alert">
            {loadError}
          </div>
        ) : tree.length === 0 ? (
          <div className="admin-empty">No roles yet.</div>
        ) : (
          <div style={{ padding: '1rem' }}>
            <RoleTreeView
              nodes={tree}
              onRename={(node) => {
                setRenameError(null);
                setRenamingRole(node);
              }}
              onDelete={(node) => setDeletingRole(node)}
            />
          </div>
        )}
      </div>

      {isCreating && (
        <RoleFormModal
          allowedParents={allowedParents}
          isLoadingAllowedParents={isLoadingAllowedParents}
          isSaving={isSaving}
          error={formError}
          onSubmit={handleCreate}
          onCancel={() => setIsCreating(false)}
        />
      )}

      {renamingRole && (
        <RenameRoleModal
          role={renamingRole}
          isSaving={isRenaming}
          error={renameError}
          onSubmit={handleRename}
          onCancel={() => setRenamingRole(null)}
        />
      )}

      {deletingRole && (
        <ConfirmDialog
          title="Delete role"
          message={`Delete "${deletingRole.name}"? This cannot be undone.`}
          confirmLabel="Delete"
          isBusy={isDeleting}
          onConfirm={handleDelete}
          onCancel={() => setDeletingRole(null)}
        />
      )}

      <div className="toast-stack">
        <Toast toast={toast} onDismiss={() => setToast(null)} />
      </div>
    </section>
  );
}
