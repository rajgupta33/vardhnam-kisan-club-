import Link from 'next/link';
import { portalCopy } from '../content/portal-copy';

interface BusinessShellProps {
  active: 'onboarding' | 'catalogue' | 'inventory' | 'offers' | 'orders' | 'audit';
  eyebrow: string;
  title: string;
  statuses: ReadonlyArray<{
    label: string;
    tone: 'ok' | 'warn' | 'danger';
  }>;
  children: React.ReactNode;
}

export function BusinessShell({ active, eyebrow, title, statuses, children }: BusinessShellProps) {
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
          {portalCopy.navItems.map((item) => (
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
