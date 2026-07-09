import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  Users,
  Home,
  Building2,
  Ban,
  Search,
  Plus,
  Mail,
  Phone,
  ShieldCheck,
  History,
  MoreVertical,
  ExternalLink,
  ShieldAlert,
  ShieldQuestion,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Calendar,
  Eye,
  Upload,
  Loader2,
  Copy,
} from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { StatusBadge } from '@/components/status-badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Label } from '@/components/ui/label';
import { DataTable, type ColumnDef } from '@/components/data-table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { SkeletonTable } from '@/components/skeleton';
import { Modal } from '@/components/modal';
import { TenantDetailsModal } from '@/components/tenants/TenantDetailsModal';
import { Select2 } from '@/components/select2';
import {
  createTenant,
  deleteTenant,
  fetchTenants,
  fetchTenantLeaseContract,
  uploadTenantKycDocument,
  uploadTenantLeaseContract,
  updateTenant,
  type TenantWriteBody,
} from '@/lib/tenantsApi';
import {
  createPartnerAgency,
  deletePartnerAgency,
  fetchPartnerAgencies,
  fetchPartnerAgencyCollaborations,
  uploadPartnerAgencyKycDocument,
  updatePartnerAgency,
  type PartnerAgencyCollaborationLog,
} from '@/lib/partnerAgenciesApi';
import {
  createLandlord,
  deleteLandlord,
  fetchLandlords,
  updateLandlord,
  type LandlordWriteBody,
} from '@/lib/landlordsApi';
import {
  createBlacklistRecord,
  fetchBlacklist,
  removeBrokerFromBlacklist,
  removeTenantFromBlacklist,
  type BlacklistRowDto,
} from '@/lib/blacklistApi';
import { fetchContracts } from '@/lib/contractsApi';
import { fetchUnits } from '@/lib/unitsApi';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import { useTranslation } from 'react-i18next';
import type { BrokerAgency, Contract, Landlord, Tenant, Unit } from '@/types';
import {
  differenceInCalendarDays,
  format,
  formatDistanceToNow,
  isValid,
  parseISO,
  startOfDay,
} from 'date-fns';
import { DatePicker as AppDatePicker } from '@/components/DatePicker';

type BlacklistRow = BlacklistRowDto;

const ID_TYPES = ['Passport', 'UMID', "Driver's License", 'Other'] as const;
const GOV_DOC_TYPES = ['Passport', 'National ID', 'Visa', 'Other'] as const;
const NATIONALITIES_ALPHA3 = [
  { code: 'PHL', label: 'Philippines' },
  { code: 'KOR', label: 'Korea' },
  { code: 'JPN', label: 'Japan' },
  { code: 'CHN', label: 'China' },
] as const;

function nationalityLabel(alpha3: string | undefined) {
  const code = String(alpha3 ?? '').trim().toUpperCase();
  if (!code) return '—';
  const hit = NATIONALITIES_ALPHA3.find((x) => x.code === code);
  return hit ? `${hit.label} (${hit.code})` : code;
}

type TenantForm = {
  name: string;
  email: string;
  phone: string;
  nationality: string;
  birthDate: string;
  idType: string;
  idNumber: string;
  idExpiry: string;
  kycVerified: boolean;
  isBlacklisted: boolean;
  blacklistReason: string;
};

function emptyForm(): TenantForm {
  return {
    name: '',
    email: '',
    phone: '',
    nationality: '',
    birthDate: '',
    idType: 'Passport',
    idNumber: '',
    idExpiry: '',
    kycVerified: true,
    isBlacklisted: false,
    blacklistReason: '',
  };
}

function tenantToForm(t: Tenant): TenantForm {
  const nat = String(t.nationality ?? '').trim().toUpperCase();
  const allowedNat = new Set<string>(NATIONALITIES_ALPHA3.map((x) => x.code));
  return {
    name: t.name,
    email: t.email,
    phone: t.phone,
    nationality: allowedNat.has(nat) ? nat : '',
    birthDate: t.birthDate ?? '',
    idType: t.idType,
    idNumber: t.idNumber,
    idExpiry: t.idExpiry || '',
    kycVerified: t.kycVerified !== false,
    isBlacklisted: t.isBlacklisted,
    blacklistReason: t.blacklistReason ?? '',
  };
}

function formToBody(f: TenantForm): TenantWriteBody {
  return {
    name: f.name.trim(),
    email: f.email.trim(),
    phone: f.phone.trim(),
    nationality: f.nationality.trim() || undefined,
    birthDate: f.birthDate.trim() || undefined,
    idType: f.idType,
    idNumber: f.idNumber.trim(),
    idExpiry: f.idExpiry.trim(),
    kycVerified: f.kycVerified,
    isBlacklisted: f.isBlacklisted,
    blacklistReason: f.blacklistReason.trim() || undefined,
  };
}

async function toWebpIfNeeded(file: File): Promise<File> {
  const isImage = file.type.startsWith('image/');
  if (!isImage) throw new Error('Please upload an image file.');
  if (file.type === 'image/webp') return file;

  const MAX_DIM = 1600;
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_DIM / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Failed to process image.');
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();

  const dataUrl = canvas.toDataURL('image/webp', 0.9);
  if (!dataUrl.startsWith('data:image/webp')) {
    throw new Error('Failed to convert image to WEBP.');
  }
  const blob = await (await fetch(dataUrl)).blob();

  const safeBase = (file.name || 'id')
    .replace(/\.[^.]+$/, '')
    .replace(/[^\w.\-]+/g, '_')
    .slice(0, 80);
  return new File([blob], `${safeBase}.webp`, { type: 'image/webp' });
}

function brokerParseExpiry(raw?: string): Date | null {
  if (!raw?.trim()) return null;
  try {
    const d = parseISO(raw);
    return isValid(d) ? d : null;
  } catch {
    return null;
  }
}

type BrokerExpiryInsight =
  | 'none'
  | { status: 'expired'; daysPast: number }
  | { status: 'expiring'; daysLeft: number }
  | { status: 'ok'; daysLeft: number };

function brokerExpiryInsight(expiryDate?: string): BrokerExpiryInsight {
  const d = brokerParseExpiry(expiryDate);
  if (!d) return 'none';
  const today = startOfDay(new Date());
  const end = startOfDay(d);
  const diff = differenceInCalendarDays(end, today);
  if (diff < 0) return { status: 'expired', daysPast: Math.abs(diff) };
  if (diff <= 14) return { status: 'expiring', daysLeft: diff };
  return { status: 'ok', daysLeft: diff };
}

function brokerCollaborationStats(
  agency: BrokerAgency,
  contracts: Contract[],
): { count: number; lastAt: Date | null } {
  if (agency.collaborationCount != null) {
    let lastAt: Date | null = null;
    if (agency.lastCollaborationAt) {
      const d = new Date(agency.lastCollaborationAt);
      if (!Number.isNaN(d.getTime())) lastAt = d;
    }
    return { count: agency.collaborationCount, lastAt };
  }
  const relevant = contracts.filter((c) => c.brokerAgencyId === agency.id);
  let lastAt: Date | null = null;
  for (const c of relevant) {
    try {
      const sd = parseISO(c.startDate);
      if (!isValid(sd)) continue;
      if (!lastAt || sd > lastAt) lastAt = sd;
    } catch {
      /* skip */
    }
  }
  return { count: relevant.length, lastAt };
}

export function CRMView() {
  const { t } = useTranslation();
  const { session } = useAuth();
  const canCreate = session?.crud?.crm?.create ?? false;
  const canUpdate = session?.crud?.crm?.update ?? false;
  const canDelete = session?.crud?.crm?.delete ?? false;

  const [crmLoading, setCrmLoading] = useState(true);
  const [brokersLoading, setBrokersLoading] = useState(true);
  const [blacklistLoading, setBlacklistLoading] = useState(true);
  const [landlordsLoading, setLandlordsLoading] = useState(true);
  const [tenantList, setTenantList] = useState<Tenant[]>([]);
  const [brokerList, setBrokerList] = useState<BrokerAgency[]>([]);
  const [landlordList, setLandlordList] = useState<Landlord[]>([]);
  const [blacklistList, setBlacklistList] = useState<BlacklistRow[]>([]);
  const [blacklistTypeFilter, setBlacklistTypeFilter] = useState<'all' | 'tenant' | 'broker'>('all');
  const [contractList, setContractList] = useState<Contract[]>([]);
  const [unitList, setUnitList] = useState<Unit[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<string | number | null>('tenants');

  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);

  const idUploadRef = useRef<HTMLInputElement | null>(null);
  const [idUploading, setIdUploading] = useState(false);
  const [pendingIdImage, setPendingIdImage] = useState<File | null>(null);
  const [pendingIdImageName, setPendingIdImageName] = useState<string>('');
  const [pendingIdPreviewUrl, setPendingIdPreviewUrl] = useState<string>('');

  const leaseUploadRef = useRef<HTMLInputElement | null>(null);
  const [leaseUploading, setLeaseUploading] = useState(false);
  const [pendingLeaseFile, setPendingLeaseFile] = useState<File | null>(null);
  const [pendingLeaseName, setPendingLeaseName] = useState('');
  const [pendingLeasePreviewUrl, setPendingLeasePreviewUrl] = useState('');
  const [existingLeaseContractUrl, setExistingLeaseContractUrl] = useState('');

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<TenantForm>(emptyForm);

  const [isBrokerFormOpen, setIsBrokerFormOpen] = useState(false);
  const [brokerFormMode, setBrokerFormMode] = useState<'create' | 'edit'>('create');
  const [editingBrokerId, setEditingBrokerId] = useState<string | null>(null);
  const [brokerForm, setBrokerForm] = useState({
    name: '',
    contactPerson: '',
    phone: '',
    email: '',
    nationality: '',
    documentType: '',
    documentNo: '',
    expiryDate: '',
    filePath: '',
  });
  const brokerDocUploadRef = useRef<HTMLInputElement | null>(null);
  const [brokerDocUploading, setBrokerDocUploading] = useState(false);
  const [pendingBrokerDoc, setPendingBrokerDoc] = useState<File | null>(null);
  const [pendingBrokerDocName, setPendingBrokerDocName] = useState('');
  const [pendingBrokerDocPreviewUrl, setPendingBrokerDocPreviewUrl] = useState('');
  const [isBrokerDeleteOpen, setIsBrokerDeleteOpen] = useState(false);
  const [pendingDeleteBroker, setPendingDeleteBroker] = useState<BrokerAgency | null>(null);
  const [isBrokerBlacklistOpen, setIsBrokerBlacklistOpen] = useState(false);
  const [pendingBlacklistBroker, setPendingBlacklistBroker] = useState<BrokerAgency | null>(null);
  const [brokerBlacklistReason, setBrokerBlacklistReason] = useState('');
  const [isBrokerActivateOpen, setIsBrokerActivateOpen] = useState(false);
  const [pendingActivateBroker, setPendingActivateBroker] = useState<BrokerAgency | null>(null);
  const [isBrokerMessageOpen, setIsBrokerMessageOpen] = useState(false);
  const [brokerMessageAgency, setBrokerMessageAgency] = useState<BrokerAgency | null>(null);
  const [isBrokerLogsOpen, setIsBrokerLogsOpen] = useState(false);
  const [brokerLogsAgency, setBrokerLogsAgency] = useState<BrokerAgency | null>(null);
  const [brokerLogs, setBrokerLogs] = useState<PartnerAgencyCollaborationLog[]>([]);
  const [brokerLogsLoading, setBrokerLogsLoading] = useState(false);
  const [isTenantActivateOpen, setIsTenantActivateOpen] = useState(false);
  const [pendingActivateTenant, setPendingActivateTenant] = useState<Tenant | null>(null);

  const [isLandlordFormOpen, setIsLandlordFormOpen] = useState(false);
  const [landlordFormMode, setLandlordFormMode] = useState<'create' | 'edit'>('create');
  const [editingLandlordId, setEditingLandlordId] = useState<string | null>(null);
  const [landlordForm, setLandlordForm] = useState({
    fullName: '',
    mobileNo: '',
    email: '',
    govIdNo: '',
  });

  const [isBlacklistDetailsOpen, setIsBlacklistDetailsOpen] = useState(false);
  const [selectedBlacklist, setSelectedBlacklist] = useState<BlacklistRow | null>(null);

  const reloadTenants = useCallback(async () => {
    try {
      const list = await fetchTenants();
      setTenantList(list);
    } catch {
      setTenantList([]);
      toast.warning(t('views.crm.tenantModal.loadError'));
    } finally {
      setCrmLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void reloadTenants();
  }, [reloadTenants]);

  useEffect(() => {
    if (!pendingIdImage) {
      setPendingIdPreviewUrl('');
      return;
    }
    const url = URL.createObjectURL(pendingIdImage);
    setPendingIdPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [pendingIdImage]);

  useEffect(() => {
    if (!pendingLeaseFile) {
      setPendingLeasePreviewUrl('');
      return;
    }
    if (!pendingLeaseFile.type.startsWith('image/')) {
      setPendingLeasePreviewUrl('');
      return;
    }
    const url = URL.createObjectURL(pendingLeaseFile);
    setPendingLeasePreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [pendingLeaseFile]);

  useEffect(() => {
    if (!isFormOpen || formMode !== 'edit' || !editingId) {
      setExistingLeaseContractUrl('');
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetchTenantLeaseContract(editingId);
        if (!cancelled) setExistingLeaseContractUrl(res.filePath || '');
      } catch {
        if (!cancelled) setExistingLeaseContractUrl('');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [editingId, formMode, isFormOpen]);

  const reloadBrokers = useCallback(async () => {
    try {
      const list = await fetchPartnerAgencies();
      setBrokerList(list);
    } catch {
      setBrokerList([]);
      toast.warning(t('views.crm.brokers.loadError'));
    } finally {
      setBrokersLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void reloadBrokers();
  }, [reloadBrokers]);

  const reloadBlacklist = useCallback(async () => {
    try {
      const list = await fetchBlacklist();
      setBlacklistList(list);
    } catch {
      setBlacklistList([]);
      toast.warning(t('views.crm.blacklist.loadError'));
    } finally {
      setBlacklistLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void reloadBlacklist();
  }, [reloadBlacklist]);

  const reloadLandlords = useCallback(async () => {
    try {
      const list = await fetchLandlords();
      setLandlordList(list);
    } catch {
      setLandlordList([]);
      toast.warning('Failed to load landlords');
    } finally {
      setLandlordsLoading(false);
    }
  }, []);

  useEffect(() => {
    void reloadLandlords();
  }, [reloadLandlords]);

  useEffect(() => {
    void (async () => {
      try {
        const list = await fetchContracts();
        setContractList(list);
      } catch {
        setContractList([]);
      }
    })();
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        const list = await fetchUnits();
        setUnitList(list);
      } catch {
        setUnitList([]);
      }
    })();
  }, []);

  useEffect(() => {
    if (!isBrokerLogsOpen || !brokerLogsAgency) return;
    setBrokerLogsLoading(true);
    let cancelled = false;
    void (async () => {
      try {
        const logs = await fetchPartnerAgencyCollaborations(brokerLogsAgency.id);
        if (!cancelled) setBrokerLogs(logs);
      } catch {
        if (!cancelled) {
          setBrokerLogs([]);
          toast.error(t('views.crm.brokers.logsLoadError'));
        }
      } finally {
        if (!cancelled) setBrokerLogsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isBrokerLogsOpen, brokerLogsAgency?.id, t]);

  const filteredTenants = useMemo(() => {
    const q = searchTerm.toLowerCase().trim();
    if (!q) return tenantList;
    return tenantList.filter(
      (tenant) =>
        tenant.name.toLowerCase().includes(q) ||
        tenant.email.toLowerCase().includes(q) ||
        tenant.phone.includes(q)
    );
  }, [searchTerm, tenantList]);

  const filteredLandlords = useMemo(() => {
    const q = searchTerm.toLowerCase().trim();
    if (!q) return landlordList;
    return landlordList.filter(
      (l) =>
        l.fullName.toLowerCase().includes(q) ||
        (l.email || '').toLowerCase().includes(q) ||
        (l.mobileNo || '').includes(q) ||
        (l.govIdNo || '').includes(q),
    );
  }, [landlordList, searchTerm]);

  const openAddLandlord = () => {
    setLandlordForm({ fullName: '', mobileNo: '', email: '', govIdNo: '' });
    setLandlordFormMode('create');
    setEditingLandlordId(null);
    setIsLandlordFormOpen(true);
  };

  const openEditLandlord = (l: Landlord) => {
    setLandlordForm({
      fullName: l.fullName ?? '',
      mobileNo: l.mobileNo ?? '',
      email: l.email ?? '',
      govIdNo: l.govIdNo ?? '',
    });
    setLandlordFormMode('edit');
    setEditingLandlordId(l.id);
    setIsLandlordFormOpen(true);
  };

  const closeLandlordForm = () => {
    setIsLandlordFormOpen(false);
    setLandlordFormMode('create');
    setEditingLandlordId(null);
    setLandlordForm({ fullName: '', mobileNo: '', email: '', govIdNo: '' });
  };

  const handleSaveLandlord = async () => {
    const payload: LandlordWriteBody = {
      fullName: landlordForm.fullName,
      mobileNo: landlordForm.mobileNo,
      email: landlordForm.email,
      govIdNo: landlordForm.govIdNo,
    };
    try {
      if (landlordFormMode === 'edit' && editingLandlordId) {
        const updated = await updateLandlord(editingLandlordId, payload);
        setLandlordList((prev) => prev.map((x) => (x.id === editingLandlordId ? updated : x)));
        toast.success('Landlord updated.');
      } else {
        const created = await createLandlord(payload);
        setLandlordList((prev) => [created, ...prev]);
        toast.success('Landlord created.');
      }
      closeLandlordForm();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save landlord');
    }
  };

  const handleDeleteLandlord = async (l: Landlord) => {
    if (!window.confirm(`Deactivate landlord ${l.fullName}?`)) return;
    try {
      await deleteLandlord(l.id);
      setLandlordList((prev) => prev.filter((x) => x.id !== l.id));
      toast.success('Landlord deactivated.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to deactivate landlord');
    }
  };

  const filteredBlacklist = useMemo(() => {
    const q = searchTerm.toLowerCase().trim();
    const typeFiltered =
      blacklistTypeFilter === 'all'
        ? blacklistList
        : blacklistList.filter((r) =>
            blacklistTypeFilter === 'tenant' ? r.entityType === 'tenant' : r.entityType === 'broker',
          );

    if (!q) return typeFiltered;
    return typeFiltered.filter(
      (row) =>
        row.name.toLowerCase().includes(q) ||
        row.reason.toLowerCase().includes(q) ||
        row.type.toLowerCase().includes(q),
    );
  }, [searchTerm, blacklistList, blacklistTypeFilter]);

  const filteredBrokers = useMemo(() => {
    const q = searchTerm.toLowerCase().trim();
    if (!q) return brokerList;
    return brokerList.filter((a) => {
      const hay = [a.name, a.contactPerson, a.phone, a.email ?? '']
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [searchTerm, brokerList]);

  const idTypeOptions = useMemo(
    () => ID_TYPES.map((x) => ({ value: x, label: x })),
    [],
  );
  const nationalityOptions = useMemo(
    () => NATIONALITIES_ALPHA3.map((x) => ({ value: x.code, label: `${x.label} (${x.code})` })),
    [],
  );
  const brokerGovDocTypeOptions = useMemo(
    () => GOV_DOC_TYPES.map((x) => ({ value: x, label: x })),
    [],
  );

  const tenantLeaseContext = useMemo(() => {
    if (!selectedTenant) return { contract: null as Contract | null, unit: null as Unit | null };
    const matches = contractList.filter((c) => c.tenantId === selectedTenant.id);
    if (matches.length === 0) return { contract: null, unit: null };
    const active = matches.find((c) => String(c.status).toLowerCase() === 'active');
    const contract = active ?? [...matches].sort((a, b) => b.endDate.localeCompare(a.endDate))[0];
    const unit = unitList.find((u) => u.id === contract.unitId) ?? null;
    return { contract, unit };
  }, [contractList, selectedTenant, unitList]);

  const existingTenantIdImageUrl = useMemo(() => {
    if (!isFormOpen || formMode !== 'edit' || !editingId) return '';
    if (selectedTenant?.id === editingId) return selectedTenant.idImageUrl ?? '';
    return tenantList.find((t) => t.id === editingId)?.idImageUrl ?? '';
  }, [editingId, formMode, isFormOpen, selectedTenant, tenantList]);

  const resolveUploadUrl = (path: string) => {
    if (/^https?:\/\//i.test(path)) return path;
    const base = window.location.origin;
    return path.startsWith('/') ? `${base}${path}` : `${base}/${path}`;
  };

  const openViewDetails = useCallback((tenant: Tenant) => {
    setSelectedTenant(tenant);
    setIsDetailsOpen(true);
  }, []);

  const openRegister = () => {
    setIsDetailsOpen(false);
    setFormMode('create');
    setEditingId(null);
    setForm(emptyForm());
    setIsFormOpen(true);
  };

  const openEdit = useCallback((tenant: Tenant) => {
    setIsDetailsOpen(false);
    setFormMode('edit');
    setEditingId(tenant.id);
    setForm(tenantToForm(tenant));
    setIsFormOpen(true);
  }, []);

  const closeForm = () => {
    setIsFormOpen(false);
    setFormMode('create');
    setEditingId(null);
    setForm(emptyForm());
    setPendingIdImage(null);
    setPendingIdImageName('');
    setPendingIdPreviewUrl('');
    setPendingLeaseFile(null);
    setPendingLeaseName('');
    setPendingLeasePreviewUrl('');
    setExistingLeaseContractUrl('');
  };

  const openAddBroker = () => {
    setBrokerForm({
      name: '',
      contactPerson: '',
      phone: '',
      email: '',
      nationality: '',
      documentType: '',
      documentNo: '',
      expiryDate: '',
      filePath: '',
    });
    setBrokerFormMode('create');
    setEditingBrokerId(null);
    setPendingBrokerDoc(null);
    setPendingBrokerDocName('');
    setPendingBrokerDocPreviewUrl('');
    setIsBrokerFormOpen(true);
  };

  const openEditBroker = (agency: BrokerAgency) => {
    setBrokerForm({
      name: agency.name ?? '',
      contactPerson: agency.contactPerson ?? '',
      phone: agency.phone ?? '',
      email: agency.email ?? '',
      nationality: agency.nationality ?? '',
      documentType: agency.documentType ?? '',
      documentNo: agency.documentNo ?? '',
      expiryDate: agency.expiryDate ?? '',
      filePath: agency.filePath ?? '',
    });
    setBrokerFormMode('edit');
    setEditingBrokerId(agency.id);
    setPendingBrokerDoc(null);
    setPendingBrokerDocName('');
    setPendingBrokerDocPreviewUrl('');
    setIsBrokerFormOpen(true);
  };

  const closeBrokerForm = () => {
    setIsBrokerFormOpen(false);
    setBrokerForm({
      name: '',
      contactPerson: '',
      phone: '',
      email: '',
      nationality: '',
      documentType: '',
      documentNo: '',
      expiryDate: '',
      filePath: '',
    });
    setBrokerFormMode('create');
    setEditingBrokerId(null);
    setPendingBrokerDoc(null);
    setPendingBrokerDocName('');
    setPendingBrokerDocPreviewUrl('');
  };

  useEffect(() => {
    if (!pendingBrokerDoc) {
      setPendingBrokerDocPreviewUrl('');
      return;
    }
    const isImage = pendingBrokerDoc.type.startsWith('image/');
    if (!isImage) {
      setPendingBrokerDocPreviewUrl('');
      return;
    }
    const url = URL.createObjectURL(pendingBrokerDoc);
    setPendingBrokerDocPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [pendingBrokerDoc]);

  const isLikelyImagePath = (p: string) => /\.(webp|png|jpe?g|gif)$/i.test(p.split('?')[0] || '');
  const isLikelyPdfPath = (p: string) => /\.pdf$/i.test(p.split('?')[0] || '');

  const handlePickBrokerDocUpload = () => {
    if (!canUpdate || brokerDocUploading) return;
    brokerDocUploadRef.current?.click();
  };

  const handlePickBrokerDoc: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    const picked = e.target.files?.[0];
    e.target.value = '';
    if (!picked) return;
    setPendingBrokerDoc(picked);
    setPendingBrokerDocName(picked.name);
    toast.success('Document ready to upload.');
  };

  const handleSaveBroker = async () => {
    const name = brokerForm.name.trim();
    if (!name) {
      toast.error(t('views.crm.brokers.validationName'));
      return;
    }
    try {
      setBrokerDocUploading(Boolean(pendingBrokerDoc));
      const payload = {
        name,
        contactPerson: brokerForm.contactPerson.trim(),
        phone: brokerForm.phone.trim(),
        email: brokerForm.email.trim() || undefined,
        nationality: brokerForm.nationality.trim() || undefined,
        documentType: brokerForm.documentType.trim() || undefined,
        documentNo: brokerForm.documentNo.trim() || undefined,
        expiryDate: brokerForm.expiryDate.trim() || undefined,
        filePath: brokerForm.filePath.trim() || undefined,
      };
      if (brokerFormMode === 'edit' && editingBrokerId) {
        let updated = await updatePartnerAgency(editingBrokerId, payload);
        if (pendingBrokerDoc) {
          updated = await uploadPartnerAgencyKycDocument(editingBrokerId, pendingBrokerDoc);
        }
        setBrokerList((prev) => prev.map((x) => (x.id === editingBrokerId ? updated : x)));
        toast.success(t('views.crm.brokers.updated'));
      } else {
        let created = await createPartnerAgency(payload);
        if (pendingBrokerDoc) {
          created = await uploadPartnerAgencyKycDocument(created.id, pendingBrokerDoc);
        }
        setBrokerList((prev) => [created, ...prev]);
        toast.success(t('views.crm.brokers.created'));
      }
      closeBrokerForm();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('views.crm.brokers.saveError'));
    } finally {
      setBrokerDocUploading(false);
    }
  };

  const handleDeleteBroker = async (agency: BrokerAgency) => {
    setPendingDeleteBroker(agency);
    setIsBrokerDeleteOpen(true);
  };

  const closeDeleteBroker = () => {
    setIsBrokerDeleteOpen(false);
    setPendingDeleteBroker(null);
  };

  const confirmDeleteBroker = async () => {
    const agency = pendingDeleteBroker;
    if (!agency) return;
    try {
      await deletePartnerAgency(agency.id);
      setBrokerList((prev) => prev.filter((x) => x.id !== agency.id));
      toast.success(t('views.crm.brokers.deleted'));
      closeDeleteBroker();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('views.crm.brokers.deleteError'));
    }
  };

  const openBrokerMessage = (agency: BrokerAgency) => {
    setBrokerMessageAgency(agency);
    setIsBrokerMessageOpen(true);
  };

  const closeBrokerMessage = () => {
    setIsBrokerMessageOpen(false);
    setBrokerMessageAgency(null);
  };

  const openBrokerLogs = (agency: BrokerAgency) => {
    setBrokerLogsAgency(agency);
    setBrokerLogs([]);
    setIsBrokerLogsOpen(true);
  };

  const closeBrokerLogs = () => {
    setIsBrokerLogsOpen(false);
    setBrokerLogsAgency(null);
    setBrokerLogs([]);
  };

  const openBlacklistBroker = (agency: BrokerAgency) => {
    setPendingBlacklistBroker(agency);
    setBrokerBlacklistReason('');
    setIsBrokerBlacklistOpen(true);
  };

  const closeBlacklistBroker = () => {
    setIsBrokerBlacklistOpen(false);
    setPendingBlacklistBroker(null);
    setBrokerBlacklistReason('');
  };

  const openActivateBroker = (agency: BrokerAgency) => {
    setPendingActivateBroker(agency);
    setIsBrokerActivateOpen(true);
  };

  const closeActivateBroker = () => {
    setIsBrokerActivateOpen(false);
    setPendingActivateBroker(null);
  };

  const openActivateTenant = (tenant: Tenant) => {
    setPendingActivateTenant(tenant);
    setIsTenantActivateOpen(true);
  };

  const closeActivateTenant = () => {
    setIsTenantActivateOpen(false);
    setPendingActivateTenant(null);
  };

  const confirmActivateTenant = async () => {
    const tenant = pendingActivateTenant;
    if (!tenant) return;
    if (tenant.kycVerified === false) {
      toast.error(t('views.crm.table.tenantActivationRequiresVerified'));
      return;
    }
    try {
      await removeTenantFromBlacklist(tenant.id);
      await reloadBlacklist();
      await reloadTenants();
      setSelectedTenant((prev) =>
        prev && prev.id === tenant.id ? { ...prev, isBlacklisted: false, blacklistReason: undefined } : prev,
      );
      toast.success(t('views.crm.table.tenantActivated'));
      closeActivateTenant();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('views.crm.table.activateTenantError'));
    }
  };

  const confirmActivateBroker = async () => {
    const agency = pendingActivateBroker;
    if (!agency) return;
    if (!agency.kycVerified) {
      toast.error(t('views.crm.brokers.activationRequiresVerified'));
      return;
    }
    try {
      await removeBrokerFromBlacklist(agency.id);
      await reloadBlacklist();
      await reloadBrokers();
      toast.success(t('views.crm.brokers.activated'));
      closeActivateBroker();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('views.crm.brokers.activateError'));
    }
  };

  const confirmBlacklistBroker = async () => {
    const agency = pendingBlacklistBroker;
    if (!agency) return;
    const reason = brokerBlacklistReason.trim();
    if (!reason) {
      toast.error(t('views.crm.blacklist.reason'));
      return;
    }
    try {
      const record = await createBlacklistRecord({
        entityType: 'broker',
        partnerAgencyId: agency.id,
        reason,
      });
      setBlacklistList((prev) => [record, ...prev]);
      await reloadBrokers();
      toast.success(t('views.crm.table.blacklisted'));
      closeBlacklistBroker();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('views.crm.blacklist.loadError'));
    }
  };

  const openBlacklistDetails = (row: BlacklistRow) => {
    setSelectedBlacklist(row);
    setIsBlacklistDetailsOpen(true);
  };

  const closeBlacklistDetails = () => {
    setIsBlacklistDetailsOpen(false);
    setSelectedBlacklist(null);
  };

  const toggleBrokerActive = async (agency: BrokerAgency) => {
    try {
      const nextActive = agency.active === false ? true : false;
      const updated = await updatePartnerAgency(agency.id, { active: nextActive });
      setBrokerList((prev) => prev.map((x) => (x.id === agency.id ? updated : x)));
      toast.success(nextActive ? t('views.crm.brokers.markedActive') : t('views.crm.brokers.markedInactive'));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('views.crm.brokers.statusUpdateError'));
    }
  };

  const toggleBrokerVerified = async (agency: BrokerAgency) => {
    try {
      const nextVerified = agency.kycVerified ? false : true;
      const updated = await updatePartnerAgency(agency.id, { kycVerified: nextVerified });
      setBrokerList((prev) => prev.map((x) => (x.id === agency.id ? updated : x)));
      toast.success(
        nextVerified ? t('views.crm.brokers.markedVerified') : t('views.crm.brokers.markedUnverified'),
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('views.crm.brokers.statusUpdateError'));
    }
  };

  const openTenantFromBlacklist = () => {
    if (!selectedBlacklist?.tenantId) return;
    const tenant = tenantList.find((x) => x.id === selectedBlacklist.tenantId);
    if (!tenant) {
      toast.error(t('views.crm.blacklist.tenantNotFound'));
      return;
    }
    closeBlacklistDetails();
    openViewDetails(tenant);
  };

  const handleSaveTenant = async () => {
    const body = formToBody(form);
    if (!body.name || !body.email || !body.phone || !body.idType || !body.idNumber) {
      toast.error(t('views.crm.tenantModal.validationRequired'));
      return;
    }
    try {
      setIdUploading(Boolean(pendingIdImage));
      if (formMode === 'edit' && editingId) {
        let updated = await updateTenant(editingId, body);
        if (pendingIdImage) {
          const webp = await toWebpIfNeeded(pendingIdImage);
          updated = await uploadTenantKycDocument(editingId, webp);
        }
        if (pendingLeaseFile) {
          setLeaseUploading(true);
          await uploadTenantLeaseContract(editingId, pendingLeaseFile, {
            title: `Lease contract - ${updated.name}`,
            portalVisible: true,
          });
        }
        setTenantList((prev) => prev.map((x) => (x.id === editingId ? updated : x)));
        setSelectedTenant((s) => (s?.id === editingId ? updated : s));
        toast.success(t('views.crm.tenantModal.updated'));
      } else {
        let created = await createTenant(body);
        if (pendingIdImage) {
          const webp = await toWebpIfNeeded(pendingIdImage);
          created = await uploadTenantKycDocument(created.id, webp);
        }
        if (pendingLeaseFile) {
          setLeaseUploading(true);
          await uploadTenantLeaseContract(created.id, pendingLeaseFile, {
            title: `Lease contract - ${created.name}`,
            portalVisible: true,
          });
        }
        setTenantList((prev) => [created, ...prev]);
        toast.success(t('views.crm.tenantModal.created'));
      }
      void reloadBlacklist();
      closeForm();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error');
    } finally {
      setIdUploading(false);
      setLeaseUploading(false);
    }
  };

  const handlePickLeaseUpload = () => {
    if (!canUpdate || leaseUploading) return;
    leaseUploadRef.current?.click();
  };

  const handlePickLeaseFile: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    const picked = e.target.files?.[0];
    e.target.value = '';
    if (!picked) return;
    setPendingLeaseFile(picked);
    setPendingLeaseName(picked.name);
    toast.success('Lease contract ready to upload.');
  };

  const handlePickIdUpload = () => {
    if (!canUpdate || idUploading) return;
    idUploadRef.current?.click();
  };

  const handlePickIdImage: React.ChangeEventHandler<HTMLInputElement> = async (e) => {
    const picked = e.target.files?.[0];
    e.target.value = '';
    if (!picked) return;
    try {
      const webp = await toWebpIfNeeded(picked);
      setPendingIdImage(webp);
      setPendingIdImageName(webp.name);
      toast.success('ID image ready (WEBP).');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Invalid image');
      setPendingIdImage(null);
      setPendingIdImageName('');
    }
  };

  const handleDeleteTenant = useCallback(
    async (tenant: Tenant) => {
      if (!window.confirm(t('views.crm.tenantModal.deleteConfirm', { name: tenant.name }))) return;
      try {
        await deleteTenant(tenant.id);
        setTenantList((prev) => prev.filter((x) => x.id !== tenant.id));
        setSelectedTenant((s) => {
          if (s?.id === tenant.id) {
            setIsDetailsOpen(false);
            return null;
          }
          return s;
        });
        toast.success(t('views.crm.tenantModal.deleted'));
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Error');
      }
    },
    [t],
  );

  const tenantColumns: ColumnDef<Tenant>[] = useMemo(
    () => [
      {
        header: t('views.crm.table.tenant'),
        render: (tenant) => (
          <div className="flex items-center gap-3">
            <Avatar>
              <AvatarFallback>{tenant.name.split(' ').map((n) => n[0]).join('')}</AvatarFallback>
            </Avatar>
            <div className="flex flex-col">
              <span className="font-bold text-slate-900">{tenant.name}</span>
              <span className="text-xs text-slate-500">{t('views.crm.table.idLabel', { id: tenant.idNumber })}</span>
            </div>
          </div>
        ),
      },
      {
        header: t('views.crm.table.contactInfo'),
        render: (tenant) => (
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2 text-xs text-slate-600">
              <Mail className="w-3 h-3" />
              {tenant.email}
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-600">
              <Phone className="w-3 h-3" />
              {tenant.phone}
            </div>
          </div>
        ),
      },
      {
        header: t('views.crm.table.kycStatus'),
        render: (tenant) =>
          tenant.kycVerified !== false ? (
            <StatusBadge tone="success">
              <ShieldCheck className="w-3.5 h-3.5 mr-1" />
              {t('views.crm.table.verified')}
            </StatusBadge>
          ) : (
            <StatusBadge tone="warning">
              <ShieldQuestion className="w-3.5 h-3.5 mr-1" />
              {t('views.crm.table.kycPending')}
            </StatusBadge>
          ),
      },
      {
        header: t('views.crm.table.currentUnit'),
        render: (tenant) => {
          const activeContract = contractList.find(
            (c) => c.tenantId === tenant.id && String(c.status).toLowerCase() === 'active',
          );
          const unit = activeContract ? unitList.find((u) => u.id === activeContract.unitId) : null;
          return unit ? (
            <div className="flex flex-col">
              <span className="text-sm font-medium text-slate-700">{t('views.crm.table.unitLabel', { unitNumber: unit.unitNumber })}</span>
              <span className="text-xs text-slate-500">{unit.buildingName}</span>
            </div>
          ) : (
            <span className="text-xs text-slate-400 italic">{t('views.crm.table.noActiveLease')}</span>
          );
        },
      },
      {
        header: t('views.crm.table.status'),
        render: (tenant) =>
          tenant.isBlacklisted ? (
            <StatusBadge tone="danger">{t('views.crm.table.blacklisted')}</StatusBadge>
          ) : (
            <StatusBadge tone="info">{t('views.crm.table.active')}</StatusBadge>
          ),
      },
      {
        header: t('views.crm.table.actions'),
        className: 'text-right',
        headerClassName: 'text-right',
        cellClassName: 'text-right',
        render: (tenant) => (
          <div
            className="inline-flex items-center justify-end gap-0.5"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
            role="presentation"
          >
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-slate-600 hover:bg-slate-100 hover:text-indigo-600"
              title={t('views.crm.table.viewDetails')}
              aria-label={t('views.crm.table.viewDetails')}
              onClick={(e) => {
                e.stopPropagation();
                openViewDetails(tenant);
              }}
            >
              <Eye className="h-4 w-4" strokeWidth={1.75} />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => e.stopPropagation()} />
                }
              >
                <MoreVertical className="w-4 h-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {canUpdate && (
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      openEdit(tenant);
                    }}
                  >
                    {t('views.crm.table.editTenant')}
                  </DropdownMenuItem>
                )}
                {canUpdate && tenant.isBlacklisted ? (
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      openActivateTenant(tenant);
                    }}
                  >
                    {t('views.crm.table.activateTenant')}
                  </DropdownMenuItem>
                ) : null}
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    try {
                      localStorage.setItem('realstate_portal_tenant_id', String(tenant.id));
                    } catch {
                      // ignore storage failures (private mode, etc.)
                    }
                    const url = `${window.location.origin}/portal?tenantId=${encodeURIComponent(tenant.id)}`;
                    window.open(url, '_blank');
                  }}
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  {t('views.crm.table.viewPortal')}
                </DropdownMenuItem>
                <DropdownMenuItem disabled>
                  <History className="w-4 h-4 mr-2" />
                  {t('views.crm.table.history')}
                </DropdownMenuItem>
                {canDelete && (
                  <DropdownMenuItem
                    className="text-rose-600"
                    onClick={(e) => {
                      e.stopPropagation();
                      void handleDeleteTenant(tenant);
                    }}
                  >
                    {t('views.crm.table.deleteTenant')}
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ),
      },
    ],
    [t, canUpdate, canDelete, openViewDetails, openEdit, openActivateTenant, handleDeleteTenant, contractList, unitList],
  );

  const landlordColumns: ColumnDef<Landlord>[] = useMemo(
    () => [
      {
        header: 'Landlord',
        render: (l) => (
          <div className="flex flex-col">
            <span className="font-bold text-slate-900">{l.fullName}</span>
            <span className="text-xs text-slate-500">{l.govIdNo || '—'}</span>
          </div>
        ),
      },
      {
        header: 'Contact',
        render: (l) => (
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2 text-xs text-slate-600">
              <Phone className="w-3 h-3" />
              {l.mobileNo || '—'}
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-600">
              <Mail className="w-3 h-3" />
              <span className="break-all">{l.email || '—'}</span>
            </div>
          </div>
        ),
      },
      {
        header: 'Created',
        render: (l) => <span className="text-xs text-slate-500">{l.createdAt || '—'}</span>,
      },
      {
        header: 'Actions',
        className: 'text-right',
        headerClassName: 'text-right',
        cellClassName: 'text-right',
        render: (l) => (
          <div
            className="inline-flex items-center justify-end"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
            role="presentation"
          >
            <DropdownMenu>
              <DropdownMenuTrigger
                render={<Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => e.stopPropagation()} />}
              >
                <MoreVertical className="w-4 h-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {canUpdate ? (
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      openEditLandlord(l);
                    }}
                  >
                    Edit
                  </DropdownMenuItem>
                ) : null}
                {canDelete ? (
                  <DropdownMenuItem
                    className="text-rose-600"
                    onClick={(e) => {
                      e.stopPropagation();
                      void handleDeleteLandlord(l);
                    }}
                  >
                    Deactivate
                  </DropdownMenuItem>
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ),
      },
    ],
    [canDelete, canUpdate],
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-50">{t('views.crm.title')}</h1>
          <p className="mt-1 text-slate-500 dark:text-slate-400">{t('views.crm.subtitle')}</p>
        </div>
        {canCreate && activeTab === 'tenants' && (
          <Button className="bg-indigo-600 text-white hover:bg-indigo-700" onClick={openRegister}>
            <Plus className="w-4 h-4 mr-2" />
            {t('views.crm.registerTenant')}
          </Button>
        )}
        {canCreate && activeTab === 'brokers' && (
          <Button className="bg-indigo-600 text-white hover:bg-indigo-700" onClick={openAddBroker}>
            <Plus className="w-4 h-4 mr-2" />
            {t('views.crm.brokers.addAgency')}
          </Button>
        )}
        {canCreate && activeTab === 'landlords' && (
          <Button className="bg-indigo-600 text-white hover:bg-indigo-700" onClick={openAddLandlord}>
            <Plus className="w-4 h-4 mr-2" />
            Add Landlord
          </Button>
        )}
      </div>

      <TenantDetailsModal
        isOpen={isDetailsOpen && !isFormOpen}
        onClose={() => setIsDetailsOpen(false)}
        tenant={
          selectedTenant
            ? {
                name: selectedTenant.name,
                email: selectedTenant.email,
                phone: selectedTenant.phone,
                nationality: nationalityLabel(selectedTenant.nationality),
                verified: selectedTenant.kycVerified !== false,
                active: !selectedTenant.isBlacklisted,
                idType: selectedTenant.idType,
                idNumber: selectedTenant.idNumber,
                idExpiry: selectedTenant.idExpiry || undefined,
              }
            : null
        }
        lease={
          tenantLeaseContext.contract && tenantLeaseContext.unit
            ? {
                unitLabel: `${tenantLeaseContext.unit.unitNumber} - ${tenantLeaseContext.unit.buildingName}`,
                leaseStart: tenantLeaseContext.contract.startDate,
                leaseEnd: tenantLeaseContext.contract.endDate,
                monthlyRent: Number(tenantLeaseContext.contract.monthlyRent),
                statusLabel: String(tenantLeaseContext.contract.status || ''),
              }
            : undefined
        }
        documents={[
          {
            id: 'lease-pdf',
            name: t('views.crm.details.documentLeasePdf'),
            fileType: 'PDF',
            sizeLabel: '—',
            kind: 'pdf',
            onPreview: tenantLeaseContext.contract
              ? () => {
                  const url = `${window.location.origin}/preview?type=contract&id=${tenantLeaseContext.contract.id}`;
                  window.open(url, '_blank', 'noopener,noreferrer');
                }
              : undefined,
            onDownload: tenantLeaseContext.contract
              ? () => {
                  const url = `${window.location.origin}/preview?type=contract&id=${tenantLeaseContext.contract.id}`;
                  window.open(url, '_blank', 'noopener,noreferrer');
                }
              : undefined,
          },
          {
            id: 'tenant-id',
            name: t('views.crm.details.documentTenantIdJpg'),
            fileType: 'WEBP',
            sizeLabel: '—',
            kind: 'image',
            onPreview: selectedTenant?.idImageUrl
              ? () => window.open(resolveUploadUrl(selectedTenant.idImageUrl), '_blank', 'noopener,noreferrer')
              : undefined,
            onDownload: selectedTenant?.idImageUrl
              ? () => window.open(resolveUploadUrl(selectedTenant.idImageUrl), '_blank', 'noopener,noreferrer')
              : undefined,
          },
        ]}
        closeLabel={t('views.crm.details.close')}
        editLabel={t('views.crm.details.editTenant')}
        onEditTenant={
          canUpdate && selectedTenant
            ? () => {
                openEdit(selectedTenant);
              }
            : undefined
        }
      />

      <Modal
        isOpen={isBrokerDeleteOpen}
        onClose={closeDeleteBroker}
        title={t('views.crm.brokers.delete')}
        maxWidth="lg"
        variant="default"
        footer={
          <div className="flex justify-end gap-3 w-full">
            <Button type="button" variant="outline" className="h-11 min-w-[120px] rounded-xl" onClick={closeDeleteBroker}>
              {t('views.crm.brokers.cancel')}
            </Button>
            <Button
              type="button"
              className="h-11 min-w-[120px] rounded-xl bg-rose-600 hover:bg-rose-700"
              onClick={() => void confirmDeleteBroker()}
            >
              {t('views.crm.brokers.delete')}
            </Button>
          </div>
        }
      >
        <p className="text-sm text-slate-600">
          {pendingDeleteBroker
            ? t('views.crm.brokers.deleteConfirm', { name: pendingDeleteBroker.name })
            : ''}
        </p>
      </Modal>

      <Modal
        isOpen={isBrokerMessageOpen}
        onClose={closeBrokerMessage}
        title={
          brokerMessageAgency
            ? t('views.crm.brokers.messageModalTitle', { name: brokerMessageAgency.name })
            : t('views.crm.brokers.messageButton')
        }
        maxWidth="md"
        footer={
          <div className="flex justify-end w-full">
            <Button type="button" variant="outline" onClick={closeBrokerMessage}>
              {t('views.crm.brokers.cancel')}
            </Button>
          </div>
        }
      >
        {brokerMessageAgency ? (
          (() => {
            const email = brokerMessageAgency.email?.trim();
            const phone = brokerMessageAgency.phone?.trim();
            const telDigits = phone ? phone.replace(/\D/g, '') : '';
            const telHref = phone ? (telDigits ? `tel:${telDigits}` : `tel:${phone}`) : '';
            if (!email && !phone) {
              return <p className="text-sm text-slate-600">{t('views.crm.brokers.noContactForMessage')}</p>;
            }
            const copyText = async (label: string, value: string) => {
              try {
                await navigator.clipboard.writeText(value);
                toast.success(t('views.crm.brokers.copied', { label }));
              } catch {
                toast.error(t('views.crm.brokers.copyFailed'));
              }
            };
            const gmailComposeUrl = email
              ? `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(email)}`
              : '';
            return (
              <div className="space-y-4">
                {email ? (
                  <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
                    <div className="text-xs font-bold uppercase tracking-wide text-slate-400">
                      {t('views.crm.brokers.emailShort')}
                    </div>
                    <p className="mt-1 break-all text-sm font-semibold text-slate-900 dark:text-slate-100">{email}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        className="rounded-lg bg-red-600 text-white hover:bg-red-700"
                        onClick={() => {
                          window.open(gmailComposeUrl, '_blank', 'noopener,noreferrer');
                        }}
                      >
                        <ExternalLink className="mr-1.5 h-4 w-4 shrink-0" aria-hidden />
                        {t('views.crm.brokers.openInGmail')}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        className="rounded-lg bg-blue-600 text-white hover:bg-blue-700"
                        onClick={() => {
                          window.location.href = `mailto:${email}`;
                        }}
                      >
                        <Mail className="mr-1.5 h-4 w-4 shrink-0" aria-hidden />
                        {t('views.crm.brokers.openEmailApp')}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="rounded-lg"
                        onClick={() => void copyText(t('views.crm.brokers.emailShort'), email)}
                      >
                        <Copy className="mr-1.5 h-4 w-4 shrink-0" aria-hidden />
                        {t('views.crm.brokers.copyEmail')}
                      </Button>
                    </div>
                  </div>
                ) : null}
                {phone ? (
                  <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
                    <div className="text-xs font-bold uppercase tracking-wide text-slate-400">
                      {t('views.crm.brokers.phone')}
                    </div>
                    <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">{phone}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <a
                        href={telHref}
                        className={cn(
                          buttonVariants({ variant: 'secondary', size: 'sm' }),
                          'rounded-lg no-underline',
                        )}
                      >
                        {t('views.crm.brokers.callPhone')}
                      </a>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="rounded-lg"
                        onClick={() => void copyText(t('views.crm.brokers.phone'), phone)}
                      >
                        <Copy className="mr-1.5 h-4 w-4 shrink-0" aria-hidden />
                        {t('views.crm.brokers.copyPhone')}
                      </Button>
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })()
        ) : null}
      </Modal>

      <Modal
        isOpen={isBrokerLogsOpen}
        onClose={closeBrokerLogs}
        title={
          brokerLogsAgency
            ? t('views.crm.brokers.logsModalTitle', { name: brokerLogsAgency.name })
            : t('views.crm.brokers.viewLogs')
        }
        maxWidth="3xl"
        footer={
          <div className="flex justify-end w-full">
            <Button type="button" variant="outline" onClick={closeBrokerLogs}>
              {t('views.crm.blacklist.close')}
            </Button>
          </div>
        }
      >
        {brokerLogsLoading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-9 w-9 animate-spin text-indigo-600" aria-hidden />
          </div>
        ) : brokerLogs.length === 0 ? (
          <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">
            {t('views.crm.brokers.logsEmpty')}
          </p>
        ) : (
          <div className="max-h-[min(60vh,28rem)] space-y-3 overflow-y-auto pr-1">
            {brokerLogs.map((log) => (
              <div
                key={log.id}
                className="rounded-xl border border-slate-200 bg-slate-50/50 p-3 text-sm dark:border-slate-700 dark:bg-slate-900/40"
              >
                <div className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-200/80 pb-2 dark:border-slate-700">
                  <div className="min-w-0 font-semibold text-slate-900 dark:text-slate-100">
                    {log.contractNo || `#${log.contractId}`}
                    {log.unitNumber || log.buildingName ? (
                      <span className="mt-0.5 block text-xs font-normal text-slate-500 dark:text-slate-400">
                        {[log.unitNumber, log.buildingName].filter(Boolean).join(' · ')}
                      </span>
                    ) : null}
                  </div>
                  <Badge variant="outline" className="shrink-0 border-slate-200 text-xs dark:border-slate-600">
                    {log.contractStatus}
                  </Badge>
                </div>
                <div className="mt-2 grid gap-1.5 text-xs text-slate-600 dark:text-slate-400">
                  <div>
                    <span className="font-semibold text-slate-500 dark:text-slate-500">
                      {t('views.crm.brokers.logsPeriod')}:{' '}
                    </span>
                    {log.contractStart && log.contractEnd ? `${log.contractStart} → ${log.contractEnd}` : '—'}
                  </div>
                  {log.commissionTerms ? (
                    <div>
                      <span className="font-semibold text-slate-500 dark:text-slate-500">
                        {t('views.crm.brokers.logsCommission')}:{' '}
                      </span>
                      {log.commissionTerms}
                    </div>
                  ) : null}
                  {log.remarks ? (
                    <div>
                      <span className="font-semibold text-slate-500 dark:text-slate-500">
                        {t('views.crm.brokers.logsRemarks')}:{' '}
                      </span>
                      <span className="whitespace-pre-wrap">{log.remarks}</span>
                    </div>
                  ) : null}
                  <div className="text-[11px] text-slate-500 dark:text-slate-500">
                    {t('views.crm.brokers.logsLoggedAt')}: {log.createdAt || '—'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Modal>

      <Modal
        isOpen={isBrokerBlacklistOpen}
        onClose={closeBlacklistBroker}
        title={t('views.crm.table.blacklisted')}
        maxWidth="lg"
        variant="default"
        footer={
          <div className="flex justify-end gap-3 w-full">
            <Button type="button" variant="outline" className="h-11 min-w-[120px] rounded-xl" onClick={closeBlacklistBroker}>
              {t('views.crm.brokers.cancel')}
            </Button>
            <Button
              type="button"
              className="h-11 min-w-[120px] rounded-xl bg-rose-600 hover:bg-rose-700"
              onClick={() => void confirmBlacklistBroker()}
            >
              {t('views.crm.table.blacklisted')}
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-slate-600">{pendingBlacklistBroker ? pendingBlacklistBroker.name : ''}</p>
          <div className="space-y-2">
            <Label htmlFor="crm-broker-blacklist-reason">{t('views.crm.blacklist.reason')}</Label>
            <Input
              id="crm-broker-blacklist-reason"
              value={brokerBlacklistReason}
              onChange={(e) => setBrokerBlacklistReason(e.target.value)}
              className="rounded-xl border-slate-200"
              placeholder={t('views.crm.blacklist.reason')}
            />
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={isBrokerActivateOpen}
        onClose={closeActivateBroker}
        title={t('views.crm.brokers.activateTitle')}
        maxWidth="lg"
        variant="default"
        footer={
          <div className="flex justify-end gap-3 w-full">
            <Button type="button" variant="outline" className="h-11 min-w-[120px] rounded-xl" onClick={closeActivateBroker}>
              {t('views.crm.brokers.cancel')}
            </Button>
            <Button
              type="button"
              className="h-11 min-w-[120px] rounded-xl bg-emerald-600 hover:bg-emerald-700"
              onClick={() => void confirmActivateBroker()}
            >
              {t('views.crm.brokers.activate')}
            </Button>
          </div>
        }
      >
        <div className="space-y-2">
          <p className="text-sm text-slate-600">{pendingActivateBroker ? pendingActivateBroker.name : ''}</p>
          <p className="text-sm text-slate-600">{t('views.crm.brokers.activateDescription')}</p>
          {pendingActivateBroker && !pendingActivateBroker.kycVerified ? (
            <p className="text-sm text-rose-700">{t('views.crm.brokers.activationRequiresVerified')}</p>
          ) : null}
        </div>
      </Modal>

      <Modal
        isOpen={isTenantActivateOpen}
        onClose={closeActivateTenant}
        title={t('views.crm.table.activateTenantTitle')}
        maxWidth="lg"
        variant="default"
        footer={
          <div className="flex justify-end gap-3 w-full">
            <Button type="button" variant="outline" className="h-11 min-w-[120px] rounded-xl" onClick={closeActivateTenant}>
              {t('views.crm.brokers.cancel')}
            </Button>
            <Button
              type="button"
              className="h-11 min-w-[120px] rounded-xl bg-emerald-600 hover:bg-emerald-700"
              onClick={() => void confirmActivateTenant()}
            >
              {t('views.crm.table.activateTenant')}
            </Button>
          </div>
        }
      >
        <div className="space-y-2">
          <p className="text-sm text-slate-600">{pendingActivateTenant ? pendingActivateTenant.name : ''}</p>
          <p className="text-sm text-slate-600">{t('views.crm.table.activateTenantDescription')}</p>
          {pendingActivateTenant && pendingActivateTenant.kycVerified === false ? (
            <p className="text-sm text-rose-700">{t('views.crm.table.tenantActivationRequiresVerified')}</p>
          ) : null}
        </div>
      </Modal>

      <Modal
        isOpen={isFormOpen}
        onClose={closeForm}
        title={formMode === 'edit' ? t('views.crm.tenantModal.editTitle') : t('views.crm.tenantModal.createTitle')}
        maxWidth="2xl"
        variant="default"
        footer={
          <div className="flex justify-end gap-3 w-full">
            <Button type="button" variant="outline" className="h-11 min-w-[120px] rounded-xl" onClick={closeForm}>
              {t('views.crm.tenantModal.cancel')}
            </Button>
            <Button type="button" className="h-11 min-w-[120px] rounded-xl bg-indigo-600 text-white hover:bg-indigo-700" onClick={() => void handleSaveTenant()}>
              {t('views.crm.tenantModal.save')}
            </Button>
          </div>
        }
      >
        <p className="text-sm text-slate-500 mb-6">{t('views.crm.tenantModal.description')}</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="crm-name">{t('views.crm.tenantModal.name')}</Label>
            <Input
              id="crm-name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="rounded-xl border-slate-200"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="crm-email">{t('views.crm.tenantModal.email')}</Label>
            <Input
              id="crm-email"
              type="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              className="rounded-xl border-slate-200"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="crm-phone">{t('views.crm.tenantModal.phone')}</Label>
            <Input
              id="crm-phone"
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              className="rounded-xl border-slate-200"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="crm-nationality">{t('views.crm.tenantModal.nationality')}</Label>
            <Select2
              options={nationalityOptions}
              value={form.nationality}
              onChange={(v) => setForm((f) => ({ ...f, nationality: (v ?? '') as string }))}
              placeholder="Select nationality"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="crm-birth-date">{t('views.crm.tenantModal.birthDate')}</Label>
            <AppDatePicker
              mode="single"
              placeholder="MM/DD/YYYY"
              fullWidth
              value={form.birthDate ? parseISO(form.birthDate) : null}
              onChange={(picked) =>
                setForm((f) => ({
                  ...f,
                  birthDate: picked instanceof Date ? format(picked, 'yyyy-MM-dd') : '',
                }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label>{t('views.crm.tenantModal.idType')}</Label>
            <Select2
              options={idTypeOptions}
              value={form.idType}
              onChange={(v) => setForm((f) => ({ ...f, idType: (v ?? 'Passport') as string }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="crm-id-number">{t('views.crm.tenantModal.idNumber')}</Label>
            <Input
              id="crm-id-number"
              value={form.idNumber}
              onChange={(e) => setForm((f) => ({ ...f, idNumber: e.target.value }))}
              className="rounded-xl border-slate-200"
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="crm-id-expiry">{t('views.crm.tenantModal.idExpiry')}</Label>
            <AppDatePicker
              mode="single"
              placeholder="MM/DD/YYYY"
              fullWidth
              value={form.idExpiry ? parseISO(form.idExpiry) : null}
              onChange={(picked) =>
                setForm((f) => ({
                  ...f,
                  idExpiry: picked instanceof Date ? format(picked, 'yyyy-MM-dd') : '',
                }))
              }
            />
          </div>
          <div className="flex items-center gap-3 sm:col-span-2">
            <input
              id="crm-kyc"
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300"
              checked={form.kycVerified}
              onChange={(e) => setForm((f) => ({ ...f, kycVerified: e.target.checked }))}
            />
            <Label htmlFor="crm-kyc" className="font-normal cursor-pointer">
              {t('views.crm.tenantModal.kycVerified')}
            </Label>
          </div>
          <div className="flex items-center gap-3 sm:col-span-2">
            <input
              id="crm-bl"
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300"
              checked={form.isBlacklisted}
              onChange={(e) => setForm((f) => ({ ...f, isBlacklisted: e.target.checked }))}
            />
            <Label htmlFor="crm-bl" className="font-normal cursor-pointer">
              {t('views.crm.tenantModal.blacklisted')}
            </Label>
          </div>
          {form.isBlacklisted ? (
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="crm-bl-reason">{t('views.crm.tenantModal.blacklistReason')}</Label>
              <Input
                id="crm-bl-reason"
                value={form.blacklistReason}
                onChange={(e) => setForm((f) => ({ ...f, blacklistReason: e.target.value }))}
                className="rounded-xl border-slate-200"
              />
            </div>
          ) : null}

          {canUpdate ? (
            <div className="space-y-2 sm:col-span-2">
              <Label>Tenant ID photo (WEBP)</Label>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between rounded-xl border border-slate-200 bg-white p-3">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-slate-900">
                    {pendingIdImageName || 'No file selected'}
                  </div>
                  <div className="text-xs text-slate-500">
                    Uploading will auto-convert to WEBP.
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    ref={idUploadRef}
                    type="file"
                    accept="image/webp,image/*"
                    className="hidden"
                    onChange={handlePickIdImage}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="h-9"
                    onClick={handlePickIdUpload}
                    disabled={idUploading}
                  >
                    {idUploading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" aria-hidden />
                        Processing
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4 mr-2" aria-hidden />
                        Choose photo
                      </>
                    )}
                  </Button>
                  {pendingIdImage ? (
                    <Button
                      type="button"
                      variant="ghost"
                      className="h-9"
                      onClick={() => {
                        setPendingIdImage(null);
                        setPendingIdImageName('');
                        setPendingIdPreviewUrl('');
                      }}
                      disabled={idUploading}
                    >
                      Remove
                    </Button>
                  ) : null}
                </div>
              </div>

              {pendingIdPreviewUrl ? (
                <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                  <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-2">
                    Preview
                  </div>
                  <button
                    type="button"
                    className="w-full"
                    onClick={() => window.open(pendingIdPreviewUrl, '_blank')}
                    title="Open full image"
                  >
                    <img
                      src={pendingIdPreviewUrl}
                      alt="Selected tenant ID"
                      className="w-full max-h-56 object-contain rounded-lg bg-white"
                      loading="lazy"
                    />
                  </button>
                </div>
              ) : existingTenantIdImageUrl ? (
                <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                  <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-2">
                    Uploaded
                  </div>
                  <button
                    type="button"
                    className="w-full"
                    onClick={() => window.open(resolveUploadUrl(existingTenantIdImageUrl), '_blank')}
                    title="Open full image"
                  >
                    <img
                      src={resolveUploadUrl(existingTenantIdImageUrl)}
                      alt="Tenant ID"
                      className="w-full max-h-56 object-contain rounded-lg bg-white"
                      loading="lazy"
                    />
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}

          {canUpdate ? (
            <div className="space-y-2 sm:col-span-2">
              <Label>Lease contract (PDF/Image)</Label>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between rounded-xl border border-slate-200 bg-white p-3">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-slate-900">{pendingLeaseName || 'No file selected'}</div>
                  <div className="text-xs text-slate-500">Uploads to document repository as `lease_contract`.</div>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    ref={leaseUploadRef}
                    type="file"
                    accept="application/pdf,image/*"
                    className="hidden"
                    onChange={handlePickLeaseFile}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="h-9"
                    onClick={handlePickLeaseUpload}
                    disabled={leaseUploading}
                  >
                    {leaseUploading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" aria-hidden />
                        Uploading
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4 mr-2" aria-hidden />
                        Choose file
                      </>
                    )}
                  </Button>
                  {pendingLeaseFile ? (
                    <Button
                      type="button"
                      variant="ghost"
                      className="h-9"
                      onClick={() => {
                        setPendingLeaseFile(null);
                        setPendingLeaseName('');
                        setPendingLeasePreviewUrl('');
                      }}
                      disabled={leaseUploading}
                    >
                      Remove
                    </Button>
                  ) : null}
                </div>
              </div>

              {pendingLeasePreviewUrl ? (
                <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                  <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-2">Preview</div>
                  <button
                    type="button"
                    className="w-full"
                    onClick={() => window.open(pendingLeasePreviewUrl, '_blank')}
                    title="Open full image"
                  >
                    <img
                      src={pendingLeasePreviewUrl}
                      alt="Selected lease contract"
                      className="w-full max-h-56 object-contain rounded-lg bg-white"
                      loading="lazy"
                    />
                  </button>
                </div>
              ) : existingLeaseContractUrl ? (
                <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                  <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-2">Uploaded</div>
                  {isLikelyPdfPath(existingLeaseContractUrl) ? (
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm text-slate-700 truncate">Lease contract</div>
                      <Button
                        type="button"
                        variant="outline"
                        className="h-9"
                        onClick={() => window.open(resolveUploadUrl(existingLeaseContractUrl), '_blank')}
                      >
                        Open PDF
                      </Button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="w-full"
                      onClick={() => window.open(resolveUploadUrl(existingLeaseContractUrl), '_blank')}
                      title="Open full image"
                    >
                      <img
                        src={resolveUploadUrl(existingLeaseContractUrl)}
                        alt="Lease contract"
                        className="w-full max-h-56 object-contain rounded-lg bg-white"
                        loading="lazy"
                      />
                    </button>
                  )}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </Modal>

      <Modal
        isOpen={isLandlordFormOpen}
        onClose={closeLandlordForm}
        title={landlordFormMode === 'edit' ? 'Edit landlord' : 'Add landlord'}
        maxWidth="lg"
        variant="default"
        footer={
          <div className="flex justify-end gap-3 w-full">
            <Button type="button" variant="outline" className="h-11 min-w-[120px] rounded-xl" onClick={closeLandlordForm}>
              Cancel
            </Button>
            <Button type="button" className="h-11 min-w-[120px] rounded-xl bg-indigo-600 text-white hover:bg-indigo-700" onClick={() => void handleSaveLandlord()}>
              Save
            </Button>
          </div>
        }
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2 sm:col-span-2">
            <Label>Full name</Label>
            <Input
              className="rounded-xl border-slate-200"
              value={landlordForm.fullName}
              onChange={(e) => setLandlordForm((f) => ({ ...f, fullName: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label>Mobile no</Label>
            <Input
              className="rounded-xl border-slate-200"
              value={landlordForm.mobileNo}
              onChange={(e) => setLandlordForm((f) => ({ ...f, mobileNo: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input
              type="email"
              className="rounded-xl border-slate-200"
              value={landlordForm.email}
              onChange={(e) => setLandlordForm((f) => ({ ...f, email: e.target.value }))}
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>Government ID no</Label>
            <Input
              className="rounded-xl border-slate-200"
              value={landlordForm.govIdNo}
              onChange={(e) => setLandlordForm((f) => ({ ...f, govIdNo: e.target.value }))}
            />
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={isBrokerFormOpen}
        onClose={closeBrokerForm}
        title={brokerFormMode === 'edit' ? t('views.crm.brokers.editTitle') : t('views.crm.brokers.addTitle')}
        maxWidth="lg"
        variant="default"
        footer={
          <div className="flex justify-end gap-3 w-full">
            <Button
              type="button"
              variant="outline"
              className="h-11 min-w-[100px] rounded-xl"
              onClick={closeBrokerForm}
            >
              {t('views.crm.brokers.cancel')}
            </Button>
            <Button
              type="button"
              className="h-11 min-w-[100px] rounded-xl bg-indigo-600 text-white hover:bg-indigo-700"
              onClick={() => void handleSaveBroker()}
            >
              {t('views.crm.brokers.save')}
            </Button>
          </div>
        }
      >
        <p className="text-sm text-slate-500 mb-6">
          {brokerFormMode === 'edit' ? t('views.crm.brokers.editDescription') : t('views.crm.brokers.addDescription')}
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="crm-broker-name">{t('views.crm.brokers.agencyName')}</Label>
            <Input
              id="crm-broker-name"
              value={brokerForm.name}
              onChange={(e) => setBrokerForm((f) => ({ ...f, name: e.target.value }))}
              className="h-12 rounded-xl border-slate-200"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="crm-broker-contact">{t('views.crm.brokers.contactPersonLabel')}</Label>
            <Input
              id="crm-broker-contact"
              value={brokerForm.contactPerson}
              onChange={(e) => setBrokerForm((f) => ({ ...f, contactPerson: e.target.value }))}
              className="h-12 rounded-xl border-slate-200"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="crm-broker-phone">{t('views.crm.brokers.phoneLabel')}</Label>
            <Input
              id="crm-broker-phone"
              value={brokerForm.phone}
              onChange={(e) => setBrokerForm((f) => ({ ...f, phone: e.target.value }))}
              className="h-12 rounded-xl border-slate-200"
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="crm-broker-email">{t('views.crm.brokers.emailLabel')}</Label>
            <Input
              id="crm-broker-email"
              type="email"
              value={brokerForm.email}
              onChange={(e) => setBrokerForm((f) => ({ ...f, email: e.target.value }))}
              className="h-12 rounded-xl border-slate-200"
            />
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label>Nationality</Label>
            <Select2
              options={nationalityOptions}
              value={brokerForm.nationality}
              onChange={(v) => setBrokerForm((f) => ({ ...f, nationality: (v ?? '') as string }))}
              placeholder="Select nationality"
            />
          </div>

          <div className="space-y-2">
            <Label>Government document type</Label>
            <Select2
              options={brokerGovDocTypeOptions}
              value={brokerForm.documentType}
              onChange={(v) => setBrokerForm((f) => ({ ...f, documentType: (v ?? '') as string }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="crm-broker-doc-no">Document no.</Label>
            <Input
              id="crm-broker-doc-no"
              value={brokerForm.documentNo}
              onChange={(e) => setBrokerForm((f) => ({ ...f, documentNo: e.target.value }))}
              className="h-12 rounded-xl border-slate-200"
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="crm-broker-expiry">Expiry date</Label>
            <AppDatePicker
              mode="single"
              placeholder="MM/DD/YYYY"
              fullWidth
              inputClassName="h-12 rounded-xl text-sm"
              value={brokerForm.expiryDate ? parseISO(brokerForm.expiryDate) : null}
              onChange={(picked) =>
                setBrokerForm((f) => ({
                  ...f,
                  expiryDate: picked instanceof Date ? format(picked, 'yyyy-MM-dd') : '',
                }))
              }
            />
          </div>

          {canUpdate ? (
            <div className="space-y-2 sm:col-span-2">
              <Label>KYC document (image or PDF)</Label>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between rounded-xl border border-slate-200 bg-white p-3">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-slate-900">
                    {pendingBrokerDocName || 'No file selected'}
                  </div>
                  <div className="text-xs text-slate-500">Max 5MB. Images will be converted to WEBP.</div>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    ref={brokerDocUploadRef}
                    type="file"
                    accept="image/*,application/pdf"
                    className="hidden"
                    onChange={handlePickBrokerDoc}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="h-10 rounded-xl"
                    onClick={handlePickBrokerDocUpload}
                    disabled={brokerDocUploading}
                  >
                    {brokerDocUploading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" aria-hidden />
                        Uploading
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4 mr-2" aria-hidden />
                        Choose file
                      </>
                    )}
                  </Button>
                  {pendingBrokerDoc ? (
                    <Button
                      type="button"
                      variant="ghost"
                      className="h-10 rounded-xl"
                      onClick={() => {
                        setPendingBrokerDoc(null);
                        setPendingBrokerDocName('');
                        setPendingBrokerDocPreviewUrl('');
                      }}
                      disabled={brokerDocUploading}
                    >
                      Remove
                    </Button>
                  ) : null}
                </div>
              </div>

              {pendingBrokerDocPreviewUrl ? (
                <div className="mt-3 rounded-xl border border-slate-100 bg-slate-50 p-3">
                  <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-2">Preview</div>
                  <button
                    type="button"
                    className="w-full"
                    onClick={() => window.open(pendingBrokerDocPreviewUrl, '_blank')}
                    title="Open full image"
                  >
                    <img
                      src={pendingBrokerDocPreviewUrl}
                      alt="Selected partner agency document"
                      className="w-full max-h-56 object-contain rounded-lg bg-white"
                      loading="lazy"
                    />
                  </button>
                </div>
              ) : brokerForm.filePath && isLikelyImagePath(brokerForm.filePath) ? (
                <div className="mt-3 rounded-xl border border-slate-100 bg-slate-50 p-3">
                  <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-2">Uploaded</div>
                  <button
                    type="button"
                    className="w-full"
                    onClick={() => window.open(resolveUploadUrl(brokerForm.filePath), '_blank')}
                    title="Open full image"
                  >
                    <img
                      src={resolveUploadUrl(brokerForm.filePath)}
                      alt="Partner agency document"
                      className="w-full max-h-56 object-contain rounded-lg bg-white"
                      loading="lazy"
                    />
                  </button>
                </div>
              ) : brokerForm.filePath && isLikelyPdfPath(brokerForm.filePath) ? (
                <div className="mt-3 flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 p-3">
                  <div className="min-w-0">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Uploaded</div>
                    <div className="text-sm font-medium text-slate-900 truncate">PDF document</div>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-9"
                    onClick={() => window.open(resolveUploadUrl(brokerForm.filePath), '_blank')}
                  >
                    Open PDF
                  </Button>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </Modal>

      <Modal
        isOpen={isBlacklistDetailsOpen}
        onClose={closeBlacklistDetails}
        title={selectedBlacklist ? t('views.crm.blacklist.detailsTitle') : ''}
        maxWidth="lg"
        variant="default"
        footer={
          <div className="flex flex-col sm:flex-row sm:items-center justify-end gap-3 w-full">
            {selectedBlacklist?.entityType === 'tenant' && selectedBlacklist.tenantId ? (
              <Button type="button" className="sm:mr-auto bg-indigo-600 text-white hover:bg-indigo-700" onClick={openTenantFromBlacklist}>
                {t('views.crm.blacklist.viewTenantProfile')}
              </Button>
            ) : null}
            <Button type="button" variant="outline" onClick={closeBlacklistDetails}>
              {t('views.crm.blacklist.close')}
            </Button>
          </div>
        }
      >
        {selectedBlacklist ? (
          <div className="space-y-4 text-sm text-slate-700">
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 space-y-2">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-xs font-bold uppercase text-slate-400">{t('views.crm.blacklist.name')}</div>
                  <div className="text-base font-semibold text-slate-900">{selectedBlacklist.name}</div>
                </div>
                <Badge variant="outline" className="border-0 bg-slate-100 text-slate-700 font-medium">
                  {selectedBlacklist.type === 'Tenant' ? t('views.crm.blacklist.tenant') : t('views.crm.blacklist.broker')}
                </Badge>
              </div>
              <div>
                <div className="text-xs font-bold uppercase text-slate-400">{t('views.crm.blacklist.reason')}</div>
                <div className="text-sm">{selectedBlacklist.reason}</div>
              </div>
              <div>
                <div className="text-xs font-bold uppercase text-slate-400">{t('views.crm.blacklist.dateAdded')}</div>
                <div className="text-sm">{format(parseISO(selectedBlacklist.date), 'MMM d, yyyy')}</div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="rounded-xl border border-slate-100 bg-white p-3">
                <div className="text-xs text-slate-500">{t('views.crm.blacklist.recordId')}</div>
                <div className="font-mono text-xs">{selectedBlacklist.id}</div>
              </div>
              <div className="rounded-xl border border-slate-100 bg-white p-3">
                <div className="text-xs text-slate-500">{t('views.crm.blacklist.branch')}</div>
                <div className="font-mono text-xs">{selectedBlacklist.branchId}</div>
              </div>
              <div className="rounded-xl border border-slate-100 bg-white p-3">
                <div className="text-xs text-slate-500">{t('views.crm.blacklist.entity')}</div>
                <div className="font-mono text-xs">{selectedBlacklist.entityType}</div>
              </div>
              {selectedBlacklist.tenantId ? (
                <div className="rounded-xl border border-slate-100 bg-white p-3">
                  <div className="text-xs text-slate-500">{t('views.crm.blacklist.tenantId')}</div>
                  <div className="font-mono text-xs">{selectedBlacklist.tenantId}</div>
                </div>
              ) : null}
              {selectedBlacklist.partnerAgencyId ? (
                <div className="rounded-xl border border-slate-100 bg-white p-3">
                  <div className="text-xs text-slate-500">{t('views.crm.blacklist.brokerId')}</div>
                  <div className="font-mono text-xs">{selectedBlacklist.partnerAgencyId}</div>
                </div>
              ) : null}
              {selectedBlacklist.taggedBy ? (
                <div className="rounded-xl border border-slate-100 bg-white p-3 sm:col-span-2">
                  <div className="text-xs text-slate-500">{t('views.crm.blacklist.taggedBy')}</div>
                  <div className="font-mono text-xs">{selectedBlacklist.taggedBy}</div>
                </div>
              ) : null}
            </div>

            {selectedBlacklist.details ? (
              <div className="rounded-xl border border-slate-100 bg-white p-4">
                <div className="text-xs font-bold uppercase text-slate-400 mb-2">{t('views.crm.blacklist.detailsLabel')}</div>
                <pre className="text-xs whitespace-pre-wrap text-slate-700">{selectedBlacklist.details}</pre>
              </div>
            ) : null}
          </div>
        ) : null}
      </Modal>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-sm">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <Input
              placeholder={t('views.crm.searchPlaceholder')}
              className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-sm shadow-sm transition-all hover:border-slate-300 focus:border-indigo-300 focus-visible:ring-2 focus-visible:ring-indigo-100 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:hover:border-slate-500 dark:focus:border-indigo-500 dark:focus-visible:ring-indigo-900/40"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <TabsList className="grid h-12 w-full grid-cols-4 gap-1 rounded-2xl border border-slate-200/90 bg-slate-100 p-1.5 shadow-inner dark:border-slate-700 dark:bg-slate-800/90 sm:w-auto sm:min-w-[34rem]">
          <TabsTrigger
            value="tenants"
            className="gap-2 rounded-xl border-0 px-2 py-0 text-xs font-medium text-slate-600 shadow-none transition-all data-[active]:bg-white data-[active]:font-semibold data-[active]:text-slate-900 data-[active]:shadow-sm dark:text-slate-400 dark:data-[active]:bg-slate-950 dark:data-[active]:text-white sm:px-3 sm:text-sm"
          >
            <Users className="size-4 shrink-0 opacity-90" aria-hidden />
            <span className="truncate">{t('views.crm.tabs.tenants')}</span>
          </TabsTrigger>
          <TabsTrigger
            value="landlords"
            className="gap-2 rounded-xl border-0 px-2 py-0 text-xs font-medium text-slate-600 shadow-none transition-all data-[active]:bg-white data-[active]:font-semibold data-[active]:text-slate-900 data-[active]:shadow-sm dark:text-slate-400 dark:data-[active]:bg-slate-950 dark:data-[active]:text-white sm:px-3 sm:text-sm"
          >
            <Home className="size-4 shrink-0 opacity-90" aria-hidden />
            <span className="truncate">{t('views.crm.tabs.landlords')}</span>
          </TabsTrigger>
          <TabsTrigger
            value="brokers"
            className="gap-2 rounded-xl border-0 px-2 py-0 text-xs font-medium text-slate-600 shadow-none transition-all data-[active]:bg-white data-[active]:font-semibold data-[active]:text-slate-900 data-[active]:shadow-sm dark:text-slate-400 dark:data-[active]:bg-slate-950 dark:data-[active]:text-white sm:px-3 sm:text-sm"
          >
            <Building2 className="size-4 shrink-0 opacity-90" aria-hidden />
            <span className="truncate">{t('views.crm.tabs.brokers')}</span>
          </TabsTrigger>
          <TabsTrigger
            value="blacklist"
            className="gap-2 rounded-xl border-0 px-2 py-0 text-xs font-medium text-slate-600 shadow-none transition-all data-[active]:bg-white data-[active]:font-semibold data-[active]:text-slate-900 data-[active]:shadow-sm dark:text-slate-400 dark:data-[active]:bg-slate-950 dark:data-[active]:text-white sm:px-3 sm:text-sm"
          >
            <Ban className="size-4 shrink-0 opacity-90" aria-hidden />
            <span className="truncate">{t('views.crm.tabs.blacklist')}</span>
          </TabsTrigger>
        </TabsList>
        </div>

        <TabsContent value="tenants" className="mt-2 space-y-6">
          {crmLoading ? (
            <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden p-6 md:p-8">
              <SkeletonTable rows={6} columns={6} />
            </div>
          ) : (
            <DataTable
              data={filteredTenants}
              columns={tenantColumns}
              keyExtractor={(tenant) => tenant.id}
              onRowClick={(tenant) => openViewDetails(tenant)}
              highlightFirstColumn={false}
            />
          )}
        </TabsContent>

        <TabsContent value="landlords" className="mt-2 space-y-6">
          {landlordsLoading ? (
            <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden p-6 md:p-8">
              <SkeletonTable rows={6} columns={4} />
            </div>
          ) : (
            <DataTable data={filteredLandlords} columns={landlordColumns} keyExtractor={(l) => l.id} highlightFirstColumn={false} />
          )}
        </TabsContent>

        <TabsContent value="brokers" className="mt-2 space-y-6">
          {brokersLoading ? (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="animate-pulse overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900"
                >
                  <div className="border-b border-slate-100 p-4 dark:border-slate-800">
                    <div className="flex gap-3">
                      <div className="h-11 w-11 shrink-0 rounded-lg bg-slate-100 dark:bg-slate-800" />
                      <div className="flex-1 space-y-2 pt-0.5">
                        <div className="h-4 w-3/5 rounded bg-slate-100 dark:bg-slate-800" />
                        <div className="h-3 w-2/5 rounded bg-slate-100 dark:bg-slate-800" />
                      </div>
                    </div>
                  </div>
                  <div className="h-10 bg-slate-50 dark:bg-slate-800/80" />
                  <div className="space-y-2 p-4">
                    <div className="h-3 w-full rounded bg-slate-100 dark:bg-slate-800" />
                    <div className="h-3 w-full rounded bg-slate-100 dark:bg-slate-800" />
                    <div className="h-3 w-4/5 rounded bg-slate-100 dark:bg-slate-800" />
                  </div>
                  <div className="border-t border-slate-100 px-4 py-3 dark:border-slate-800">
                    <div className="mb-3 flex justify-between">
                      <div className="h-3 w-24 rounded bg-slate-100 dark:bg-slate-800" />
                      <div className="h-3 w-12 rounded bg-slate-100 dark:bg-slate-800" />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="h-10 rounded-lg bg-slate-100 dark:bg-slate-800" />
                      <div className="h-10 rounded-lg bg-slate-100 dark:bg-slate-800" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid min-w-0 grid-cols-1 items-stretch gap-5 md:grid-cols-2 lg:grid-cols-3">
              {filteredBrokers.map((agency) => {
                const isBrokerBl =
                  Boolean(agency.isBlacklisted) ||
                  blacklistList.some((r) => r.entityType === 'broker' && r.partnerAgencyId === agency.id);
                const expInsight = brokerExpiryInsight(agency.expiryDate);
                const collab = brokerCollaborationStats(agency, contractList);

                const passportValue =
                  agency.documentType || agency.documentNo
                    ? `${agency.documentType ?? '—'}${agency.documentNo ? ` · ${agency.documentNo}` : ''}`
                    : '—';

                const banner = (() => {
                  if (isBrokerBl) {
                    return (
                      <div className="flex items-center gap-2 rounded-lg bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-900 dark:bg-rose-950/45 dark:text-rose-100">
                        <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" aria-hidden />
                        {t('views.crm.brokers.bannerBlacklisted')}
                      </div>
                    );
                  }
                  if (expInsight !== 'none' && expInsight.status === 'expired') {
                    return (
                      <div className="flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-900 dark:bg-red-950/40 dark:text-red-100">
                        <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
                        {t('views.crm.brokers.bannerExpired')}
                      </div>
                    );
                  }
                  if (expInsight !== 'none' && expInsight.status === 'expiring') {
                    return (
                      <div className="flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-950 dark:bg-amber-950/35 dark:text-amber-100">
                        <AlertTriangle className="h-4 w-4 shrink-0 text-amber-700 dark:text-amber-400" aria-hidden />
                        {t('views.crm.brokers.bannerExpiring', { days: expInsight.daysLeft })}
                      </div>
                    );
                  }
                  if (agency.kycVerified) {
                    return (
                      <div className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100">
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
                        {t('views.crm.brokers.bannerVerifiedOk')}
                      </div>
                    );
                  }
                  return (
                    <div className="flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-950 dark:bg-amber-950/35 dark:text-amber-100">
                      <AlertTriangle className="h-4 w-4 shrink-0 text-amber-700 dark:text-amber-400" aria-hidden />
                      {t('views.crm.brokers.bannerPending')}
                    </div>
                  );
                })();

                let statsNode: React.ReactNode;
                if (isBrokerBl) {
                  statsNode = (
                    <span className="font-semibold text-rose-600 dark:text-rose-400">{t('views.crm.table.blacklisted')}</span>
                  );
                } else if (
                  !agency.kycVerified ||
                  (expInsight !== 'none' &&
                    (expInsight.status === 'expired' || expInsight.status === 'expiring'))
                ) {
                  statsNode = (
                    <span className="font-semibold text-amber-700 dark:text-amber-400">
                      {t('views.crm.brokers.statsReview')}
                    </span>
                  );
                } else {
                  statsNode = (
                    <span className="inline-flex items-center gap-1 font-semibold text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
                      {t('views.crm.brokers.statsOk')}
                    </span>
                  );
                }

                const primaryButton = (() => {
                  if (isBrokerBl && canUpdate) {
                    return (
                      <Button
                        type="button"
                        className="h-10 w-full min-w-0 rounded-lg border border-amber-300 bg-amber-50 text-sm font-semibold text-amber-950 shadow-sm hover:bg-amber-100 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100 dark:hover:bg-amber-950/60"
                        onClick={() => openActivateBroker(agency)}
                      >
                        {t('views.crm.brokers.activate')}
                      </Button>
                    );
                  }
                  if (!isBrokerBl && canUpdate && !agency.kycVerified) {
                    return (
                      <Button
                        type="button"
                        className="h-10 w-full min-w-0 rounded-lg bg-amber-400 text-sm font-semibold text-slate-900 shadow-sm hover:bg-amber-500"
                        onClick={() => void toggleBrokerVerified(agency)}
                      >
                        <ShieldCheck className="mr-1.5 h-4 w-4 shrink-0" aria-hidden />
                        {t('views.crm.brokers.verifyButton')}
                      </Button>
                    );
                  }
                  return (
                    <Button
                      type="button"
                      className="h-10 w-full min-w-0 rounded-lg bg-blue-600 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
                      onClick={() => openBrokerMessage(agency)}
                    >
                      <Mail className="mr-1.5 h-4 w-4 shrink-0" aria-hidden />
                      {t('views.crm.brokers.messageButton')}
                    </Button>
                  );
                })();

                return (
                  <div
                    key={agency.id}
                    className="group flex min-h-[420px] min-w-0 max-w-full flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition-all duration-200 hover:shadow-md dark:border-slate-700 dark:bg-slate-900"
                  >
                    <div className="relative min-w-0 border-b border-slate-100 px-4 pb-4 pt-4 dark:border-slate-800">
                      <div className="flex items-start gap-3 pr-9">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-100 text-base font-bold text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200">
                          {(agency.name || '?').charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="truncate text-base font-bold tracking-tight text-slate-900 dark:text-white">
                            {agency.name}
                          </h3>
                          <p className="mt-0.5 truncate text-xs font-medium text-slate-500 dark:text-slate-400">
                            {agency.contactPerson || '—'}
                          </p>
                          <div className="mt-2 flex flex-wrap items-center gap-3">
                            {isBrokerBl ? (
                              <span className="flex items-center gap-1.5 text-[11px] font-semibold text-rose-600 dark:text-rose-400">
                                <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                                {t('views.crm.table.blacklisted')}
                              </span>
                            ) : (
                              <>
                                <span
                                  className={cn(
                                    'flex items-center gap-1.5 text-[11px] font-semibold',
                                    agency.kycVerified ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400',
                                  )}
                                >
                                  <span
                                    className={cn(
                                      'h-1.5 w-1.5 rounded-full',
                                      agency.kycVerified ? 'bg-emerald-500' : 'bg-amber-500',
                                    )}
                                  />
                                  {agency.kycVerified
                                    ? t('views.crm.table.verified')
                                    : t('views.crm.table.verificationPending')}
                                </span>
                                <span
                                  className={cn(
                                    'flex items-center gap-1.5 text-[11px] font-semibold',
                                    agency.active !== false
                                      ? 'text-slate-600 dark:text-slate-300'
                                      : 'text-slate-400 dark:text-slate-500',
                                  )}
                                >
                                  <span
                                    className={cn(
                                      'h-1.5 w-1.5 rounded-full',
                                      agency.active !== false ? 'bg-slate-500 dark:bg-slate-400' : 'bg-slate-300 dark:bg-slate-600',
                                    )}
                                  />
                                  {agency.active !== false
                                    ? t('views.crm.table.active')
                                    : t('views.crm.table.inactive')}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      {canUpdate || canDelete ? (
                        <div className="absolute right-3 top-4">
                          <DropdownMenu>
                            <DropdownMenuTrigger
                              render={
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 shrink-0 text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
                                  onClick={(e) => e.stopPropagation()}
                                />
                              }
                            >
                              <MoreVertical className="h-4 w-4" />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {canUpdate ? (
                                <DropdownMenuItem onClick={() => openEditBroker(agency)}>
                                  {t('views.crm.brokers.edit')}
                                </DropdownMenuItem>
                              ) : null}
                              {canUpdate ? (
                                <DropdownMenuItem
                                  onClick={() => {
                                    if (isBrokerBl) {
                                      openActivateBroker(agency);
                                      return;
                                    }
                                    openBlacklistBroker(agency);
                                  }}
                                >
                                  {isBrokerBl ? t('views.crm.brokers.activate') : t('views.crm.table.blacklisted')}
                                </DropdownMenuItem>
                              ) : null}
                              {canUpdate ? (
                                <DropdownMenuItem onClick={() => void toggleBrokerVerified(agency)}>
                                  {agency.kycVerified
                                    ? t('views.crm.brokers.unverify')
                                    : t('views.crm.brokers.verify')}
                                </DropdownMenuItem>
                              ) : null}
                              {canUpdate ? (
                                <DropdownMenuItem onClick={() => void toggleBrokerActive(agency)}>
                                  {agency.active !== false
                                    ? t('views.crm.brokers.deactivate')
                                    : t('views.crm.brokers.activateActive')}
                                </DropdownMenuItem>
                              ) : null}
                              {canDelete ? (
                                <DropdownMenuItem
                                  variant="destructive"
                                  className="text-rose-600"
                                  onClick={() => void handleDeleteBroker(agency)}
                                >
                                  {t('views.crm.brokers.delete')}
                                </DropdownMenuItem>
                              ) : null}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      ) : null}
                    </div>

                    <div className="min-w-0 border-b border-slate-100 px-4 py-3 dark:border-slate-800">{banner}</div>

                    <div className="flex min-w-0 flex-1 flex-col px-4 py-3">
                      <div className="min-w-0 space-y-2.5 text-xs">
                        <div className="flex min-w-0 items-center justify-between gap-3">
                          <span className="shrink-0 font-medium text-slate-500 dark:text-slate-400">
                            {t('views.crm.brokers.phone')}
                          </span>
                          <span className="min-w-0 text-right font-semibold text-slate-900 dark:text-slate-100">
                            {agency.phone || '—'}
                          </span>
                        </div>
                        <div className="flex min-w-0 items-center justify-between gap-3">
                          <span className="shrink-0 font-medium text-slate-500 dark:text-slate-400">
                            {t('views.crm.brokers.emailShort')}
                          </span>
                          <span className="min-w-0 break-all text-right font-semibold text-slate-900 dark:text-slate-100">
                            {agency.email?.trim() || '—'}
                          </span>
                        </div>
                        <div className="flex min-w-0 items-center justify-between gap-3">
                          <span className="shrink-0 font-medium text-slate-500 dark:text-slate-400">
                            {t('views.crm.brokers.nationality')}
                          </span>
                          <span className="min-w-0 text-right font-semibold text-slate-900 dark:text-slate-100">
                            {agency.nationality?.trim() || '—'}
                          </span>
                        </div>
                        <div className="flex min-w-0 items-center justify-between gap-3">
                          <span className="shrink-0 font-medium text-slate-500 dark:text-slate-400">
                            {t('views.crm.brokers.passport')}
                          </span>
                          <span className="min-w-0 text-right font-semibold text-slate-900 dark:text-slate-100">
                            {passportValue}
                          </span>
                        </div>
                        <div className="flex min-w-0 items-center justify-between gap-3">
                          <span className="shrink-0 font-medium text-slate-500 dark:text-slate-400">
                            {t('views.crm.brokers.stats')}
                          </span>
                          <div className="min-w-0 text-right">{statsNode}</div>
                        </div>
                      </div>
                    </div>

                    <div className="mt-auto min-w-0 border-t border-slate-100 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900">
                      <div className="mb-3 flex min-w-0 items-start justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                        <span className="flex min-w-0 flex-1 items-start gap-1">
                          <History className="mt-0.5 h-3.5 w-3.5 shrink-0 text-blue-500 dark:text-blue-400" aria-hidden />
                          <span className="min-w-0 leading-snug break-words">
                            <span className="font-medium text-slate-600 dark:text-slate-300">
                              {t('views.crm.brokers.lastCollaboration')}:
                            </span>{' '}
                            {collab.lastAt
                              ? formatDistanceToNow(collab.lastAt, { addSuffix: true })
                              : '—'}
                          </span>
                        </span>
                        <span className="shrink-0 pl-1 font-semibold tabular-nums text-slate-700 dark:text-slate-200">
                          {t('views.crm.brokers.totalLabel')}: {collab.count}
                        </span>
                      </div>
                      <div className="flex min-w-0 flex-col gap-2">
                        <div className="min-w-0 w-full">{primaryButton}</div>
                        <Button
                          type="button"
                          variant="outline"
                          className="h-auto min-h-10 w-full min-w-0 flex-wrap items-center justify-center gap-x-1.5 gap-y-0.5 whitespace-normal rounded-lg border-slate-200 bg-white px-3 py-2 text-xs font-semibold leading-snug text-blue-600 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:text-blue-400 dark:hover:bg-slate-800 [&_svg]:shrink-0"
                          onClick={() => openBrokerLogs(agency)}
                        >
                          <span className="max-w-full text-center">{t('views.crm.brokers.viewLogs')}</span>
                          <ChevronDown className="h-3.5 w-3.5 opacity-70" aria-hidden />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>
        <TabsContent value="blacklist" className="mt-2 space-y-6">
          <div className="rounded-xl border border-rose-200 bg-gradient-to-br from-rose-50 via-white to-white px-4 py-4 shadow-sm dark:border-rose-900/50 dark:from-rose-950/35 dark:via-slate-900 dark:to-slate-900">
            <div className="flex gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-rose-100 dark:bg-rose-950/80">
                <ShieldAlert className="h-6 w-6 text-rose-600 dark:text-rose-400" aria-hidden />
              </div>
              <div className="min-w-0">
                <h2 className="text-base font-bold text-rose-950 dark:text-rose-50">{t('views.crm.blacklist.title')}</h2>
                <p className="mt-1 text-sm leading-relaxed text-rose-900/85 dark:text-rose-200/90">
                  {t('views.crm.blacklist.description')}
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-2 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <Button
              type="button"
              variant={blacklistTypeFilter === 'all' ? 'default' : 'outline'}
              size="sm"
              className={cn(
                'h-9 rounded-lg px-3',
                blacklistTypeFilter === 'all'
                  ? 'bg-rose-600 text-white hover:bg-rose-700'
                  : 'border-rose-200 text-rose-700 hover:bg-rose-50 dark:border-rose-800 dark:text-rose-300 dark:hover:bg-rose-950/40',
              )}
              onClick={() => setBlacklistTypeFilter('all')}
            >
              All
            </Button>
            <Button
              type="button"
              variant={blacklistTypeFilter === 'tenant' ? 'default' : 'outline'}
              size="sm"
              className={cn(
                'h-9 rounded-lg px-3',
                blacklistTypeFilter === 'tenant'
                  ? 'bg-rose-600 text-white hover:bg-rose-700'
                  : 'border-rose-200 text-rose-700 hover:bg-rose-50 dark:border-rose-800 dark:text-rose-300 dark:hover:bg-rose-950/40',
              )}
              onClick={() => setBlacklistTypeFilter('tenant')}
            >
              {t('views.crm.blacklist.tenant')}
            </Button>
            <Button
              type="button"
              variant={blacklistTypeFilter === 'broker' ? 'default' : 'outline'}
              size="sm"
              className={cn(
                'h-9 rounded-lg px-3',
                blacklistTypeFilter === 'broker'
                  ? 'bg-rose-600 text-white hover:bg-rose-700'
                  : 'border-rose-200 text-rose-700 hover:bg-rose-50 dark:border-rose-800 dark:text-rose-300 dark:hover:bg-rose-950/40',
              )}
              onClick={() => setBlacklistTypeFilter('broker')}
            >
              {t('views.crm.blacklist.broker')}
            </Button>
          </div>

          {crmLoading || blacklistLoading ? (
            <div className="grid min-w-0 grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <div
                  key={i}
                  className="animate-pulse overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900"
                >
                  <div className="border-b border-slate-100 p-4 dark:border-slate-800">
                    <div className="flex gap-3">
                      <div className="h-11 w-11 shrink-0 rounded-lg bg-slate-100 dark:bg-slate-800" />
                      <div className="flex-1 space-y-2 pt-0.5">
                        <div className="h-4 w-3/5 rounded bg-slate-100 dark:bg-slate-800" />
                        <div className="h-3 w-2/5 rounded bg-slate-100 dark:bg-slate-800" />
                      </div>
                    </div>
                  </div>
                  <div className="h-12 bg-rose-50/80 dark:bg-rose-950/30" />
                  <div className="space-y-2 p-4">
                    <div className="h-3 w-full rounded bg-slate-100 dark:bg-slate-800" />
                    <div className="h-12 w-full rounded bg-slate-100 dark:bg-slate-800" />
                  </div>
                  <div className="border-t border-slate-100 px-4 py-3 dark:border-slate-800">
                    <div className="h-10 w-full rounded-lg bg-slate-100 dark:bg-slate-800" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredBlacklist.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50 py-16 text-center dark:border-slate-700 dark:bg-slate-900/40">
              <ShieldAlert className="mb-3 h-12 w-12 text-rose-300 dark:text-rose-700" />
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400">{t('views.crm.blacklist.emptyCards')}</p>
            </div>
          ) : (
            <div className="grid min-w-0 grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
              {filteredBlacklist.map((row) => {
                const initial = (row.name || '?').trim().charAt(0).toUpperCase();
                const typeLabel =
                  row.type === 'Tenant' ? t('views.crm.blacklist.tenant') : t('views.crm.blacklist.broker');
                let dateAdded = row.date;
                try {
                  const d = parseISO(row.date);
                  if (isValid(d)) dateAdded = format(d, 'MMM d, yyyy');
                } catch {
                  /* keep raw */
                }
                return (
                  <div
                    key={row.id}
                    className="flex min-h-[320px] min-w-0 max-w-full flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition-all duration-200 hover:shadow-md dark:border-slate-700 dark:bg-slate-900"
                  >
                    <div className="relative min-w-0 border-b border-slate-100 px-4 pb-4 pt-4 dark:border-slate-800">
                      <div className="flex items-start gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-rose-200 bg-rose-50 text-base font-bold text-rose-700 dark:border-rose-800 dark:bg-rose-950/60 dark:text-rose-200">
                          {initial}
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="truncate text-base font-bold tracking-tight text-slate-900 dark:text-white">
                            {row.name}
                          </h3>
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-semibold text-rose-800 dark:bg-rose-950/80 dark:text-rose-200">
                              <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                              {t('views.crm.table.blacklisted')}
                            </span>
                            <Badge
                              variant="outline"
                              className="border-0 bg-slate-100 text-[11px] font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200"
                            >
                              {typeLabel}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="min-w-0 border-b border-slate-100 px-4 py-3 dark:border-slate-800">
                      <div className="flex items-start gap-2 rounded-lg bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-900 dark:bg-rose-950/45 dark:text-rose-100">
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" aria-hidden />
                        <span className="leading-snug">{t('views.crm.blacklist.cardBanner')}</span>
                      </div>
                    </div>

                    <div className="flex min-w-0 flex-1 flex-col px-4 py-3">
                      <div className="min-w-0 space-y-2.5 text-xs">
                        <div className="flex min-w-0 items-center justify-between gap-3">
                          <span className="flex shrink-0 items-center gap-1 font-medium text-slate-500 dark:text-slate-400">
                            <Calendar className="h-3.5 w-3.5 opacity-80" aria-hidden />
                            {t('views.crm.blacklist.dateAdded')}
                          </span>
                          <span className="min-w-0 text-right font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                            {dateAdded}
                          </span>
                        </div>
                        {row.taggedBy ? (
                          <div className="flex min-w-0 items-start justify-between gap-3 border-t border-slate-100 pt-2.5 dark:border-slate-800">
                            <span className="shrink-0 font-medium text-slate-500 dark:text-slate-400">
                              {t('views.crm.blacklist.taggedBy')}
                            </span>
                            <span className="min-w-0 break-all text-right font-mono text-[11px] font-medium text-slate-700 dark:text-slate-300">
                              {row.taggedBy}
                            </span>
                          </div>
                        ) : null}
                      </div>

                      <div className="mt-4 border-t border-slate-100 pt-3 dark:border-slate-800">
                        <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                          {t('views.crm.blacklist.reason')}
                        </div>
                        <p className="mt-1.5 text-sm font-semibold leading-snug text-slate-800 dark:text-slate-100">
                          {row.reason?.trim() || '—'}
                        </p>
                      </div>
                    </div>

                    <div className="mt-auto min-w-0 border-t border-slate-100 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900">
                      <Button
                        type="button"
                        variant="outline"
                        className="h-10 w-full min-w-0 rounded-lg border-slate-200 bg-white text-sm font-semibold text-blue-600 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:text-blue-400 dark:hover:bg-slate-800"
                        onClick={() => openBlacklistDetails(row)}
                      >
                        <Eye className="mr-2 h-4 w-4 shrink-0" aria-hidden />
                        {t('views.crm.blacklist.details')}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
