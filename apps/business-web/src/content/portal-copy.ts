export const portalCopy = {
  title: 'Business Portal',
  phase: 'Phase 4E Fulfilment',
  navigationLabel: 'Business portal sections',
  navItems: [
    { key: 'onboarding', label: 'Onboarding', href: '/' },
    { key: 'catalogue', label: 'Catalogue', href: '/catalogue' },
    { key: 'inventory', label: 'Inventory', href: '/inventory' },
    { key: 'offers', label: 'Offers', href: '/offers' },
    { key: 'orders', label: 'Orders', href: '/orders' },
    { key: 'audit', label: 'Audit', href: '/audit' },
  ],
  activeRoleEyebrow: 'Mock role',
  activeRoleTitle: 'Operations Manager Workspace',
  statusLabel: 'System status',
  statuses: [
    { label: 'Onboarding API ready', tone: 'ok' },
    { label: 'Postgres local', tone: 'ok' },
    { label: 'Provider mocks only', tone: 'warn' },
  ],
  metrics: [
    { value: '2', label: 'Business profile types' },
    { value: '8', label: 'KYC document types' },
    { value: '8', label: 'Onboarding and KYC permissions' },
  ],
  queueLabel: 'Operational queues',
  queues: [
    {
      title: 'Company onboarding',
      meta: 'Profile, KYC metadata and approval readiness',
      action: 'Review',
    },
    {
      title: 'Distributor onboarding',
      meta: 'Pincode serviceability and fulfilment capability',
      action: 'Review',
    },
    {
      title: 'KYC review',
      meta: 'Submitted, rejected, expired and approved metadata',
      action: 'Inspect',
    },
  ],
  rolePanelTitle: 'Role boundaries',
  rolePanelDescription:
    'The business portal remains one app with server-side permission checks and role-specific onboarding queues.',
  roleResponsibilities: [
    'Companies maintain brand and legal onboarding details.',
    'Distributors maintain operating and serviceability details.',
    'Vardhnam teams review KYC metadata and organisation approvals.',
  ],
} as const;
