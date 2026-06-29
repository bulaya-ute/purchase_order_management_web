import { Outlet } from 'react-router-dom';
import { ThemeToggle } from '../components/ThemeToggle';
import { Sidebar } from './Sidebar';
import { UserMenu } from './UserMenu';
import './shell.css';

/** The authenticated app layout: top bar + sidebar + content area for the active route. */
export function AppShell() {
  return (
    <div className="app-shell">
      <header className="app-header">
        <h1 className="app-title">Purchase Order Management</h1>
        <div className="app-header-actions">
          <ThemeToggle />
          <UserMenu />
        </div>
      </header>

      <div className="app-body">
        <Sidebar />
        <main className="app-main">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
