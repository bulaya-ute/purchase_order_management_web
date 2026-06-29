import { apiClient } from './client';
import { buildQueryString } from './types';
import type { PagedQuery, PagedResult } from './types';

/** Mirrors PurchaseOrderManagement.Api.Dtos.Companies.CompanyDto. */
export interface Company {
  id: number;
  name: string;
  parentCompanyId: number | null;
  parentCompanyName: string | null;
}

/** Mirrors PurchaseOrderManagement.Api.Dtos.Companies.CreateCompanyRequest. */
export interface CreateCompanyRequest {
  name: string;
  parentCompanyId: number | null;
}

/** Mirrors PurchaseOrderManagement.Api.Dtos.Companies.UpdateCompanyRequest. */
export interface UpdateCompanyRequest {
  name: string;
  parentCompanyId: number | null;
}

export function listCompanies(query: PagedQuery = {}): Promise<PagedResult<Company>> {
  return apiClient.get<PagedResult<Company>>(`/companies${buildQueryString(query)}`);
}

/**
 * Fetches every company by walking pages, for use in pickers (e.g. the parent-company select)
 * where the full set is needed regardless of the screen's current page size. The backend caps
 * PageSize at 100, so this loops if there are more than that.
 */
export async function listAllCompanies(): Promise<Company[]> {
  const all: Company[] = [];
  let page = 1;
  const pageSize = 100;
  while (true) {
    const result = await listCompanies({ page, pageSize });
    all.push(...result.items);
    if (all.length >= result.totalCount || result.items.length === 0) {
      break;
    }
    page += 1;
  }
  return all;
}

export function getCompany(id: number): Promise<Company> {
  return apiClient.get<Company>(`/companies/${id}`);
}

export function createCompany(request: CreateCompanyRequest): Promise<Company> {
  return apiClient.post<Company>('/companies', request);
}

export function updateCompany(id: number, request: UpdateCompanyRequest): Promise<Company> {
  return apiClient.put<Company>(`/companies/${id}`, request);
}

export function deleteCompany(id: number): Promise<void> {
  return apiClient.delete<void>(`/companies/${id}`);
}
