import { format, isValid, parseISO } from 'date-fns';
import type { Landlord } from '@/types';

export type LandlordFilters = {
  status: 'all' | 'active' | 'inactive' | 'suspended';
};

export const DEFAULT_LANDLORD_FILTERS: LandlordFilters = {
  status: 'all',
};

export type LandlordSummary = {
  totalLandlords: number;
  verifiedLandlords: number;
  pendingKyc: number;
  totalProperties: number;
  totalUnits: number;
};

export function composeLandlordFullName(parts: {
  firstName?: string;
  middleName?: string;
  lastName?: string;
  fullName?: string;
}): string {
  const segments = [parts.firstName, parts.middleName, parts.lastName]
    .map((p) => String(p ?? '').trim())
    .filter(Boolean);
  if (segments.length) return segments.join(' ');
  return String(parts.fullName ?? '').trim();
}

export function formatLandlordDateTime(value?: string): string {
  if (!value?.trim()) return '—';
  const normalized = value.trim().includes('T') ? value.trim() : value.trim().replace(' ', 'T');
  const d = new Date(normalized);
  if (Number.isNaN(d.getTime())) return value;
  return format(d, 'MMM dd, yyyy · h:mm a');
}

export function formatLandlordDate(value?: string): string {
  if (!value?.trim()) return '—';
  const d = parseISO(value.trim().slice(0, 10));
  return isValid(d) ? format(d, 'MMM dd, yyyy') : value;
}

export function formatLandlordPhp(amount: number | undefined): string {
  const n = Number(amount);
  if (!Number.isFinite(n)) return '₱0';
  return `₱${n.toLocaleString('en-PH', { maximumFractionDigits: 0 })}`;
}

export function computeLandlordSummary(landlords: Landlord[]): LandlordSummary {
  return {
    totalLandlords: landlords.length,
    verifiedLandlords: landlords.filter((l) => l.kycStatus === 'verified').length,
    pendingKyc: landlords.filter((l) => (l.kycStatus ?? 'pending') === 'pending').length,
    totalProperties: landlords.reduce((sum, l) => sum + (l.propertyCount ?? 0), 0),
    totalUnits: landlords.reduce((sum, l) => sum + (l.totalUnits ?? 0), 0),
  };
}

export function filterLandlords(
  landlords: Landlord[],
  searchTerm: string,
  filters: LandlordFilters,
): Landlord[] {
  const q = searchTerm.trim().toLowerCase();

  return landlords.filter((l) => {
    if (filters.status !== 'all' && (l.accountStatus ?? 'active') !== filters.status) return false;

    if (!q) return true;
    const haystack = [
      l.fullName,
      l.firstName,
      l.middleName,
      l.lastName,
      l.email,
      l.mobileNo,
      l.companyName,
      l.city,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return haystack.includes(q);
  });
}

/** Valid Philippine government-issued ID types for landlord KYC. */
export const LANDLORD_ID_TYPES = [
  'Passport',
  'National ID (PhilID)',
  'UMID',
  "Driver's License",
  'SSS ID',
  'GSIS ID',
  'PRC ID',
  "Voter's ID",
  'Postal ID',
  'PhilHealth ID',
  'TIN ID',
  'Senior Citizen ID',
  'PWD ID',
  'ACR / I-Card',
  'Barangay ID',
  'Other',
] as const;

export const LANDLORD_DOCUMENT_TYPES = [
  { value: 'government_id', labelKey: 'views.crm.landlords.docTypes.government_id' },
  { value: 'land_title', labelKey: 'views.crm.landlords.docTypes.land_title' },
  { value: 'tax_declaration', labelKey: 'views.crm.landlords.docTypes.tax_declaration' },
  { value: 'lease_authorization', labelKey: 'views.crm.landlords.docTypes.lease_authorization' },
  { value: 'business_permit', labelKey: 'views.crm.landlords.docTypes.business_permit' },
  { value: 'proof_of_address', labelKey: 'views.crm.landlords.docTypes.proof_of_address' },
  { value: 'other', labelKey: 'views.crm.landlords.docTypes.other' },
] as const;

export function emptyLandlordForm() {
  return {
    firstName: '',
    middleName: '',
    lastName: '',
    companyName: '',
    mobileNo: '',
    email: '',
    birthDate: '',
    address: '',
    city: '',
    province: '',
    postalCode: '',
    idType: '',
    idNumber: '',
    tin: '',
    bankName: '',
    accountName: '',
    accountNumber: '',
    gcash: '',
    maya: '',
    internalNotes: '',
    kycStatus: 'pending' as const,
    accountStatus: 'active' as const,
    assignedAgentId: '',
  };
}

export function landlordToForm(landlord: Landlord) {
  return {
    firstName: landlord.firstName ?? '',
    middleName: landlord.middleName ?? '',
    lastName: landlord.lastName ?? '',
    companyName: landlord.companyName ?? '',
    mobileNo: landlord.mobileNo ?? '',
    email: landlord.email ?? '',
    birthDate: landlord.birthDate ?? '',
    address: landlord.address ?? '',
    city: landlord.city ?? '',
    province: landlord.province ?? '',
    postalCode: landlord.postalCode ?? '',
    idType: landlord.idType ?? '',
    idNumber: landlord.idNumber ?? landlord.govIdNo ?? '',
    tin: landlord.tin ?? '',
    bankName: landlord.bankName ?? '',
    accountName: landlord.accountName ?? '',
    accountNumber: landlord.accountNumber ?? '',
    gcash: landlord.gcash ?? '',
    maya: landlord.maya ?? '',
    internalNotes: landlord.internalNotes ?? '',
    kycStatus: (landlord.kycStatus ?? 'pending') as 'pending' | 'verified' | 'rejected',
    accountStatus: (landlord.accountStatus ?? 'active') as 'active' | 'inactive' | 'suspended',
    assignedAgentId: landlord.assignedAgentId ?? '',
  };
}
