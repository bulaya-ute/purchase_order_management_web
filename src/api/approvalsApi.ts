import { apiClient } from './client';

/** Approval status — string enum mirroring PurchaseOrderManagement.Api.Enums.ApprovalStatus. */
export type ApprovalStatus = 'Pending' | 'Approved' | 'Rejected' | 'Skipped';

/** Mirrors PurchaseOrderManagement.Api.Dtos.Approvals.ApprovalDto. */
export interface ApprovalDto {
  id: number;
  purchaseOrderId: number;
  requiredRoleId: number | null;
  requiredRoleName: string | null;
  requiredUserId: number | null;
  requiredUserName: string | null;
  sequenceOrder: number;
  status: ApprovalStatus;
  approvedByUserId: number | null;
  approvedByUserName: string | null;
  approvedAtUtc: string | null;
  comment: string | null;
  rowVersion: string;
}

/** Mirrors PurchaseOrderManagement.Api.Dtos.Approvals.MyApprovalDto — the current user's inbox row. */
export interface MyApprovalDto {
  id: number;
  purchaseOrderId: number;
  poNumber: string;
  companyName: string;
  totalAmount: number;
  currency: string;
  requiredRoleId: number | null;
  requiredRoleName: string | null;
  requiredUserId: number | null;
  sequenceOrder: number;
  rowVersion: string;
}

/** Mirrors PurchaseOrderManagement.Api.Dtos.Approvals.ActOnApprovalRequest. */
export interface ActOnApprovalRequest {
  comment?: string;
  rowVersion?: string;
}

export function getMyApprovals(): Promise<MyApprovalDto[]> {
  return apiClient.get<MyApprovalDto[]>('/approvals/mine');
}

export function approveApproval(
  approvalId: number,
  request: ActOnApprovalRequest = {},
): Promise<ApprovalDto> {
  return apiClient.post<ApprovalDto>(`/approvals/${approvalId}/approve`, request);
}

export function rejectApproval(
  approvalId: number,
  request: ActOnApprovalRequest = {},
): Promise<ApprovalDto> {
  return apiClient.post<ApprovalDto>(`/approvals/${approvalId}/reject`, request);
}
