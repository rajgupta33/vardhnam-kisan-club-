import Link from 'next/link';
import { logoutAction } from '../app/login/actions';
import { portalCopy } from '../content/portal-copy';
import { readPortalSession } from '../lib/auth-session';

type NavKey = (typeof portalCopy.navItems)[number]['key'];

interface BusinessShellProps {
  active: NavKey;
  eyebrow: string;
  title: string;
  statuses: ReadonlyArray<{
    label: string;
    tone: 'ok' | 'warn' | 'danger';
  }>;
  children: React.ReactNode;
}

export async function BusinessShell({
  active,
  eyebrow,
  title,
  statuses,
  children,
}: BusinessShellProps) {
  const session = await readPortalSession();
  const permissions = session?.permissions ?? [];
  const navigation = portalCopy.navItems.filter((item) =>
    item.anyPermission.some((permission) => permissions.includes(permission)),
  );

  return (
    <main className="shell">
      <aside className="sidebar" aria-label={portalCopy.navigationLabel}>
        <div className="brandBlock">
          <span className="brandMark">VA</span>
          <div>
            <p className="eyebrow">{portalCopy.phase}</p>
            <h1>{portalCopy.title}</h1>
          </div>
        </div>
        <nav className="navList">
          {navigation.map((item) => (
            <Link
              aria-current={active === item.key ? 'page' : undefined}
              className={active === item.key ? 'active' : undefined}
              href={item.href}
              key={item.href}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {session ? (
          <div className="sidebarUser">
            <div className="sidebarUserInfo">
              <span className="sidebarUserAvatar">{session.sub.slice(-2).toUpperCase()}</span>
              <div className="sidebarUserMeta">
                <span className="sidebarUserPhone">{shortIdentifier(session.sub)}</span>
                <span className="sidebarUserRole">{labelFromCode(session.role)}</span>
              </div>
            </div>
            <form action={logoutAction}>
              <button
                aria-label="Sign out"
                className="sidebarLogout"
                title="Sign out"
                type="submit"
              >
                →
              </button>
            </form>
          </div>
        ) : null}
      </aside>

      <section className="workspace">
        <header className="workspaceHeader">
          <div>
            <p className="eyebrow">{eyebrow}</p>
            <h2>{title}</h2>
          </div>
          <div className="statusGroup" aria-label={portalCopy.statusLabel}>
            {statuses.map((status) => (
              <span className={`statusBadge ${status.tone}`} key={status.label}>
                {status.label}
              </span>
            ))}
          </div>
        </header>

        {children}
      </section>
    </main>
  );
}

function labelFromCode(value: string): string {
  return value
    .toLowerCase()
    .split('_')
    .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
    .join(' ');
}

function shortIdentifier(userId: string): string {
  return userId.length > 12 ? `${userId.slice(0, 8)}…` : userId;
}
