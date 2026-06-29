/**
 * Admin-tier role names that unlock the Administration nav group.
 * Mirrors the backend's coarse gate in
 * PurchaseOrderManagement.Api/Services/AdminAuthorizer.cs (case-insensitive).
 */
const ADMIN_ROLE_NAMES = new Set(['super admin', 'admin']);

export function isAdminTier(roles: readonly string[]): boolean {
  return roles.some((role) => ADMIN_ROLE_NAMES.has(role.toLowerCase()));
}
