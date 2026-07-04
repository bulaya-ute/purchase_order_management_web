import { apiClient } from './client';
import { buildQueryString } from './types';
import type { PagedQuery, PagedResult } from './types';
import type { UploadedFile } from './filesApi';
import { cachedFetch } from '../utils/requestCache';

/** Mirrors PurchaseOrderManagement.Api.Dtos.Quotations.QuotationLineItemDto. */
export interface QuotationLineItem {
  id: number;
  description: string;
  quantity: number;
  unitCost: number;
}

/** Mirrors PurchaseOrderManagement.Api.Dtos.Quotations.QuotationDto (full quotation detail). */
export interface Quotation {
  id: number;
  supplierId: number;
  supplierName: string;
  file: UploadedFile;
  description: string | null;
  quoteReference: string | null;
  quoteDate: string;
  expiresAtUtc: string | null;
  isExpired: boolean;
  currency: string;
  notes: string | null;
  isUsed: boolean;
  taxRate: number | null;
  discountRate: number | null;
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  grandTotal: number;
  lineItems: QuotationLineItem[];
}

/** Mirrors PurchaseOrderManagement.Api.Dtos.Quotations.QuotationSummaryDto. */
export interface QuotationSummary {
  id: number;
  supplierId: number;
  supplierName: string;
  fileId: number;
  fileUrl: string;
  originalFileName: string | null;
  description: string | null;
  quoteReference: string | null;
  quoteDate: string;
  expiresAtUtc: string | null;
  isExpired: boolean;
  currency: string;
  notes: string | null;
  lineItemCount: number;
  isUsed: boolean;
  taxRate: number | null;
  discountRate: number | null;
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  grandTotal: number;
}

/** Mirrors PurchaseOrderManagement.Api.Dtos.Quotations.CreateQuotationLineItemRequest. */
export interface CreateQuotationLineItemRequest {
  description: string;
  quantity: number;
  unitCost: number;
}

/** Mirrors PurchaseOrderManagement.Api.Dtos.Quotations.CreateQuotationRequest. */
export interface CreateQuotationRequest {
  supplierId: number;
  fileId: number;
  description?: string | null;
  quoteReference?: string | null;
  quoteDate: string;
  expiresAtUtc?: string | null;
  currency: string;
  taxRate?: number | null;
  discountRate?: number | null;
  notes?: string | null;
  lineItems: CreateQuotationLineItemRequest[];
}

/** Mirrors PurchaseOrderManagement.Api.Dtos.Quotations.QuotationListQuery. */
export interface QuotationListQuery extends PagedQuery {
  supplierId?: number;
  isExpired?: boolean;
  isUsed?: boolean;
  /** Case-insensitive search across QuoteReference, Description, Notes, and the supplier's name. */
  search?: string;
}

export function listQuotations(
  query: QuotationListQuery = {},
): Promise<PagedResult<QuotationSummary>> {
  return apiClient.get<PagedResult<QuotationSummary>>(`/quotations${buildQueryString(query)}`);
}

/** Cached (60s TTL) — reused across the preview pane and column 2's quotation cards. */
export function getQuotation(quotationId: number): Promise<Quotation> {
  return cachedFetch(`quotation-${quotationId}`, () =>
    apiClient.get<Quotation>(`/quotations/${quotationId}`),
  );
}

export function createQuotation(request: CreateQuotationRequest): Promise<Quotation> {
  return apiClient.post<Quotation>('/quotations', request);
}
