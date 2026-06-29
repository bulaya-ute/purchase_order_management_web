import { apiClient } from './client';
import { buildQueryString } from './types';
import type { PagedQuery, PagedResult } from './types';
import type { ApprovalDto } from './approvalsApi';

/** PO lifecycle status — string enum mirroring PurchaseOrderManagement.Api.Enums.PurchaseOrderStatus. */
export type PurchaseOrderStatus = 'Draft' | 'Open' | 'Approved' | 'Rejected' | 'Cancelled';

/** Mirrors PurchaseOrderManagement.Api.Dtos.PurchaseOrders.PurchaseOrderSummaryDto. */
export interface PurchaseOrderSummary {
  id: number;
  poNumber: string;
  companyId: number;
  companyName: string;
  issuerUserId: number;
  issuerUserName: string;
  currency: string;
  status: PurchaseOrderStatus;
  totalAmount: number;
  paidAtUtc: string | null;
  deliveredAtUtc: string | null;
  createdAtUtc: string;
}

/** Mirrors PurchaseOrderManagement.Api.Dtos.PurchaseOrders.PurchaseOrderLineItemDto. */
export interface PurchaseOrderLineItem {
  id: number;
  purchaseOrderId: number;
  sourceSupplierBidItemId: number | null;
  description: string;
  quantity: number;
  unitCost: number;
  discountPercentage: number | null;
  discountAmount: number;
  taxPercentage: number | null;
  taxAmount: number;
  lineSubtotal: number;
  lineTotal: number;
  rowVersion: string;
}

/** Mirrors PurchaseOrderManagement.Api.Dtos.SupplierBids.SupplierBidSummaryDto. */
export interface SupplierBidSummary {
  id: number;
  purchaseOrderId: number;
  supplierId: number;
  supplierName: string;
  notes: string | null;
  bidTotal: number;
  itemCount: number;
  quotationCount: number;
  hasExpiredQuotation: boolean;
  earliestQuotationExpiryUtc: string | null;
}

/** Mirrors PurchaseOrderManagement.Api.Dtos.PurchaseOrders.PurchaseOrderDto. */
export interface PurchaseOrderDetail {
  id: number;
  poNumber: string;
  companyId: number;
  companyName: string;
  issuerUserId: number;
  issuerUserName: string;
  currency: string;
  status: PurchaseOrderStatus;
  notes: string | null;
  awardedSupplierBidId: number | null;
  awardedAtUtc: string | null;
  awardedByUserId: number | null;
  paidAtUtc: string | null;
  deliveredAtUtc: string | null;
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  createdAtUtc: string;
  lineItems: PurchaseOrderLineItem[];
  approvals: ApprovalDto[];
  supplierBids: SupplierBidSummary[];
  rowVersion: string;
}

/** Mirrors PurchaseOrderManagement.Api.Dtos.PurchaseOrders.PurchaseOrderListQuery. */
export interface PurchaseOrderListQuery extends PagedQuery {
  status?: PurchaseOrderStatus;
  companyId?: number;
}

export function listPurchaseOrders(
  query: PurchaseOrderListQuery = {},
): Promise<PagedResult<PurchaseOrderSummary>> {
  return apiClient.get<PagedResult<PurchaseOrderSummary>>(
    `/purchase-orders${buildQueryString(query)}`,
  );
}

export function getPurchaseOrder(id: number): Promise<PurchaseOrderDetail> {
  return apiClient.get<PurchaseOrderDetail>(`/purchase-orders/${id}`);
}

export function submitPurchaseOrder(id: number): Promise<PurchaseOrderDetail> {
  return apiClient.post<PurchaseOrderDetail>(`/purchase-orders/${id}/submit`);
}

export function payPurchaseOrder(id: number): Promise<PurchaseOrderDetail> {
  return apiClient.post<PurchaseOrderDetail>(`/purchase-orders/${id}/pay`);
}

export function deliverPurchaseOrder(id: number): Promise<PurchaseOrderDetail> {
  return apiClient.post<PurchaseOrderDetail>(`/purchase-orders/${id}/deliver`);
}

export function cancelPurchaseOrder(id: number): Promise<PurchaseOrderDetail> {
  return apiClient.post<PurchaseOrderDetail>(`/purchase-orders/${id}/cancel`);
}
