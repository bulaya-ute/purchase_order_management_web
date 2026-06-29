export interface NavItem {
  label: string;
  to: string;
}

export const PRIMARY_NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', to: '/' },
  { label: 'Purchase Orders', to: '/purchase-orders' },
  { label: 'Approvals', to: '/approvals' },
  { label: 'Suppliers', to: '/suppliers' },
];

export const ADMIN_NAV_ITEMS: NavItem[] = [
  { label: 'Companies', to: '/admin/companies' },
  { label: 'Users', to: '/admin/users' },
  { label: 'Roles', to: '/admin/roles' },
];
