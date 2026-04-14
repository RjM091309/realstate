/** Keys stored in `branch_sidebar_permissions.feature_key` / `user_role_crud_permissions.module_key`. */
export const SIDEBAR_FEATURE_KEYS = [
  'dashboard',
  'units',
  'contracts',
  'crm',
  'ledger',
  'calendar',
  'tenant_portal',
  'agent_portal',
] as const;

export type SidebarFeatureKey = (typeof SIDEBAR_FEATURE_KEYS)[number];
