import { apiClient } from './client';

export interface PurchaseOrderTypeApprovalStepDto {
  id: number;
  requiredRoleId: number | null;
  requiredRoleName: string | null;
  requiredUserId: number | null;
  requiredUserName: string | null;
  sequenceOrder: number;
}

export interface PurchaseOrderTypeDto {
  id: number;
  name: string;
  isActive: boolean;
  approvalSteps: PurchaseOrderTypeApprovalStepDto[];
  allowedCreatorRoleIds: number[];
  allowedCreatorRoleNames: string[];
}

export interface CreatePurchaseOrderTypeRequest {
  name: string;
  isActive: boolean;
  approvalSteps: {
    requiredRoleId?: number;
    requiredUserId?: number;
    sequenceOrder: number;
  }[];
  allowedCreatorRoleIds: number[];
}

export interface UpdatePurchaseOrderTypeRequest {
  name: string;
  isActive: boolean;
  approvalSteps: {
    requiredRoleId?: number;
    requiredUserId?: number;
    sequenceOrder: number;
  }[];
  allowedCreatorRoleIds: number[];
}

export function listPurchaseOrderTypes(): Promise<PurchaseOrderTypeDto[]> {
  return apiClient.get<PurchaseOrderTypeDto[]>('/purchase-order-types');
}

export function getPurchaseOrderType(id: number): Promise<PurchaseOrderTypeDto> {
  return apiClient.get<PurchaseOrderTypeDto>(`/purchase-order-types/${id}`);
}

export function createPurchaseOrderType(
  request: CreatePurchaseOrderTypeRequest,
): Promise<PurchaseOrderTypeDto> {
  return apiClient.post<PurchaseOrderTypeDto>('/purchase-order-types', request);
}

export function updatePurchaseOrderType(
  id: number,
  request: UpdatePurchaseOrderTypeRequest,
): Promise<PurchaseOrderTypeDto> {
  return apiClient.put<PurchaseOrderTypeDto>(`/purchase-order-types/${id}`, request);
}

export function deletePurchaseOrderType(id: number): Promise<void> {
  return apiClient.delete<void>(`/purchase-order-types/${id}`);
}
