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
  ShieldCheck,
  History,
  ExternalLink,
  CheckCircle2,
  Upload,
  Loader2,
  Copy,
  Pencil,
  Trash2,
} from 'lucide-react';
import { Button, buttonVariants, modalDangerButtonClass, modalDismissButtonClass, modalPrimaryButtonClass, modalSuccessButtonClass } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { StatusBadge } from '@/components/status-badge';
import { contractStatusVariant } from '@/lib/statusBadge';
import { Label } from '@/components/ui/label';
import { DataTable } from '@/components/data-table';
import type { ColumnDef } from '@/components/data-table';
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
import { TenantHistoryModal } from '@/components/tenants/TenantHistoryModal';
import { Select2 } from '@/components/select2';
import {
  createTenant,
  deleteTenant,
  fetchTenants,
  fetchTenantLeaseContract,
  scanTenantIdPhoto,
  uploadTenantKycDocument,
  uploadTenantLeaseContract,
  updateTenant,
  type TenantWriteBody,
} from '@/lib/tenantsApi';
import { LandlordsPanel } from '@/components/landlords/LandlordsPanel';
import { BrokersPanel } from '@/components/brokers/BrokersPanel';
import { BlacklistPanel } from '@/components/blacklist/BlacklistPanel';
import { removeTenantFromBlacklist } from '@/lib/blacklistApi';
import { fetchContracts } from '@/lib/contractsApi';
import { fetchUnits } from '@/lib/unitsApi';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import { useTranslation } from 'react-i18next';
import type { Contract, Tenant, Unit } from '@/types';
import {
  differenceInCalendarDays,
  format,
  formatDistanceToNow,
  isValid,
  parseISO,
  startOfDay,
} from 'date-fns';
import { DatePicker as AppDatePicker } from '@/components/DatePicker';

const CRM_TABLE_ACTION_BTN =
  'h-8 w-8 rounded-lg border-transparent bg-white text-slate-700 shadow-sm hover:border-transparent hover:bg-slate-50 dark:border-transparent dark:bg-slate-900 dark:text-slate-300 dark:hover:border-transparent dark:hover:bg-slate-800 [&_svg]:translate-y-0.5';

const CRM_TABLE_ID_CELL = 'font-mono text-xs text-slate-500 uppercase dark:text-slate-400';
const CRM_TABLE_NAME_CELL = 'block min-w-[7rem] font-medium text-slate-700 dark:text-slate-200';
const CRM_TABLE_TEXT_CELL = 'text-sm text-slate-600 dark:text-slate-300';
const CRM_TABLE_UNIT_CELL = 'block min-w-[5rem] font-semibold text-slate-900 dark:text-slate-100';

function parseCrmDateTime(value?: string): Date | null {
  if (!value?.trim()) return null;
  const normalized = value.trim().includes('T') ? value.trim() : value.trim().replace(' ', 'T');
  const d = new Date(normalized);
  return Number.isNaN(d.getTime()) ? null : d;
}

function renderCrmDateTimeCell(value?: string) {
  const dt = parseCrmDateTime(value);
  return dt ? (
    <div className="flex min-w-[8rem] flex-col gap-0.5">
      <span className="whitespace-nowrap text-sm text-slate-600 dark:text-slate-300">{format(dt, 'MMM dd, yyyy')}</span>
      <span className="whitespace-nowrap text-xs text-slate-500">{format(dt, 'h:mm a')}</span>
    </div>
  ) : (
    <span className="text-sm text-slate-400">â€”</span>
  );
}

function formatCrmDateTimeLabel(value?: string) {
  const dt = parseCrmDateTime(value);
  return dt ? format(dt, 'MMM dd, yyyy Â· h:mm a') : 'â€”';
}

const CRM_FORM_INPUT =
  'h-12 rounded-xl border border-slate-200 bg-white shadow-sm focus-visible:border-indigo-500 focus-visible:ring-indigo-500/20 dark:border-slate-600 dark:bg-slate-950/80';

const CRM_FORM_DATEPICKER =
  'unit-form-datepicker-input h-12 !rounded-xl border border-slate-200 bg-white text-sm shadow-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-600 dark:bg-slate-950/80';

const CRM_SELECT_CLASS = '[&_.unit-form-select-control]:!min-h-12';
const CRM_TENANT_INPUT =
  'h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm shadow-sm focus-visible:border-indigo-500 focus-visible:ring-indigo-500/20 dark:border-slate-600 dark:bg-slate-950/80';
const CRM_TENANT_DATEPICKER =
  'unit-form-datepicker-input h-9 !rounded-lg border border-slate-200 bg-white text-sm shadow-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-600 dark:bg-slate-950/80';
const CRM_TENANT_SELECT_CLASS = '[&_.unit-form-select-control]:!min-h-9 [&_.unit-form-select-control]:!h-9';

const CRM_TAB_TRIGGER =
  '!flex-none gap-1.5 whitespace-nowrap rounded-md border-0 px-2.5 py-0 text-xs font-medium text-slate-600 shadow-none transition-all data-[active]:bg-white data-[active]:font-semibold data-[active]:text-slate-900 data-[active]:shadow-none dark:text-slate-400 dark:data-[active]:bg-slate-950 dark:data-[active]:text-white';

function TenantFormSection({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-indigo-100/70 bg-white p-3 dark:border-indigo-500/20 dark:bg-slate-950/80">
      <h3 className="mb-2.5 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.12em] text-indigo-600 dark:text-indigo-300">
        <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-300">
          <Icon className="h-3.5 w-3.5" aria-hidden />
        </span>
        {title}
      </h3>
      {children}
    </section>
  );
}

function TenantFormField({
  label,
  children,
  className,
  span = 1,
}: {
  label: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  span?: 1 | 2;
}) {
  return (
    <div className={cn('min-w-0 space-y-1', span === 2 && 'sm:col-span-2', className)}>
      <label className="block text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
        {label}
      </label>
      {children}
    </div>
  );
}

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
  if (!code) return 'â€”';
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
  const [tenantList, setTenantList] = useState<Tenant[]>([]);
  const [contractList, setContractList] = useState<Contract[]>([]);
  const [unitList, setUnitList] = useState<Unit[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<string | number | null>('tenants');

  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);

  const idUploadRef = useRef<HTMLInputElement | null>(null);
  const [idUploading, setIdUploading] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
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

  const [isTenantActivateOpen, setIsTenantActivateOpen] = useState(false);
  const [pendingActivateTenant, setPendingActivateTenant] = useState<Tenant | null>(null);
  const [isTenantHistoryOpen, setIsTenantHistoryOpen] = useState(false);
  const [tenantHistoryTarget, setTenantHistoryTarget] = useState<Tenant | null>(null);

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

  const filteredTenants = useMemo(() => {
    const q = searchTerm.toLowerCase().trim();
    if (!q) return tenantList;
    return tenantList.filter(
      (tenant) =>
        tenant.name.toLowerCase().includes(q) ||
        tenant.email.toLowerCase().includes(q) ||
        tenant.phone.includes(q) ||
        tenant.idNumber?.toLowerCase().includes(q),
    );
  }, [searchTerm, tenantList]);

  const idTypeOptions = useMemo(
    () => ID_TYPES.map((x) => ({ value: x, label: x })),
    [],
  );
  const nationalityOptions = useMemo(
    () => NATIONALITIES_ALPHA3.map((x) => ({ value: x.code, label: `${x.label} (${x.code})` })),
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

  const isLikelyPdfPath = (p: string) => /\.pdf$/i.test(p.split('?')[0] || '');

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
    setIsScanning(false);
    setPendingLeaseFile(null);
    setPendingLeaseName('');
    setPendingLeasePreviewUrl('');
    setExistingLeaseContractUrl('');
  };

  const openTenantHistory = (tenant: Tenant) => {
    setTenantHistoryTarget(tenant);
    setIsTenantHistoryOpen(true);
  };

  const closeTenantHistory = () => {
    setIsTenantHistoryOpen(false);
    setTenantHistoryTarget(null);
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
    if (!(canCreate || canUpdate) || idUploading || isScanning) return;
    idUploadRef.current?.click();
  };

  const handleDropIdImage: React.DragEventHandler<HTMLButtonElement> = async (e) => {
    e.preventDefault();
    if (!(canCreate || canUpdate) || idUploading || isScanning) return;
    const picked = e.dataTransfer.files?.[0];
    if (!picked) return;
    await processPickedIdImage(picked);
  };

  const applyScanToForm = useCallback(
    (data: {
      name?: string;
      email?: string;
      phone?: string;
      nationality?: string;
      birthDate?: string;
      idType?: string;
      idNumber?: string;
      idExpiry?: string;
    }) => {
      setForm((prev) => ({
        ...prev,
        name: data.name || prev.name,
        email: data.email || prev.email,
        phone: data.phone || prev.phone,
        nationality: data.nationality || prev.nationality,
        birthDate: data.birthDate || prev.birthDate,
        idType: data.idType || prev.idType,
        idNumber: data.idNumber || prev.idNumber,
        idExpiry: data.idExpiry || prev.idExpiry,
      }));
    },
    [],
  );

  const scanErrorMessage = useCallback(
    (err: unknown) => {
      if (err && typeof err === 'object' && 'code' in err && (err as { code?: string }).code === 'SCANNER_NOT_CONFIGURED') {
        return t('views.crm.tenantModal.scanNotConfigured');
      }
      if (err instanceof Error && err.message.trim()) return err.message;
      return t('views.crm.tenantModal.scanFailed');
    },
    [t],
  );

  const processPickedIdImage = async (picked: File) => {
    if (!picked) return;

    setIsScanning(true);
    setPendingIdImageName(picked.name);

    try {
      let scanError: string | null = null;
      const [scanResult, webp] = await Promise.all([
        scanTenantIdPhoto(picked).catch((err) => {
          scanError = scanErrorMessage(err);
          return null;
        }),
        toWebpIfNeeded(picked),
      ]);

      setPendingIdImage(webp);
      setPendingIdImageName(webp.name);

      if (scanResult?.data) {
        applyScanToForm(scanResult.data);
        toast.success(t('views.crm.tenantModal.scanSuccess'));
      } else if (scanError) {
        toast.warning(scanError);
      } else {
        toast.success(t('views.crm.tenantModal.idImageReady'));
      }
    } catch (err) {
      toast.error(scanErrorMessage(err));
      setPendingIdImage(null);
      setPendingIdImageName('');
      setPendingIdPreviewUrl('');
    } finally {
      setIsScanning(false);
    }
  };

  const handleRescanId = async () => {
    if (!(canCreate || canUpdate) || idUploading || isScanning) return;

    setIsScanning(true);
    try {
      let file: File | null = pendingIdImage;
      if (!file && existingTenantIdImageUrl) {
        const res = await fetch(resolveUploadUrl(existingTenantIdImageUrl));
        if (!res.ok) throw new Error(t('views.crm.tenantModal.scanFailed'));
        const blob = await res.blob();
        const name = pendingIdImageName || existingTenantIdImageUrl.split('/').pop() || 'id.webp';
        file = new File([blob], name, { type: blob.type || 'image/webp' });
      }
      if (!file) {
        toast.warning(t('views.crm.tenantModal.rescanNoImage'));
        return;
      }

      const scanResult = await scanTenantIdPhoto(file);
      if (scanResult?.data) {
        applyScanToForm(scanResult.data);
        toast.success(t('views.crm.tenantModal.scanSuccess'));
      } else {
        toast.warning(t('views.crm.tenantModal.scanFailed'));
      }
    } catch (err) {
      toast.warning(scanErrorMessage(err));
    } finally {
      setIsScanning(false);
    }
  };

  const handlePickIdImage: React.ChangeEventHandler<HTMLInputElement> = async (e) => {
    const picked = e.target.files?.[0];
    e.target.value = '';
    if (picked) await processPickedIdImage(picked);
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
        id: 'createdAt',
        header: t('views.crm.table.dateTime'),
        sortable: true,
        sortValue: (tenant) => tenant.createdAt ?? '',
        render: (tenant) => renderCrmDateTimeCell(tenant.createdAt),
      },
      {
        id: 'idNumber',
        header: t('views.crm.table.idNumber'),
        sortable: true,
        sortValue: (tenant) => tenant.idNumber,
        render: (tenant) => (
          <span className={CRM_TABLE_ID_CELL}>{tenant.idNumber || 'â€”'}</span>
        ),
      },
      {
        id: 'tenant',
        header: t('views.crm.table.tenant'),
        sortable: true,
        sortValue: (tenant) => tenant.name,
        render: (tenant) => (
          <span className={CRM_TABLE_NAME_CELL}>{tenant.name}</span>
        ),
      },
      {
        id: 'contact',
        header: t('views.crm.table.contactInfo'),
        sortable: true,
        sortValue: (tenant) => tenant.email,
        render: (tenant) => (
          <div className="flex min-w-[10rem] flex-col gap-0.5">
            <span className={CRM_TABLE_TEXT_CELL}>{tenant.email}</span>
            <span className={cn(CRM_TABLE_TEXT_CELL, 'whitespace-nowrap')}>{tenant.phone}</span>
          </div>
        ),
      },
      {
        id: 'kyc',
        header: t('views.crm.table.kycStatus'),
        sortable: true,
        sortValue: (tenant) => (tenant.kycVerified !== false ? 'verified' : 'pending'),
        render: (tenant) =>
          tenant.kycVerified !== false ? (
            <StatusBadge tone="success">{t('views.crm.table.verified')}</StatusBadge>
          ) : (
            <StatusBadge tone="warning">{t('views.crm.table.kycPending')}</StatusBadge>
          ),
      },
      {
        id: 'unit',
        header: t('views.crm.table.currentUnit'),
        sortable: true,
        sortValue: (tenant) => {
          const activeContract = contractList.find(
            (c) => c.tenantId === tenant.id && String(c.status).toLowerCase() === 'active',
          );
          const unit = activeContract ? unitList.find((u) => u.id === activeContract.unitId) : null;
          return unit?.unitNumber ?? '';
        },
        render: (tenant) => {
          const activeContract = contractList.find(
            (c) => c.tenantId === tenant.id && String(c.status).toLowerCase() === 'active',
          );
          const unit = activeContract ? unitList.find((u) => u.id === activeContract.unitId) : null;
          return unit ? (
            <div className="flex min-w-[5rem] flex-col">
              <span className={CRM_TABLE_UNIT_CELL}>
                {t('views.crm.table.unitLabel', { unitNumber: unit.unitNumber })}
              </span>
              <span className="text-xs text-slate-500">{unit.buildingName}</span>
            </div>
          ) : (
            <span className="text-sm italic text-slate-400">{t('views.crm.table.noActiveLease')}</span>
          );
        },
      },
      {
        id: 'status',
        header: t('views.crm.table.status'),
        sortable: true,
        sortValue: (tenant) => (tenant.isBlacklisted ? 'blacklisted' : 'active'),
        render: (tenant) =>
          tenant.isBlacklisted ? (
            <StatusBadge tone="danger">{t('views.crm.table.blacklisted')}</StatusBadge>
          ) : (
            <StatusBadge tone="success">{t('views.crm.table.active')}</StatusBadge>
          ),
      },
      {
        id: 'actions',
        header: t('views.crm.table.actions'),
        className: 'text-center',
        headerClassName: 'text-center',
        cellClassName: 'text-center',
        render: (tenant) => (
          <div
            className="flex items-center justify-center gap-1"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
            role="presentation"
          >
            {canUpdate ? (
              <Button
                type="button"
                variant="outline"
                size="icon"
                title={t('views.crm.table.editTenant')}
                className={CRM_TABLE_ACTION_BTN}
                onClick={(e) => {
                  e.stopPropagation();
                  openEdit(tenant);
                }}
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            ) : null}
            {canUpdate && tenant.isBlacklisted ? (
              <Button
                type="button"
                variant="outline"
                size="icon"
                title={t('views.crm.table.activateTenant')}
                aria-label={t('views.crm.table.activateTenant')}
                className={CRM_TABLE_ACTION_BTN}
                onClick={(e) => {
                  e.stopPropagation();
                  openActivateTenant(tenant);
                }}
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
              </Button>
            ) : null}
            <Button
              type="button"
              variant="outline"
              size="icon"
              title={t('views.crm.table.viewPortal')}
              aria-label={t('views.crm.table.viewPortal')}
              className={CRM_TABLE_ACTION_BTN}
              onClick={(e) => {
                e.stopPropagation();
                try {
                  localStorage.setItem('realstate_portal_tenant_id', String(tenant.id));
                } catch {
                  // ignore
                }
                const url = `${window.location.origin}/portal?tenantId=${encodeURIComponent(tenant.id)}`;
                window.open(url, '_blank');
              }}
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              title={t('views.crm.table.history')}
              aria-label={t('views.crm.table.history')}
              className={CRM_TABLE_ACTION_BTN}
              onClick={(e) => {
                e.stopPropagation();
                openTenantHistory(tenant);
              }}
            >
              <History className="h-3.5 w-3.5" />
            </Button>
            {canDelete ? (
              <Button
                type="button"
                variant="outline"
                size="icon"
                title={t('views.crm.table.deleteTenant')}
                className={CRM_TABLE_ACTION_BTN}
                onClick={(e) => {
                  e.stopPropagation();
                  void handleDeleteTenant(tenant);
                }}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            ) : null}
          </div>
        ),
      },
    ],
    [t, canUpdate, canDelete, openEdit, openActivateTenant, openTenantHistory, handleDeleteTenant, contractList, unitList],
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">{t('views.crm.title')}</h1>
        <p className="mt-1 text-slate-500 dark:text-slate-400">{t('views.crm.subtitle')}</p>
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
                createdAt: selectedTenant.createdAt,
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
            sizeLabel: 'â€”',
            kind: 'pdf',
            onPreview: tenantLeaseContext.contract
              ? () => {
                  const url = `${window.location.origin}/preview?type=contract&id=${tenantLeaseContext.contract?.id}`;
                  window.open(url, '_blank', 'noopener,noreferrer');
                }
              : undefined,
            onDownload: tenantLeaseContext.contract
              ? () => {
                  const url = `${window.location.origin}/preview?type=contract&id=${tenantLeaseContext.contract?.id}`;
                  window.open(url, '_blank', 'noopener,noreferrer');
                }
              : undefined,
          },
          {
            id: 'tenant-id',
            name: t('views.crm.details.documentTenantIdJpg'),
            fileType: 'WEBP',
            sizeLabel: 'â€”',
            kind: 'image',
            onPreview: selectedTenant?.idImageUrl
              ? () => window.open(resolveUploadUrl(selectedTenant.idImageUrl ?? ''), '_blank', 'noopener,noreferrer')
              : undefined,
            onDownload: selectedTenant?.idImageUrl
              ? () => window.open(resolveUploadUrl(selectedTenant.idImageUrl ?? ''), '_blank', 'noopener,noreferrer')
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

      <TenantHistoryModal
        isOpen={isTenantHistoryOpen}
        onClose={closeTenantHistory}
        tenant={tenantHistoryTarget}
        contracts={contractList}
        units={unitList}
        onEditTenant={
          canUpdate && tenantHistoryTarget
            ? () => {
                const target = tenantHistoryTarget;
                closeTenantHistory();
                openEdit(target);
              }
            : undefined
        }
      />

      <Modal
        isOpen={isTenantActivateOpen}
        onClose={closeActivateTenant}
        title={t('views.crm.table.activateTenantTitle')}
        maxWidth="lg"
        variant="glass"
        footer={
          <div className="flex justify-end gap-3 w-full">
            <Button type="button" className={modalDismissButtonClass} onClick={closeActivateTenant}>
              {t('views.crm.brokers.cancel')}
            </Button>
            <Button
              type="button"
              className={modalSuccessButtonClass}
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
        subtitle={t('views.crm.tenantModal.description')}
        maxWidth="4xl"
        variant="glass"
        compact
        shellClassName="crm-form-modal-shell"
        footer={
          <div className="flex justify-end gap-3 w-full">
            <Button type="button" className={modalDismissButtonClass} onClick={closeForm}>
              {t('views.crm.tenantModal.cancel')}
            </Button>
            <Button type="button" className={modalPrimaryButtonClass} onClick={() => void handleSaveTenant()}>
              {t('views.crm.tenantModal.save')}
            </Button>
          </div>
        }
      >
        <div className="tenant-form-modal unit-form-fields max-h-[min(68vh,36rem)] space-y-3 overflow-y-auto pr-1">
          {(canCreate || canUpdate) ? (
            <TenantFormSection title={t('views.crm.tenantModal.idPhotoLabel')} icon={Upload}>
              <input
                ref={idUploadRef}
                type="file"
                accept="image/webp,image/*"
                className="hidden"
                onChange={handlePickIdImage}
                disabled={isScanning || idUploading}
              />
              {!pendingIdPreviewUrl && !existingTenantIdImageUrl ? (
                <button
                  type="button"
                  onClick={handlePickIdUpload}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleDropIdImage}
                  disabled={idUploading || isScanning}
                  className={cn(
                    'relative flex min-h-28 w-full flex-col items-center justify-center overflow-hidden rounded-xl border border-dashed border-indigo-300/80 bg-gradient-to-br from-indigo-50/70 via-white to-violet-50/80 px-4 py-5 text-center shadow-sm transition-all',
                    'hover:border-indigo-400 hover:shadow-md focus:outline-none focus:ring-4 focus:ring-indigo-500/15',
                    'dark:border-indigo-500/40 dark:from-indigo-950/25 dark:via-slate-950 dark:to-violet-950/25',
                    (isScanning || idUploading) && 'cursor-wait',
                  )}
                >
                  <span className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-white text-indigo-600 shadow-sm ring-1 ring-indigo-100 dark:bg-slate-900 dark:text-indigo-300 dark:ring-indigo-500/30">
                    {isScanning ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : <Upload className="h-5 w-5" aria-hidden />}
                  </span>
                  <span className="text-sm font-semibold text-slate-900 dark:text-slate-50">
                    {isScanning ? t('views.crm.tenantModal.scanning') : t('views.crm.tenantModal.choosePhoto')}
                  </span>
                  <span className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    {t('views.crm.tenantModal.idPhotoHint')}
                  </span>
                </button>
              ) : (
                <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-700 dark:bg-slate-950/80">
                  {isScanning ? (
                    <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/70 dark:bg-slate-950/70">
                      <Loader2 className="h-5 w-5 animate-spin text-indigo-600 dark:text-indigo-300" aria-hidden />
                    </div>
                  ) : null}
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      className="shrink-0"
                      onClick={() =>
                        window.open(pendingIdPreviewUrl || resolveUploadUrl(existingTenantIdImageUrl), '_blank')
                      }
                      title="Open full image"
                    >
                      <img
                        src={pendingIdPreviewUrl || resolveUploadUrl(existingTenantIdImageUrl)}
                        alt="Selected tenant ID"
                        className="h-16 w-28 rounded-lg border border-slate-200 bg-slate-50 object-cover dark:border-slate-700"
                        loading="lazy"
                      />
                    </button>
                    <div className="min-w-0 flex-1">
                      {isScanning ? (
                        <div className="inline-flex items-center gap-1.5 text-xs text-slate-500">
                          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                          {t('views.crm.tenantModal.scanning')}
                        </div>
                      ) : (
                        <div className="text-xs text-slate-500">{t('views.crm.tenantModal.idPhotoHint')}</div>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <Button
                        type="button"
                        variant="outline"
                        className="h-8 px-2 text-xs"
                        onClick={() => void handleRescanId()}
                        disabled={idUploading || isScanning}
                      >
                        {isScanning ? (
                          <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" aria-hidden />
                        ) : null}
                        {t('views.crm.tenantModal.rescanPhoto')}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="h-8 px-2 text-xs"
                        onClick={handlePickIdUpload}
                        disabled={idUploading || isScanning}
                      >
                        {t('views.crm.tenantModal.replacePhoto')}
                      </Button>
                      {pendingIdImage ? (
                        <Button
                          type="button"
                          variant="ghost"
                          className="h-8 px-2 text-xs"
                          onClick={() => {
                            setPendingIdImage(null);
                            setPendingIdImageName('');
                            setPendingIdPreviewUrl('');
                          }}
                          disabled={idUploading || isScanning}
                        >
                          {t('views.crm.tenantModal.removePhoto')}
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </div>
              )}
            </TenantFormSection>
          ) : null}

          <TenantFormSection title="Basic Information" icon={Users}>
            <div className="grid gap-2 sm:grid-cols-2">
              <TenantFormField label={t('views.crm.tenantModal.name')} span={2}>
                <Input
                  id="crm-name"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className={CRM_TENANT_INPUT}
                />
              </TenantFormField>
              <TenantFormField label={t('views.crm.tenantModal.email')}>
                <Input
                  id="crm-email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  className={CRM_TENANT_INPUT}
                />
              </TenantFormField>
              <TenantFormField label={t('views.crm.tenantModal.phone')}>
                <Input
                  id="crm-phone"
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  className={CRM_TENANT_INPUT}
                />
              </TenantFormField>
              <TenantFormField label={t('views.crm.tenantModal.nationality')}>
                <Select2
                  options={nationalityOptions}
                  value={form.nationality}
                  borderless={false}
                  className={CRM_TENANT_SELECT_CLASS}
                  onChange={(v) => setForm((f) => ({ ...f, nationality: (v ?? '') as string }))}
                  placeholder="Select nationality"
                />
              </TenantFormField>
              <TenantFormField label={t('views.crm.tenantModal.birthDate')}>
                <AppDatePicker
                  mode="single"
                  placeholder="MM/DD/YYYY"
                  fullWidth
                  inputClassName={CRM_TENANT_DATEPICKER}
                  value={form.birthDate ? parseISO(form.birthDate) : null}
                  onChange={(picked) =>
                    setForm((f) => ({
                      ...f,
                      birthDate: picked instanceof Date ? format(picked, 'yyyy-MM-dd') : '',
                    }))
                  }
                />
              </TenantFormField>
            </div>
          </TenantFormSection>

          <TenantFormSection title="Identification (KYC)" icon={ShieldCheck}>
            <div className="grid gap-2 sm:grid-cols-2">
              <TenantFormField label={t('views.crm.tenantModal.idType')}>
                <Select2
                  options={idTypeOptions}
                  value={form.idType}
                  borderless={false}
                  className={CRM_TENANT_SELECT_CLASS}
                  onChange={(v) => setForm((f) => ({ ...f, idType: (v ?? 'Passport') as string }))}
                />
              </TenantFormField>
              <TenantFormField label={t('views.crm.tenantModal.idNumber')}>
                <Input
                  id="crm-id-number"
                  value={form.idNumber}
                  onChange={(e) => setForm((f) => ({ ...f, idNumber: e.target.value }))}
                  className={CRM_TENANT_INPUT}
                />
              </TenantFormField>
              <TenantFormField label={t('views.crm.tenantModal.idExpiry')} span={2}>
                <AppDatePicker
                  mode="single"
                  placeholder="MM/DD/YYYY"
                  fullWidth
                  inputClassName={CRM_TENANT_DATEPICKER}
                  value={form.idExpiry ? parseISO(form.idExpiry) : null}
                  onChange={(picked) =>
                    setForm((f) => ({
                      ...f,
                      idExpiry: picked instanceof Date ? format(picked, 'yyyy-MM-dd') : '',
                    }))
                  }
                />
              </TenantFormField>
              <div className="flex flex-wrap gap-4 sm:col-span-2">
                <label htmlFor="crm-kyc" className="flex cursor-pointer items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
                  <input
                    id="crm-kyc"
                    type="checkbox"
                    className="h-4 w-4 rounded border-slate-300 accent-indigo-600"
                    checked={form.kycVerified}
                    onChange={(e) => setForm((f) => ({ ...f, kycVerified: e.target.checked }))}
                  />
                  {t('views.crm.tenantModal.kycVerified')}
                </label>
                <label htmlFor="crm-bl" className="flex cursor-pointer items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
                  <input
                    id="crm-bl"
                    type="checkbox"
                    className="h-4 w-4 rounded border-slate-300 accent-indigo-600"
                    checked={form.isBlacklisted}
                    onChange={(e) => setForm((f) => ({ ...f, isBlacklisted: e.target.checked }))}
                  />
                  {t('views.crm.tenantModal.blacklisted')}
                </label>
              </div>
              {form.isBlacklisted ? (
                <TenantFormField label={t('views.crm.tenantModal.blacklistReason')} span={2}>
                  <Input
                    id="crm-bl-reason"
                    value={form.blacklistReason}
                    onChange={(e) => setForm((f) => ({ ...f, blacklistReason: e.target.value }))}
                    className={CRM_TENANT_INPUT}
                  />
                </TenantFormField>
              ) : null}
            </div>
          </TenantFormSection>

          {canUpdate ? (
            <TenantFormSection title="Documents" icon={Upload}>
              <TenantFormField label="Lease contract (PDF/Image)">
                  <div className="rounded-lg border border-slate-200 bg-white p-2.5 shadow-sm dark:border-slate-600 dark:bg-slate-950/80">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">{pendingLeaseName || 'No file selected'}</div>
                        <div className="text-xs text-slate-500">Saved as lease contract.</div>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <input
                          ref={leaseUploadRef}
                          type="file"
                          accept="application/pdf,image/*"
                          className="hidden"
                          onChange={handlePickLeaseFile}
                        />
                        <Button type="button" variant="outline" className="h-8 px-2 text-xs" onClick={handlePickLeaseUpload} disabled={leaseUploading}>
                          {leaseUploading ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden /> : <Upload className="mr-1.5 h-3.5 w-3.5" aria-hidden />}
                          File
                        </Button>
                        {pendingLeaseFile ? (
                          <Button
                            type="button"
                            variant="ghost"
                            className="h-8 px-2 text-xs"
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
                      <button type="button" className="mt-2 w-full" onClick={() => window.open(pendingLeasePreviewUrl, '_blank')} title="Open full image">
                        <img src={pendingLeasePreviewUrl} alt="Selected lease contract" className="max-h-36 w-full rounded-lg bg-slate-50 object-contain" loading="lazy" />
                      </button>
                    ) : existingLeaseContractUrl ? (
                      <div className="mt-2 rounded-lg bg-slate-50 p-2 dark:bg-slate-900/60">
                        {isLikelyPdfPath(existingLeaseContractUrl) ? (
                          <div className="flex items-center justify-between gap-3">
                            <div className="truncate text-sm text-slate-700 dark:text-slate-200">Lease contract</div>
                            <Button type="button" variant="outline" className="h-8 px-2 text-xs" onClick={() => window.open(resolveUploadUrl(existingLeaseContractUrl), '_blank')}>
                              Open PDF
                            </Button>
                          </div>
                        ) : (
                          <button type="button" className="w-full" onClick={() => window.open(resolveUploadUrl(existingLeaseContractUrl), '_blank')} title="Open full image">
                            <img src={resolveUploadUrl(existingLeaseContractUrl)} alt="Lease contract" className="max-h-36 w-full rounded-lg bg-white object-contain" loading="lazy" />
                          </button>
                        )}
                      </div>
                    ) : null}
                  </div>
                </TenantFormField>
            </TenantFormSection>
          ) : null}
        </div>
      </Modal>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="flex w-full flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <TabsList className="h-9 w-max max-w-full shrink-0 self-start gap-0.5 overflow-hidden rounded-lg border border-slate-200 bg-slate-100 p-0.5 dark:border-slate-700 dark:bg-slate-900 [&_[data-slot=tabs-trigger]]:flex-none [&_[data-slot=tabs-trigger]]:after:hidden">
            <TabsTrigger value="tenants" className={CRM_TAB_TRIGGER}>
              <Users className="size-3.5 shrink-0 opacity-90" aria-hidden />
              <span className="truncate">{t('views.crm.tabs.tenants')}</span>
            </TabsTrigger>
            <TabsTrigger value="landlords" className={CRM_TAB_TRIGGER}>
              <Home className="size-3.5 shrink-0 opacity-90" aria-hidden />
              <span className="truncate">{t('views.crm.tabs.landlords')}</span>
            </TabsTrigger>
            <TabsTrigger value="brokers" className={CRM_TAB_TRIGGER}>
              <Building2 className="size-3.5 shrink-0 opacity-90" aria-hidden />
              <span className="truncate">{t('views.crm.tabs.brokers')}</span>
            </TabsTrigger>
            <TabsTrigger value="blacklist" className={CRM_TAB_TRIGGER}>
              <Ban className="size-3.5 shrink-0 opacity-90" aria-hidden />
              <span className="truncate">{t('views.crm.tabs.blacklist')}</span>
            </TabsTrigger>
          </TabsList>

          {activeTab !== 'landlords' && activeTab !== 'brokers' && activeTab !== 'blacklist' ? (
            <div className="flex w-full flex-wrap items-center gap-2 lg:w-auto lg:justify-end">
              <div className="relative min-w-0 flex-1 sm:w-72 sm:flex-none">
                <Search className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                <Input
                  placeholder={t('views.crm.searchPlaceholder')}
                  className="h-9 rounded-xl border-transparent bg-white pl-9 pr-3 text-sm shadow-sm dark:border-transparent dark:bg-slate-950/80 dark:text-slate-100 dark:placeholder:text-slate-500"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              {canCreate && activeTab === 'tenants' ? (
                <Button type="button" className="h-9 shrink-0 rounded-xl bg-indigo-600 text-white shadow-sm hover:bg-indigo-700" onClick={openRegister}>
                  <Plus className="mr-2 h-4 w-4" />
                  {t('views.crm.registerTenant')}
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>

        <TabsContent value="tenants" className="mt-4 w-full outline-none">
          {crmLoading ? (
            <div className="overflow-hidden rounded-2xl bg-white p-6 shadow-sm dark:bg-slate-900 md:p-8">
              <SkeletonTable rows={6} columns={8} />
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

        <TabsContent value="landlords" className="mt-4 w-full outline-none">
          <LandlordsPanel
            canCreate={canCreate}
            canUpdate={canUpdate}
            canDelete={canDelete}
          />
        </TabsContent>

        <TabsContent value="brokers" className="mt-4 w-full outline-none">
          <BrokersPanel
            canCreate={canCreate}
            canUpdate={canUpdate}
            canDelete={canDelete}
          />
        </TabsContent>
        <TabsContent value="blacklist" className="mt-4 w-full outline-none">
          <BlacklistPanel canCreate={canCreate} canUpdate={canUpdate} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default CRMView;
