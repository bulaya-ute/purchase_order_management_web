import { NavLink } from 'react-router-dom';
import { ADMIN_NAV_ITEMS, PRIMARY_NAV_ITEMS } from './navItems';
import { isAdminTier } from '../auth/roles';
import { useAuth } from '../auth/useAuth';

export function Sidebar() {
  const { user } = useAuth();
  const showAdmin = isAdminTier(user?.roles ?? []);

  return (
    <nav className="app-sidebar" aria-label="Primary">
      <div className="sidebar-brand">
        <span className="sidebar-brand-mark" aria-hidden="true">
          PO
        </span>
        <span className="sidebar-brand-text">Purchase Orders</span>
      </div>

      <ul className="nav-list">
        {PRIMARY_NAV_ITEMS.map((item) => (
          <li key={item.to}>
            <NavLink
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) => (isActive ? 'nav-link is-active' : 'nav-link')}
            >
              {item.label}
            </NavLink>
          </li>
        ))}
      </ul>

      {showAdmin && (
        <div className="nav-group">
          <div className="nav-group-label">Administration</div>
          <ul className="nav-list">
            {ADMIN_NAV_ITEMS.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  className={({ isActive }) => (isActive ? 'nav-link is-active' : 'nav-link')}
                >
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      )}
    </nav>
  );
}
