import fs from 'fs';

const filePath = new URL('../src/components/views/CRMView/CRMView.tsx', import.meta.url);
let s = fs.readFileSync(filePath, 'utf8');

function removeBetween(startMarker, endMarker, label) {
  const start = s.indexOf(startMarker);
  const end = s.indexOf(endMarker, start);
  if (start === -1 || end === -1) {
    console.error('Failed:', label, start, end);
    process.exit(1);
  }
  s = s.slice(0, start) + s.slice(end);
  console.log('OK:', label);
}

removeBetween('  const [brokersLoading, setBrokersLoading]', '  const [blacklistLoading, setBlacklistLoading]', 'brokersLoading state');
removeBetween('  const [isBrokerFormOpen, setIsBrokerFormOpen]', '  const [isTenantHistoryOpen', 'broker form state');
removeBetween('  const reloadBrokers = useCallback(async () => {', '  const reloadBlacklist = useCallback(async () => {', 'reloadBrokers');
removeBetween('  useEffect(() => {\n    if (!isBrokerLogsOpen || !brokerLogsAgency) return;', '  const filteredTenants = useMemo(() => {', 'broker logs effect');
removeBetween('  const filteredBrokers = useMemo(() => {', '  const idTypeOptions = useMemo(', 'filteredBrokers');
removeBetween('  const brokerGovDocTypeOptions = useMemo(', '  const tenantLeaseContext = useMemo(() => {', 'brokerGovDocTypeOptions');
removeBetween('  const openAddBroker = () => {', '  const openTenantFromBlacklist = () => {', 'broker handlers');

// Clean imports
s = s.replace(
  /import \{\n  createPartnerAgency,\n  deletePartnerAgency,\n  fetchPartnerAgencies,\n  fetchPartnerAgencyCollaborations,\n  uploadPartnerAgencyKycDocument,\n  updatePartnerAgency,\n  type PartnerAgencyCollaborationLog,\n\} from '@\/lib\/partnerAgenciesApi';\n\n/,
  '',
);

s = s.replace(
  /import type \{ BrokerAgency, Contract, Tenant, Unit \} from '@\/types';/,
  "import type { Contract, Tenant, Unit } from '@/types';",
);

s = s.replace(/  const \[brokerList, setBrokerList\] = useState<BrokerAgency\[\]>\(\[\]\);\n/, '');

fs.writeFileSync(filePath, s);
console.log('pass 2 done');
