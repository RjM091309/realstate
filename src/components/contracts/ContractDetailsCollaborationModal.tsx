import React, { useEffect, useMemo, useState } from 'react';
import { MoreVertical, Pencil, Trash2, FileText, ExternalLink, ChevronRight } from 'lucide-react';
import { Modal } from '@/components/modal';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select2 } from '@/components/select2';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { DataTable, type ColumnDef } from '@/components/data-table';

export type CollaboratorRole = 'Owner' | 'Editor' | 'Viewer';

export type ContractDetailsSummary = {
  title: string;
  unitLabel: string;
  primaryTenantLabel: string;
  periodLabel: string;
  statusLabel: string;
};

export type Collaborator = {
  id: string;
  name: string;
  email: string;
  role: CollaboratorRole;
  dateAdded: string;
};

export type ActivityItem = {
  id: string;
  at: string;
  text: string;
};

export type CommentItem = {
  id: string;
  at: string;
  text: string;
};

export type DocTemplate = {
  id: string;
  templateKey: string;
  title: string;
  filePath: string;
  versionNo: number;
  createdAt: string;
};

export type RepoDoc = {
  id: string;
  docType: string;
  title: string;
  filePath: string;
  createdAt: string;
  portalVisible?: boolean;
  contractId?: string;
};

export type InventorySnapshotItem = {
  id: string;
  itemName: string;
  category: string;
  quantity: number;
  conditionState: string;
  notes: string;
};

export type InventorySnapshot = {
  id: string;
  snapshotType: 'move_in' | 'move_out' | 'routine';
  inspectionDate: string;
  remarks: string;
  items: InventorySnapshotItem[];
};

type TabKey = 'collaboration' | 'activity' | 'documents' | 'inventory' | 'notes';

const INVENTORY_CATEGORIES = [
  { value: 'furniture', label: 'Furniture', detail: 'Beds, sofa, tables, chairs, cabinets' },
  { value: 'appliances', label: 'Appliances', detail: 'Aircon, ref, microwave, washing machine' },
  { value: 'electronics', label: 'Electronics', detail: 'TV, router, CCTV, intercom' },
  { value: 'fixtures', label: 'Fixtures', detail: 'Lights, curtains/blinds, faucets, shower' },
  { value: 'kitchenware', label: 'Kitchenware', detail: 'Plates, cookware, utensils' },
  { value: 'keys_access', label: 'Keys/Access', detail: 'Door keys, RFID, gate/parking access' },
  { value: 'other', label: 'Other', detail: 'Anything not listed' },
] as const;

function inventoryCategoryLabel(value: string) {
  const v = String(value ?? '').trim();
  if (!v) return '';
  const hit = INVENTORY_CATEGORIES.find((x) => x.value === v);
  return hit ? hit.label : v;
}

function roleBadgeClass(role: CollaboratorRole) {
  if (role === 'Owner') return 'bg-indigo-100 text-indigo-700';
  if (role === 'Editor') return 'bg-emerald-100 text-emerald-700';
  return 'bg-slate-100 text-slate-700';
}

export function ContractSummaryCard({
  title,
  value,
  subValue,
}: {
  title: string;
  value: string;
  subValue?: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
      <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{title}</div>
      <div className="mt-1 text-sm font-semibold text-slate-900">{value || '—'}</div>
      {subValue ? <div className="mt-1 text-xs text-slate-500 break-all">{subValue}</div> : null}
    </div>
  );
}

export function TabsNavigation({
  tab,
  onChange,
}: {
  tab: TabKey;
  onChange: (t: TabKey) => void;
}) {
  const items: Array<{ value: TabKey; label: string }> = [
    { value: 'collaboration', label: 'Collaboration' },
    { value: 'activity', label: 'Activity' },
    { value: 'documents', label: 'Documents' },
    { value: 'inventory', label: 'Inventory' },
    { value: 'notes', label: 'Notes' },
  ];
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-2 max-w-xs">
      <Select2 options={items} value={tab} onChange={(v) => onChange(v as TabKey)} />
    </div>
  );
} 


export function CollaboratorList({
  collaborators,
  onRoleChange,
  onRemove,
}: {
  collaborators: Collaborator[];
  onRoleChange: (id: string, next: CollaboratorRole) => void;
  onRemove: (id: string) => void;
}) {
  const columns: ColumnDef<Collaborator>[] = useMemo(() => [
    {
      header: 'Collaborator',
      render: (c) => (
        <div>
          <div className="font-semibold text-slate-900 truncate">{c.name || '—'}</div>
          <div className="text-xs text-slate-500 break-all">{c.email || '—'}</div>
        </div>
      ),
    },
    {
      header: 'Role',
      render: (c) => (
        <Badge variant="outline" className={cn('border-0', roleBadgeClass(c.role))}>
          {c.role}
        </Badge>
      ),
    },
    {
      header: 'Added',
      render: (c) => <span className="text-xs text-slate-400">{c.dateAdded || '—'}</span>,
    },
    {
      header: 'Actions',
      render: (c) => (
        <div className="flex items-center gap-2">
          <select
            value={c.role}
            onChange={(e) => onRoleChange(c.id, e.target.value as CollaboratorRole)}
            className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-200"
          >
            <option value="Owner">Owner</option>
            <option value="Editor">Editor</option>
            <option value="Viewer">Viewer</option>
          </select>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={<Button type="button" variant="ghost" size="icon" className="h-8 w-8" />}
            >
              <MoreVertical className="h-4 w-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem className="text-rose-600" onClick={() => onRemove(c.id)}>
                Remove
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
    },
  ], [onRoleChange, onRemove]);

  return (
    <DataTable
      data={collaborators}
      columns={columns}
      keyExtractor={(c) => c.id}
      highlightFirstColumn={false}
      embedded
    />
  );
}

export function ActivityFeed({ items }: { items: ActivityItem[] }) {
  return (
    <div className="space-y-2">
      {items.length === 0 ? (
        <div className="rounded-2xl border border-slate-100 bg-white p-4 text-sm text-slate-500">
          No activity recorded.
        </div>
      ) : (
        items.map((it) => (
          <div key={it.id} className="rounded-2xl border border-slate-100 bg-white p-4">
            <div className="text-[11px] text-slate-400 mb-1">{it.at}</div>
            <div className="text-sm text-slate-700">{it.text}</div>
          </div>
        ))
      )}
    </div>
  );
}

export function CommentSection({
  comments,
  onAdd,
  onEdit,
  onDelete,
}: {
  comments: CommentItem[];
  onAdd: (text: string) => void;
  onEdit: (id: string, nextText: string) => void;
  onDelete: (id: string) => void;
}) {
  const [value, setValue] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState('');
  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-slate-100 bg-white p-4">
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <Label>Add a comment / note</Label>
            <Input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="mt-2 rounded-xl"
              placeholder="Type a note…"
            />
          </div>
          <Button
            type="button"
            className="bg-indigo-600 hover:bg-indigo-700"
            onClick={() => {
              const t = value.trim();
              if (!t) return;
              onAdd(t);
              setValue('');
            }}
          >
            Add
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        {comments.length === 0 ? (
          <div className="rounded-2xl border border-slate-100 bg-white p-4 text-sm text-slate-500">
            No notes yet.
          </div>
        ) : (
          comments.map((c) => (
            <div key={c.id} className="rounded-2xl border border-slate-100 bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[11px] text-slate-400">{c.at}</div>
                  {editingId === c.id ? (
                    <div className="mt-2 space-y-2">
                      <Input
                        value={editingValue}
                        onChange={(e) => setEditingValue(e.target.value)}
                        className="rounded-xl"
                      />
                      <div className="flex justify-end gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          className="h-8"
                          onClick={() => {
                            setEditingId(null);
                            setEditingValue('');
                          }}
                        >
                          Cancel
                        </Button>
                        <Button
                          type="button"
                          className="h-8 bg-indigo-600 hover:bg-indigo-700"
                          onClick={() => {
                            const next = editingValue.trim();
                            if (!next) return;
                            onEdit(c.id, next);
                            setEditingId(null);
                            setEditingValue('');
                          }}
                        >
                          Save
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-1 text-sm text-slate-700 whitespace-pre-wrap">{c.text}</div>
                  )}
                </div>

                {editingId !== c.id ? (
                  <div className="shrink-0 flex items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 text-slate-500 hover:text-indigo-600"
                      title="Edit"
                      onClick={() => {
                        setEditingId(c.id);
                        setEditingValue(c.text);
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 text-slate-500 hover:text-rose-600"
                      title="Delete"
                      onClick={() => onDelete(c.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ) : null}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export function ContractDetailsCollaborationModal({
  isOpen,
  onClose,
  summary,
  initialCollaborators,
  initialActivity,
  documents,
  templates,
  inventory,
  onAddSnapshot,
  onAddItem,
  onEditSnapshot,
  onDeleteSnapshot,
  onEditItem,
  onDeleteItem,
  onSendInvite,
  onUploadRepositoryDocument,
  onUploadTemplate,
  onGenerateInvoice,
}: {
  isOpen: boolean;
  onClose: () => void;
  summary: ContractDetailsSummary;
  initialCollaborators: Collaborator[];
  initialActivity: ActivityItem[];
  documents: RepoDoc[];
  templates: DocTemplate[];
  inventory: InventorySnapshot[];
  onAddSnapshot: (payload: { snapshotType: InventorySnapshot['snapshotType']; inspectionDate: string; remarks?: string }) => Promise<void>;
  onAddItem: (payload: {
    snapshotId: string;
    itemName: string;
    category?: string;
    quantity: number;
    conditionState: 'excellent' | 'good' | 'fair' | 'damaged' | 'missing';
    notes?: string;
  }) => Promise<void>;
  onEditSnapshot: (snapshotId: string, payload: { snapshotType: InventorySnapshot['snapshotType']; inspectionDate: string; remarks?: string }) => Promise<void>;
  onDeleteSnapshot: (snapshotId: string) => Promise<void>;
  onEditItem: (
    itemId: string,
    payload: {
      itemName: string;
      category?: string;
      quantity: number;
      conditionState: 'excellent' | 'good' | 'fair' | 'damaged' | 'missing';
      notes?: string;
    },
  ) => Promise<void>;
  onDeleteItem: (itemId: string) => Promise<void>;
  onSendInvite?: (payload: {
    name: string;
    email: string;
    commissionTerms?: string;
    remarks?: string;
  }) => Promise<void>;
  onUploadRepositoryDocument?: (payload: {
    file: File;
    docType: 'lease_contract' | 'invoice' | 'kyc' | 'receipt' | 'move_in_out' | 'other';
    title: string;
    portalVisible: boolean;
  }) => Promise<void>;
  onUploadTemplate?: (payload: { file: File; templateKey: string; title: string; isActive: boolean }) => Promise<void>;
  onGenerateInvoice?: () => Promise<void>;
}) {
  const [tab, setTab] = useState<TabKey>('collaboration');

  const [collaborators, setCollaborators] = useState<Collaborator[]>(initialCollaborators);
  const [activity, setActivity] = useState<ActivityItem[]>(initialActivity);
  const [comments, setComments] = useState<CommentItem[]>([]);

  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteName, setInviteName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteSaving, setInviteSaving] = useState(false);
  const [inviteCommissionTerms, setInviteCommissionTerms] = useState('');
  const [inviteRemarks, setInviteRemarks] = useState('');
  const [inviteCommissionMode, setInviteCommissionMode] = useState<'preset' | 'custom'>('preset');

  const [repoUploadOpen, setRepoUploadOpen] = useState(false);
  const [repoUploadFile, setRepoUploadFile] = useState<File | null>(null);
  const [repoUploadType, setRepoUploadType] = useState<
    'lease_contract' | 'invoice' | 'kyc' | 'receipt' | 'move_in_out' | 'other'
  >('other');
  const [repoUploadTitle, setRepoUploadTitle] = useState('');
  const [repoUploadPortalVisible, setRepoUploadPortalVisible] = useState(false);
  const [repoUploadSaving, setRepoUploadSaving] = useState(false);

  const [templateUploadOpen, setTemplateUploadOpen] = useState(false);
  const [templateUploadFile, setTemplateUploadFile] = useState<File | null>(null);
  const [templateKey, setTemplateKey] = useState('');
  const [templateTitle, setTemplateTitle] = useState('');
  const [templateActive, setTemplateActive] = useState(true);
  const [templateSaving, setTemplateSaving] = useState(false);
  const [invoiceSaving, setInvoiceSaving] = useState(false);

  const [addSnapshotOpen, setAddSnapshotOpen] = useState(false);
  const [snapType, setSnapType] = useState<InventorySnapshot['snapshotType']>('move_in');
  const [snapDate, setSnapDate] = useState('');
  const [snapRemarks, setSnapRemarks] = useState('');
  const [snapSaving, setSnapSaving] = useState(false);

  const [itemOpenFor, setItemOpenFor] = useState<string | null>(null);
  const [itemName, setItemName] = useState('');
  const [itemCategory, setItemCategory] = useState('');
  const [itemQty, setItemQty] = useState('1');
  const [itemCondition, setItemCondition] = useState<'excellent' | 'good' | 'fair' | 'damaged' | 'missing'>('good');
  const [itemNotes, setItemNotes] = useState('');
  const [itemSaving, setItemSaving] = useState(false);

  const [editSnapshotId, setEditSnapshotId] = useState<string | null>(null);
  const [editSnapType, setEditSnapType] = useState<InventorySnapshot['snapshotType']>('move_in');
  const [editSnapDate, setEditSnapDate] = useState('');
  const [editSnapRemarks, setEditSnapRemarks] = useState('');
  const [editSnapSaving, setEditSnapSaving] = useState(false);

  const [editItemId, setEditItemId] = useState<string | null>(null);
  const [editItemName, setEditItemName] = useState('');
  const [editItemCategory, setEditItemCategory] = useState('');
  const [editItemQty, setEditItemQty] = useState('1');
  const [editItemCondition, setEditItemCondition] = useState<'excellent' | 'good' | 'fair' | 'damaged' | 'missing'>('good');
  const [editItemNotes, setEditItemNotes] = useState('');
  const [editItemSaving, setEditItemSaving] = useState(false);

  const permissionsGuide = useMemo(
    () => [
      { role: 'Owner' as const, desc: 'Full access. Can manage roles and collaborators.' },
      { role: 'Editor' as const, desc: 'Can update details and add notes.' },
      { role: 'Viewer' as const, desc: 'Read-only access.' },
    ],
    [],
  );

  const commissionTermOptions = useMemo(
    () => [
      { value: '50/50', label: '50 / 50' },
      { value: '60/40', label: '60 / 40' },
      { value: '70/30', label: '70 / 30' },
      { value: '80/20', label: '80 / 20' },
      { value: '100% agency', label: '100% agency' },
      { value: '100% owner', label: '100% owner' },
      { value: 'custom', label: 'Custom…' },
    ],
    [],
  );

  const repoDocTypeOptions = useMemo(
    () => [
      { value: 'lease_contract', label: 'Lease contract' },
      { value: 'invoice', label: 'Invoice' },
      { value: 'receipt', label: 'Receipt' },
      { value: 'move_in_out', label: 'Move-in/out' },
      { value: 'kyc', label: 'KYC' },
      { value: 'other', label: 'Other' },
    ],
    [],
  );

  const submitRepoUpload = async () => {
    if (!onUploadRepositoryDocument) return;
    if (repoUploadSaving) return;
    if (!repoUploadFile) return;
    const title = repoUploadTitle.trim() || repoUploadFile.name;
    setRepoUploadSaving(true);
    try {
      await onUploadRepositoryDocument({
        file: repoUploadFile,
        docType: repoUploadType,
        title,
        portalVisible: repoUploadPortalVisible,
      });
      setRepoUploadFile(null);
      setRepoUploadType('other');
      setRepoUploadTitle('');
      setRepoUploadPortalVisible(false);
      setRepoUploadOpen(false);
    } finally {
      setRepoUploadSaving(false);
    }
  };

  const submitTemplateUpload = async () => {
    if (!onUploadTemplate) return;
    if (templateSaving) return;
    if (!templateUploadFile) return;
    const key = templateKey.trim();
    const title = templateTitle.trim() || templateUploadFile.name;
    if (!key) return;
    setTemplateSaving(true);
    try {
      await onUploadTemplate({ file: templateUploadFile, templateKey: key, title, isActive: templateActive });
      setTemplateUploadFile(null);
      setTemplateKey('');
      setTemplateTitle('');
      setTemplateActive(true);
      setTemplateUploadOpen(false);
    } finally {
      setTemplateSaving(false);
    }
  };

  const logActivity = (text: string) => {
    const now = new Date();
    const at = now.toLocaleString();
    setActivity((prev) => [{ id: `a-${now.getTime()}`, at, text }, ...prev]);
  };

  const handleRoleChange = (id: string, next: CollaboratorRole) => {
    setCollaborators((prev) =>
      prev.map((c) => (c.id === id ? { ...c, role: next } : c)),
    );
    logActivity(`Updated collaborator role to ${next}.`);
  };

  const handleRemove = (id: string) => {
    const who = collaborators.find((c) => c.id === id);
    setCollaborators((prev) => prev.filter((c) => c.id !== id));
    logActivity(`Removed collaborator ${who?.name || who?.email || id}.`);
  };

  const addComment = (text: string) => {
    const now = new Date();
    const at = now.toLocaleString();
    setComments((prev) => [{ id: `c-${now.getTime()}`, at, text }, ...prev]);
    logActivity('Added a note.');
  };

  const editComment = (id: string, nextText: string) => {
    setComments((prev) => prev.map((c) => (c.id === id ? { ...c, text: nextText } : c)));
    logActivity('Edited a note.');
  };

  const deleteComment = (id: string) => {
    setComments((prev) => prev.filter((c) => c.id !== id));
    logActivity('Deleted a note.');
  };

  useEffect(() => {
    setCollaborators(initialCollaborators);
  }, [initialCollaborators]);

  useEffect(() => {
    setActivity(initialActivity);
  }, [initialActivity]);

  useEffect(() => {
    if (!isOpen) return;
    setTab('collaboration');
    setInviteOpen(false);
    setInviteName('');
    setInviteEmail('');
    setInviteCommissionTerms('');
    setInviteRemarks('');
    setInviteCommissionMode('preset');
    setInviteSaving(false);

    setRepoUploadOpen(false);
    setRepoUploadFile(null);
    setRepoUploadType('other');
    setRepoUploadTitle('');
    setRepoUploadPortalVisible(false);
    setRepoUploadSaving(false);

    setTemplateUploadOpen(false);
    setTemplateUploadFile(null);
    setTemplateKey('');
    setTemplateTitle('');
    setTemplateActive(true);
    setTemplateSaving(false);

    setInvoiceSaving(false);
  }, [isOpen, summary.title]);

  const submitInvite = async () => {
    const name = inviteName.trim();
    const email = inviteEmail.trim();
    const commissionTerms = inviteCommissionTerms.trim();
    const remarks = inviteRemarks.trim();
    if (!email) return;
    if (!onSendInvite) return;
    if (inviteSaving) return;

    setInviteSaving(true);
    try {
      await onSendInvite({
        name,
        email,
        commissionTerms,
        remarks,
      });
      setInviteName('');
      setInviteEmail('');
      setInviteCommissionTerms('');
      setInviteRemarks('');
      setInviteCommissionMode('preset');
      setInviteOpen(false);
      logActivity(`Invited collaborator ${email}.`);
    } finally {
      setInviteSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={summary.title} maxWidth="5xl">
      <div className="space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <ContractSummaryCard title="Unit" value={summary.unitLabel} />
          <ContractSummaryCard title="Primary tenant" value={summary.primaryTenantLabel} />
          <ContractSummaryCard title="Period" value={summary.periodLabel} />
          <ContractSummaryCard title="Status" value={summary.statusLabel} />
        </div>        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 pt-2">
          {/* ── Sidebar Nav ── */}
          <div className="col-span-1 space-y-1">
            <button
              type="button"
              onClick={() => setTab('collaboration')}
              className={cn(
                "w-full flex items-center justify-between rounded-xl px-4 py-3 text-sm font-semibold transition-all text-left",
                tab === 'collaboration' ? "bg-indigo-50 text-indigo-700" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              )}
            >
              Collaborators
              <ChevronRight className={cn("h-4 w-4", tab === 'collaboration' ? "text-indigo-700" : "text-transparent")} />
            </button>
            <button
              type="button"
              onClick={() => setTab('activity')}
              className={cn(
                "w-full flex items-center justify-between rounded-xl px-4 py-3 text-sm font-semibold transition-all text-left",
                tab === 'activity' ? "bg-indigo-50 text-indigo-700" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              )}
            >
              Activity & Notes
              <ChevronRight className={cn("h-4 w-4", tab === 'activity' ? "text-indigo-700" : "text-transparent")} />
            </button>
            <button
              type="button"
              onClick={() => setTab('documents')}
              className={cn(
                "w-full flex items-center justify-between rounded-xl px-4 py-3 text-sm font-semibold transition-all text-left",
                tab === 'documents' ? "bg-indigo-50 text-indigo-700" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              )}
            >
              Documents
              <ChevronRight className={cn("h-4 w-4", tab === 'documents' ? "text-indigo-700" : "text-transparent")} />
            </button>
            <button
              type="button"
              onClick={() => setTab('inventory')}
              className={cn(
                "w-full flex items-center justify-between rounded-xl px-4 py-3 text-sm font-semibold transition-all text-left",
                tab === 'inventory' ? "bg-indigo-50 text-indigo-700" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              )}
            >
              Inventory
              <ChevronRight className={cn("h-4 w-4", tab === 'inventory' ? "text-indigo-700" : "text-transparent")} />
            </button>
          </div>

          {/* ── Main Content Area ── */}
          <div className="col-span-1 md:col-span-3 min-w-0">
            {tab === 'collaboration' ? (
              <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <div className="text-sm font-bold text-slate-900">Collaborators</div>
                  <div className="text-xs text-slate-500">Manage access for this contract.</div>
                </div>
                <div className="flex items-center gap-2">
                  <Button type="button" className="h-9 bg-indigo-600 hover:bg-indigo-700" onClick={() => setInviteOpen(true)}>
                    Add collaborator
                  </Button>
                </div>
              </div>

              {inviteOpen ? (
                <div className="rounded-2xl border border-slate-100 bg-white p-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>Name</Label>
                      <Input
                        className="rounded-xl"
                        value={inviteName}
                        onChange={(e) => setInviteName(e.target.value)}
                        placeholder="Optional"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Email</Label>
                      <Input
                        className="rounded-xl"
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                        placeholder="name@email.com"
                      />
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-1 gap-3">
                    <div className="space-y-2">
                      <Label>Commission terms</Label>
                      <Select2
                        options={commissionTermOptions}
                        value={
                          inviteCommissionMode === 'custom'
                            ? 'custom'
                            : inviteCommissionTerms
                              ? inviteCommissionTerms
                              : null
                        }
                        onChange={(v) => {
                          const next = String(v ?? '');
                          if (next === 'custom') {
                            setInviteCommissionMode('custom');
                            setInviteCommissionTerms('');
                            return;
                          }
                          setInviteCommissionMode('preset');
                          setInviteCommissionTerms(next);
                        }}
                      />
                      {inviteCommissionMode === 'custom' ? (
                        <Input
                          className="rounded-xl mt-2"
                          value={inviteCommissionTerms}
                          onChange={(e) => setInviteCommissionTerms(e.target.value)}
                          placeholder="Type custom commission terms"
                        />
                      ) : null}
                    </div>
                    <div className="space-y-2">
                      <Label>Remarks</Label>
                      <Textarea
                        className="rounded-xl"
                        value={inviteRemarks}
                        onChange={(e) => setInviteRemarks(e.target.value)}
                        placeholder="Optional"
                      />
                    </div>
                  </div>
                  <div className="mt-3 flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={() => setInviteOpen(false)}>
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      className="bg-indigo-600 hover:bg-indigo-700"
                      onClick={submitInvite}
                      disabled={inviteSaving}
                    >
                      Add
                    </Button>
                  </div>
                </div>
              ) : null}

              <CollaboratorList collaborators={collaborators} onRoleChange={handleRoleChange} onRemove={handleRemove} />

              <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                <div className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-2">Permissions guide</div>
                <div className="space-y-2">
                  {permissionsGuide.map((p) => (
                    <div key={p.role} className="flex items-start gap-3">
                      <Badge variant="outline" className={cn('border-0', roleBadgeClass(p.role))}>
                        {p.role}
                      </Badge>
                      <div className="text-sm text-slate-600">{p.desc}</div>
                    </div>
                  ))}
                </div>
              </div>
              </div>
            ) : tab === 'activity' ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div>
              <div className="text-sm font-bold text-slate-900 mb-2">Activity</div>
              <ActivityFeed items={activity} />
            </div>
            <div>
              <div className="text-sm font-bold text-slate-900 mb-2">Comments & Notes</div>
              <CommentSection comments={comments} onAdd={addComment} onEdit={editComment} onDelete={deleteComment} />
            </div>
              </div>
            ) : tab === 'documents' ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-bold text-slate-900">Repository documents</div>
                  <div className="text-xs text-slate-500 mb-3">Files saved in `document_repository` for this contract.</div>
                </div>
                {onUploadRepositoryDocument ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="h-9"
                    onClick={() => setRepoUploadOpen((v) => !v)}
                  >
                    Upload
                  </Button>
                ) : null}
              </div>
              {repoUploadOpen ? (
                <div className="mb-3 rounded-2xl border border-slate-100 bg-white p-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>Doc type</Label>
                      <Select2
                        options={repoDocTypeOptions}
                        value={repoUploadType}
                        onChange={(v) => setRepoUploadType(String(v) as typeof repoUploadType)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Title</Label>
                      <Input
                        className="rounded-xl"
                        value={repoUploadTitle}
                        onChange={(e) => setRepoUploadTitle(e.target.value)}
                        placeholder="Optional (defaults to filename)"
                      />
                    </div>
                  </div>
                  <div className="mt-3 space-y-2">
                    <Label>File</Label>
                    <Input
                      type="file"
                      className="rounded-xl"
                      accept="application/pdf,image/*"
                      onChange={(e) => setRepoUploadFile(e.target.files?.[0] ?? null)}
                    />
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <label className="flex items-center gap-2 text-sm text-slate-700">
                      <Checkbox
                        checked={repoUploadPortalVisible}
                        onCheckedChange={(v) => setRepoUploadPortalVisible(Boolean(v))}
                      />
                      Visible in tenant portal
                    </label>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setRepoUploadOpen(false)}
                        disabled={repoUploadSaving}
                      >
                        Cancel
                      </Button>
                      <Button
                        type="button"
                        className="bg-indigo-600 hover:bg-indigo-700"
                        onClick={submitRepoUpload}
                        disabled={repoUploadSaving || !repoUploadFile}
                      >
                        {repoUploadSaving ? 'Uploading…' : 'Save'}
                      </Button>
                    </div>
                  </div>
                </div>
              ) : null}
              <div className="space-y-2">
                {documents.length === 0 ? (
                  <div className="rounded-xl border border-slate-100 bg-white p-4 text-sm text-slate-500">
                    No documents uploaded.
                  </div>
                ) : (
                  documents.map((d) => (
                    <div key={d.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-white p-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-50">
                          <FileText className="h-5 w-5 text-indigo-600" />
                        </div>
                        <div className="min-w-0">
                          <div className="font-semibold text-slate-900 truncate">{d.title || 'Document'}</div>
                          <div className="flex items-center gap-2 text-xs text-slate-500">
                            <span className="capitalize">{d.docType.replace(/_/g, ' ')}</span>
                            <span>•</span>
                            <span>{d.createdAt || '—'}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {d.portalVisible ? (
                          <Badge variant="outline" className="border-0 bg-emerald-100 text-emerald-700 hidden sm:inline-flex">Portal</Badge>
                        ) : null}
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-slate-400 hover:text-indigo-600"
                          onClick={() => {
                            if (d.docType === 'lease_contract' && d.contractId) {
                              const url = `${window.location.origin}${window.location.pathname}?view=preview&type=contract&id=${encodeURIComponent(d.contractId)}`;
                              window.open(url, '_blank', 'noopener,noreferrer');
                              return;
                            }
                            window.open(d.filePath.startsWith('/') ? d.filePath : `/${d.filePath}`, '_blank');
                          }}
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-bold text-slate-900">Templates</div>
                  <div className="text-xs text-slate-500 mb-3">Active `document_template` grouped by `template_key`.</div>
                </div>
                <div className="flex items-center gap-2">
                  {onGenerateInvoice ? (
                    <Button
                      type="button"
                      className="h-9 bg-indigo-600 hover:bg-indigo-700"
                      disabled={invoiceSaving}
                      onClick={async () => {
                        if (invoiceSaving) return;
                        setInvoiceSaving(true);
                        try {
                          await onGenerateInvoice();
                        } finally {
                          setInvoiceSaving(false);
                        }
                      }}
                    >
                      {invoiceSaving ? 'Generating…' : 'Generate invoice'}
                    </Button>
                  ) : null}
                  {onUploadTemplate ? (
                    <Button
                      type="button"
                      variant="outline"
                      className="h-9"
                      onClick={() => setTemplateUploadOpen((v) => !v)}
                    >
                      Upload
                    </Button>
                  ) : null}
                </div>
              </div>
              {templateUploadOpen ? (
                <div className="mb-3 rounded-2xl border border-slate-100 bg-white p-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>Template key</Label>
                      <Input
                        className="rounded-xl"
                        value={templateKey}
                        onChange={(e) => setTemplateKey(e.target.value)}
                        placeholder="e.g., lease_contract"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Title</Label>
                      <Input
                        className="rounded-xl"
                        value={templateTitle}
                        onChange={(e) => setTemplateTitle(e.target.value)}
                        placeholder="Optional (defaults to filename)"
                      />
                    </div>
                  </div>
                  <div className="mt-3 space-y-2">
                    <Label>File</Label>
                    <Input
                      type="file"
                      className="rounded-xl"
                      accept="application/pdf,image/*"
                      onChange={(e) => setTemplateUploadFile(e.target.files?.[0] ?? null)}
                    />
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <label className="flex items-center gap-2 text-sm text-slate-700">
                      <Checkbox checked={templateActive} onCheckedChange={(v) => setTemplateActive(Boolean(v))} />
                      Active
                    </label>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setTemplateUploadOpen(false)}
                        disabled={templateSaving}
                      >
                        Cancel
                      </Button>
                      <Button
                        type="button"
                        className="bg-indigo-600 hover:bg-indigo-700"
                        onClick={submitTemplateUpload}
                        disabled={templateSaving || !templateUploadFile || !templateKey.trim()}
                      >
                        {templateSaving ? 'Uploading…' : 'Save'}
                      </Button>
                    </div>
                  </div>
                </div>
              ) : null}
              <div className="space-y-2">
                {templates.length === 0 ? (
                  <div className="rounded-xl border border-slate-100 bg-white p-4 text-sm text-slate-500">
                    No templates available.
                  </div>
                ) : (
                  templates.map((t) => (
                    <div key={t.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-white p-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-50">
                          <FileText className="h-5 w-5 text-indigo-600" />
                        </div>
                        <div className="min-w-0">
                          <div className="font-semibold text-slate-900 truncate">{t.title || 'Template'}</div>
                          <div className="flex items-center gap-2 text-xs text-slate-500">
                            <span>{t.templateKey}</span>
                            <span>•</span>
                            <span>v{t.versionNo}</span>
                            <span>•</span>
                            <span>{t.createdAt || '—'}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-slate-400 hover:text-indigo-600"
                          onClick={() => window.open(t.filePath.startsWith('/') ? t.filePath : `/${t.filePath}`, '_blank')}
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
              </div>
            ) : tab === 'inventory' ? (
              <div className="space-y-4">
                <div className="rounded-2xl border border-slate-100 bg-white p-4">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                <div>
                  <div className="text-sm font-bold text-slate-900">Inventory snapshots</div>
                  <div className="text-xs text-slate-500">
                    Move-in / move-out inspection snapshots from `inventory_snapshot` and items from `inventory_snapshot_item`.
                  </div>
                </div>
                <Button
                  type="button"
                  className="h-9 bg-indigo-600 hover:bg-indigo-700"
                  onClick={() => setAddSnapshotOpen((v) => !v)}
                >
                  Add snapshot
                </Button>
              </div>

              {addSnapshotOpen ? (
                <div className="mt-4 rounded-2xl border border-slate-100 bg-slate-50 p-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="space-y-2">
                      <Label>Snapshot type</Label>
                      <select
                        value={snapType}
                        onChange={(e) => setSnapType(e.target.value as InventorySnapshot['snapshotType'])}
                        className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                      >
                        <option value="move_in">Move in</option>
                        <option value="move_out">Move out</option>
                        <option value="routine">Routine</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label>Inspection date</Label>
                      <Input
                        type="date"
                        className="rounded-xl"
                        value={snapDate}
                        onChange={(e) => setSnapDate(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2 sm:col-span-3">
                      <Label>Remarks</Label>
                      <Input
                        className="rounded-xl"
                        value={snapRemarks}
                        onChange={(e) => setSnapRemarks(e.target.value)}
                        placeholder="Optional notes"
                      />
                    </div>
                  </div>
                  <div className="mt-3 flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      disabled={snapSaving}
                      onClick={() => {
                        setAddSnapshotOpen(false);
                        setSnapRemarks('');
                        setSnapDate('');
                        setSnapType('move_in');
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      className="bg-indigo-600 hover:bg-indigo-700"
                      disabled={snapSaving}
                      onClick={async () => {
                        if (!snapDate) return;
                        try {
                          setSnapSaving(true);
                          await onAddSnapshot({
                            snapshotType: snapType,
                            inspectionDate: snapDate,
                            remarks: snapRemarks.trim() || undefined,
                          });
                          setAddSnapshotOpen(false);
                          setSnapRemarks('');
                          setSnapDate('');
                          setSnapType('move_in');
                        } finally {
                          setSnapSaving(false);
                        }
                      }}
                    >
                      {snapSaving ? 'Saving…' : 'Save snapshot'}
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="space-y-3">
              {inventory.length === 0 ? (
                <div className="rounded-2xl border border-slate-100 bg-white p-4 text-sm text-slate-500">
                  No inventory snapshots yet.
                </div>
              ) : (
                inventory.map((s) => (
                  <div key={s.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge
                            variant="outline"
                            className={cn(
                              'border-0',
                              s.snapshotType === 'move_in'
                                ? 'bg-emerald-100 text-emerald-700'
                                : s.snapshotType === 'move_out'
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-slate-100 text-slate-700',
                            )}
                          >
                            {s.snapshotType.replace('_', ' ')}
                          </Badge>
                          <div className="text-sm font-semibold text-slate-900">{s.inspectionDate || '—'}</div>
                        </div>
                        {s.remarks ? <div className="mt-1 text-xs text-slate-600">{s.remarks}</div> : null}
                      </div>
                      <div className="shrink-0 flex items-center gap-2">
                        <div className="text-xs text-slate-500">
                          {s.items.length} item{s.items.length === 1 ? '' : 's'}
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 text-slate-500 hover:text-indigo-600"
                          title="Edit snapshot"
                          onClick={() => {
                            setEditSnapshotId(s.id);
                            setEditSnapType(s.snapshotType);
                            setEditSnapDate(s.inspectionDate);
                            setEditSnapRemarks(s.remarks ?? '');
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 text-slate-500 hover:text-rose-600"
                          title="Delete snapshot"
                          onClick={async () => {
                            if (!confirm('Delete this snapshot (and its items)?')) return;
                            await onDeleteSnapshot(s.id);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-8"
                          onClick={() => {
                            setItemOpenFor((cur) => (cur === s.id ? null : s.id));
                            setItemName('');
                            setItemCategory('');
                            setItemQty('1');
                            setItemCondition('good');
                            setItemNotes('');
                          }}
                        >
                          Add item
                        </Button>
                      </div>
                    </div>

                    {editSnapshotId === s.id ? (
                      <div className="mt-3 rounded-2xl border border-slate-100 bg-white p-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div className="space-y-2">
                            <Label>Snapshot type</Label>
                            <select
                              value={editSnapType}
                              onChange={(e) => setEditSnapType(e.target.value as any)}
                              className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                            >
                              <option value="move_in">Move in</option>
                              <option value="move_out">Move out</option>
                              <option value="routine">Routine</option>
                            </select>
                          </div>
                          <div className="space-y-2">
                            <Label>Inspection date</Label>
                            <Input
                              type="date"
                              className="rounded-xl"
                              value={editSnapDate}
                              onChange={(e) => setEditSnapDate(e.target.value)}
                            />
                          </div>
                          <div className="space-y-2 md:col-span-2">
                            <Label>Remarks</Label>
                            <Input
                              className="rounded-xl"
                              value={editSnapRemarks}
                              onChange={(e) => setEditSnapRemarks(e.target.value)}
                              placeholder="Optional"
                            />
                          </div>
                        </div>
                        <div className="mt-3 flex justify-end gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            disabled={editSnapSaving}
                            onClick={() => setEditSnapshotId(null)}
                          >
                            Cancel
                          </Button>
                          <Button
                            type="button"
                            className="bg-indigo-600 hover:bg-indigo-700"
                            disabled={editSnapSaving}
                            onClick={async () => {
                              if (!editSnapDate) return;
                              try {
                                setEditSnapSaving(true);
                                await onEditSnapshot(s.id, {
                                  snapshotType: editSnapType,
                                  inspectionDate: editSnapDate,
                                  remarks: editSnapRemarks.trim() || undefined,
                                });
                                setEditSnapshotId(null);
                              } finally {
                                setEditSnapSaving(false);
                              }
                            }}
                          >
                            {editSnapSaving ? 'Saving…' : 'Save changes'}
                          </Button>
                        </div>
                      </div>
                    ) : null}

                    {itemOpenFor === s.id ? (
                      <div className="mt-3 rounded-2xl border border-slate-100 bg-white p-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div className="space-y-2">
                            <Label>Item name</Label>
                            <Input className="rounded-xl" value={itemName} onChange={(e) => setItemName(e.target.value)} />
                          </div>
                          <div className="space-y-2">
                            <Label>Category</Label>
                                    <select
                                      value={itemCategory}
                                      onChange={(e) => setItemCategory(e.target.value)}
                                      className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                                    >
                                      <option value="">Select category (optional)</option>
                                      {INVENTORY_CATEGORIES.map((c) => (
                                        <option key={c.value} value={c.value}>
                                          {c.label} — {c.detail}
                                        </option>
                                      ))}
                                    </select>
                          </div>
                          <div className="space-y-2">
                            <Label>Quantity</Label>
                            <Input
                              type="number"
                              min={1}
                              className="rounded-xl"
                              value={itemQty}
                              onChange={(e) => setItemQty(e.target.value)}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Condition</Label>
                            <select
                              value={itemCondition}
                              onChange={(e) => setItemCondition(e.target.value as any)}
                              className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                            >
                              <option value="excellent">excellent</option>
                              <option value="good">good</option>
                              <option value="fair">fair</option>
                              <option value="damaged">damaged</option>
                              <option value="missing">missing</option>
                            </select>
                          </div>
                          <div className="space-y-2 md:col-span-2">
                            <Label>Notes</Label>
                            <Input
                              className="rounded-xl"
                              value={itemNotes}
                              onChange={(e) => setItemNotes(e.target.value)}
                              placeholder="Optional"
                            />
                          </div>
                        </div>
                        <div className="mt-3 flex justify-end gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            disabled={itemSaving}
                            onClick={() => setItemOpenFor(null)}
                          >
                            Cancel
                          </Button>
                          <Button
                            type="button"
                            className="bg-indigo-600 hover:bg-indigo-700"
                            disabled={itemSaving}
                            onClick={async () => {
                              const qty = Number(itemQty);
                              if (!itemName.trim() || !Number.isFinite(qty) || qty <= 0) return;
                              try {
                                setItemSaving(true);
                                await onAddItem({
                                  snapshotId: s.id,
                                  itemName: itemName.trim(),
                                  category: itemCategory.trim() || undefined,
                                  quantity: qty,
                                  conditionState: itemCondition,
                                  notes: itemNotes.trim() || undefined,
                                });
                                setItemOpenFor(null);
                              } finally {
                                setItemSaving(false);
                              }
                            }}
                          >
                            {itemSaving ? 'Saving…' : 'Save item'}
                          </Button>
                        </div>
                      </div>
                    ) : null}

                    <div className="mt-3">
                      <div className="space-y-2">
                        {s.items.length === 0 ? (
                          <div className="rounded-xl border border-slate-100 bg-white p-4 text-sm text-slate-500">
                            No items in this snapshot.
                          </div>
                        ) : (
                          s.items.map((it) => (
                            <div key={it.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-slate-100 bg-white p-3">
                              <div className="flex-1 min-w-0">
                                <div className="font-semibold text-slate-900 truncate">{it.itemName}</div>
                                {it.notes ? <div className="text-xs text-slate-500 truncate mb-1">{it.notes}</div> : null}
                                <div className="flex items-center gap-2 text-xs text-slate-600">
                                  <span>{inventoryCategoryLabel(it.category) || 'Uncategorized'}</span>
                                  <span>•</span>
                                  <span>Qty: {it.quantity}</span>
                                  <span>•</span>
                                  <Badge variant="outline" className="border-0 bg-slate-100 text-slate-700 capitalize">
                                    {it.conditionState}
                                  </Badge>
                                </div>
                              </div>
                              <div className="flex items-center gap-1 shrink-0 self-end sm:self-center">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-slate-500 hover:text-indigo-600"
                                  title="Edit item"
                                  onClick={() => {
                                    setEditItemId(it.id);
                                    setEditItemName(it.itemName);
                                    setEditItemCategory(it.category ?? '');
                                    setEditItemQty(String(it.quantity ?? 1));
                                    setEditItemCondition(it.conditionState as any);
                                    setEditItemNotes(it.notes ?? '');
                                  }}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-slate-500 hover:text-rose-600"
                                  title="Delete item"
                                  onClick={async () => {
                                    if (!confirm('Delete this item?')) return;
                                    await onDeleteItem(it.id);
                                  }}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          ))
                        )}
                      </div>

                      {/* Inline edit form for selected item */}
                      {editItemId && s.items.find((it) => it.id === editItemId) ? (() => {
                        const it = s.items.find((i) => i.id === editItemId)!;
                        return (
                          <div key={it.id} className="mt-3 rounded-xl border border-slate-100 bg-slate-50 p-3">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              <div className="space-y-2">
                                <Label>Item name</Label>
                                <Input className="rounded-xl" value={editItemName} onChange={(e) => setEditItemName(e.target.value)} />
                              </div>
                              <div className="space-y-2">
                                <Label>Category</Label>
                                <select
                                  value={editItemCategory}
                                  onChange={(e) => setEditItemCategory(e.target.value)}
                                  className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                                >
                                  <option value="">Select category (optional)</option>
                                  {INVENTORY_CATEGORIES.map((c) => (
                                    <option key={c.value} value={c.value}>
                                      {c.label} — {c.detail}
                                    </option>
                                  ))}
                                </select>
                              </div>
                              <div className="space-y-2">
                                <Label>Quantity</Label>
                                <Input type="number" min={1} className="rounded-xl" value={editItemQty} onChange={(e) => setEditItemQty(e.target.value)} />
                              </div>
                              <div className="space-y-2">
                                <Label>Condition</Label>
                                <select
                                  value={editItemCondition}
                                  onChange={(e) => setEditItemCondition(e.target.value as any)}
                                  className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                                >
                                  <option value="excellent">excellent</option>
                                  <option value="good">good</option>
                                  <option value="fair">fair</option>
                                  <option value="damaged">damaged</option>
                                  <option value="missing">missing</option>
                                </select>
                              </div>
                              <div className="space-y-2 md:col-span-2">
                                <Label>Notes</Label>
                                <Input className="rounded-xl" value={editItemNotes} onChange={(e) => setEditItemNotes(e.target.value)} />
                              </div>
                            </div>
                            <div className="mt-3 flex justify-end gap-2">
                              <Button type="button" variant="outline" disabled={editItemSaving} onClick={() => setEditItemId(null)}>
                                Cancel
                              </Button>
                              <Button
                                type="button"
                                className="bg-indigo-600 hover:bg-indigo-700"
                                disabled={editItemSaving}
                                onClick={async () => {
                                  const qty = Number(editItemQty);
                                  if (!editItemName.trim() || !Number.isFinite(qty) || qty <= 0) return;
                                  try {
                                    setEditItemSaving(true);
                                    await onEditItem(it.id, {
                                      itemName: editItemName.trim(),
                                      category: editItemCategory.trim() || undefined,
                                      quantity: qty,
                                      conditionState: editItemCondition,
                                      notes: editItemNotes.trim() || undefined,
                                    });
                                    setEditItemId(null);
                                  } finally {
                                    setEditItemSaving(false);
                                  }
                                }}
                              >
                                {editItemSaving ? 'Saving…' : 'Save changes'}
                              </Button>
                            </div>
                          </div>
                        );
                      })() : null}
                    </div>
                  </div>
                ))
              )}
            </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </Modal>
  );
}

