import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { buildCompanyTree, CompanyTreeView } from './CompanyTreeView';
import type { CompanyTreeNode } from './CompanyTreeView';
import './admin.css';

const PAGE_SIZE = 20;

type ViewMode = 'table' | 'tree';

export function CompaniesScreen() {
  const [viewMode, setViewMode] = useState<ViewMode>('table');

  const [companies, setCompanies] = useState<Company[]>([]);
  const [allCompanies, setAllCompanies] = useState<Company[]>([]);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [editingCompany, setEditingCompany] = useState<Company | null | undefined>(undefined);
  const [defaultParentCompanyId, setDefaultParentCompanyId] = useState<number | undefined>(undefined);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [deletingCompany, setDeletingCompany] = useState<Company | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [toast, setToast] = useState<ToastMessage | null>(null);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const loadPage = useCallback(async () => {
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

  const loadAll = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const all = await listAllCompanies();
      setAllCompanies(all);
      setTotalCount(all.length);
    } catch (err) {
      setLoadError(getErrorMessage(err, 'Failed to load companies.'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (viewMode === 'table') {
      void loadPage();
    } else {
      void loadAll();
    }
  }, [viewMode, loadPage, loadAll]);

  const reload = useCallback(() => {
    if (viewMode === 'table') return loadPage();
    return loadAll();
  }, [viewMode, loadPage, loadAll]);

  const companyTree = useMemo(
    () => (viewMode === 'tree' ? buildCompanyTree(allCompanies) : []),
    [viewMode, allCompanies],
  );

  const openCreate = async (preselectedParentId?: number) => {
    setFormError(null);
    setDefaultParentCompanyId(preselectedParentId);
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

  const openEditFromTree = async (node: CompanyTreeNode) => {
    const company: Company = {
      id: node.id,
      name: node.name,
      parentCompanyId: node.parentCompanyId,
      parentCompanyName: null,
    };
    await openEdit(company);
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
      setDefaultParentCompanyId(undefined);
      await reload();
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
      await reload();
    } catch (err) {
      setToast({ kind: 'error', text: getErrorMessage(err, 'Failed to delete company.') });
      setDeletingCompany(null);
    } finally {
      setIsDeleting(false);
    }
  };

  const setDeletingFromTree = (node: CompanyTreeNode) => {
    setDeletingCompany({ id: node.id, name: node.name, parentCompanyId: node.parentCompanyId, parentCompanyName: null });
  };

  return (
    <section className="admin-screen">
      <div className="admin-header">
        <h2>Companies</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div className="view-toggle" role="group" aria-label="View mode">
            <button
              type="button"
              className={`btn btn-small${viewMode === 'table' ? ' btn-primary' : ' btn-secondary'}`}
              aria-pressed={viewMode === 'table'}
              onClick={() => setViewMode('table')}
            >
              Table
            </button>
            <button
              type="button"
              className={`btn btn-small${viewMode === 'tree' ? ' btn-primary' : ' btn-secondary'}`}
              aria-pressed={viewMode === 'tree'}
              onClick={() => setViewMode('tree')}
            >
              Tree
            </button>
          </div>
          <button type="button" className="btn btn-primary" onClick={() => void openCreate()}>
            New company
          </button>
        </div>
      </div>

      <div className="admin-panel">
        {isLoading ? (
          <div className="admin-loading">Loading companies…</div>
        ) : loadError ? (
          <div className="admin-error" role="alert">
            {loadError}
          </div>
        ) : viewMode === 'tree' ? (
          companyTree.length === 0 ? (
            <div className="admin-empty">No companies yet.</div>
          ) : (
            <div style={{ padding: '1rem' }}>
              <div className="role-tree-scroll">
                <CompanyTreeView
                  nodes={companyTree}
                  onAddChild={(node) => void openCreate(node.id)}
                  onEdit={(node) => void openEditFromTree(node)}
                  onDelete={setDeletingFromTree}
                />
              </div>
            </div>
          )
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
          defaultParentCompanyId={defaultParentCompanyId}
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
