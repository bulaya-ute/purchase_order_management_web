import { apiClient } from './client';

/** Mirrors PurchaseOrderManagement.Api.Dtos.Roles.RoleDto. Flat shape; client builds the tree. */
export interface Role {
  id: number;
  name: string;
  parentRoleId: number | null;
  isSystemRole: boolean;
}

/** Mirrors PurchaseOrderManagement.Api.Dtos.Roles.CreateRoleRequest. */
export interface CreateRoleRequest {
  name: string;
  parentRoleId: number;
}

/** Mirrors PurchaseOrderManagement.Api.Dtos.Roles.UpdateRoleRequest. Rename only. */
export interface UpdateRoleRequest {
  name: string;
}

export function listRoles(): Promise<Role[]> {
  return apiClient.get<Role[]>('/roles');
}

/** Roles the current user may set as a parent for a new role (their seniority ceiling + descendants). */
export function listAllowedParentRoles(): Promise<Role[]> {
  return apiClient.get<Role[]>('/roles/allowed-parents');
}

export function getRole(id: number): Promise<Role> {
  return apiClient.get<Role>(`/roles/${id}`);
}

export function createRole(request: CreateRoleRequest): Promise<Role> {
  return apiClient.post<Role>('/roles', request);
}

export function renameRole(id: number, request: UpdateRoleRequest): Promise<Role> {
  return apiClient.put<Role>(`/roles/${id}`, request);
}

export function deleteRole(id: number): Promise<void> {
  return apiClient.delete<void>(`/roles/${id}`);
}
