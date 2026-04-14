/** Must match `server/accessConfig.ts` SIDEBAR_FEATURE_KEYS. */
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

const TO_NAV: Record<SidebarFeatureKey, string> = {
  dashboard: 'dashboard',
  units: 'units',
  contracts: 'contracts',
  crm: 'crm',
  ledger: 'ledger',
  calendar: 'calendar',
  tenant_portal: 'portal',
  agent_portal: 'agentPortal',
};

export function featureKeyToNavMenuKey(key: SidebarFeatureKey): string {
  return TO_NAV[key];
}
