// Client-side mirror of the SQL permission map (sql/admin-roles-migration.sql).
// Keep these two in sync.

export const ROLES = {
  super_admin: 'Super Admin',
  finance:     'Finance',
  compliance:  'Compliance',
  support:     'Support',
  ops:         'Operations',
  read_only:   'Read-Only',
};

export const PERMISSIONS = {
  // Finance
  'withdrawals.review':       ['super_admin', 'finance'],
  'deposits.review':          ['super_admin', 'finance'],
  'balances.adjust':          ['super_admin', 'finance'],
  'investments.manage':       ['super_admin', 'finance'],
  // Compliance
  'kyc.review':               ['super_admin', 'compliance'],
  'fingerprints.view':        ['super_admin', 'compliance'],
  'multiaccount.view':        ['super_admin', 'compliance'],
  'platform.flags':           ['super_admin'],
  'platform.access':          ['super_admin', 'compliance'],
  'announcements.manage':     ['super_admin', 'support'],
  'audit.view':               ['super_admin', 'compliance'],
  // Support
  'support.manage':           ['super_admin', 'support'],
  'notifications.send':       ['super_admin', 'support'],
  'users.message':            ['super_admin', 'support'],
  // User management
  'users.view':               ['super_admin', 'support', 'finance', 'compliance', 'ops', 'read_only'],
  'users.freeze':             ['super_admin', 'support', 'compliance'],
  'users.role.assign':        ['super_admin'],
  // Ops / platform
  'platform.settings':        ['super_admin', 'ops'],
  'platform.maintenance':     ['super_admin', 'ops'],
  'platform.flags':           ['super_admin', 'ops'],
  'announcements.manage':     ['super_admin', 'ops'],
  'leaderboard.manage':       ['super_admin', 'ops'],
  'deposit_addresses.manage': ['super_admin', 'ops'],
  // Always-on
  'dashboard.view':           ['super_admin', 'finance', 'compliance', 'support', 'ops', 'read_only'],
};

export function hasPermission(role, perm) {
  if (!role) return false;
  if (role === 'super_admin') return true;
  const allowed = PERMISSIONS[perm];
  return Array.isArray(allowed) && allowed.includes(role);
}

export function roleLabel(role) {
  return ROLES[role] || 'Unknown';
}
