/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type UnitStatus = 'Available' | 'Occupied' | 'Maintenance' | 'Reserved';
export type UnitType =
  | 'House and Lot'
  | 'Condominium'
  | 'Apartment'
  | 'Commercial Building'
  | 'Warehouse'
  | 'Hotel'
  | 'Office Space'
  // Legacy types (kept for existing saved units)
  | 'Studio'
  | '1BR'
  | '2BR'
  | '3BR'
  | 'Loft'
  | 'Penthouse';
export type UnitFurnishing = 'Unfurnished' | 'Semi-furnished' | 'Fully furnished';
export type TransactionType = 'Monthly Rental' | 'Sales' | 'Short-term Rental';
export type PaymentStatus = 'Paid' | 'Overdue' | 'Pending';

export type PaymentMethod = 'cash' | 'bank_transfer' | 'online' | 'check' | 'other';

export const LEDGER_PAYMENT_METHODS: PaymentMethod[] = ['cash', 'bank_transfer', 'online'];

export interface Unit {
  id: string;
  unitNumber: string;
  floor: string;
  tower: string;
  buildingName: string;
  commonAddress: string;
  legalAddress: string;
  type: UnitType;
  status: UnitStatus;
  area: string;
  areaSqm?: number;
  bedrooms?: number;
  bathrooms?: number;
  monthlyRate: number;
  photoDataUrl?: string | null;
  /** Up to 5 unit gallery photos (first is also photoDataUrl / cover). */
  photos?: string[];
  marketValue?: number;
  moreDetails?: string;
  specialRemarks?: string;
  parkingSlot?: string;
  furnishing?: UnitFurnishing;
  inventory: InventoryItem[];
}

export interface InventoryItem {
  id: string;
  name: string;
  condition: 'New' | 'Good' | 'Fair' | 'Poor';
  quantity: number;
}

export interface Tenant {
  id: string;
  name: string;
  email: string;
  phone: string;
  nationality?: string;
  birthDate?: string;
  idType: string;
  idNumber: string;
  idExpiry: string;
  idImageUrl?: string;
  /** When false, KYC badge shows as pending (defaults true for legacy mock rows). */
  kycVerified?: boolean;
  isBlacklisted: boolean;
  blacklistReason?: string;
  createdAt?: string;
}

export type LandlordKycStatus = 'pending' | 'verified' | 'rejected';
export type LandlordAccountStatus = 'active' | 'inactive' | 'suspended';

export interface Landlord {
  id: string;
  fullName: string;
  firstName?: string;
  middleName?: string;
  lastName?: string;
  companyName?: string;
  mobileNo: string;
  email: string;
  birthDate?: string;
  address?: string;
  city?: string;
  province?: string;
  postalCode?: string;
  govIdNo: string;
  idType?: string;
  idNumber?: string;
  idFrontUrl?: string;
  idBackUrl?: string;
  tin?: string;
  proofOfAddressUrl?: string;
  bankName?: string;
  accountName?: string;
  accountNumber?: string;
  gcash?: string;
  maya?: string;
  internalNotes?: string;
  kycStatus?: LandlordKycStatus;
  accountStatus?: LandlordAccountStatus;
  assignedAgentId?: string;
  assignedAgentName?: string;
  propertyCount?: number;
  totalUnits?: number;
  monthlyRentalIncome?: number;
  lastActivity?: string;
  active: boolean;
  createdAt: string;
  updatedAt?: string;
}

export type LandlordPropertyRow = {
  id: string;
  name: string;
  propertyType: string;
  address: string;
  units: number;
  occupied: number;
  vacant: number;
  monthlyIncome: number;
  status: string;
};

export type LandlordContractRow = {
  id: string;
  contractNo: string;
  startDate: string;
  endDate: string;
  monthlyRent: number;
  status: string;
  unitNo: string;
  propertyName: string;
  createdAt: string;
};

export type LandlordDocumentRow = {
  id: string;
  documentType: string;
  title: string;
  filePath: string;
  uploadedByName?: string;
  createdAt: string;
};

export type LandlordTransactionRow = {
  id: string;
  amountPaid: number;
  paymentDate: string;
  paymentMethod: string;
  referenceNo?: string;
  contractNo: string;
  propertyName: string;
  unitNo: string;
  createdAt: string;
};

export type LandlordActivityRow = {
  id: string;
  action: string;
  changeSummary?: string;
  actorUserId?: string;
  createdAt: string;
};

export type LandlordDetailPayload = {
  landlord: Landlord;
  properties: LandlordPropertyRow[];
  contracts: LandlordContractRow[];
  documents: LandlordDocumentRow[];
  transactions: LandlordTransactionRow[];
  activityLogs: LandlordActivityRow[];
};

export interface Contract {
  id: string;
  contractNo?: string;
  unitId: string;
  tenantId: string;
  agentId: string;
  /** Staff name from `user_info` (API); optional for older clients. */
  agentName?: string;
  startDate: string;
  endDate: string;
  monthlyRent: number;
  securityDeposit: number;
  advanceRent: number;
  type: TransactionType;
  status: 'Pending Inspection' | 'Active' | 'Expired' | 'Terminated';
  brokerAgencyId?: string;
  remarks?: string;
  createdAt?: string;
}

export interface ContractTenantRow {
  contractId: string;
  tenantId: string;
  isPrimary: boolean;
  remarks?: string;
  createdAt: string;
  name: string;
  email: string;
  phone: string;
}

export interface ContractCollaborationRow {
  id: string;
  contractId: string;
  partnerAgencyId?: string;
  partnerAgencyName: string;
  email: string;
  commissionTerms: string;
  remarks: string;
  createdBy: string;
  createdAt: string;
}

export interface DocumentTemplateRow {
  id: string;
  templateKey: string;
  title: string;
  filePath: string;
  versionNo: number;
  createdAt: string;
}

export interface RepositoryDocumentRow {
  id: string;
  contractId?: string;
  tenantId?: string;
  docType: string;
  title: string;
  filePath: string;
  portalVisible: boolean;
  createdAt: string;
}

export interface InventorySnapshotRow {
  id: string;
  contractId: string;
  snapshotType: 'move_in' | 'move_out' | 'routine';
  inspectionDate: string;
  inspectedBy?: string;
  remarks: string;
  createdAt: string;
}

export interface InventorySnapshotItemRow {
  id: string;
  snapshotId: string;
  itemName: string;
  category: string;
  quantity: number;
  conditionState: 'excellent' | 'good' | 'fair' | 'damaged' | 'missing';
  notes: string;
}

export interface Payment {
  id: string;
  contractId: string;
  unitId: string;
  amount: number;
  dueDate: string;
  paidDate?: string;
  status: PaymentStatus;
  remarks?: string;
  paymentMethod?: PaymentMethod;
}

export interface InvoiceRow {
  id: string;
  branchId: string;
  invoiceNo: string;
  contractId: string;
  billingPeriodStart: string;
  billingPeriodEnd: string;
  dueDate: string;
  baseAmount: number;
  otherCharges: number;
  discountAmount: number;
  totalAmount: number;
  status: 'draft' | 'issued' | 'partially_paid' | 'paid' | 'overdue' | 'void';
  issuedAt?: string;
  createdBy?: string;
  createdAt: string;
}

export interface Agent {
  id: string;
  name: string;
  email: string;
  avatar?: string;
}

export interface BrokerAgency {
  id: string;
  name: string;
  contactPerson: string;
  phone: string;
  email?: string;
  nationality?: string;
  documentType?: string;
  documentNo?: string;
  expiryDate?: string;
  filePath?: string;
  kycVerified: boolean;
  isBlacklisted: boolean;
  blacklistReason?: string;
  active: boolean;
  /** Count of `contract_collaboration` rows for this agency (from API list). */
  collaborationCount?: number;
  lastCollaborationAt?: string;
}

export interface DashboardStats {
  totalProfit: number;
  closedDeals: number;
  vacancyRate: number;
  overdueCount: number;
}

export type InspectionStatus =
  | 'vacant'
  | 'under_inspection'
  | 'pending_approval'
  | 'ready_for_occupancy'
  | 'move_in_scheduled'
  | 'occupied'
  | 'failed';

export type InspectionWorkflowStep =
  | 'overview'
  | 'checklist'
  | 'inventory'
  | 'photos'
  | 'approval'
  | 'ready'
  | 'logs';

export type InspectionPhotoSection =
  | 'living_room'
  | 'bedroom'
  | 'kitchen'
  | 'bathroom'
  | 'damages'
  | 'meter_reading';

export interface UnitInspection {
  id: string;
  contractId: string;
  unitId: string;
  status: InspectionStatus;
  workflowStep: InspectionWorkflowStep;
  scheduledMoveIn: string;
  inspectorRemarks: string;
  checklistScore: number;
  inventoryCompletion: number;
  photosComplete: boolean;
  startedAt: string;
  approvedAt: string;
  failedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface InspectionChecklistItem {
  id: string;
  itemKey: string;
  itemLabel: string;
  result: 'pending' | 'pass' | 'fail';
  remarks: string;
  photoDataUrl: string;
  sortOrder: number;
}

export interface InspectionInventoryItem {
  id: string;
  itemKey: string;
  itemLabel: string;
  conditionState: 'pending' | 'good' | 'damaged' | 'missing';
  quantity: number;
  remarks: string;
  sortOrder: number;
}

export interface InspectionPhoto {
  id: string;
  section: InspectionPhotoSection;
  photoDataUrl: string;
  caption: string;
  createdAt: string;
}

export interface InspectionLog {
  id: string;
  eventType: string;
  message: string;
  actorUserId?: string;
  createdAt: string;
}

export interface UnitInspectionPayload {
  inspection: UnitInspection;
  checklist: InspectionChecklistItem[];
  inventory: InspectionInventoryItem[];
  photos: InspectionPhoto[];
  logs: InspectionLog[];
}

export type LeaseRenewalWorkflowStep =
  | 'summary'
  | 'balance'
  | 'terms'
  | 'agreement'
  | 'approval'
  | 'activation';

export type LeaseRenewalStatus =
  | 'pending_renewal'
  | 'awaiting_payment'
  | 'pending_signature'
  | 'ready_to_activate'
  | 'active'
  | 'declined';

export interface LeaseRenewalBalanceBreakdown {
  outstandingRent: number;
  utilities: number;
  penalties: number;
  parkingFees: number;
  otherCharges: number;
  /** Future unpaid schedule total (not yet due) — informational, does not block renewal. */
  remainingScheduled?: number;
  overdueMonths?: number;
  remainingMonths?: number;
}

export interface LeaseRenewalTerms {
  startDate: string;
  endDate: string;
  leaseTerm: string;
  monthlyRent: number;
  previousRent: number;
  securityDeposit: number;
  advanceRent: number;
  parkingFee: number;
  associationDues: number;
  renewalFee: number;
  rentIncreasePercentage: number;
}

export interface LeaseRenewal {
  id: string;
  branchId: string;
  oldContractId: string;
  newContractId: string | null;
  tenantId: string;
  unitId: string;
  renewalStatus: LeaseRenewalStatus;
  workflowStep: LeaseRenewalWorkflowStep;
  outstandingBalance: number;
  balanceBreakdown: LeaseRenewalBalanceBreakdown;
  carryOverBalance: boolean;
  carryOverReason: string;
  internalNotes: string;
  terms: LeaseRenewalTerms;
  rentIncreasePercentage: number | null;
  approvalStatus: 'pending' | 'approved' | 'rejected';
  tenantSignatureStatus: 'pending' | 'signed' | 'rejected';
  managerApprovalNotes: string;
  signedAt: string | null;
  activationDate: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string | null;
}

export interface LeaseRenewalSummary {
  contractNumber: string;
  unitNumber: string;
  tenantName: string;
  currentLeaseStart: string | null;
  currentLeaseEnd: string | null;
  tenantSince: string | null;
  previousRenewals: number;
  currentMonthlyRent: number;
}

export interface LeaseRenewalApproval {
  id: string;
  renewalId: string;
  approverRole: string;
  approverUserId: string | null;
  status: 'pending' | 'approved' | 'rejected';
  notes: string;
  decidedAt: string | null;
  createdAt: string;
}

export interface LeaseRenewalLog {
  id: string;
  renewalId: string;
  eventType: string;
  message: string;
  actorUserId: string | null;
  createdAt: string;
}

export interface LeaseRenewalPayload {
  renewal: LeaseRenewal;
  summary: LeaseRenewalSummary;
  newContractPreview: {
    contractNumber: string;
    startDate: string;
    endDate: string;
    monthlyRent: number;
  } | null;
  approvals: LeaseRenewalApproval[];
  logs: LeaseRenewalLog[];
}
