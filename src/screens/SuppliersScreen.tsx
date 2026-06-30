import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import {
  createSupplier,
  deleteSupplier,
  listSuppliers,
  updateSupplier,
} from '../api/suppliersApi';
import type { Supplier } from '../api/suppliersApi';
import { getErrorMessage } from '../api/errorMessage';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { Toast } from '../components/Toast';
import type { ToastMessage } from '../components/Toast';
import { SupplierFormModal } from './SupplierFormModal';
import type { SupplierFormValues } from './SupplierFormModal';
import './admin/admin.css';

const PAGE_SIZE = 20;

export function SuppliersScreen() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');

  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [editingSupplier, setEditingSupplier] = useState<Supplier | null | undefined>(undefined);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [deletingSupplier, setDeletingSupplier] = useState<Supplier | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [toast, setToast] = useState<ToastMessage | null>(null);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const load = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const result = await listSuppliers({ page, pageSize: PAGE_SIZE, search: search || undefined });
      setSuppliers(result.items);
      setTotalCount(result.totalCount);
    } catch (err) {
      setLoadError(getErrorMessage(err, 'Failed to load suppliers.'));
    } finally {
      setIsLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSearchSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  };

  const openCreate = () => {
    setFormError(null);
    setEditingSupplier(null);
  };

  const openEdit = (supplier: Supplier) => {
    setFormError(null);
    setEditingSupplier(supplier);
  };

  const closeForm = () => setEditingSupplier(undefined);

  const handleSubmit = async (values: SupplierFormValues) => {
    setIsSaving(true);
    setFormError(null);
    try {
      if (editingSupplier) {
        await updateSupplier(editingSupplier.id, values);
        setToast({ kind: 'success', text: 'Supplier updated.' });
      } else {
        await createSupplier(values);
        setToast({ kind: 'success', text: 'Supplier created.' });
      }
      closeForm();
      await load();
    } catch (err) {
      setFormError(getErrorMessage(err, 'Failed to save supplier.'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingSupplier) return;
    setIsDeleting(true);
    try {
      await deleteSupplier(deletingSupplier.id);
      setToast({ kind: 'success', text: 'Supplier deleted.' });
      setDeletingSupplier(null);
      await load();
    } catch (err) {
      setToast({ kind: 'error', text: getErrorMessage(err, 'Failed to delete supplier.') });
      setDeletingSupplier(null);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <section className="admin-screen admin-screen--wide">
      <div className="admin-header">
        <h2>Suppliers</h2>
        <form className="admin-filters" onSubmit={handleSearchSubmit} role="search">
          <label htmlFor="supplier-search">Search</label>
          <input
            id="supplier-search"
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Supplier name…"
          />
          <button type="submit" className="btn btn-small btn-secondary">
            Search
          </button>
        </form>
        <button type="button" className="btn btn-primary" onClick={openCreate}>
          New supplier
        </button>
      </div>

      <div className="admin-panel">
        {isLoading ? (
          <div className="admin-loading">Loading suppliers…</div>
        ) : loadError ? (
          <div className="admin-error" role="alert">
            {loadError}
          </div>
        ) : suppliers.length === 0 ? (
          <div className="admin-empty">No suppliers found.</div>
        ) : (
          <>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Phone</th>
                  <th>Email</th>
                  <th>Address</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {suppliers.map((supplier) => (
                  <tr key={supplier.id}>
                    <td>{supplier.supplierName}</td>
                    <td>{supplier.phone}</td>
                    <td>{supplier.email}</td>
                    <td>{supplier.address}</td>
                    <td>
                      <div className="row-actions">
                        <button
                          type="button"
                          className="btn btn-small btn-secondary"
                          onClick={() => openEdit(supplier)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="btn btn-small btn-danger"
                          onClick={() => setDeletingSupplier(supplier)}
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

      {editingSupplier !== undefined && (
        <SupplierFormModal
          supplier={editingSupplier ?? undefined}
          isSaving={isSaving}
          error={formError}
          onSubmit={handleSubmit}
          onCancel={closeForm}
        />
      )}

      {deletingSupplier && (
        <ConfirmDialog
          title="Delete supplier"
          message={`Delete "${deletingSupplier.supplierName}"? This cannot be undone.`}
          confirmLabel="Delete"
          isBusy={isDeleting}
          onConfirm={handleDelete}
          onCancel={() => setDeletingSupplier(null)}
        />
      )}

      <div className="toast-stack">
        <Toast toast={toast} onDismiss={() => setToast(null)} />
      </div>
    </section>
  );
}
