import { apiClient } from './client';
import { buildQueryString } from './types';
import type { PagedQuery, PagedResult } from './types';

/** Mirrors PurchaseOrderManagement.Api.Dtos.Users.UserRoleDto. */
export interface UserRole {
  id: number;
  name: string;
}

/** Mirrors PurchaseOrderManagement.Api.Dtos.Users.UserDto. Never includes a password hash. */
export interface User {
  id: number;
  fullName: string;
  email: string;
  isActive: boolean;
  companyId: number;
  companyName: string;
  roles: UserRole[];
}

/** Mirrors PurchaseOrderManagement.Api.Dtos.Users.UserListQuery. */
export interface UserListQuery extends PagedQuery {
  companyId?: number;
}

/** Mirrors PurchaseOrderManagement.Api.Dtos.Users.CreateUserRequest. */
export interface CreateUserRequest {
  fullName: string;
  email: string;
  companyId: number;
  isActive: boolean;
  password: string;
  roleIds: number[];
}

/** Mirrors PurchaseOrderManagement.Api.Dtos.Users.UpdateUserRequest. */
export interface UpdateUserRequest {
  fullName: string;
  email: string;
  companyId: number;
  isActive: boolean;
  roleIds: number[];
}

export function listUsers(query: UserListQuery = {}): Promise<PagedResult<User>> {
  return apiClient.get<PagedResult<User>>(`/users${buildQueryString(query)}`);
}

export function getUser(id: number): Promise<User> {
  return apiClient.get<User>(`/users/${id}`);
}

export function createUser(request: CreateUserRequest): Promise<User> {
  return apiClient.post<User>('/users', request);
}

export function updateUser(id: number, request: UpdateUserRequest): Promise<User> {
  return apiClient.put<User>(`/users/${id}`, request);
}

export function deleteUser(id: number): Promise<void> {
  return apiClient.delete<void>(`/users/${id}`);
}

export function resetUserPassword(id: number, newPassword: string): Promise<void> {
  return apiClient.post<void>(`/users/${id}/reset-password`, { newPassword });
}
