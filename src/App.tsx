import { ThemeToggle } from './components/ThemeToggle';
import './App.css';

function App() {
  return (
    <div className="app-shell">
      <header className="app-header">
        <h1 className="app-title">Purchase Order Management</h1>
        <ThemeToggle />
      </header>

      <main className="app-main">
        <section className="placeholder-card">
          <h2>Foundation ready</h2>
          <p>
            Frontend scaffold is in place with System / Light / Dark theming. Feature screens
            (suppliers, quotations &amp; bids, purchase orders, approvals) will be built on top of
            this shell.
          </p>
        </section>
      </main>
    </div>
  );
}

export default App;
