import { useCallback, useEffect, useState } from 'react';
import { listAllCompanies } from '../../api/companiesApi';
import type { Company } from '../../api/companiesApi';
import { getErrorMessage } from '../../api/errorMessage';
import { listRoles } from '../../api/rolesApi';
import type { Role } from '../../api/rolesApi';
import { createUser, deleteUser, listUsers, resetUserPassword, updateUser } from '../../api/usersApi';
import type { User } from '../../api/usersApi';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { Toast } from '../../components/Toast';
import type { ToastMessage } from '../../components/Toast';
import { ResetPasswordModal } from './ResetPasswordModal';
import { UserFormModal } from './UserFormModal';
import type { UserFormValues } from './UserFormModal';
import './admin.css';

const PAGE_SIZE = 20;

export function UsersScreen() {
  const [users, setUsers] = useState<User[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [companyFilter, setCompanyFilter] = useState<string>('');

  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [editingUser, setEditingUser] = useState<User | null | undefined>(undefined);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [resettingUser, setResettingUser] = useState<User | null>(null);
  const [isResetting, setIsResetting] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);

  const [deletingUser, setDeletingUser] = useState<User | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [toast, setToast] = useState<ToastMessage | null>(null);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const load = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const [userResult, companyList, roleList] = await Promise.all([
        listUsers({
          page,
          pageSize: PAGE_SIZE,
          companyId: companyFilter ? Number(companyFilter) : undefined,
        }),
        listAllCompanies(),
        listRoles(),
      ]);
      setUsers(userResult.items);
      setTotalCount(userResult.totalCount);
      setCompanies(companyList);
      setRoles(roleList);
    } catch (err) {
      setLoadError(getErrorMessage(err, 'Failed to load users.'));
    } finally {
      setIsLoading(false);
    }
  }, [page, companyFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const openCreate = () => {
    setFormError(null);
    setEditingUser(null);
  };

  const openEdit = (user: User) => {
    setFormError(null);
    setEditingUser(user);
  };

  const closeForm = () => setEditingUser(undefined);

  const handleSubmit = async (values: UserFormValues) => {
    setIsSaving(true);
    setFormError(null);
    try {
      if (editingUser) {
        await updateUser(editingUser.id, {
          fullName: values.fullName,
          email: values.email,
          companyId: values.companyId,
          isActive: values.isActive,
          roleIds: values.roleIds,
        });
        setToast({ kind: 'success', text: 'User updated.' });
      } else {
        await createUser({
          fullName: values.fullName,
          email: values.email,
          companyId: values.companyId,
          isActive: values.isActive,
          password: values.password ?? '',
          roleIds: values.roleIds,
        });
        setToast({ kind: 'success', text: 'User created.' });
      }
      closeForm();
      await load();
    } catch (err) {
      setFormError(getErrorMessage(err, 'Failed to save user.'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetPassword = async (newPassword: string) => {
    if (!resettingUser) return;
    setIsResetting(true);
    setResetError(null);
    try {
      await resetUserPassword(resettingUser.id, newPassword);
      setToast({ kind: 'success', text: `Password reset for ${resettingUser.fullName}.` });
      setResettingUser(null);
    } catch (err) {
      setResetError(getErrorMessage(err, 'Failed to reset password.'));
    } finally {
      setIsResetting(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingUser) return;
    setIsDeleting(true);
    try {
      await deleteUser(deletingUser.id);
      setToast({ kind: 'success', text: 'User deleted.' });
      setDeletingUser(null);
      await load();
    } catch (err) {
      setToast({ kind: 'error', text: getErrorMessage(err, 'Failed to delete user.') });
      setDeletingUser(null);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <section className="admin-screen">
      <div className="admin-header">
        <h2>Users</h2>
        <div className="admin-filters">
          <label htmlFor="company-filter">Company</label>
          <select
            id="company-filter"
            value={companyFilter}
            onChange={(e) => {
              setPage(1);
              setCompanyFilter(e.target.value);
            }}
          >
            <option value="">All companies</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <button type="button" className="btn btn-primary" onClick={openCreate}>
          New user
        </button>
      </div>

      <div className="admin-panel">
        {isLoading ? (
          <div className="admin-loading">Loading users…</div>
        ) : loadError ? (
          <div className="admin-error" role="alert">
            {loadError}
          </div>
        ) : users.length === 0 ? (
          <div className="admin-empty">No users found.</div>
        ) : (
          <>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Company</th>
                  <th>Active</th>
                  <th>Roles</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id}>
                    <td>{user.fullName}</td>
                    <td>{user.email}</td>
                    <td>{user.companyName}</td>
                    <td>
                      <span className={user.isActive ? 'badge badge-success' : 'badge badge-muted'}>
                        {user.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>
                      {user.roles.length === 0 ? (
                        '—'
                      ) : (
                        <div className="role-chip-list">
                          {user.roles.map((role) => (
                            <span key={role.id} className="role-chip">
                              {role.name}
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
                          onClick={() => openEdit(user)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="btn btn-small btn-secondary"
                          onClick={() => {
                            setResetError(null);
                            setResettingUser(user);
                          }}
                        >
                          Reset password
                        </button>
                        <button
                          type="button"
                          className="btn btn-small btn-danger"
                          onClick={() => setDeletingUser(user)}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="admin-pagination">
              <span>
                Page {page} of {totalPages} ({totalCount} total)
              </span>
              <button
                type="button"
                className="btn btn-small"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
              >
                Previous
              </button>
              <button
                type="button"
                className="btn btn-small"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
              >
                Next
              </button>
            </div>
          </>
        )}
      </div>

      {editingUser !== undefined && (
        <UserFormModal
          user={editingUser ?? undefined}
          companies={companies}
          roles={roles}
          isSaving={isSaving}
          error={formError}
          onSubmit={handleSubmit}
          onCancel={closeForm}
        />
      )}

      {resettingUser && (
        <ResetPasswordModal
          user={resettingUser}
          isSaving={isResetting}
          error={resetError}
          onSubmit={handleResetPassword}
          onCancel={() => setResettingUser(null)}
        />
      )}

      {deletingUser && (
        <ConfirmDialog
          title="Delete user"
          message={`Delete "${deletingUser.fullName}"? This cannot be undone.`}
          confirmLabel="Delete"
          isBusy={isDeleting}
          onConfirm={handleDelete}
          onCancel={() => setDeletingUser(null)}
        />
      )}

      <div className="toast-stack">
        <Toast toast={toast} onDismiss={() => setToast(null)} />
      </div>
    </section>
  );
}
