import { QuotationBrowserPanel } from './QuotationBrowserPanel';
import type { QuotationSummary } from '../api/quotationsApi';
import '../screens/admin/admin.css';

export interface AddQuotationModalProps {
  supplierId: number;
  excludeQuotationIds: ReadonlySet<number>;
  onAdd: (quotation: QuotationSummary) => void;
  isAdding: boolean;
  onClose: () => void;
}

export function AddQuotationModal({
  supplierId,
  excludeQuotationIds,
  onAdd,
  isAdding,
  onClose,
}: AddQuotationModalProps) {
  return (
    <div className="modal-overlay" role="presentation" onClick={onClose}>
      <div
        className="modal-card"
        role="dialog"
        aria-modal="true"
        aria-label="Add a quotation"
        style={{ width: '90vw', maxWidth: '900px' }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ marginTop: 0 }}>Add a quotation</h3>

        <QuotationBrowserPanel
          supplierId={supplierId}
          excludeQuotationIds={excludeQuotationIds}
          actionLabel="Add quotation"
          isActionBusy={isAdding}
          onAction={onAdd}
        />

        <div className="modal-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
