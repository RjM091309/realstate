import PDFDocument from 'pdfkit';

const PAGE_WIDTH = 495;

function fmtDate(value) {
  if (!value) return '—';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function ensureSpace(doc, minHeight = 72) {
  if (doc.y + minHeight > doc.page.height - doc.page.margins.bottom) {
    doc.addPage();
  }
}

function writeSummaryGrid(doc, rows) {
  const colWidth = (PAGE_WIDTH - 16) / 2;

  for (let i = 0; i < rows.length; i += 2) {
    ensureSpace(doc, 54);
    const rowTop = doc.y;
    let rowBottom = rowTop;

    for (let col = 0; col < 2; col += 1) {
      const entry = rows[i + col];
      if (!entry) break;
      const [label, value] = entry;
      const x = doc.page.margins.left + col * (colWidth + 16);

      doc.font('Helvetica-Bold').fontSize(8).fillColor('#64748b').text(label.toUpperCase(), x, rowTop, {
        width: colWidth,
      });
      const valueY = rowTop + 12;
      doc.font('Helvetica').fontSize(10).fillColor('#0f172a').text(String(value ?? '—'), x, valueY, {
        width: colWidth,
      });
      rowBottom = Math.max(rowBottom, doc.y);
    }

    doc.y = rowBottom + 12;
  }
}

function writeTableHeader(doc, columns) {
  ensureSpace(doc, 28);
  const startY = doc.y;
  let x = doc.page.margins.left;
  doc.font('Helvetica-Bold').fontSize(8).fillColor('#334155');
  columns.forEach((col) => {
    doc.text(col.label, x, startY, { width: col.width, lineBreak: false });
    x += col.width;
  });
  const lineY = startY + 14;
  doc
    .moveTo(doc.page.margins.left, lineY)
    .lineTo(doc.page.width - doc.page.margins.right, lineY)
    .strokeColor('#cbd5e1')
    .stroke();
  doc.y = lineY + 6;
}

function writeTableRow(doc, columns, values) {
  ensureSpace(doc, 20);
  const startY = doc.y;
  const heights = values.map((value, idx) =>
    doc.heightOfString(String(value ?? '—'), { width: columns[idx].width }),
  );
  const rowHeight = Math.max(12, ...heights);

  values.forEach((value, idx) => {
    const x = doc.page.margins.left + columns.slice(0, idx).reduce((sum, col) => sum + col.width, 0);
    doc.font('Helvetica').fontSize(9).fillColor('#0f172a').text(String(value ?? '—'), x, startY, {
      width: columns[idx].width,
      lineBreak: true,
    });
  });

  doc.y = startY + rowHeight + 8;
}

function sectionTitle(doc, title) {
  ensureSpace(doc, 36);
  doc.moveDown(0.3);
  doc.font('Helvetica-Bold').fontSize(12).fillColor('#0f172a').text(title);
  doc.moveDown(0.25);
}

/**
 * @param {import('express').Response} res
 * @param {{ payload: object, details: object | null, fileName: string }} input
 */
export function streamInspectionReportPdf(res, { payload, details, fileName }) {
  const doc = new PDFDocument({ margin: 50, size: 'A4' });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
  res.setHeader('Cache-Control', 'no-store');
  doc.pipe(res);

  const { inspection, checklist, inventory, photos, logs } = payload;
  const contractNo = details?.contract_no ?? inspection.contractId;
  const unitLabel = details
    ? `${details.unit_number ?? '—'} · ${details.building_name ?? '—'}`
    : inspection.unitId;
  const tenantName = details?.tenant_name ?? '—';
  const periodLabel = details
    ? `${fmtDate(details.start_date)} — ${fmtDate(details.end_date)}`
    : '—';

  doc.font('Helvetica-Bold').fontSize(20).fillColor('#0f172a').text('Unit Inspection Report');
  doc.moveDown(0.15);
  doc.font('Helvetica').fontSize(10).fillColor('#64748b').text(`Generated ${new Date().toLocaleString()}`);
  doc.moveDown(0.7);

  writeSummaryGrid(doc, [
    ['Contract', contractNo],
    ['Unit', unitLabel],
    ['Tenant', tenantName],
    ['Period', periodLabel],
    ['Status', String(inspection.status).replace(/_/g, ' ')],
    ['Checklist Score', `${Math.round(inspection.checklistScore)}%`],
    ['Inventory Verified', `${Math.round(inspection.inventoryCompletion)}%`],
    ['Photos Complete', inspection.photosComplete ? 'Yes' : 'No'],
    ['Approved At', fmtDate(inspection.approvedAt)],
    ['Scheduled Move-In', fmtDate(inspection.scheduledMoveIn)],
    ['Inspector Remarks', inspection.inspectorRemarks || '—'],
  ]);

  sectionTitle(doc, 'Inspection Checklist');
  const checklistCols = [
    { label: 'Item', width: 210 },
    { label: 'Result', width: 70 },
    { label: 'Remarks', width: 215 },
  ];
  writeTableHeader(doc, checklistCols);
  checklist.forEach((item) => {
    writeTableRow(doc, checklistCols, [item.itemLabel, item.result, item.remarks || '—']);
  });

  sectionTitle(doc, 'Inventory & Assets');
  const inventoryCols = [
    { label: 'Item', width: 170 },
    { label: 'Condition', width: 90 },
    { label: 'Qty', width: 40 },
    { label: 'Remarks', width: 195 },
  ];
  writeTableHeader(doc, inventoryCols);
  inventory.forEach((item) => {
    writeTableRow(doc, inventoryCols, [
      item.itemLabel,
      item.conditionState,
      item.quantity,
      item.remarks || '—',
    ]);
  });

  sectionTitle(doc, 'Photos & Evidence');
  const photoCounts = photos.reduce((acc, photo) => {
    acc[photo.section] = (acc[photo.section] ?? 0) + 1;
    return acc;
  }, {});
  const photoCols = [
    { label: 'Section', width: 180 },
    { label: 'Photos', width: 60 },
    { label: 'Notes', width: 255 },
  ];
  writeTableHeader(doc, photoCols);
  const photoSections = Object.keys(photoCounts);
  if (!photoSections.length) {
    writeTableRow(doc, photoCols, ['—', '0', 'No photos uploaded']);
  } else {
    photoSections.forEach((section) => {
      writeTableRow(doc, photoCols, [
        section.replace(/_/g, ' '),
        photoCounts[section],
        'Stored in inspection record',
      ]);
    });
  }

  sectionTitle(doc, 'Activity Log');
  const logCols = [
    { label: 'Date', width: 95 },
    { label: 'Event', width: 120 },
    { label: 'Details', width: 280 },
  ];
  writeTableHeader(doc, logCols);
  logs.slice(0, 30).forEach((log) => {
    writeTableRow(doc, logCols, [
      fmtDate(log.createdAt),
      log.eventType.replace(/_/g, ' '),
      log.message,
    ]);
  });

  doc.end();
}
