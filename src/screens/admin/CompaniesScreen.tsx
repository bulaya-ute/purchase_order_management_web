import { useCallback, useEffect, useState } from 'react';
import {
  createCompany,
  deleteCompany,
  listAllCompanies,
  listCompanies,
  updateCompany,
} from '../../api/companiesApi';
import type { Company } from '../../api/companiesApi';
import { getErrorMessage } from '../../api/errorMessage';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { Toast } from '../../components/Toast';
import type { ToastMessage } from '../../components/Toast';
import { CompanyFormModal } from './CompanyFormModal';
import './admin.css';

const PAGE_SIZE = 20;

export function CompaniesScreen() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [allCompanies, setAllCompanies] = useState<Company[]>([]);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [editingCompany, setEditingCompany] = useState<Company | null | undefined>(undefined);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [deletingCompany, setDeletingCompany] = useState<Company | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [toast, setToast] = useState<ToastMessage | null>(null);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const load = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const result = await listCompanies({ page, pageSize: PAGE_SIZE });
      setCompanies(result.items);
      setTotalCount(result.totalCount);
    } catch (err) {
      setLoadError(getErrorMessage(err, 'Failed to load companies.'));
    } finally {
      setIsLoading(false);
    }
  }, [page]);

  useEffect(() => {
    void load();
  }, [load]);

  const openCreate = async () => {
    setFormError(null);
    setEditingCompany(null);
    try {
      setAllCompanies(await listAllCompanies());
    } catch (err) {
      setFormError(getErrorMessage(err, 'Failed to load companies for the parent picker.'));
    }
  };

  const openEdit = async (company: Company) => {
    setFormError(null);
    setEditingCompany(company);
    try {
      setAllCompanies(await listAllCompanies());
    } catch (err) {
      setFormError(getErrorMessage(err, 'Failed to load companies for the parent picker.'));
    }
  };

  const closeForm = () => setEditingCompany(undefined);

  const handleSubmit = async (values: { name: string; parentCompanyId: number | null }) => {
    setIsSaving(true);
    setFormError(null);
    try {
      if (editingCompany) {
        await updateCompany(editingCompany.id, values);
        setToast({ kind: 'success', text: 'Company updated.' });
      } else {
        await createCompany(values);
        setToast({ kind: 'success', text: 'Company created.' });
      }
      closeForm();
      await load();
    } catch (err) {
      setFormError(getErrorMessage(err, 'Failed to save company.'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingCompany) return;
    setIsDeleting(true);
    try {
      await deleteCompany(deletingCompany.id);
      setToast({ kind: 'success', text: 'Company deleted.' });
      setDeletingCompany(null);
      await load();
    } catch (err) {
      setToast({ kind: 'error', text: getErrorMessage(err, 'Failed to delete company.') });
      setDeletingCompany(null);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <section className="admin-screen">
      <div className="admin-header">
        <h2>Companies</h2>
        <button type="button" className="btn btn-primary" onClick={() => void openCreate()}>
          New company
        </button>
      </div>

      <div className="admin-panel">
        {isLoading ? (
          <div className="admin-loading">Loading companies…</div>
        ) : loadError ? (
          <div className="admin-error" role="alert">
            {loadError}
          </div>
        ) : companies.length === 0 ? (
          <div className="admin-empty">No companies yet.</div>
        ) : (
          <>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Parent company</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {companies.map((company) => (
                  <tr key={company.id}>
                    <td>{company.name}</td>
                    <td>{company.parentCompanyName ?? '—'}</td>
                    <td>
                      <div className="row-actions">
                        <button
                          type="button"
                          className="btn btn-small btn-secondary"
                          onClick={() => void openEdit(company)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="btn btn-small btn-danger"
                          onClick={() => setDeletingCompany(company)}
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

      {editingCompany !== undefined && (
        <CompanyFormModal
          company={editingCompany ?? undefined}
          companies={allCompanies}
          isSaving={isSaving}
          error={formError}
          onSubmit={handleSubmit}
          onCancel={closeForm}
        />
      )}

      {deletingCompany && (
        <ConfirmDialog
          title="Delete company"
          message={`Delete "${deletingCompany.name}"? This cannot be undone.`}
          confirmLabel="Delete"
          isBusy={isDeleting}
          onConfirm={handleDelete}
          onCancel={() => setDeletingCompany(null)}
        />
      )}

      <div className="toast-stack">
        <Toast toast={toast} onDismiss={() => setToast(null)} />
      </div>
    </section>
  );
}
