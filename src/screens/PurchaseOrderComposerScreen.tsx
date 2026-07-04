import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { createPurchaseOrder } from '../api/purchaseOrdersApi';
import { listAllCompanies } from '../api/companiesApi';
import type { Company } from '../api/companiesApi';
import { listCurrencies } from '../api/currenciesApi';
import type { Currency } from '../api/currenciesApi';
import { listPurchaseOrderTypes } from '../api/purchaseOrderTypesApi';
import type { PurchaseOrderTypeDto } from '../api/purchaseOrderTypesApi';
import { getErrorMessage } from '../api/errorMessage';
import { useAuth } from '../auth/useAuth';
import { Toast } from '../components/Toast';
import type { ToastMessage } from '../components/Toast';
import './admin/admin.css';

const DEFAULT_CURRENCY_CODE = 'ZMW';

/**
 * PO creation form only — the Draft editing/composition experience lives entirely on
 * PurchaseOrderDetailScreen now (bid-based composition, one unified screen for all statuses).
 */
export function PurchaseOrderComposerScreen() {
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();

  const [toast, setToast] = useState<ToastMessage | null>(null);

  // ----- New PO header form -----
  const [companies, setCompanies] = useState<Company[]>([]);
  const [companyId, setCompanyId] = useState<string>('');
  const [targetCompanyId, setTargetCompanyId] = useState<string>('');
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [currency, setCurrency] = useState('');
  const [poTypes, setPoTypes] = useState<PurchaseOrderTypeDto[]>([]);
  const [purchaseOrderTypeId, setPurchaseOrderTypeId] = useState<string>('');

  // Types the current user's roles permit them to create. Empty allowedCreatorRoleIds = no restriction.
  const permittedPoTypes = useMemo(
    () =>
      poTypes.filter(
        (t) =>
          t.allowedCreatorRoleIds.length === 0 ||
          t.allowedCreatorRoleNames.some((n) => currentUser?.roles.includes(n)),
      ),
    [poTypes, currentUser],
  );
  const [notes, setNotes] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  useEffect(() => {
    listAllCompanies()
      .then(setCompanies)
      .catch(() => setCompanies([]));
    listCurrencies({ isActive: true })
      .then((result) => {
        setCurrencies(result);
        const fallback = result.find((c) => c.code === DEFAULT_CURRENCY_CODE) ?? result[0];
        if (fallback) setCurrency(fallback.code);
      })
      .catch(() => setCurrencies([]));
    listPurchaseOrderTypes()
      .then((result) => setPoTypes(result.filter((t) => t.isActive)))
      .catch(() => setPoTypes([]));
  }, []);

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!companyId) {
      setCreateError('Company is required.');
      return;
    }
    setIsCreating(true);
    setCreateError(null);
    try {
      const created = await createPurchaseOrder({
        companyId: Number(companyId),
        targetCompanyId: targetCompanyId ? Number(targetCompanyId) : null,
        currency: currency || null,
        purchaseOrderTypeId: purchaseOrderTypeId ? Number(purchaseOrderTypeId) : null,
        notes: notes.trim() || null,
      });
      navigate(`/purchase-orders/${created.id}`, { replace: true });
    } catch (err) {
      setCreateError(getErrorMessage(err, 'Failed to create the draft purchase order.'));
    } finally {
      setIsCreating(false);
    }
  };

  return (
      <section className="admin-screen">
        <div className="admin-header">
          <h2>New Purchase Order</h2>
          <Link to="/purchase-orders" className="po-back-link">
            ← Back to purchase orders
          </Link>
        </div>

        <div className="admin-panel" style={{ padding: '1rem' }}>
          <form className="admin-form" onSubmit={handleCreate}>
            {createError && (
              <div className="admin-error" role="alert">
                {createError}
              </div>
            )}

            <div className="form-field">
              <label htmlFor="po-company">Company</label>
              <select
                id="po-company"
                value={companyId}
                onChange={(e) => setCompanyId(e.target.value)}
                disabled={isCreating}
              >
                <option value="">Select a company…</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-field">
              <label htmlFor="po-target-company">Target branch (optional)</label>
              <select
                id="po-target-company"
                value={targetCompanyId}
                onChange={(e) => setTargetCompanyId(e.target.value)}
                disabled={isCreating}
              >
                <option value="">None</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-field">
              <label htmlFor="po-type">Type (optional)</label>
              <select
                id="po-type"
                value={purchaseOrderTypeId}
                onChange={(e) => setPurchaseOrderTypeId(e.target.value)}
                disabled={isCreating}
              >
                <option value="">None</option>
                {permittedPoTypes.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-field">
              <label htmlFor="po-currency">Currency</label>
              <select
                id="po-currency"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                disabled={isCreating}
              >
                {currencies.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.code} — {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-field">
              <label htmlFor="po-notes">Notes</label>
              <textarea
                id="po-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                disabled={isCreating}
                rows={3}
              />
            </div>

            <div className="modal-actions" style={{ marginTop: 0 }}>
              <button type="submit" className="btn btn-primary" disabled={isCreating}>
                {isCreating ? 'Creating…' : 'Create draft'}
              </button>
            </div>
          </form>
        </div>

        <div className="toast-stack">
          <Toast toast={toast} onDismiss={() => setToast(null)} />
        </div>
      </section>
  );
}
