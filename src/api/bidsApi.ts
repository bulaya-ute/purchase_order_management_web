import { apiClient } from './client';
import { buildQueryString } from './types';
import type { CurrencyTotal } from './types';

/** Mirrors PurchaseOrderManagement.Api.Enums.SupplierBidStatus. Draft = editable. Locked once the PO it's attached to is submitted. */
export type SupplierBidStatus = 'Draft' | 'Locked';

/** Mirrors PurchaseOrderManagement.Api.Dtos.SupplierBids.SupplierBidSummaryDto. */
export interface SupplierBidSummary {
  id: number;
  /** Null = standalone/unattached bid (not yet attached to a PO). */
  purchaseOrderId: number | null;
  supplierId: number;
  supplierName: string;
  notes: string | null;
  status: SupplierBidStatus;
  /** Per-currency totals across the bid's items. Never converted/combined. */
  totals: CurrencyTotal[];
  itemCount: number;
  quotationCount: number;
  hasExpiredQuotation: boolean;
  earliestQuotationExpiryUtc: string | null;
}

/** Mirrors PurchaseOrderManagement.Api.Dtos.SupplierBids.SupplierBidItemDto. */
export interface SupplierBidItem {
  id: number;
  supplierBidId: number;
  /** Backend enforces non-nullable — all bid items must be sourced from a quotation line. */
  sourceQuotationLineItemId: number;
  sourceQuotationId: number;
  sourceQuotationReference: string | null;
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

/** Mirrors PurchaseOrderManagement.Api.Dtos.SupplierBids.SupplierBidDto (full bid detail). */
export interface SupplierBidDetail {
  id: number;
  purchaseOrderId: number | null;
  supplierId: number;
  supplierName: string;
  notes: string | null;
  status: SupplierBidStatus;
  totals: CurrencyTotal[];
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
  /** Defaults from the source quotation's currency; may be omitted when sourceQuotationLineItemId is set. */
  currency?: string | null;
  discountPercentage?: number | null;
  taxPercentage?: number | null;
  /** Required — all bid items must be sourced from a quotation line. */
  sourceQuotationLineItemId: number;
}

/** Mirrors PurchaseOrderManagement.Api.Dtos.SupplierBids.UpdateSupplierBidItemRequest. */
export interface UpdateSupplierBidItemRequest {
  description: string;
  quantity: number;
  unitCost: number;
  currency: string;
  discountPercentage?: number | null;
  taxPercentage?: number | null;
  rowVersion?: string | null;
}

/** Mirrors PurchaseOrderManagement.Api.Dtos.SupplierBids.SeedBidItemsFromQuotationRequest. */
export interface SeedBidItemsFromQuotationRequest {
  quotationId: number;
}

/** Mirrors the BidsController list query string (api/supplier-bids). */
export interface SupplierBidListQuery {
  supplierId?: number;
  purchaseOrderId?: number;
  unattachedOnly?: boolean;
}

/** Standalone bids library listing — optionally filtered by supplier/PO/unattached-only. */
export function listBids(query: SupplierBidListQuery = {}): Promise<SupplierBidSummary[]> {
  return apiClient.get<SupplierBidSummary[]>(`/supplier-bids${buildQueryString(query)}`);
}

export function listBidsForPurchaseOrder(purchaseOrderId: number): Promise<SupplierBidSummary[]> {
  return apiClient.get<SupplierBidSummary[]>(`/purchase-orders/${purchaseOrderId}/bids`);
}

/** Creates a standalone (unattached) bid via the top-level library endpoint. */
export function createStandaloneBid(request: CreateSupplierBidRequest): Promise<SupplierBidDetail> {
  return apiClient.post<SupplierBidDetail>('/supplier-bids', request);
}

/** Creates a bid already attached to the given PO (the composer's "+ New Bid" shortcut). */
export function createBid(
  purchaseOrderId: number,
  request: CreateSupplierBidRequest,
): Promise<SupplierBidDetail> {
  return apiClient.post<SupplierBidDetail>(`/purchase-orders/${purchaseOrderId}/bids`, request);
}

/** Attaches an existing standalone bid to a Draft purchase order. */
export function attachBidToPurchaseOrder(
  supplierBidId: number,
  purchaseOrderId: number,
): Promise<SupplierBidDetail> {
  return apiClient.post<SupplierBidDetail>(`/supplier-bids/${supplierBidId}/attach`, {
    purchaseOrderId,
  });
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
