/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type UnitStatus = 'Available' | 'Occupied' | 'Maintenance' | 'Reserved';
export type UnitType = 'Studio' | '1BR' | '2BR' | '3BR' | 'Loft' | 'Penthouse';
export type TransactionType = 'Monthly Rental' | 'Sales' | 'Short-term Rental';
export type PaymentStatus = 'Paid' | 'Overdue' | 'Pending';

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
  monthlyRate: number;
  photoDataUrl?: string | null;
  marketValue?: number;
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
}

export interface Landlord {
  id: string;
  fullName: string;
  mobileNo: string;
  email: string;
  govIdNo: string;
  active: boolean;
  createdAt: string;
}

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
  status: 'Active' | 'Expired' | 'Terminated';
  brokerAgencyId?: string;
  remarks?: string;
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
}

export interface DashboardStats {
  totalProfit: number;
  closedDeals: number;
  vacancyRate: number;
  overdueCount: number;
}
