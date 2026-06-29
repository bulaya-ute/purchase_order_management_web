import { apiClient } from './client';
import type { UploadedFile } from './filesApi';

/** Mirrors PurchaseOrderManagement.Api.Dtos.Quotations.QuotationLineItemDto. */
export interface QuotationLineItem {
  id: number;
  description: string;
  quantity: number;
  unitCost: number;
}

/** Mirrors PurchaseOrderManagement.Api.Dtos.Quotations.QuotationDto. */
export interface Quotation {
  id: number;
  supplierBidId: number;
  file: UploadedFile;
  quoteReference: string | null;
  quoteDate: string;
  expiresAtUtc: string | null;
  isExpired: boolean;
  notes: string | null;
  lineItems: QuotationLineItem[];
}

/** Mirrors PurchaseOrderManagement.Api.Dtos.Quotations.QuotationSummaryDto. */
export interface QuotationSummary {
  id: number;
  supplierBidId: number;
  fileId: number;
  fileUrl: string;
  originalFileName: string | null;
  quoteReference: string | null;
  quoteDate: string;
  expiresAtUtc: string | null;
  isExpired: boolean;
  notes: string | null;
  lineItemCount: number;
}

/** Mirrors PurchaseOrderManagement.Api.Dtos.Quotations.CreateQuotationLineItemRequest. */
export interface CreateQuotationLineItemRequest {
  description: string;
  quantity: number;
  unitCost: number;
}

/** Mirrors PurchaseOrderManagement.Api.Dtos.Quotations.CreateQuotationRequest. */
export interface CreateQuotationRequest {
  fileId: number;
  quoteReference?: string | null;
  quoteDate: string;
  expiresAtUtc?: string | null;
  notes?: string | null;
  lineItems: CreateQuotationLineItemRequest[];
}

export function listQuotations(supplierBidId: number): Promise<QuotationSummary[]> {
  return apiClient.get<QuotationSummary[]>(`/supplier-bids/${supplierBidId}/quotations`);
}

export function getQuotation(supplierBidId: number, quotationId: number): Promise<Quotation> {
  return apiClient.get<Quotation>(`/supplier-bids/${supplierBidId}/quotations/${quotationId}`);
}

export function createQuotation(
  supplierBidId: number,
  request: CreateQuotationRequest,
): Promise<Quotation> {
  return apiClient.post<Quotation>(`/supplier-bids/${supplierBidId}/quotations`, request);
}
