import { useCallback, useEffect, useState } from 'react';
import { getErrorMessage } from '../../api/errorMessage';
import {
  createCurrency,
  listCurrencies,
  updateCurrency,
  type Currency,
} from '../../api/currenciesApi';
import { Toast } from '../../components/Toast';
import type { ToastMessage } from '../../components/Toast';
import { CurrencyFormModal } from './CurrencyFormModal';
import './admin.css';

export function CurrenciesScreen() {
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [editingCurrency, setEditingCurrency] = useState<Currency | null | undefined>(undefined);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [showInactive, setShowInactive] = useState(false);

  const [toast, setToast] = useState<ToastMessage | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      setCurrencies(await listCurrencies({ isActive: !showInactive || undefined }));
    } catch (err) {
      setLoadError(getErrorMessage(err, 'Failed to load currencies.'));
    } finally {
      setIsLoading(false);
    }
  }, [showInactive]);

  useEffect(() => {
    void load();
  }, [load]);

  const openCreate = () => {
    setFormError(null);
    setEditingCurrency(null);
  };

  const openEdit = (currency: Currency) => {
    setFormError(null);
    setEditingCurrency(currency);
  };

  const closeForm = () => setEditingCurrency(undefined);

  const handleSubmit = async (values: { code: string; name: string; isActive: boolean }) => {
    setIsSaving(true);
    setFormError(null);
    try {
      if (editingCurrency) {
        await updateCurrency(editingCurrency.code, {
          name: values.name,
          isActive: values.isActive,
        });
        setToast({ kind: 'success', text: 'Currency updated.' });
      } else {
        await createCurrency({
          code: values.code,
          name: values.name,
          isActive: values.isActive,
        });
        setToast({ kind: 'success', text: 'Currency created.' });
      }
      closeForm();
      await load();
    } catch (err) {
      setFormError(getErrorMessage(err, 'Failed to save currency.'));
    } finally {
      setIsSaving(false);
    }
  };

  const displayedCurrencies = showInactive ? currencies : currencies.filter((c) => c.isActive);

  return (
    <section className="admin-screen">
      <div className="admin-header">
        <h2>Currencies</h2>
        <div className="admin-filters">
          <label htmlFor="show-inactive">
            <input
              id="show-inactive"
              type="checkbox"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
            />
            Show inactive too
          </label>
        </div>
        <button type="button" className="btn btn-primary" onClick={openCreate}>
          New currency
        </button>
      </div>

      <div className="admin-panel">
        {isLoading ? (
          <div className="admin-loading">Loading currencies…</div>
        ) : loadError ? (
          <div className="admin-error" role="alert">
            {loadError}
          </div>
        ) : displayedCurrencies.length === 0 ? (
          <div className="admin-empty">No currencies found.</div>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Name</th>
                <th>Status</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {displayedCurrencies.map((currency) => (
                <tr key={currency.code}>
                  <td>{currency.code}</td>
                  <td>{currency.name}</td>
                  <td>
                    <span className={currency.isActive ? 'badge badge-success' : 'badge badge-muted'}>
                      {currency.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td>
                    <div className="row-actions">
                      <button
                        type="button"
                        className="btn btn-small btn-secondary"
                        onClick={() => openEdit(currency)}
                      >
                        Edit
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {editingCurrency !== undefined && (
        <CurrencyFormModal
          currency={editingCurrency ?? undefined}
          isSaving={isSaving}
          error={formError}
          onSubmit={handleSubmit}
          onCancel={closeForm}
        />
      )}

      <div className="toast-stack">
        <Toast toast={toast} onDismiss={() => setToast(null)} />
      </div>
    </section>
  );
}
