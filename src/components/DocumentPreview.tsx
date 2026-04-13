import React from 'react';
import { FileText, Download, Printer, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { contracts, units, tenants } from '@/lib/mockData';
import { format } from 'date-fns';

interface DocumentPreviewProps {
  type: 'contract' | 'invoice';
  contractId: string;
  onBack?: () => void;
  isStandalone?: boolean;
}

export function DocumentPreview({ type, contractId, onBack, isStandalone = false }: DocumentPreviewProps) {
  const contract = contracts.find(c => c.id === contractId);
  const unit = units.find(u => u.id === contract?.unitId);
  const tenant = tenants.find(t => t.id === contract?.tenantId);

  if (!contract) return <div className="p-8 text-center">Contract not found.</div>;

  return (
    <div className="min-h-screen bg-slate-200 flex flex-col">
      {/* Toolbar */}
      <div className="sticky top-0 z-30 bg-white border-b p-4 flex items-center justify-between shadow-sm print:hidden">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => isStandalone ? window.close() : onBack?.()}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <div className="flex flex-col">
            <h1 className="text-lg font-bold">{type === 'contract' ? 'Lease Agreement' : 'Billing Statement'}</h1>
            <p className="text-xs text-slate-500">Document ID: {contract.id}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="h-8">
            <Download className="w-4 h-4 mr-2" />
            PDF
          </Button>
          <Button variant="default" size="sm" className="h-8 bg-indigo-600" onClick={() => window.print()}>
            <Printer className="w-4 h-4 mr-2" />
            Print
          </Button>
        </div>
      </div>
      
      {/* Document Area */}
      <div className="flex-1 flex justify-center p-8 sm:p-12 overflow-y-auto">
        {/* A4 Container */}
        <div className="bg-white shadow-2xl w-[210mm] min-h-[297mm] p-[20mm] sm:p-[25mm] font-serif text-slate-800 relative overflow-hidden print:shadow-none print:p-0 print:w-full">
          {type === 'contract' ? (
            <div className="space-y-8">
              <div className="text-center space-y-4">
                <div className="flex justify-center mb-4">
                  <div className="w-16 h-16 bg-indigo-600 rounded-xl flex items-center justify-center text-white">
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

                <div className="grid grid-cols-2 gap-20 mt-24 pt-20">
                  <div className="text-center border-t border-slate-400 pt-2">
                    <p className="font-bold uppercase text-xs">3CORE Management</p>
                    <p className="text-[10px] text-slate-500">LESSOR</p>
                  </div>
                  <div className="text-center border-t border-slate-400 pt-2">
                    <p className="font-bold uppercase text-xs">{tenant?.name}</p>
                    <p className="text-[10px] text-slate-500">LESSEE</p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="font-sans space-y-12">
              <div className="flex justify-between items-start">
                <div className="space-y-2">
                  <div className="w-12 h-12 bg-indigo-600 rounded-lg flex items-center justify-center text-white mb-4">
                    <FileText className="w-6 h-6" />
                  </div>
                  <h2 className="text-4xl font-black text-slate-900 tracking-tighter">INVOICE</h2>
                  <p className="text-slate-500 font-medium">3CORE Management Systems</p>
                </div>
                <div className="text-right space-y-1">
                  <div className="bg-slate-900 text-white px-4 py-2 rounded-md mb-4 inline-block">
                    <p className="text-xs font-bold uppercase tracking-widest opacity-70">Invoice Number</p>
                    <p className="font-mono text-lg font-bold">#INV-2026-001</p>
                  </div>
                  <p className="text-sm font-bold text-slate-900">Date Issued</p>
                  <p className="text-sm text-slate-500">{format(new Date(), 'MMMM dd, yyyy')}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-12 py-8 border-y border-slate-100">
                <div className="space-y-3">
                  <p className="text-[10px] font-black uppercase text-indigo-600 tracking-widest">Billing To</p>
                  <div>
                    <p className="font-bold text-lg text-slate-900">{tenant?.name}</p>
                    <p className="text-sm text-slate-600">Unit {unit?.unitNumber}</p>
                    <p className="text-sm text-slate-600">{unit?.buildingName}</p>
                    <p className="text-sm text-slate-600">Makati City, Philippines</p>
                  </div>
                </div>
                <div className="space-y-3 text-right">
                  <p className="text-[10px] font-black uppercase text-indigo-600 tracking-widest">Payment Instructions</p>
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
                    <TableRow className="hover:bg-transparent border-slate-100">
                      <TableCell className="py-6">
                        <p className="font-bold text-slate-900">Security Deposit</p>
                        <p className="text-xs text-slate-500">Equivalent to two (2) months of rent</p>
                      </TableCell>
                      <TableCell className="text-right font-bold text-slate-900">₱{contract.securityDeposit.toLocaleString()}</TableCell>
                    </TableRow>
                    <TableRow className="hover:bg-transparent border-slate-100">
                      <TableCell className="py-6">
                        <p className="font-bold text-slate-900">Advance Rent</p>
                        <p className="text-xs text-slate-500">First month of lease</p>
                      </TableCell>
                      <TableCell className="text-right font-bold text-slate-900">₱{contract.advanceRent.toLocaleString()}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>

                <div className="flex justify-end pt-6">
                  <div className="w-full max-w-xs space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Subtotal</span>
                      <span className="font-bold text-slate-900">₱{(contract.securityDeposit + contract.advanceRent).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Tax (0%)</span>
                      <span className="font-bold text-slate-900">₱0.00</span>
                    </div>
                    <div className="flex justify-between items-center pt-3 border-t-2 border-slate-900">
                      <span className="text-lg font-black uppercase text-slate-900">Total Due</span>
                      <span className="text-2xl font-black text-indigo-600">₱{(contract.securityDeposit + contract.advanceRent).toLocaleString()}</span>
                    </div>
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
