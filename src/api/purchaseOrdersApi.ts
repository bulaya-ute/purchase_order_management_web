import { apiClient } from './client';
import { buildQueryString } from './types';
import type { CurrencyTotal, PagedQuery, PagedResult } from './types';
import type { ApprovalDto } from './approvalsApi';
import type { SupplierBidSummary } from './bidsApi';

export type { SupplierBidSummary } from './bidsApi';

/** Mirrors PurchaseOrderManagement.Api.Dtos.PurchaseOrders.CreatePurchaseOrderRequest. */
export interface CreatePurchaseOrderRequest {
  companyId: number;
  /** Who the purchase is for (a branch/company), distinct from companyId. Optional. */
  targetCompanyId?: number | null;
  /** Optional — defaults to "ZMW" server-side when omitted. */
  currency?: string | null;
  /** Optional: creates the PO from an admin-defined type preset (fixed approval chain, restricted creator roles). */
  purchaseOrderTypeId?: number | null;
  notes?: string | null;
}

/** Mirrors PurchaseOrderManagement.Api.Dtos.PurchaseOrders.UpdatePurchaseOrderRequest. */
export interface UpdatePurchaseOrderRequest {
  currency: string;
  targetCompanyId?: number | null;
  notes?: string | null;
  rowVersion?: string | null;
}

/** Mirrors PurchaseOrderManagement.Api.Dtos.PurchaseOrders.CreatePurchaseOrderLineItemRequest. */
export interface CreatePurchaseOrderLineItemRequest {
  description: string;
  quantity: number;
  unitCost: number;
  discountPercentage?: number | null;
  taxPercentage?: number | null;
}

/** Mirrors PurchaseOrderManagement.Api.Dtos.PurchaseOrders.UpdatePurchaseOrderLineItemRequest. */
export interface UpdatePurchaseOrderLineItemRequest {
  description: string;
  quantity: number;
  unitCost: number;
  discountPercentage?: number | null;
  taxPercentage?: number | null;
  rowVersion?: string | null;
}

/** Mirrors PurchaseOrderManagement.Api.Dtos.Approvals.CreateApprovalDefinitionRequest. */
export interface CreateApprovalDefinitionRequest {
  requiredRoleId?: number | null;
  requiredUserId?: number | null;
  sequenceOrder: number;
}

/** PO lifecycle status — string enum mirroring PurchaseOrderManagement.Api.Enums.PurchaseOrderStatus. */
export type PurchaseOrderStatus = 'Draft' | 'Open' | 'Approved' | 'Rejected' | 'Cancelled';

/** Mirrors PurchaseOrderManagement.Api.Dtos.PurchaseOrders.PurchaseOrderSummaryDto. */
export interface PurchaseOrderSummary {
  id: number;
  poNumber: string;
  companyId: number;
  companyName: string;
  targetCompanyId: number | null;
  targetCompanyName: string | null;
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
  currency: string;
  discountPercentage: number | null;
  discountAmount: number;
  taxPercentage: number | null;
  taxAmount: number;
  lineSubtotal: number;
  lineTotal: number;
  rowVersion: string;
}

/** Mirrors PurchaseOrderManagement.Api.Dtos.PurchaseOrders.PurchaseOrderSupplierBidDto. */
export interface PurchaseOrderAttachedBid {
  supplierBidId: number;
  isPrimary: boolean;
  addedAtUtc: string;
}

/** Mirrors PurchaseOrderManagement.Api.Dtos.PurchaseOrders.PurchaseOrderDto. */
export interface PurchaseOrderDetail {
  id: number;
  poNumber: string;
  companyId: number;
  companyName: string;
  targetCompanyId: number | null;
  targetCompanyName: string | null;
  issuerUserId: number;
  issuerUserName: string;
  currency: string;
  status: PurchaseOrderStatus;
  notes: string | null;
  purchaseOrderTypeId: number | null;
  purchaseOrderTypeName: string | null;
  awardedSupplierBidId: number | null;
  awardedAtUtc: string | null;
  awardedByUserId: number | null;
  paidAtUtc: string | null;
  deliveredAtUtc: string | null;
  /** Authoritative only for direct-entry POs / single-currency bid-based POs — see hasMultiCurrencyTotals. */
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  /** True when totals must be read from `totals` instead of the flat subtotal/taxAmount/totalAmount fields. */
  hasMultiCurrencyTotals: boolean;
  totals: CurrencyTotal[];
  createdAtUtc: string;
  lineItems: PurchaseOrderLineItem[];
  approvals: ApprovalDto[];
  supplierBids: SupplierBidSummary[];
  /** Junction-row metadata for all SBs attached to this PO (primary + alternatives). */
  attachedSupplierBids: PurchaseOrderAttachedBid[];
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

export function createPurchaseOrder(
  request: CreatePurchaseOrderRequest,
): Promise<PurchaseOrderDetail> {
  return apiClient.post<PurchaseOrderDetail>('/purchase-orders', request);
}

export function updatePurchaseOrder(
  id: number,
  request: UpdatePurchaseOrderRequest,
): Promise<PurchaseOrderDetail> {
  return apiClient.put<PurchaseOrderDetail>(`/purchase-orders/${id}`, request);
}

export function addLineItem(
  id: number,
  request: CreatePurchaseOrderLineItemRequest,
): Promise<PurchaseOrderLineItem> {
  return apiClient.post<PurchaseOrderLineItem>(`/purchase-orders/${id}/line-items`, request);
}

export function updateLineItem(
  id: number,
  lineItemId: number,
  request: UpdatePurchaseOrderLineItemRequest,
): Promise<PurchaseOrderLineItem> {
  return apiClient.put<PurchaseOrderLineItem>(
    `/purchase-orders/${id}/line-items/${lineItemId}`,
    request,
  );
}

export function deleteLineItem(id: number, lineItemId: number): Promise<void> {
  return apiClient.delete<void>(`/purchase-orders/${id}/line-items/${lineItemId}`);
}

export function addApprovalDefinition(
  id: number,
  request: CreateApprovalDefinitionRequest,
): Promise<ApprovalDto> {
  return apiClient.post<ApprovalDto>(`/purchase-orders/${id}/approvals`, request);
}

export function deleteApprovalDefinition(id: number, approvalId: number): Promise<void> {
  return apiClient.delete<void>(`/purchase-orders/${id}/approvals/${approvalId}`);
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

export function attachSupplierBid(
  poId: number,
  supplierBidId: number,
  isPrimary: boolean,
): Promise<PurchaseOrderDetail> {
  return apiClient.post<PurchaseOrderDetail>(`/purchase-orders/${poId}/supplier-bids`, {
    supplierBidId,
    isPrimary,
  });
}

export function detachSupplierBid(poId: number, supplierBidId: number): Promise<void> {
  return apiClient.delete<void>(`/purchase-orders/${poId}/supplier-bids/${supplierBidId}`);
}

export function setPrimarySupplierBid(poId: number, supplierBidId: number): Promise<void> {
  return apiClient.patch<void>(
    `/purchase-orders/${poId}/supplier-bids/${supplierBidId}/set-primary`,
  );
}

/** Mirrors PurchaseOrderManagement.Api.Dtos.PurchaseOrders.SelectAwardedBidRequest. */
export interface SelectAwardedBidRequest {
  supplierBidId: number;
}

export function setAwardedBid(
  id: number,
  supplierBidId: number,
): Promise<PurchaseOrderDetail> {
  return apiClient.post<PurchaseOrderDetail>(`/purchase-orders/${id}/awarded-bid`, {
    supplierBidId,
  } satisfies SelectAwardedBidRequest);
}
