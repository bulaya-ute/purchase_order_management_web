import { apiClient } from './client';

export interface Currency {
  code: string;
  name: string;
  isActive: boolean;
}

export interface CreateCurrencyRequest {
  code: string;
  name: string;
  isActive: boolean;
}

export interface UpdateCurrencyRequest {
  name: string;
  isActive: boolean;
}

export function listCurrencies(options?: { isActive?: boolean }): Promise<Currency[]> {
  const params = new URLSearchParams();
  if (options?.isActive !== undefined) {
    params.append('isActive', String(options.isActive));
  }
  const query = params.toString();
  return apiClient.get<Currency[]>(`/currencies${query ? `?${query}` : ''}`);
}

export function getCurrency(code: string): Promise<Currency> {
  return apiClient.get<Currency>(`/currencies/${code}`);
}

export function createCurrency(request: CreateCurrencyRequest): Promise<Currency> {
  return apiClient.post<Currency>('/currencies', request);
}

export function updateCurrency(code: string, request: UpdateCurrencyRequest): Promise<Currency> {
  return apiClient.put<Currency>(`/currencies/${code}`, request);
}
