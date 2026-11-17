export type DashboardExportRow = [string, string | number];

export type DashboardExportSummary = {
  generatedAtUtc: string;
  window: { fromUtc: string; toUtc: string };
  audience: {
    role: string;
    profileKey?: string;
    metricKeys: string[];
    panelKeys: string[];
  };
  totalOnSite: number;
  pendingRequests: number;
  approvedRequests: number;
  deniedRequests: number;
  movements: { total: number; entries: number; exits: number; denied: number };
  workforce: {
    eligibleWorkers: number;
    clearedWorkers: number;
    pendingWorkers: number;
    returnedWorkers: number;
    readinessRate: number;
  };
  expiry: { expired: number; next7Days: number; days8To30: number };
  portfolio: {
    registeredWorkers: number;
    projects: number;
    sites: number;
    externalCompanies: number;
    consultants: number;
  };
  actionQueue: Array<{ key: string; count: number; applicable: boolean }>;
};

type DashboardExportContext = {
  operatorId?: string;
  siteId?: string;
  externalCompanyId?: string;
  externalCompanyName?: string;
  accessRequestStatus?: string;
};

const ASSIGNED_DECISION_KEYS = new Set([
  'work-pass-consultant-approvals',
  'work-pass-supervisor-approvals',
]);

export function getDashboardExportRows(
  summary: DashboardExportSummary,
  showAttendanceAnalytics: boolean,
  context: DashboardExportContext = {},
): DashboardExportRow[] {
  const rows: DashboardExportRow[] = [
    ['Report', 'GatePass dashboard'],
    ['Generated at UTC', summary.generatedAtUtc],
    ['Window from UTC', summary.window.fromUtc],
    ['Window to UTC', summary.window.toUtc],
    ['Operator filter', context.operatorId ?? 'all'],
    ['Site filter', context.siteId ?? 'all'],
    ['External company filter', formatExternalCompanyScope(context)],
    ['Access request filter', context.accessRequestStatus ?? 'all'],
    ['Role view', summary.audience.role],
  ];
  const labels = new Set(rows.map(([label]) => label));
  const add = (label: string, value: string | number) => {
    if (!labels.has(label)) {
      rows.push([label, value]);
      labels.add(label);
    }
  };
  const addPortfolio = () => {
    add('Registered workers', summary.portfolio.registeredWorkers);
    add('Projects', summary.portfolio.projects);
    add('Sites', summary.portfolio.sites);
    add('Contractors & consultants', summary.portfolio.externalCompanies);
    add('Consultant companies', summary.portfolio.consultants);
  };
  const addWorkforce = () => {
    add('Eligible workforce', summary.workforce.eligibleWorkers);
    add('Cleared workforce', summary.workforce.clearedWorkers);
    add('Readiness rate', summary.workforce.readinessRate);
  };
  const addCredentials = () => {
    add('Expired credentials', summary.expiry.expired);
    add('Credentials expiring next 7 days', summary.expiry.next7Days);
    add('Credentials expiring in 8–30 days', summary.expiry.days8To30);
  };
  const addMovements = () => {
    add('Movements', summary.movements.total);
    add('Entries', summary.movements.entries);
    add('Exits', summary.movements.exits);
    add('Denied movements', summary.movements.denied);
  };

  for (const key of summary.audience.metricKeys ?? []) {
    switch (key) {
      case 'people-on-site': add('On site now', summary.totalOnSite); break;
      case 'pending-decisions': add('Pending requests', summary.pendingRequests); break;
      case 'assigned-decisions':
        add('Assigned decisions', summary.actionQueue
          .filter((item) => item.applicable && ASSIGNED_DECISION_KEYS.has(item.key))
          .reduce((total, item) => total + item.count, 0));
        break;
      case 'workforce-readiness': addWorkforce(); break;
      case 'workers-needing-action':
        add('Workers needing action', summary.workforce.pendingWorkers + summary.workforce.returnedWorkers);
        break;
      case 'credential-risk': addCredentials(); break;
      case 'compliance-exceptions':
        add('Returned workforce', summary.workforce.returnedWorkers);
        add('Expired credentials', summary.expiry.expired);
        break;
      case 'registered-workers': add('Registered workers', summary.portfolio.registeredWorkers); break;
      case 'projects': add('Projects', summary.portfolio.projects); break;
      case 'sites': add('Sites', summary.portfolio.sites); break;
      case 'external-companies':
        add('Contractors & consultants', summary.portfolio.externalCompanies);
        add('Consultant companies', summary.portfolio.consultants);
        break;
      case 'entries': add('Entries', summary.movements.entries); break;
      case 'exits': add('Exits', summary.movements.exits); break;
      case 'denied-attempts': add('Denied movements', summary.movements.denied); break;
    }
  }

  const panelKeys = new Set(summary.audience.panelKeys ?? []);
  if (panelKeys.has('scope-overview')) addPortfolio();
  if (showAttendanceAnalytics && panelKeys.has('movement-activity')) addMovements();
  if (panelKeys.has('decision-health')) {
    add('Pending requests', summary.pendingRequests);
    add('Active approvals', summary.approvedRequests);
    add('Denied requests in window', summary.deniedRequests);
  }
  if (panelKeys.has('clearance-pipeline') || panelKeys.has('workforce-readiness')) addWorkforce();
  if (panelKeys.has('credential-watch')) addCredentials();

  return rows;
}

function formatExternalCompanyScope(context: DashboardExportContext) {
  const companyId = context.externalCompanyId ?? 'all';
  if (companyId === 'all') return 'all';
  return context.externalCompanyName
    ? `${context.externalCompanyName} (${companyId})`
    : companyId;
}
