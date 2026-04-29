import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  Users,
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
  CalendarRange,
  FileText,
  FileImage,
  Eye,
  Upload,
  Loader2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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
import { Select2 } from '@/components/select2';
import { tenants as seedTenants, contracts as seedContracts, units } from '@/lib/mockData';
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
  uploadPartnerAgencyKycDocument,
  updatePartnerAgency,
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
import { format, parseISO } from 'date-fns';
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
      setTenantList([...seedTenants]);
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
        setContractList(seedContracts);
      }
    })();
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        const list = await fetchUnits();
        setUnitList(list);
      } catch {
        setUnitList(units);
      }
    })();
  }, []);

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

  const handleViewBrokerLogs = () => {
    toast.info(t('views.crm.brokers.logsSoon'));
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
            <Badge variant="outline" className="border-0 bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
              <ShieldCheck className="w-3 h-3 mr-1" />
              {t('views.crm.table.verified')}
            </Badge>
          ) : (
            <Badge variant="outline" className="border-0 bg-amber-100 text-amber-800 hover:bg-amber-100">
              <ShieldQuestion className="w-3 h-3 mr-1" />
              {t('views.crm.table.kycPending')}
            </Badge>
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
            <Badge variant="outline" className="border-0 bg-rose-100 text-rose-700 hover:bg-rose-100">
              {t('views.crm.table.blacklisted')}
            </Badge>
          ) : (
            <Badge variant="outline" className="border-0 bg-indigo-100 text-indigo-700 hover:bg-indigo-100">
              {t('views.crm.table.active')}
            </Badge>
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
                    const url = `${window.location.origin}${window.location.pathname}?view=portal&tenantId=${encodeURIComponent(tenant.id)}`;
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

  const blacklistColumns: ColumnDef<BlacklistRow>[] = useMemo(
    () => [
      {
        header: t('views.crm.blacklist.name'),
        render: (item) => <span className="font-medium text-slate-900">{item.name}</span>,
      },
      {
        header: t('views.crm.blacklist.type'),
        render: (item) => (
          <Badge variant="outline" className="border-0 bg-slate-100 text-slate-700 font-medium">
            {item.type === 'Tenant' ? t('views.crm.blacklist.tenant') : t('views.crm.blacklist.broker')}
          </Badge>
        ),
      },
      {
        header: t('views.crm.blacklist.reason'),
        render: (item) => <span className="text-sm text-slate-600">{item.reason}</span>,
      },
      {
        header: t('views.crm.blacklist.dateAdded'),
        render: (item) => (
          <span className="text-xs text-slate-400">{format(parseISO(item.date), 'MMM d, yyyy')}</span>
        ),
      },
      {
        header: t('views.crm.blacklist.actions'),
        className: 'text-right',
        headerClassName: 'text-right',
        cellClassName: 'text-right',
        render: (item) => (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 border-slate-200 text-slate-700 hover:bg-slate-50"
            onClick={(e) => {
              e.stopPropagation();
              openBlacklistDetails(item);
            }}
          >
            {t('views.crm.blacklist.details')}
          </Button>
        ),
      },
    ],
    [t],
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">{t('views.crm.title')}</h1>
          <p className="text-slate-500 mt-1">{t('views.crm.subtitle')}</p>
        </div>
        {canCreate && activeTab === 'tenants' && (
          <Button className="bg-indigo-600 hover:bg-indigo-700" onClick={openRegister}>
            <Plus className="w-4 h-4 mr-2" />
            {t('views.crm.registerTenant')}
          </Button>
        )}
        {canCreate && activeTab === 'brokers' && (
          <Button className="bg-indigo-600 hover:bg-indigo-700" onClick={openAddBroker}>
            <Plus className="w-4 h-4 mr-2" />
            {t('views.crm.brokers.addAgency')}
          </Button>
        )}
        {canCreate && activeTab === 'landlords' && (
          <Button className="bg-indigo-600 hover:bg-indigo-700" onClick={openAddLandlord}>
            <Plus className="w-4 h-4 mr-2" />
            Add Landlord
          </Button>
        )}
      </div>

      <Modal
        isOpen={isDetailsOpen && !isFormOpen}
        onClose={() => setIsDetailsOpen(false)}
        title={selectedTenant ? selectedTenant.name : ''}
        maxWidth="2xl"
        variant="glass"
        footer={
          <div className="flex justify-end gap-3 w-full">
            <Button variant="outline" onClick={() => setIsDetailsOpen(false)}>
              {t('views.crm.details.close')}
            </Button>
            {canUpdate && selectedTenant && (
              <Button className="bg-indigo-600" onClick={() => openEdit(selectedTenant)}>
                {t('views.crm.details.editTenant')}
              </Button>
            )}
            {canUpdate && selectedTenant?.isBlacklisted ? (
              <Button
                type="button"
                className="bg-emerald-600 hover:bg-emerald-700"
                onClick={() => openActivateTenant(selectedTenant)}
              >
                {t('views.crm.table.activateTenant')}
              </Button>
            ) : null}
          </div>
        }
      >
        {selectedTenant && (
          <div className="flex flex-col">
            <div className="flex flex-wrap items-center gap-1.5">
              {selectedTenant.kycVerified !== false ? (
                <Badge variant="outline" className="border-0 bg-emerald-100 text-emerald-700">
                  {t('views.crm.table.verified')}
                </Badge>
              ) : (
                <Badge variant="outline" className="border-0 bg-amber-100 text-amber-800">
                  {t('views.crm.table.kycPending')}
                </Badge>
              )}
              {selectedTenant.isBlacklisted ? (
                <Badge variant="outline" className="border-0 bg-rose-100 text-rose-700">
                  {t('views.crm.table.blacklisted')}
                </Badge>
              ) : (
                <Badge variant="outline" className="border-0 bg-indigo-100 text-indigo-700">
                  {t('views.crm.table.active')}
                </Badge>
              )}
            </div>

            <div className="mt-3 border-t border-slate-200 pt-3">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-x-6">
                <div className="flex min-w-0 flex-col gap-1.5">
                  <h4 className="text-xs font-bold uppercase tracking-wide text-slate-400">
                    {t('views.crm.details.contact')}
                  </h4>
                  <div className="divide-y divide-slate-100">
                    <div className="grid grid-cols-[minmax(6rem,7.5rem)_1fr] items-start gap-x-3 py-2 text-sm">
                      <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                        {t('views.crm.tenantModal.email')}
                      </span>
                      <span className="flex min-w-0 items-start gap-1.5 text-slate-900">
                        <Mail className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
                        <span className="break-all">{selectedTenant.email}</span>
                      </span>
                    </div>
                    <div className="grid grid-cols-[minmax(6rem,7.5rem)_1fr] items-start gap-x-3 py-2 text-sm">
                      <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                        {t('views.crm.tenantModal.phone')}
                      </span>
                      <span className="flex items-center gap-1.5 text-slate-900">
                        <Phone className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                        {selectedTenant.phone}
                      </span>
                    </div>
                    <div className="grid grid-cols-[minmax(6rem,7.5rem)_1fr] items-start gap-x-3 py-2 text-sm">
                      <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                        {t('views.crm.tenantModal.nationality')}
                      </span>
                      <span className="text-slate-900">{nationalityLabel(selectedTenant.nationality)}</span>
                    </div>
                  </div>
                </div>

                <div className="flex min-w-0 flex-col gap-1.5 border-t border-slate-200 pt-3 md:border-t-0 md:border-l md:border-slate-200 md:pt-0 md:pl-6">
                  <h4 className="text-xs font-bold uppercase tracking-wide text-slate-400">
                    {t('views.crm.details.leaseInfo')}
                  </h4>
                  {tenantLeaseContext.contract && tenantLeaseContext.unit ? (
                    <div className="divide-y divide-slate-100">
                      <div className="grid grid-cols-[minmax(6rem,7.5rem)_1fr] items-start gap-x-3 py-2 text-sm">
                        <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                          {t('views.crm.details.leaseUnit')}
                        </span>
                        <span className="font-medium text-slate-900">
                          {tenantLeaseContext.unit.unitNumber} · {tenantLeaseContext.unit.buildingName}
                        </span>
                      </div>
                      <div className="grid grid-cols-[minmax(6rem,7.5rem)_1fr] items-start gap-x-3 py-2 text-sm">
                        <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                          {t('views.crm.details.leasePeriod')}
                        </span>
                        <span className="flex min-w-0 items-start gap-1.5 text-slate-900">
                          <CalendarRange className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
                          <span>
                            {format(parseISO(tenantLeaseContext.contract.startDate), 'MMM d, yyyy')} —{' '}
                            {format(parseISO(tenantLeaseContext.contract.endDate), 'MMM d, yyyy')}
                          </span>
                        </span>
                      </div>
                      <div className="grid grid-cols-[minmax(6rem,7.5rem)_1fr] items-start gap-x-3 py-2 text-sm">
                        <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                          {t('views.crm.details.leaseMonthlyRent')}
                        </span>
                        <span className="font-semibold text-slate-900">
                          ₱{tenantLeaseContext.contract.monthlyRent.toLocaleString()}
                        </span>
                      </div>
                      <div className="grid grid-cols-[minmax(6rem,7.5rem)_1fr] items-start gap-x-3 py-2 text-sm">
                        <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                          {t('views.ledger.table.status')}
                        </span>
                        <span>
                          <Badge
                            variant="outline"
                            className="border-slate-200 capitalize text-slate-700"
                          >
                            {tenantLeaseContext.contract.status}
                          </Badge>
                        </span>
                      </div>
                    </div>
                  ) : (
                    <p className="py-1.5 text-sm leading-snug text-slate-500">
                      {t('views.crm.details.leaseNoContract')}
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-3 border-t border-slate-200 pt-3">
              <div className="flex flex-col gap-1.5">
                <h4 className="text-xs font-bold uppercase tracking-wide text-slate-400">
                  {t('views.crm.details.identification')}
                </h4>
                <div className="divide-y divide-slate-100">
                  <div className="grid grid-cols-[minmax(6rem,7.5rem)_1fr] items-start gap-x-3 py-2 text-sm">
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                      {t('views.crm.tenantModal.idType')}
                    </span>
                    <span className="text-slate-900">{selectedTenant.idType}</span>
                  </div>
                  <div className="grid grid-cols-[minmax(6rem,7.5rem)_1fr] items-start gap-x-3 py-2 text-sm">
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                      {t('views.crm.tenantModal.idNumber')}
                    </span>
                    <span className="text-slate-900">{selectedTenant.idNumber}</span>
                  </div>
                  <div className="grid grid-cols-[minmax(6rem,7.5rem)_1fr] items-start gap-x-3 py-2 text-sm">
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                      {t('views.crm.tenantModal.idExpiry')}
                    </span>
                    <span className="text-slate-900">{selectedTenant.idExpiry || '—'}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-3 border-t border-slate-200 pt-3">
              <div className="flex flex-col gap-1.5">
                <h4 className="text-xs font-bold uppercase tracking-wide text-slate-400">
                  {t('views.crm.details.documents')}
                </h4>
                <div className="divide-y divide-slate-100">
                  <button
                    type="button"
                    className={cn(
                      'grid w-full grid-cols-[minmax(6rem,7.5rem)_1fr] items-center gap-x-3 py-2 text-left text-sm transition-colors',
                      tenantLeaseContext.contract
                        ? 'cursor-pointer hover:bg-slate-50/80'
                        : 'cursor-default opacity-70',
                    )}
                    onClick={() => {
                      if (!tenantLeaseContext.contract) {
                        toast.info(t('views.crm.details.documentLeaseUnavailable'));
                        return;
                      }
                      const url = `${window.location.origin}${window.location.pathname}?view=preview&type=contract&id=${tenantLeaseContext.contract.id}`;
                      window.open(url, '_blank');
                    }}
                  >
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">PDF</span>
                    <span className="flex min-w-0 items-center gap-1.5 text-slate-900">
                      <FileText className="h-3.5 w-3.5 shrink-0 text-slate-400" strokeWidth={1.75} />
                      <span className="truncate font-medium">{t('views.crm.details.documentLeasePdf')}</span>
                    </span>
                  </button>
                  <button
                    type="button"
                    className={cn(
                      'grid w-full grid-cols-[minmax(6rem,7.5rem)_1fr] items-center gap-x-3 py-2 text-left text-sm transition-colors',
                      selectedTenant.idImageUrl
                        ? 'cursor-pointer hover:bg-slate-50/80'
                        : 'cursor-default opacity-70',
                    )}
                    onClick={() => {
                      if (!selectedTenant.idImageUrl) {
                        toast.info(t('views.crm.details.documentIdUnavailable'));
                        return;
                      }
                      window.open(resolveUploadUrl(selectedTenant.idImageUrl), '_blank');
                    }}
                  >
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">WEBP</span>
                    <span className="flex min-w-0 items-center gap-1.5 text-slate-900">
                      <FileImage className="h-3.5 w-3.5 shrink-0 text-slate-400" strokeWidth={1.75} />
                      <span className="truncate font-medium">{t('views.crm.details.documentTenantIdJpg')}</span>
                    </span>
                  </button>
                </div>

                {selectedTenant.idImageUrl ? (
                  <div className="mt-3 rounded-xl border border-slate-100 bg-slate-50 p-3">
                    <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-2">
                      Preview
                    </div>
                    <button
                      type="button"
                      className="w-full"
                      onClick={() => window.open(resolveUploadUrl(selectedTenant.idImageUrl!), '_blank')}
                      title="Open full image"
                    >
                      <img
                        src={resolveUploadUrl(selectedTenant.idImageUrl)}
                        alt="Tenant ID"
                        className="w-full max-h-56 object-contain rounded-lg bg-white"
                        loading="lazy"
                      />
                    </button>
                  </div>
                ) : null}
              </div>
            </div>

            {selectedTenant.blacklistReason ? (
              <div className="mt-3 border-t border-slate-200 pt-3">
                <div className="flex flex-col gap-1.5">
                  <h4 className="text-xs font-bold uppercase tracking-wide text-slate-400">
                    {t('views.crm.details.notes')}
                  </h4>
                  <p className="text-sm leading-snug text-slate-600">{selectedTenant.blacklistReason}</p>
                </div>
              </div>
            ) : null}
          </div>
        )}
      </Modal>

      <Modal
        isOpen={isBrokerDeleteOpen}
        onClose={closeDeleteBroker}
        title={t('views.crm.brokers.delete')}
        maxWidth="lg"
        variant="glass"
        footer={
          <div className="flex justify-end gap-3 w-full">
            <Button type="button" variant="outline" onClick={closeDeleteBroker}>
              {t('views.crm.brokers.cancel')}
            </Button>
            <Button
              type="button"
              className="bg-rose-600 hover:bg-rose-700"
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
        isOpen={isBrokerBlacklistOpen}
        onClose={closeBlacklistBroker}
        title={t('views.crm.table.blacklisted')}
        maxWidth="lg"
        variant="glass"
        footer={
          <div className="flex justify-end gap-3 w-full">
            <Button type="button" variant="outline" onClick={closeBlacklistBroker}>
              {t('views.crm.brokers.cancel')}
            </Button>
            <Button
              type="button"
              className="bg-rose-600 hover:bg-rose-700"
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
        variant="glass"
        footer={
          <div className="flex justify-end gap-3 w-full">
            <Button type="button" variant="outline" onClick={closeActivateBroker}>
              {t('views.crm.brokers.cancel')}
            </Button>
            <Button
              type="button"
              className="bg-emerald-600 hover:bg-emerald-700"
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
        variant="glass"
        footer={
          <div className="flex justify-end gap-3 w-full">
            <Button type="button" variant="outline" onClick={closeActivateTenant}>
              {t('views.crm.brokers.cancel')}
            </Button>
            <Button
              type="button"
              className="bg-emerald-600 hover:bg-emerald-700"
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
        variant="glass"
        footer={
          <div className="flex justify-end gap-3 w-full">
            <Button type="button" variant="outline" onClick={closeForm}>
              {t('views.crm.tenantModal.cancel')}
            </Button>
            <Button type="button" className="bg-indigo-600 hover:bg-indigo-700" onClick={() => void handleSaveTenant()}>
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
        variant="glass"
        footer={
          <div className="flex justify-end gap-3 w-full">
            <Button type="button" variant="outline" onClick={closeLandlordForm}>
              Cancel
            </Button>
            <Button type="button" className="bg-indigo-600 hover:bg-indigo-700" onClick={() => void handleSaveLandlord()}>
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
        variant="glass"
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
              className="h-11 min-w-[100px] rounded-xl bg-indigo-600 hover:bg-indigo-700"
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
        variant="glass"
        footer={
          <div className="flex flex-col sm:flex-row sm:items-center justify-end gap-3 w-full">
            {selectedBlacklist?.entityType === 'tenant' && selectedBlacklist.tenantId ? (
              <Button type="button" className="sm:mr-auto bg-indigo-600 hover:bg-indigo-700" onClick={openTenantFromBlacklist}>
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

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          <Input
            placeholder={t('views.crm.searchPlaceholder')}
            className="h-10 rounded-xl pl-10 pr-4 border border-slate-200 bg-white shadow-sm hover:border-slate-300 focus:border-indigo-300 focus-visible:ring-2 focus-visible:ring-indigo-100 transition-all text-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full max-w-2xl grid-cols-4 mb-6">
          <TabsTrigger value="tenants">{t('views.crm.tabs.tenants')}</TabsTrigger>
          <TabsTrigger value="landlords">Landlords</TabsTrigger>
          <TabsTrigger value="brokers">{t('views.crm.tabs.brokers')}</TabsTrigger>
          <TabsTrigger value="blacklist">{t('views.crm.tabs.blacklist')}</TabsTrigger>
        </TabsList>

        <TabsContent value="tenants" className="space-y-6">
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
            />
          )}
        </TabsContent>

        <TabsContent value="landlords" className="space-y-6">
          {landlordsLoading ? (
            <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden p-6 md:p-8">
              <SkeletonTable rows={6} columns={4} />
            </div>
          ) : (
            <DataTable data={filteredLandlords} columns={landlordColumns} keyExtractor={(l) => l.id} />
          )}
        </TabsContent>

        <TabsContent value="brokers" className="space-y-6">
          {brokersLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[0, 1, 2].map((i) => (
                <div key={i} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm animate-pulse">
                  <div className="h-12 w-12 rounded-lg bg-slate-100 mb-4" />
                  <div className="h-5 w-2/3 bg-slate-100 rounded mb-2" />
                  <div className="h-3 w-1/2 bg-slate-100 rounded mb-6" />
                  <div className="h-4 w-full bg-slate-100 rounded mb-2" />
                  <div className="h-4 w-5/6 bg-slate-100 rounded mb-4" />
                  <div className="h-9 w-full bg-slate-100 rounded" />
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredBrokers.map((agency) => {
                const isBrokerBl =
                  Boolean(agency.isBlacklisted) ||
                  blacklistList.some((r) => r.entityType === 'broker' && r.partnerAgencyId === agency.id);
                return (
                <div
                  key={agency.id}
                  className="group rounded-2xl border border-slate-200/80 bg-white shadow-sm hover:shadow-lg transition-all duration-200 overflow-hidden"
                >
                  {/* Header */}
                  <div className="px-5 pt-5 pb-4">
                    <div className="flex items-start gap-3.5">
                      <div className="h-11 w-11 shrink-0 rounded-xl bg-gradient-to-br from-slate-100 to-slate-50 border border-slate-200/60 flex items-center justify-center text-slate-600 font-semibold text-base">
                        {(agency.name || '?').charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-bold text-slate-900 truncate">{agency.name}</h3>
                          {(canUpdate || canDelete) ? (
                            <DropdownMenu>
                              <DropdownMenuTrigger
                                render={
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 ml-auto shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                    onClick={(e) => e.stopPropagation()}
                                  />
                                }
                              >
                                <MoreVertical className="w-3.5 h-3.5" />
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
                          ) : null}
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5 truncate">{agency.contactPerson || '—'}</p>
                        {/* Status indicators */}
                        <div className="flex items-center gap-3 mt-2">
                          {isBrokerBl ? (
                            <span className="flex items-center gap-1.5 text-[11px] text-rose-600 font-medium">
                              <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                              {t('views.crm.table.blacklisted')}
                            </span>
                          ) : (
                            <>
                              <span className={cn(
                                'flex items-center gap-1.5 text-[11px] font-medium',
                                agency.kycVerified ? 'text-emerald-600' : 'text-amber-600',
                              )}>
                                <span className={cn('h-1.5 w-1.5 rounded-full', agency.kycVerified ? 'bg-emerald-500' : 'bg-amber-500')} />
                                {agency.kycVerified ? t('views.crm.table.verified') : t('views.crm.table.verificationPending')}
                              </span>
                              <span className={cn(
                                'flex items-center gap-1.5 text-[11px] font-medium',
                                agency.active !== false ? 'text-slate-600' : 'text-slate-400',
                              )}>
                                <span className={cn('h-1.5 w-1.5 rounded-full', agency.active !== false ? 'bg-slate-500' : 'bg-slate-300')} />
                                {agency.active !== false ? t('views.crm.table.active') : t('views.crm.table.inactive')}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Details */}
                  <div className="px-5 pb-4 space-y-2">
                    <div className="border-t border-slate-100 pt-3 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-400 font-medium">{t('views.crm.brokers.phone')}</span>
                        <span className="text-slate-700 font-medium tabular-nums">{agency.phone || '—'}</span>
                      </div>
                      {agency.email ? (
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-400 font-medium">{t('views.crm.brokers.emailShort')}</span>
                          <span className="text-slate-700 font-medium break-all text-right">{agency.email}</span>
                        </div>
                      ) : null}
                      {agency.nationality ? (
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-400 font-medium">Nationality</span>
                          <span className="text-slate-700 font-medium">{agency.nationality}</span>
                        </div>
                      ) : null}
                      {agency.documentType ? (
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-400 font-medium">Document</span>
                          <span className="text-slate-700 font-medium">{agency.documentType}{agency.documentNo ? ` • ${agency.documentNo}` : ''}</span>
                        </div>
                      ) : null}
                      {agency.expiryDate ? (
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-400 font-medium">Expiry</span>
                          <span className="text-slate-700 font-medium tabular-nums">{agency.expiryDate}</span>
                        </div>
                      ) : null}
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="px-5 py-3 bg-slate-50/80 border-t border-slate-100">
                    <Button type="button" variant="ghost" size="sm" className="w-full h-7 text-xs font-medium text-slate-500 hover:text-slate-900" onClick={handleViewBrokerLogs}>
                      {t('views.crm.brokers.viewLogs')}
                    </Button>
                  </div>
                </div>
                );
              })}
            </div>
          )}
        </TabsContent>
        <TabsContent value="blacklist" className="space-y-6">
          <Card className="gap-0 overflow-hidden rounded-xl border border-rose-100/80 py-0 shadow-sm">
            <CardHeader className="bg-rose-50/50 border-b border-rose-100 px-6 py-4">
              <CardTitle className="text-rose-900 flex items-center gap-2">
                <ShieldAlert className="w-5 h-5" />
                {t('views.crm.blacklist.title')}
              </CardTitle>
              <CardDescription className="text-rose-700/70">{t('views.crm.blacklist.description')}</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="flex flex-wrap items-center gap-2 px-6 py-4 border-b border-rose-100 bg-white">
                <Button
                  type="button"
                  variant={blacklistTypeFilter === 'all' ? 'default' : 'outline'}
                  size="sm"
                  className={cn(
                    'h-8',
                    blacklistTypeFilter === 'all'
                      ? 'bg-rose-600 hover:bg-rose-700'
                      : 'border-rose-200 text-rose-700 hover:bg-rose-50',
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
                    'h-8',
                    blacklistTypeFilter === 'tenant'
                      ? 'bg-rose-600 hover:bg-rose-700'
                      : 'border-rose-200 text-rose-700 hover:bg-rose-50',
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
                    'h-8',
                    blacklistTypeFilter === 'broker'
                      ? 'bg-rose-600 hover:bg-rose-700'
                      : 'border-rose-200 text-rose-700 hover:bg-rose-50',
                  )}
                  onClick={() => setBlacklistTypeFilter('broker')}
                >
                  {t('views.crm.blacklist.broker')}
                </Button>
              </div>
              {crmLoading || blacklistLoading ? (
                <div className="p-6">
                  <SkeletonTable rows={5} columns={5} showToolbar={false} />
                </div>
              ) : (
                <DataTable
                  data={filteredBlacklist}
                  columns={blacklistColumns}
                  keyExtractor={(row) => row.id}
                  highlightFirstColumn={false}
                  embedded
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
