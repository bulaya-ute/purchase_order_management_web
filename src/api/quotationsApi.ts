import { apiClient } from './client';
import { buildQueryString } from './types';
import type { UploadedFile } from './filesApi';

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
  quoteReference: string | null;
  quoteDate: string;
  expiresAtUtc: string | null;
  isExpired: boolean;
  currency: string;
  notes: string | null;
  isUsed: boolean;
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
  quoteReference: string | null;
  quoteDate: string;
  expiresAtUtc: string | null;
  isExpired: boolean;
  currency: string;
  notes: string | null;
  lineItemCount: number;
  isUsed: boolean;
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
  quoteReference?: string | null;
  quoteDate: string;
  expiresAtUtc?: string | null;
  currency: string;
  notes?: string | null;
  lineItems: CreateQuotationLineItemRequest[];
}

/** Mirrors the QuotationsController query string (supplierId/isExpired/isUsed all optional). */
export interface QuotationListQuery {
  supplierId?: number;
  isExpired?: boolean;
  isUsed?: boolean;
}

export function listQuotations(query: QuotationListQuery = {}): Promise<QuotationSummary[]> {
  return apiClient.get<QuotationSummary[]>(`/quotations${buildQueryString(query)}`);
}

export function getQuotation(quotationId: number): Promise<Quotation> {
  return apiClient.get<Quotation>(`/quotations/${quotationId}`);
}

export function createQuotation(request: CreateQuotationRequest): Promise<Quotation> {
  return apiClient.post<Quotation>('/quotations', request);
}
