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
  area: 'Makati' | 'BGC' | 'Pasig' | 'Quezon City';
  monthlyRate: number;
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
  idType: string;
  idNumber: string;
  idExpiry: string;
  idImageUrl?: string;
  /** When false, KYC badge shows as pending (defaults true for legacy mock rows). */
  kycVerified?: boolean;
  isBlacklisted: boolean;
  blacklistReason?: string;
}

export interface Contract {
  id: string;
  unitId: string;
  tenantId: string;
  agentId: string;
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

export interface Payment {
  id: string;
  contractId: string;
  unitId: string;
  amount: number;
  dueDate: string;
  paidDate?: string;
  status: PaymentStatus;
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
}

export interface DashboardStats {
  totalProfit: number;
  closedDeals: number;
  vacancyRate: number;
  overdueCount: number;
}
