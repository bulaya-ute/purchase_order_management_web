import { apiClient } from './client';
import { buildQueryString } from './types';
import type { PagedQuery, PagedResult } from './types';

/** Mirrors PurchaseOrderManagement.Api.Dtos.Suppliers.SupplierDto. */
export interface Supplier {
  id: number;
  supplierName: string;
  phone: string;
  email: string;
  address: string;
}

/** Mirrors PurchaseOrderManagement.Api.Dtos.Suppliers.SupplierListQuery. */
export interface SupplierListQuery extends PagedQuery {
  /** Optional case-insensitive filter on SupplierName. */
  search?: string;
}

/** Mirrors PurchaseOrderManagement.Api.Dtos.Suppliers.CreateSupplierRequest. */
export interface CreateSupplierRequest {
  supplierName: string;
  phone: string;
  email: string;
  address: string;
}

/** Mirrors PurchaseOrderManagement.Api.Dtos.Suppliers.UpdateSupplierRequest. */
export interface UpdateSupplierRequest {
  supplierName: string;
  phone: string;
  email: string;
  address: string;
}

export function listSuppliers(query: SupplierListQuery = {}): Promise<PagedResult<Supplier>> {
  return apiClient.get<PagedResult<Supplier>>(`/suppliers${buildQueryString(query)}`);
}

export function getSupplier(id: number): Promise<Supplier> {
  return apiClient.get<Supplier>(`/suppliers/${id}`);
}

export function createSupplier(request: CreateSupplierRequest): Promise<Supplier> {
  return apiClient.post<Supplier>('/suppliers', request);
}

export function updateSupplier(id: number, request: UpdateSupplierRequest): Promise<Supplier> {
  return apiClient.put<Supplier>(`/suppliers/${id}`, request);
}

export function deleteSupplier(id: number): Promise<void> {
  return apiClient.delete<void>(`/suppliers/${id}`);
}
