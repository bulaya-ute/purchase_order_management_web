import { useAuth } from '../auth/useAuth';

export function ProfileScreen() {
  const { user } = useAuth();

  return (
    <section className="placeholder-card">
      <h2>My profile</h2>
      {user && (
        <dl className="profile-fields">
          <dt>Full name</dt>
          <dd>{user.fullName}</dd>
          <dt>Email</dt>
          <dd>{user.email}</dd>
          <dt>Roles</dt>
          <dd>{user.roles.length > 0 ? user.roles.join(', ') : '—'}</dd>
        </dl>
      )}
      <p>Password change and further account details will be added in a later slice.</p>
    </section>
  );
}
