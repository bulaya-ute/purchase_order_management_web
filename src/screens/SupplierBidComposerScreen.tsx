import { useNavigate, useSearchParams } from 'react-router-dom';
import { SupplierBidComposerContent } from './SupplierBidComposerContent';

/**
 * Routed wrapper around SupplierBidComposerContent. Reads purchaseOrderId from the URL search
 * params and wires navigation callbacks so the content component stays route-agnostic.
 */
export function SupplierBidComposerScreen() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const purchaseOrderIdParam = searchParams.get('purchaseOrderId');
  const purchaseOrderId = purchaseOrderIdParam ? Number(purchaseOrderIdParam) : null;

  return (
    <SupplierBidComposerContent
      purchaseOrderId={purchaseOrderId}
      onDone={() => {
        if (purchaseOrderId) {
          navigate(`/purchase-orders/${purchaseOrderId}/edit`);
        } else {
          navigate('/supplier-bids');
        }
      }}
      onCancel={() => navigate(-1)}
    />
  );
}
