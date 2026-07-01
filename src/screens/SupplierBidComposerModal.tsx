import { useEffect } from 'react';
import { SupplierBidComposerContent } from './SupplierBidComposerContent';

interface SupplierBidComposerModalProps {
  purchaseOrderId?: number | null;
  onClose: () => void;
  onDone: () => void;
}

/**
 * Full-screen overlay modal that hosts the bid-creation flow. Uses position:fixed/inset:0 so it
 * sits above the current page without navigating away. Escape key and the Close button both invoke
 * onClose; completing the bid invokes onDone so the caller can refresh its data.
 */
export function SupplierBidComposerModal({ purchaseOrderId, onClose, onDone }: SupplierBidComposerModalProps) {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'var(--color-bg)',
        zIndex: 60,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
      role="dialog"
      aria-modal="true"
      aria-label="New Supplier Bid"
    >
      {/* header bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0.75rem 1.25rem',
          borderBottom: '1px solid var(--color-border)',
          background: 'var(--color-surface)',
          flexShrink: 0,
        }}
      >
        <h2 style={{ margin: 0, fontSize: '1rem' }}>New Supplier Bid</h2>
        <button
          type="button"
          className="btn btn-secondary btn-small"
          onClick={onClose}
          aria-label="Close composer"
        >
          ✕ Close
        </button>
      </div>

      {/* scrollable content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '1rem' }}>
        <SupplierBidComposerContent
          purchaseOrderId={purchaseOrderId}
          onDone={onDone}
          onCancel={onClose}
        />
      </div>
    </div>
  );
}
