import React, { useEffect, useMemo, useState } from 'react';
import { FileText, Download, Printer, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { fetchContractDocumentDetails } from '@/lib/contractsApi';
import { fetchContractRepositoryDocuments } from '@/lib/documentsApi';
import { fetchContractInvoices, fetchInvoice } from '@/lib/invoicesApi';
import { format } from 'date-fns';
import type { Contract, InvoiceRow, Tenant, Unit } from '@/types';

interface DocumentPreviewProps {
  type: 'contract' | 'invoice';
  contractId: string;
  onBack?: () => void;
  isStandalone?: boolean;
}

export function DocumentPreview({ type, contractId, onBack, isStandalone = false }: DocumentPreviewProps) {
  const [loading, setLoading] = useState(true);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [invoice, setInvoice] = useState<InvoiceRow | null>(null);
  const [resolvedContractId, setResolvedContractId] = useState<string>(contractId);
  const [leaseAttachmentPath, setLeaseAttachmentPath] = useState<string>('');
  const [loadError, setLoadError] = useState<string>('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    void (async () => {
      try {
        setLoadError('');
        let contractIdForDetails = contractId;
        let resolvedInvoice: InvoiceRow | null = null;

        // Prefer treating incoming `id` as contractId first.
        // This avoids noisy /api/invoices/:id 404 logs for contract-based preview links.
        let details;
        try {
          details = await fetchContractDocumentDetails(contractIdForDetails);
        } catch {
          if (type !== 'invoice') throw new Error('Contract details not found');
          // If contract lookup fails in invoice mode, retry by resolving as invoice id.
          const invRow = await fetchInvoice(contractId);
          if (!active) return;
          resolvedInvoice = invRow;
          contractIdForDetails = invRow.contractId;
          details = await fetchContractDocumentDetails(contractIdForDetails);
        }

        if (!active) return;
        setResolvedContractId(contractIdForDetails);
        setContracts([details.contract]);
        setUnits([
          {
            id: details.unit.id,
            unitNumber: details.unit.unitNumber,
            floor: details.unit.floor,
            tower: details.unit.tower,
            buildingName: details.unit.buildingName,
            commonAddress: details.unit.commonAddress,
            legalAddress: details.unit.legalAddress,
            type: 'Studio',
            status: 'Available',
            area: 'Makati',
            monthlyRate: Number(details.contract.monthlyRent ?? 0),
            inventory: [],
          },
        ]);
        setTenants(
          details.tenant
            ? [
                {
                  id: details.tenant.id,
                  name: details.tenant.name,
                  email: details.tenant.email,
                  phone: details.tenant.phone,
                  idType: '',
                  idNumber: '',
                  idExpiry: '',
                  isBlacklisted: false,
                },
              ]
            : [],
        );

        if (type === 'invoice') {
          // Prefer invoices scoped to contract; fallback to resolved invoice-id lookup.
          try {
            const inv = await fetchContractInvoices(contractIdForDetails);
            if (!active) return;
            const pick =
              (resolvedInvoice
                ? inv.find((x) => x.id === resolvedInvoice.id) ?? resolvedInvoice
                : null) ??
              inv.find((x) => x.id === contractId) ??
              inv.find((x) => x.status === 'issued') ??
              inv.find((x) => x.status === 'draft') ??
              inv[0] ??
              null;
            setInvoice(pick);
          } catch {
            if (!active) return;
            setInvoice(resolvedInvoice);
          }
        }

        // Always use the generated HTML view for 'contract' preview
        setLeaseAttachmentPath('');
      } catch {
        if (!active) return;
        setContracts([]);
        setUnits([]);
        setTenants([]);
        setInvoice(null);
        setLeaseAttachmentPath('');
        setLoadError('Failed to load document preview.');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [contractId, type]);

  const contract = useMemo(
    () => contracts.find((c) => c.id === resolvedContractId),
    [contracts, resolvedContractId],
  );
  const unit = useMemo(
    () => units.find((u) => u.id === contract?.unitId),
    [units, contract?.unitId],
  );
  const tenant = useMemo(
    () => tenants.find((t) => t.id === contract?.tenantId),
    [tenants, contract?.tenantId],
  );

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-200 p-8 text-center text-slate-700 dark:bg-slate-950 dark:text-slate-300">
        Loading document…
      </div>
    );
  }
  if (loadError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-200 p-8 text-center text-rose-600 dark:bg-slate-950 dark:text-rose-400">
        {loadError}
      </div>
    );
  }
  if (!contract) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-200 p-8 text-center text-slate-700 dark:bg-slate-950 dark:text-slate-300">
        Contract not found.
      </div>
    );
  }

  const invoiceNoLabel = invoice?.invoiceNo ? invoice.invoiceNo : `INV-${new Date().getFullYear()}-001`;
  const issuedLabel = invoice?.issuedAt ? invoice.issuedAt : format(new Date(), 'MMMM dd, yyyy');
  const base = invoice?.baseAmount ?? contract.securityDeposit + contract.advanceRent;
  const other = invoice?.otherCharges ?? 0;
  const discount = invoice?.discountAmount ?? 0;
  const total = invoice?.totalAmount ?? base + other - discount;
  const usingMoveInFallback = !invoice?.baseAmount;
  const billingPeriodLabel =
    invoice?.billingPeriodStart && invoice?.billingPeriodEnd
      ? `${invoice.billingPeriodStart} – ${invoice.billingPeriodEnd}`
      : null;
  const showSubtotal = other > 0 || discount > 0;

  const resolveUploadUrl = (p: string) => {
    const s = String(p ?? '').trim();
    if (!s) return '';
    if (/^https?:\/\//i.test(s)) return s;
    return s;
  };

  const isLikelyPdfPath = (p: string) => /\.pdf(\?|#|$)/i.test(String(p ?? ''));

  const handlePdf = () => {
    // If we have an attached lease contract file, open it directly (user can download from viewer).
    if (type === 'contract' && leaseAttachmentPath) {
      const url = resolveUploadUrl(leaseAttachmentPath);
      if (url) window.open(url, '_blank', 'noopener,noreferrer');
      return;
    }
    const title =
      type === 'invoice'
        ? `Invoice_${invoiceNoLabel}`
        : `Contract_${contract.contractNo ?? contract.id}`;
    const prev = document.title;
    document.title = title;
    try {
      window.print();
    } finally {
      document.title = prev;
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-slate-200 dark:bg-slate-950">
      {/* Toolbar */}
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-[#ffffff] p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 print:hidden">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => isStandalone ? window.close() : onBack?.()}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <div className="flex flex-col">
            <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100">
              {type === 'contract' ? 'Lease Agreement' : 'Billing Statement'}
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">Document ID: {type === 'invoice' ? (invoice?.id ?? '') : contract.id}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="h-8" onClick={handlePdf}>
            <Download className="w-4 h-4 mr-2" />
            PDF
          </Button>
          <Button variant="default" size="sm" className="h-8 bg-brand-blue" onClick={() => window.print()}>
            <Printer className="w-4 h-4 mr-2" />
            Print
          </Button>
        </div>
      </div>
      
      {/* Document Area — full width chrome, centered paper */}
      <div className="flex flex-1 justify-center overflow-y-auto px-4 py-8 sm:px-6 sm:py-10 md:px-10 md:py-12">
        {/* A4 / readable sheet — lease-document-sheet reverses global .dark .bg-white for readable print preview */}
        <div
          className="lease-document-sheet relative w-full max-w-[min(210mm,calc(100vw-2rem))] min-h-[297mm] overflow-visible bg-white p-[clamp(12mm,4vw,20mm)] font-serif text-slate-800 shadow-2xl sm:p-[clamp(14mm,4vw,25mm)] print:max-w-none print:min-h-0 print:w-full print:p-0 print:shadow-none"
        >
          {type === 'contract' && leaseAttachmentPath ? (
            <div className="w-full h-[calc(297mm-40mm)] print:h-auto">
              {isLikelyPdfPath(leaseAttachmentPath) ? (
                <iframe
                  title="Lease agreement"
                  src={resolveUploadUrl(leaseAttachmentPath)}
                  className="w-full h-full border-0"
                />
              ) : (
                <img
                  src={resolveUploadUrl(leaseAttachmentPath)}
                  alt="Lease agreement"
                  className="w-full h-full object-contain bg-white"
                />
              )}
            </div>
          ) : type === 'contract' ? (
            <div className="space-y-8">
              <div className="text-center space-y-4">
                <div className="flex justify-center mb-4">
                  <div className="w-16 h-16 bg-brand-blue rounded-xl flex items-center justify-center text-white">
                    <FileText className="w-8 h-8" />
                  </div>
                </div>
                <h2 className="text-2xl font-bold uppercase underline tracking-widest">Contract of Lease</h2>
                <p className="text-sm font-bold">KNOW ALL MEN BY THESE PRESENTS:</p>
              </div>
              
              <div className="space-y-6 text-justify leading-relaxed text-[13px] sm:text-[14px]">
                <p>
                  This CONTRACT OF LEASE is made and executed at the City of Makati, Philippines, this day by and between:
                </p>
                <p className="font-bold pl-8 border-l-2 border-slate-200">
                  3CORE PROPERTIES, a corporation duly organized and existing under Philippine laws, with principal office address at Ayala Ave, Makati City, hereinafter referred to as the <span className="underline">LESSOR</span>;
                </p>
                <p className="text-center italic font-bold">- and -</p>
                <p className="font-bold uppercase pl-8 border-l-2 border-slate-200">
                  {tenant?.name}, of legal age, with permanent address provided in the tenant information sheet, hereinafter referred to as the <span className="underline">LESSEE</span>;
                </p>
                
                <h3 className="font-bold underline uppercase mt-8">WITNESSETH; That</h3>
                <p>
                  WHEREAS, the LESSOR is the absolute owner of the LEASED PREMISES, a residential property situated at 
                  <span className="font-bold"> Unit {unit?.unitNumber}, {unit?.buildingName}</span>.
                </p>
                <p>
                  WHEREAS, the LESSOR agrees to lease-out the property to the LESSEE and the LESSEE is willing to lease the same under the following terms and conditions:
                </p>
                
                <div className="space-y-4 mt-6">
                  <p><span className="font-bold">1. PURPOSES:</span> That premises hereby leased shall be used exclusively by the LESSEE for Residential purposes only and shall not be diverted to other uses.</p>
                  <p><span className="font-bold">2. TERM:</span> This term of lease is for ONE (1) YEAR, commencing from <span className="font-bold">{contract.startDate}</span> and expiring on <span className="font-bold">{contract.endDate}</span>.</p>
                  <p><span className="font-bold">3. RENTAL RATE:</span> The monthly rate for the leased premises shall be in PESOS: <span className="font-bold">₱{contract.monthlyRent.toLocaleString()}</span>, Philippine Currency. All payments shall be made payable to the LESSOR.</p>
                  <p><span className="font-bold">4. DEPOSIT:</span> The LESSEE shall deposit to the LESSOR an amount equivalent to two (2) months rent or <span className="font-bold">₱{contract.securityDeposit.toLocaleString()}</span> as security deposit.</p>
                </div>

                <div className="mt-24 grid grid-cols-1 gap-10 pt-16 sm:grid-cols-2 sm:gap-16 sm:pt-20 md:gap-24">
                  <div className="border-t border-slate-400 pt-2 text-center">
                    <p className="text-xs font-bold uppercase text-slate-900">3CORE Management</p>
                    <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-slate-700">LESSOR</p>
                  </div>
                  <div className="border-t border-slate-400 pt-2 text-center">
                    <p className="text-xs font-bold uppercase text-slate-900">{tenant?.name}</p>
                    <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-slate-700">LESSEE</p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="font-sans space-y-12">
              <div className="flex justify-between items-start">
                <div className="space-y-2">
                  <div className="w-12 h-12 bg-brand-blue rounded-lg flex items-center justify-center text-white mb-4">
                    <FileText className="w-6 h-6" />
                  </div>
                  <h2 className="text-4xl font-black text-slate-900 tracking-tighter">INVOICE</h2>
                  <p className="text-slate-500 font-medium">3CORE Management Systems</p>
                </div>
                <div className="text-right space-y-1">
                  <div className="bg-slate-900 text-white px-4 py-2 rounded-md mb-4 inline-block">
                    <p className="text-xs font-bold uppercase tracking-widest opacity-70">Invoice Number</p>
                    <p className="font-mono text-lg font-bold">#{invoiceNoLabel}</p>
                  </div>
                  <p className="text-sm font-bold text-slate-900">Date Issued</p>
                  <p className="text-sm text-slate-500">{issuedLabel}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-12 py-8 border-y border-slate-100">
                <div className="space-y-3">
                  <p className="text-[10px] font-black uppercase text-brand-blue tracking-widest">Billing To</p>
                  <div>
                    <p className="font-bold text-lg text-slate-900">{tenant?.name}</p>
                    <p className="text-sm text-slate-600">Unit {unit?.unitNumber}</p>
                    <p className="text-sm text-slate-600">{unit?.buildingName}</p>
                    <p className="text-sm text-slate-600">Makati City, Philippines</p>
                  </div>
                </div>
                <div className="space-y-3 text-right">
                  <p className="text-[10px] font-black uppercase text-brand-blue tracking-widest">Payment Instructions</p>
                  <div className="text-sm text-slate-600 space-y-1">
                    <p><span className="font-bold text-slate-900">Bank:</span> BDO Unibank</p>
                    <p><span className="font-bold text-slate-900">Account Name:</span> 3CORE Corp</p>
                    <p><span className="font-bold text-slate-900">Account Number:</span> 001234567890</p>
                    <p className="text-[10px] italic mt-2">Please send proof of payment to billing@proptrack.ph</p>
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <Table>
                  <TableHeader>
                    <TableRow className="border-b-2 border-slate-900 hover:bg-transparent">
                      <TableHead className="text-slate-900 font-bold uppercase text-xs">Description</TableHead>
                      <TableHead className="text-right text-slate-900 font-bold uppercase text-xs">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {usingMoveInFallback ? (
                      <TableRow className="hover:bg-transparent border-slate-100">
                        <TableCell className="py-6">
                          <p className="font-bold text-slate-900">Move-in charges</p>
                          <p className="text-xs text-slate-500">
                            Security deposit ₱{Number(contract.securityDeposit || 0).toLocaleString()} + advance rent ₱
                            {Number(contract.advanceRent || 0).toLocaleString()}
                          </p>
                        </TableCell>
                        <TableCell className="text-right font-bold text-slate-900">
                          ₱{Number(base).toLocaleString()}
                        </TableCell>
                      </TableRow>
                    ) : (
                      <TableRow className="hover:bg-transparent border-slate-100">
                        <TableCell className="py-6">
                          <p className="font-bold text-slate-900">Monthly rent</p>
                          {billingPeriodLabel ? (
                            <p className="text-xs text-slate-500">Billing period: {billingPeriodLabel}</p>
                          ) : null}
                        </TableCell>
                        <TableCell className="text-right font-bold text-slate-900">
                          ₱{Number(base).toLocaleString()}
                        </TableCell>
                      </TableRow>
                    )}
                    {other ? (
                      <TableRow className="hover:bg-transparent border-slate-100">
                        <TableCell className="py-6">
                          <p className="font-bold text-slate-900">Other charges</p>
                        </TableCell>
                        <TableCell className="text-right font-bold text-slate-900">₱{Number(other).toLocaleString()}</TableCell>
                      </TableRow>
                    ) : null}
                    {discount ? (
                      <TableRow className="hover:bg-transparent border-slate-100">
                        <TableCell className="py-6">
                          <p className="font-bold text-slate-900">Discount</p>
                        </TableCell>
                        <TableCell className="text-right font-bold text-slate-900">-₱{Number(discount).toLocaleString()}</TableCell>
                      </TableRow>
                    ) : null}
                  </TableBody>
                </Table>

                <div className="flex justify-end pt-6">
                  <div className="w-full max-w-xs space-y-3">
                    {showSubtotal ? (
                      <>
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-500">Subtotal</span>
                          <span className="font-bold text-slate-900">₱{Number(base + other).toLocaleString()}</span>
                        </div>
                        {discount ? (
                          <div className="flex justify-between text-sm">
                            <span className="text-slate-500">Discount</span>
                            <span className="font-bold text-slate-900">-₱{Number(discount).toLocaleString()}</span>
                          </div>
                        ) : null}
                      </>
                    ) : null}
                    <div className="flex justify-between items-center pt-3 border-t-2 border-slate-900">
                      <span className="text-lg font-black uppercase text-slate-900">Total Due</span>
                      <span className="text-2xl font-black text-brand-blue">₱{Number(total).toLocaleString()}</span>
                    </div>
                    {invoice?.dueDate ? (
                      <div className="flex justify-between text-xs text-slate-500 pt-1">
                        <span>Due date</span>
                        <span className="font-medium">{invoice.dueDate}</span>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="pt-20 text-center">
                <p className="text-[10px] font-bold uppercase text-slate-400 tracking-[0.2em]">Thank you for choosing 3CORE</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
