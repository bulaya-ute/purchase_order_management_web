import { apiClient } from './client';

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

/** Mirrors PurchaseOrderManagement.Api.Dtos.SupplierBids.SupplierBidItemDto. */
export interface SupplierBidItem {
  id: number;
  supplierBidId: number;
  sourceQuotationLineItemId: number | null;
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

/** Mirrors PurchaseOrderManagement.Api.Dtos.SupplierBids.SupplierBidDto (full bid detail). */
export interface SupplierBidDetail {
  id: number;
  purchaseOrderId: number;
  supplierId: number;
  supplierName: string;
  notes: string | null;
  bidTotal: number;
  itemCount: number;
  items: SupplierBidItem[];
  rowVersion: string;
}

/** Mirrors PurchaseOrderManagement.Api.Dtos.SupplierBids.CreateSupplierBidRequest. */
export interface CreateSupplierBidRequest {
  supplierId: number;
  notes?: string | null;
}

/** Mirrors PurchaseOrderManagement.Api.Dtos.SupplierBids.CreateSupplierBidItemRequest. */
export interface CreateSupplierBidItemRequest {
  description: string;
  quantity: number;
  unitCost: number;
  discountPercentage?: number | null;
  taxPercentage?: number | null;
  sourceQuotationLineItemId?: number | null;
}

/** Mirrors PurchaseOrderManagement.Api.Dtos.SupplierBids.UpdateSupplierBidItemRequest. */
export interface UpdateSupplierBidItemRequest {
  description: string;
  quantity: number;
  unitCost: number;
  discountPercentage?: number | null;
  taxPercentage?: number | null;
  rowVersion?: string | null;
}

/** Mirrors PurchaseOrderManagement.Api.Dtos.SupplierBids.SeedBidItemsFromQuotationRequest. */
export interface SeedBidItemsFromQuotationRequest {
  quotationId: number;
}

export function listBidsForPurchaseOrder(purchaseOrderId: number): Promise<SupplierBidSummary[]> {
  return apiClient.get<SupplierBidSummary[]>(`/purchase-orders/${purchaseOrderId}/bids`);
}

export function createBid(
  purchaseOrderId: number,
  request: CreateSupplierBidRequest,
): Promise<SupplierBidDetail> {
  return apiClient.post<SupplierBidDetail>(`/purchase-orders/${purchaseOrderId}/bids`, request);
}

export function getBid(id: number): Promise<SupplierBidDetail> {
  return apiClient.get<SupplierBidDetail>(`/supplier-bids/${id}`);
}

export function addBidItem(
  supplierBidId: number,
  request: CreateSupplierBidItemRequest,
): Promise<SupplierBidItem> {
  return apiClient.post<SupplierBidItem>(`/supplier-bids/${supplierBidId}/items`, request);
}

export function updateBidItem(
  supplierBidId: number,
  itemId: number,
  request: UpdateSupplierBidItemRequest,
): Promise<SupplierBidItem> {
  return apiClient.put<SupplierBidItem>(
    `/supplier-bids/${supplierBidId}/items/${itemId}`,
    request,
  );
}

export function deleteBidItem(supplierBidId: number, itemId: number): Promise<void> {
  return apiClient.delete<void>(`/supplier-bids/${supplierBidId}/items/${itemId}`);
}

export function seedBidItemsFromQuotation(
  supplierBidId: number,
  request: SeedBidItemsFromQuotationRequest,
): Promise<SupplierBidDetail> {
  return apiClient.post<SupplierBidDetail>(
    `/supplier-bids/${supplierBidId}/items/seed-from-quotation`,
    request,
  );
}
