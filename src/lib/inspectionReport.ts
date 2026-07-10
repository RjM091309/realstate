import { format } from 'date-fns';
import type { Contract, Unit, UnitInspectionPayload } from '@/types';

export type InspectionReportLabels = {
  title: string;
  contractNumber: string;
  unit: string;
  tenant: string;
  agent: string;
  period: string;
  status: string;
  checklistScore: string;
  inventoryVerified: string;
  photosUploaded: string;
  inspectorRemarks: string;
  checklistTitle: string;
  inventoryTitle: string;
  photosTitle: string;
  logsTitle: string;
  complete: string;
  incomplete: string;
  pass: string;
  fail: string;
  pending: string;
  remarks: string;
  quantity: string;
  condition: string;
  generatedOn: string;
  sectionLabels: Record<string, string>;
  statusLabels: Record<string, string>;
  conditionLabels: Record<string, string>;
};

export type InspectionReportContext = {
  contract: Contract | null;
  unit: Unit | null;
  tenantName: string;
  agentName: string;
  payload: UnitInspectionPayload;
  labels: InspectionReportLabels;
};

type BuildReportOptions = {
  includePhotoPreviews?: boolean;
  maxPhotoDataUrlLength?: number;
};

function esc(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function fmtDate(value: string | Date | null | undefined) {
  if (!value) return '—';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return format(d, 'MMM d, yyyy');
}

function resultLabel(labels: InspectionReportLabels, result: string) {
  if (result === 'pass') return labels.pass;
  if (result === 'fail') return labels.fail;
  return labels.pending;
}

function photoThumbTag(dataUrl: string, label: string, maxLength: number) {
  if (!dataUrl || dataUrl.length > maxLength) return '';
  return `<img src="${dataUrl}" alt="${esc(label)}" style="width:72px;height:72px;object-fit:cover;border-radius:8px;border:1px solid #e2e8f0;margin-right:6px;" />`;
}

export function buildInspectionReportHtml(
  ctx: InspectionReportContext,
  options: BuildReportOptions = {},
): string {
  const { includePhotoPreviews = true, maxPhotoDataUrlLength = 150_000 } = options;
  const { contract, unit, tenantName, agentName, payload, labels } = ctx;
  const { inspection, checklist, inventory, photos, logs } = payload;
  const periodLabel = contract
    ? `${fmtDate(contract.startDate)} — ${fmtDate(contract.endDate)}`
    : '—';
  const statusLabel = labels.statusLabels[inspection.status] ?? inspection.status;
  const photosLabel = inspection.photosComplete ? labels.complete : labels.incomplete;

  const checklistRows = checklist
    .map(
      (item) => `
      <tr>
        <td>${esc(item.itemLabel)}</td>
        <td>${esc(resultLabel(labels, item.result))}</td>
        <td>${esc(item.remarks || '—')}</td>
      </tr>`,
    )
    .join('');

  const inventoryRows = inventory
    .map(
      (item) => `
      <tr>
        <td>${esc(item.itemLabel)}</td>
        <td>${esc(labels.conditionLabels[item.conditionState] ?? item.conditionState)}</td>
        <td>${item.quantity}</td>
        <td>${esc(item.remarks || '—')}</td>
      </tr>`,
    )
    .join('');

  const photosBySection = photos.reduce<Record<string, number>>((acc, photo) => {
    acc[photo.section] = (acc[photo.section] ?? 0) + 1;
    return acc;
  }, {});

  const photoRows = Object.entries(labels.sectionLabels)
    .map(([key, label]) => {
      const count = photosBySection[key] ?? 0;
      const sectionPhotos = photos.filter((p) => p.section === key);
      const thumbs = includePhotoPreviews
        ? sectionPhotos
            .slice(0, 3)
            .map((p) => photoThumbTag(p.photoDataUrl, label, maxPhotoDataUrlLength))
            .filter(Boolean)
            .join('')
        : '';
      const preview = thumbs || (count > 0 ? `${count} photo(s)` : '—');
      return `
      <tr>
        <td>${esc(label)}</td>
        <td>${count}</td>
        <td>${preview}</td>
      </tr>`;
    })
    .join('');

  const logRows = logs
    .slice(0, 25)
    .map(
      (log) => `
      <tr>
        <td>${esc(fmtDate(log.createdAt))}</td>
        <td>${esc(log.eventType.replace(/_/g, ' '))}</td>
        <td>${esc(log.message)}</td>
      </tr>`,
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${esc(labels.title)}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: Arial, Helvetica, sans-serif; color: #0f172a; margin: 0; padding: 24px; background: #fff; }
    h1 { font-size: 22px; margin: 0 0 4px; }
    h2 { font-size: 14px; margin: 24px 0 8px; text-transform: uppercase; letter-spacing: 0.08em; color: #475569; }
    .meta { color: #64748b; font-size: 12px; margin-bottom: 20px; }
    .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px 16px; margin-bottom: 8px; }
    .card { border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px; background: #f8fafc; break-inside: avoid; }
    .label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em; color: #64748b; margin-bottom: 4px; }
    .value { font-size: 13px; font-weight: 600; word-break: break-word; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 8px; }
    th, td { border: 1px solid #e2e8f0; padding: 8px; text-align: left; vertical-align: top; word-break: break-word; }
    th { background: #f1f5f9; font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; }
    @media print {
      body { padding: 12px; }
      h2 { page-break-after: avoid; }
      table { page-break-inside: auto; }
      tr { page-break-inside: avoid; }
      .card { background: #fff; }
    }
  </style>
</head>
<body>
  <h1>${esc(labels.title)}</h1>
  <div class="meta">${esc(labels.generatedOn)}: ${esc(format(new Date(), 'MMM d, yyyy h:mm a'))}</div>

  <div class="grid">
    <div class="card"><div class="label">${esc(labels.contractNumber)}</div><div class="value">${esc(contract?.contractNo ?? contract?.id ?? '—')}</div></div>
    <div class="card"><div class="label">${esc(labels.unit)}</div><div class="value">${esc(unit ? `${unit.unitNumber} · ${unit.buildingName}` : '—')}</div></div>
    <div class="card"><div class="label">${esc(labels.tenant)}</div><div class="value">${esc(tenantName || '—')}</div></div>
    <div class="card"><div class="label">${esc(labels.agent)}</div><div class="value">${esc(agentName || '—')}</div></div>
    <div class="card"><div class="label">${esc(labels.period)}</div><div class="value">${esc(periodLabel)}</div></div>
    <div class="card"><div class="label">${esc(labels.status)}</div><div class="value">${esc(statusLabel)}</div></div>
    <div class="card"><div class="label">${esc(labels.checklistScore)}</div><div class="value">${Math.round(inspection.checklistScore)}%</div></div>
    <div class="card"><div class="label">${esc(labels.inventoryVerified)}</div><div class="value">${Math.round(inspection.inventoryCompletion)}%</div></div>
    <div class="card"><div class="label">${esc(labels.photosUploaded)}</div><div class="value">${esc(photosLabel)}</div></div>
    <div class="card"><div class="label">${esc(labels.inspectorRemarks)}</div><div class="value">${esc(inspection.inspectorRemarks || '—')}</div></div>
  </div>

  <h2>${esc(labels.checklistTitle)}</h2>
  <table>
    <thead><tr><th>Item</th><th>Result</th><th>${esc(labels.remarks)}</th></tr></thead>
    <tbody>${checklistRows || '<tr><td colspan="3">—</td></tr>'}</tbody>
  </table>

  <h2>${esc(labels.inventoryTitle)}</h2>
  <table>
    <thead><tr><th>Item</th><th>${esc(labels.condition)}</th><th>${esc(labels.quantity)}</th><th>${esc(labels.remarks)}</th></tr></thead>
    <tbody>${inventoryRows || '<tr><td colspan="4">—</td></tr>'}</tbody>
  </table>

  <h2>${esc(labels.photosTitle)}</h2>
  <table>
    <thead><tr><th>Section</th><th>Count</th><th>Preview</th></tr></thead>
    <tbody>${photoRows || '<tr><td colspan="3">—</td></tr>'}</tbody>
  </table>

  <h2>${esc(labels.logsTitle)}</h2>
  <table>
    <thead><tr><th>Date</th><th>Event</th><th>Details</th></tr></thead>
    <tbody>${logRows || '<tr><td colspan="3">—</td></tr>'}</tbody>
  </table>
</body>
</html>`;
}

function printHtmlDocument(html: string) {
  const iframe = document.createElement('iframe');
  iframe.setAttribute('title', 'Inspection report print');
  iframe.setAttribute('aria-hidden', 'true');
  Object.assign(iframe.style, {
    position: 'fixed',
    right: '0',
    bottom: '0',
    width: '0',
    height: '0',
    border: '0',
    visibility: 'hidden',
  });
  document.body.appendChild(iframe);

  const frameWindow = iframe.contentWindow;
  const frameDoc = frameWindow?.document;
  if (!frameWindow || !frameDoc) {
    iframe.remove();
    throw new Error('Failed to prepare print preview.');
  }

  frameDoc.open();
  frameDoc.write(html);
  frameDoc.close();

  let printed = false;
  const triggerPrint = () => {
    if (printed) return;
    printed = true;
    frameWindow.focus();
    frameWindow.print();
    window.setTimeout(() => iframe.remove(), 2000);
  };

  frameWindow.addEventListener('load', () => window.setTimeout(triggerPrint, 200), { once: true });
  window.setTimeout(triggerPrint, 600);
}

export function printInspectionReport(ctx: InspectionReportContext) {
  const html = buildInspectionReportHtml(ctx, {
    includePhotoPreviews: true,
    maxPhotoDataUrlLength: 120_000,
  });
  printHtmlDocument(html);
}

export function inspectionReportFileName(contract: Contract | null) {
  const id = (contract?.contractNo ?? contract?.id ?? 'inspection').replace(/[^\w.-]+/g, '_');
  return `Inspection_${id}_${format(new Date(), 'yyyyMMdd')}.pdf`;
}
