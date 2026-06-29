import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';

export function UserMenu() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);

  if (!user) return null;

  const handleLogout = async () => {
    setIsOpen(false);
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="user-menu">
      <button
        type="button"
        className="user-menu-trigger"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((open) => !open)}
      >
        {user.fullName}
      </button>

      {isOpen && (
        <div className="user-menu-popover" role="menu">
          <Link to="/profile" role="menuitem" onClick={() => setIsOpen(false)}>
            My profile
          </Link>
          <button type="button" role="menuitem" onClick={handleLogout}>
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
