export interface NavItem {
  label: string;
  to: string;
}

export const PRIMARY_NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', to: '/' },
  { label: 'Purchase Orders', to: '/purchase-orders' },
  { label: 'Approvals', to: '/approvals' },
  { label: 'Suppliers', to: '/suppliers' },
  { label: 'Quotations', to: '/quotations' },
  { label: 'Supplier Bids', to: '/supplier-bids' },
];

export const ADMIN_NAV_ITEMS: NavItem[] = [
  { label: 'Companies', to: '/admin/companies' },
  { label: 'Users', to: '/admin/users' },
  { label: 'Roles', to: '/admin/roles' },
  { label: 'Currencies', to: '/admin/currencies' },
  { label: 'PO Types', to: '/admin/po-types' },
];
