import { apiClient } from './client';

/** Mirrors PurchaseOrderManagement.Api.Dtos.Auth.CurrentUserDto. */
export interface CurrentUser {
  id: number;
  fullName: string;
  email: string;
  companyId: number;
  roles: string[];
}

export function login(email: string, password: string): Promise<CurrentUser> {
  return apiClient.post<CurrentUser>('/auth/login', { email, password });
}

export function logout(): Promise<void> {
  return apiClient.post<void>('/auth/logout');
}

export function getMe(): Promise<CurrentUser> {
  return apiClient.get<CurrentUser>('/auth/me');
}
