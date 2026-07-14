import { format, isValid, parseISO, differenceInCalendarDays } from 'date-fns';
import type { BrokerAgency } from '@/types';
import type { PartnerAgencyCollaborationLog } from '@/lib/partnerAgenciesApi';

export type BrokerVerificationStatus = 'verified' | 'pending' | 'rejected';
export type BrokerPartnershipStatus = 'active' | 'inactive' | 'suspended' | 'expired';

export type BrokerFilters = {
  verification: 'all' | BrokerVerificationStatus;
  partnership: 'all' | BrokerPartnershipStatus;
  city: string;
  province: string;
  contractExpiry: 'all' | 'expired' | 'expiring30' | 'expiring90' | 'valid';
};

export const DEFAULT_BROKER_FILTERS: BrokerFilters = {
  verification: 'all',
  partnership: 'all',
  city: 'all',
  province: 'all',
  contractExpiry: 'all',
};

export type BrokerSummary = {
  totalAgencies: number;
  activeAgencies: number;
  pendingVerification: number;
  expiringContracts: number;
  verifiedAgencies: number;
};

export const BROKER_BUSINESS_TYPES = [
  'Real Estate Brokerage',
  'Property Management',
  'Developer Sales Office',
  'Independent Broker',
  'Corporate Agency',
  'Other',
] as const;

export const BROKER_DOCUMENT_TYPES = [
  'Business Permit',
  'SEC Registration',
  'DTI Registration',
  'BIR Certificate',
  'PRC License',
  'Company Profile',
  'Government ID',
  'Other',
] as const;

export const BROKER_GOV_DOC_TYPES = [
  'Passport',
  'National ID (PhilID)',
  'Driver\'s License',
  'PRC ID',
  'Other',
] as const;

export type BrokerFormState = {
  agencyName: string;
  businessRegistrationName: string;
  businessType: string;
  website: string;
  officeAddress: string;
  city: string;
  province: string;
  postalCode: string;
  brokerFullName: string;
  prcLicenseNo: string;
  prcLicenseExpiry: string;
  brokerMobile: string;
  brokerEmail: string;
  telephone: string;
  mobile: string;
  email: string;
  contactWebsite: string;
  facebookPage: string;
  partnershipDate: string;
  contractStart: string;
  contractEnd: string;
  assignedAccountManager: string;
  internalNotes: string;
  nationality: string;
  documentType: string;
  documentNo: string;
  expiryDate: string;
  filePath: string;
};

export function emptyBrokerForm(): BrokerFormState {
  return {
    agencyName: '',
    businessRegistrationName: '',
    businessType: '',
    website: '',
    officeAddress: '',
    city: '',
    province: '',
    postalCode: '',
    brokerFullName: '',
    prcLicenseNo: '',
    prcLicenseExpiry: '',
    brokerMobile: '',
    brokerEmail: '',
    telephone: '',
    mobile: '',
    email: '',
    contactWebsite: '',
    facebookPage: '',
    partnershipDate: '',
    contractStart: '',
    contractEnd: '',
    assignedAccountManager: '',
    internalNotes: '',
    nationality: '',
    documentType: '',
    documentNo: '',
    expiryDate: '',
    filePath: '',
  };
}

export function brokerToForm(agency: BrokerAgency): BrokerFormState {
  return {
    ...emptyBrokerForm(),
    agencyName: agency.name ?? '',
    brokerFullName: agency.contactPerson ?? '',
    mobile: agency.phone ?? '',
    brokerMobile: agency.phone ?? '',
    email: agency.email ?? '',
    brokerEmail: agency.email ?? '',
    nationality: agency.nationality ?? '',
    documentType: agency.documentType ?? '',
    documentNo: agency.documentNo ?? '',
    prcLicenseNo: agency.documentNo ?? '',
    expiryDate: agency.expiryDate ?? '',
    contractEnd: agency.expiryDate ?? '',
    prcLicenseExpiry: agency.expiryDate ?? '',
    filePath: agency.filePath ?? '',
    internalNotes: agency.blacklistReason ?? '',
  };
}

export function brokerFormToApiPayload(form: BrokerFormState) {
  const name = form.agencyName.trim();
  const contactPerson = form.brokerFullName.trim() || form.agencyName.trim();
  const phone = form.mobile.trim() || form.brokerMobile.trim() || form.telephone.trim();
  const contractEnd = form.contractEnd.trim() || form.expiryDate.trim() || form.prcLicenseExpiry.trim();
  return {
    name,
    contactPerson,
    phone,
    email: form.email.trim() || form.brokerEmail.trim() || undefined,
    nationality: form.nationality.trim() || undefined,
    documentType: form.documentType.trim() || 'PRC License',
    documentNo: form.prcLicenseNo.trim() || form.documentNo.trim() || undefined,
    expiryDate: contractEnd || undefined,
    filePath: form.filePath.trim() || undefined,
  };
}

export function formatBrokerDateTime(value?: string): string {
  if (!value?.trim()) return '—';
  const normalized = value.trim().includes('T') ? value.trim() : value.trim().replace(' ', 'T');
  const d = new Date(normalized);
  if (Number.isNaN(d.getTime())) return value;
  return format(d, 'MMM dd, yyyy · h:mm a');
}

export function formatBrokerDate(value?: string): string {
  if (!value?.trim()) return '—';
  const d = parseISO(value.trim().slice(0, 10));
  return isValid(d) ? format(d, 'MMM d, yyyy') : value;
}

export function parseBrokerDate(value?: string): Date | null {
  if (!value?.trim()) return null;
  const d = parseISO(value.trim().slice(0, 10));
  return isValid(d) ? d : null;
}

export function getVerificationStatus(agency: BrokerAgency): BrokerVerificationStatus {
  if (agency.kycVerified) return 'verified';
  if (agency.isBlacklisted) return 'rejected';
  return 'pending';
}

export function getPartnershipStatus(agency: BrokerAgency): BrokerPartnershipStatus {
  if (agency.isBlacklisted) return 'suspended';
  if (!agency.active) return 'inactive';
  const expiry = parseBrokerDate(agency.expiryDate);
  if (expiry && differenceInCalendarDays(expiry, new Date()) < 0) return 'expired';
  return 'active';
}

export function verificationTone(status: BrokerVerificationStatus): 'success' | 'warning' | 'danger' {
  if (status === 'verified') return 'success';
  if (status === 'rejected') return 'danger';
  return 'warning';
}

export function partnershipTone(status: BrokerPartnershipStatus): 'success' | 'neutral' | 'danger' | 'warning' {
  if (status === 'active') return 'success';
  if (status === 'expired') return 'danger';
  if (status === 'suspended') return 'danger';
  if (status === 'inactive') return 'neutral';
  return 'neutral';
}

export function isContractExpiringSoon(agency: BrokerAgency, withinDays = 30): boolean {
  const expiry = parseBrokerDate(agency.expiryDate);
  if (!expiry) return false;
  const days = differenceInCalendarDays(expiry, new Date());
  return days >= 0 && days <= withinDays;
}

export function isContractExpired(agency: BrokerAgency): boolean {
  const expiry = parseBrokerDate(agency.expiryDate);
  if (!expiry) return false;
  return differenceInCalendarDays(expiry, new Date()) < 0;
}

export function computeBrokerSummary(agencies: BrokerAgency[]): BrokerSummary {
  return {
    totalAgencies: agencies.length,
    activeAgencies: agencies.filter((a) => getPartnershipStatus(a) === 'active').length,
    pendingVerification: agencies.filter((a) => getVerificationStatus(a) === 'pending').length,
    expiringContracts: agencies.filter((a) => isContractExpiringSoon(a, 30)).length,
    verifiedAgencies: agencies.filter((a) => a.kycVerified).length,
  };
}

export function filterBrokers(agencies: BrokerAgency[], search: string, filters: BrokerFilters): BrokerAgency[] {
  const q = search.trim().toLowerCase();
  return agencies.filter((agency) => {
    if (q) {
      const haystack = [
        agency.name,
        agency.contactPerson,
        agency.email,
        agency.phone,
        agency.nationality,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      if (!haystack.includes(q)) return false;
    }

    const verification = getVerificationStatus(agency);
    if (filters.verification !== 'all' && verification !== filters.verification) return false;

    const partnership = getPartnershipStatus(agency);
    if (filters.partnership !== 'all' && partnership !== filters.partnership) return false;

    if (filters.contractExpiry === 'expired' && !isContractExpired(agency)) return false;
    if (filters.contractExpiry === 'expiring30' && !isContractExpiringSoon(agency, 30)) return false;
    if (filters.contractExpiry === 'expiring90' && !isContractExpiringSoon(agency, 90)) return false;
    if (filters.contractExpiry === 'valid') {
      if (!agency.expiryDate || isContractExpired(agency)) return false;
    }

    return true;
  });
}

export type BrokerActivityRow = {
  id: string;
  action: string;
  user: string;
  createdAt: string;
};

export function buildBrokerActivityLogs(
  agency: BrokerAgency,
  collaborations: PartnerAgencyCollaborationLog[],
): BrokerActivityRow[] {
  const rows: BrokerActivityRow[] = [];

  if (agency.kycVerified) {
    rows.push({
      id: `verified-${agency.id}`,
      action: 'Verification Approved',
      user: 'System',
      createdAt: agency.lastCollaborationAt ?? new Date().toISOString(),
    });
  } else if (agency.isBlacklisted) {
    rows.push({
      id: `rejected-${agency.id}`,
      action: 'Verification Rejected',
      user: 'System',
      createdAt: agency.lastCollaborationAt ?? new Date().toISOString(),
    });
  }

  collaborations.forEach((log) => {
    rows.push({
      id: `collab-${log.id}`,
      action: 'Contract Updated',
      user: log.createdBy || 'System',
      createdAt: log.createdAt,
    });
  });

  if (agency.filePath) {
    rows.push({
      id: `doc-${agency.id}`,
      action: 'Document Uploaded',
      user: 'System',
      createdAt: agency.lastCollaborationAt ?? new Date().toISOString(),
    });
  }

  rows.push({
    id: `created-${agency.id}`,
    action: 'Agency Created',
    user: 'System',
    createdAt: agency.lastCollaborationAt ?? new Date().toISOString(),
  });

  return rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function resolveUploadUrl(path?: string): string {
  if (!path?.trim()) return '';
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  if (path.startsWith('/')) return `${window.location.origin}${path}`;
  return `${window.location.origin}/${path}`;
}
