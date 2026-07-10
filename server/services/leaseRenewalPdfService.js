import PDFDocument from 'pdfkit';

const PAGE_WIDTH = 495;
const COLORS = {
  indigo: '#312e81',
  indigoLight: '#eef2ff',
  slate: '#0f172a',
  muted: '#64748b',
  border: '#cbd5e1',
  success: '#059669',
  warning: '#d97706',
  danger: '#dc2626',
};

function fmtMoney(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return '₱0.00';
  return `₱${v.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(value) {
  if (!value) return '—';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function fmtStatus(value) {
  const s = String(value ?? 'pending').replace(/_/g, ' ');
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function ensureSpace(doc, minHeight = 72) {
  if (doc.y + minHeight > doc.page.height - doc.page.margins.bottom) {
    doc.addPage();
    drawPageFooter(doc);
  }
}

function drawPageFooter(doc) {
  const y = doc.page.height - doc.page.margins.bottom + 12;
  doc
    .font('Helvetica')
    .fontSize(7)
    .fillColor('#94a3b8')
    .text('Lease Renewal Agreement — Draft for review only', doc.page.margins.left, y, {
      width: PAGE_WIDTH,
      align: 'center',
    });
}

function drawHeaderBand(doc, title, subtitle) {
  const left = doc.page.margins.left;
  const top = doc.page.margins.top - 10;
  const width = PAGE_WIDTH;

  doc.save();
  doc.rect(left, top, width, 56).fill(COLORS.indigo);
  doc.restore();

  doc.font('Helvetica-Bold').fontSize(18).fillColor('#ffffff').text(title, left + 16, top + 14, { width: width - 32 });
  doc.font('Helvetica').fontSize(9).fillColor('#c7d2fe').text(subtitle, left + 16, top + 38, { width: width - 32 });

  doc.y = top + 68;
}

function drawDraftBadge(doc) {
  const left = doc.page.margins.left + PAGE_WIDTH - 72;
  const top = doc.page.margins.top + 6;
  doc.save();
  doc.roundedRect(left, top, 56, 18, 4).fill('#fbbf24');
  doc.font('Helvetica-Bold').fontSize(7).fillColor('#78350f').text('DRAFT', left, top + 5, { width: 56, align: 'center' });
  doc.restore();
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

      doc.font('Helvetica-Bold').fontSize(7.5).fillColor(COLORS.muted).text(label.toUpperCase(), x, rowTop, {
        width: colWidth,
      });
      const valueY = rowTop + 11;
      doc.font('Helvetica').fontSize(10).fillColor(COLORS.slate).text(String(value ?? '—'), x, valueY, {
        width: colWidth,
      });
      rowBottom = Math.max(rowBottom, doc.y);
    }

    doc.y = rowBottom + 10;
  }
}

function sectionTitle(doc, title) {
  ensureSpace(doc, 44);
  doc.moveDown(0.2);
  const x = doc.page.margins.left;
  doc.save();
  doc.rect(x, doc.y, 3, 14).fill(COLORS.indigo);
  doc.restore();
  doc.font('Helvetica-Bold').fontSize(12).fillColor(COLORS.slate).text(title, x + 10, doc.y);
  doc.moveDown(0.35);
}

function writeComparisonCard(doc, { leftTitle, leftRows, rightTitle, rightRows }) {
  ensureSpace(doc, 120);
  const cardWidth = (PAGE_WIDTH - 12) / 2;
  const startY = doc.y;
  const leftX = doc.page.margins.left;
  const rightX = leftX + cardWidth + 12;

  const drawCard = (x, title, rows, accent) => {
    doc.save();
    doc.roundedRect(x, startY, cardWidth, 108, 6).lineWidth(1).strokeColor(COLORS.border).stroke();
    doc.rect(x, startY, cardWidth, 22).fill(accent);
    doc.restore();
    doc.font('Helvetica-Bold').fontSize(9).fillColor(COLORS.indigo).text(title, x + 10, startY + 7);
    let y = startY + 30;
    rows.forEach(([label, value]) => {
      doc.font('Helvetica-Bold').fontSize(7).fillColor(COLORS.muted).text(label.toUpperCase(), x + 10, y, { width: cardWidth - 20 });
      doc.font('Helvetica').fontSize(9.5).fillColor(COLORS.slate).text(String(value ?? '—'), x + 10, y + 10, { width: cardWidth - 20 });
      y += 26;
    });
  };

  drawCard(leftX, leftTitle, leftRows, COLORS.indigoLight);
  drawCard(rightX, rightTitle, rightRows, '#ecfdf5');
  doc.y = startY + 118;
}

function writeTable(doc, columns, rows) {
  ensureSpace(doc, 28 + rows.length * 22);
  const startY = doc.y;
  let x = doc.page.margins.left;

  doc.save();
  doc.rect(doc.page.margins.left, startY, PAGE_WIDTH, 18).fill('#f8fafc');
  doc.restore();

  doc.font('Helvetica-Bold').fontSize(8).fillColor('#334155');
  columns.forEach((col) => {
    doc.text(col.label, x + 6, startY + 5, { width: col.width - 12, lineBreak: false });
    x += col.width;
  });

  let rowY = startY + 22;
  rows.forEach((values, idx) => {
    if (idx % 2 === 1) {
      doc.save();
      doc.rect(doc.page.margins.left, rowY - 2, PAGE_WIDTH, 20).fill('#f8fafc');
      doc.restore();
    }
    x = doc.page.margins.left;
    values.forEach((value, colIdx) => {
      const align = columns[colIdx].align ?? 'left';
      doc
        .font('Helvetica')
        .fontSize(9)
        .fillColor(COLORS.slate)
        .text(String(value ?? '—'), x + 6, rowY, { width: columns[colIdx].width - 12, align });
      x += columns[colIdx].width;
    });
    rowY += 20;
  });

  doc.y = rowY + 6;
}

function writeStatusPill(doc, label, status) {
  ensureSpace(doc, 28);
  const normalized = String(status ?? 'pending').toLowerCase();
  let color = COLORS.warning;
  if (normalized === 'approved' || normalized === 'signed' || normalized === 'active') color = COLORS.success;
  if (normalized === 'rejected' || normalized === 'declined') color = COLORS.danger;

  doc.font('Helvetica-Bold').fontSize(8).fillColor(COLORS.muted).text(label.toUpperCase(), doc.page.margins.left, doc.y, { continued: true });
  doc.font('Helvetica-Bold').fontSize(9).fillColor(color).text(`  ${fmtStatus(status)}`);
  doc.moveDown(0.4);
}

function writeSignatureBlock(doc) {
  ensureSpace(doc, 90);
  const blockWidth = (PAGE_WIDTH - 24) / 2;
  const startY = doc.y;
  const leftX = doc.page.margins.left;
  const rightX = leftX + blockWidth + 24;

  const drawBlock = (x, title) => {
    doc.font('Helvetica-Bold').fontSize(8).fillColor(COLORS.muted).text(title.toUpperCase(), x, startY);
    doc
      .moveTo(x, startY + 44)
      .lineTo(x + blockWidth, startY + 44)
      .strokeColor(COLORS.border)
      .stroke();
    doc.font('Helvetica').fontSize(7.5).fillColor('#94a3b8').text('Signature over printed name', x, startY + 50);
    doc.text('Date: ___________________', x, startY + 62);
  };

  drawBlock(leftX, 'Tenant');
  drawBlock(rightX, 'Authorized Manager');
  doc.y = startY + 82;
}

export function buildRenewalDraftPdfBuffer(context) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const { payload } = context;
    const { summary, renewal } = payload;
    const terms = renewal.terms ?? {};
    const previousRent = Number(summary.currentMonthlyRent ?? terms.previousRent ?? 0);
    const newRent = Number(terms.monthlyRent ?? 0);
    const increaseAmt = newRent - previousRent;
    const increasePct = terms.rentIncreasePercentage ?? (previousRent > 0 ? ((increaseAmt / previousRent) * 100).toFixed(1) : 0);

    drawHeaderBand(doc, 'Lease Renewal Agreement', `Generated ${new Date().toLocaleString()}`);
    drawDraftBadge(doc);
    doc.moveDown(0.4);

    writeSummaryGrid(doc, [
      ['Contract Number', summary.contractNumber],
      ['Unit', summary.unitNumber],
      ['Tenant', summary.tenantName],
      ['Tenant Since', fmtDate(summary.tenantSince)],
      ['Previous Renewals', String(summary.previousRenewals ?? 0)],
      ['Renewal Status', fmtStatus(renewal.renewalStatus)],
    ]);

    sectionTitle(doc, 'Lease Comparison');
    writeComparisonCard(doc, {
      leftTitle: 'Current Lease',
      leftRows: [
        ['Period', `${fmtDate(summary.currentLeaseStart)} — ${fmtDate(summary.currentLeaseEnd)}`],
        ['Monthly Rent', fmtMoney(previousRent)],
        ['Contract', summary.contractNumber],
      ],
      rightTitle: 'Proposed Renewal',
      rightRows: [
        ['Period', `${fmtDate(terms.startDate)} — ${fmtDate(terms.endDate)}`],
        ['Monthly Rent', fmtMoney(newRent)],
        ['Rent Change', `${increasePct}% (${increaseAmt >= 0 ? '+' : ''}${fmtMoney(increaseAmt)})`],
      ],
    });

    sectionTitle(doc, 'Financial Terms');
    const feeRows = [
      ['Monthly Rent', fmtMoney(newRent), 'Recurring'],
      ['Security Deposit', fmtMoney(terms.securityDeposit), 'One-time / hold'],
      ['Advance Rent', fmtMoney(terms.advanceRent), 'Prepaid'],
    ];
    if (Number(terms.parkingFee) > 0) feeRows.push(['Parking Fee', fmtMoney(terms.parkingFee), 'Monthly']);
    if (Number(terms.associationDues) > 0) feeRows.push(['Association Dues', fmtMoney(terms.associationDues), 'Monthly']);
    if (Number(terms.renewalFee) > 0) feeRows.push(['Renewal Fee', fmtMoney(terms.renewalFee), 'One-time']);

    writeTable(
      doc,
      [
        { label: 'CHARGE', width: 180 },
        { label: 'AMOUNT', width: 120, align: 'right' },
        { label: 'TYPE', width: PAGE_WIDTH - 300 },
      ],
      feeRows,
    );

    if (Number(renewal.outstandingBalance) > 0) {
      sectionTitle(doc, 'Outstanding Balance');
      const b = renewal.balanceBreakdown ?? {};
      writeTable(
        doc,
        [
          { label: 'CATEGORY', width: 220 },
          { label: 'AMOUNT', width: PAGE_WIDTH - 220, align: 'right' },
        ],
        [
          ['Outstanding Rent', fmtMoney(b.outstandingRent)],
          ['Utilities', fmtMoney(b.utilities)],
          ['Penalties', fmtMoney(b.penalties)],
          ['Parking Fees', fmtMoney(b.parkingFees)],
          ['Other Charges', fmtMoney(b.otherCharges)],
          ['Total Outstanding', fmtMoney(renewal.outstandingBalance)],
        ],
      );
      if (renewal.carryOverBalance) {
        doc.font('Helvetica-Bold').fontSize(9).fillColor(COLORS.warning).text('Carry over approved', doc.page.margins.left, doc.y);
        doc.moveDown(0.2);
        doc.font('Helvetica').fontSize(9).fillColor(COLORS.slate).text(`Reason: ${renewal.carryOverReason || '—'}`, { width: PAGE_WIDTH });
        doc.moveDown(0.5);
      }
    }

    sectionTitle(doc, 'Approval & Signatures');
    writeStatusPill(doc, 'Manager Approval', renewal.approvalStatus);
    writeStatusPill(doc, 'Tenant Signature', renewal.tenantSignatureStatus);
    if (renewal.signedAt) {
      doc.font('Helvetica').fontSize(9).fillColor(COLORS.muted).text(`Signed on ${fmtDate(renewal.signedAt)}`);
      doc.moveDown(0.3);
    }
    if (renewal.managerApprovalNotes) {
      doc.font('Helvetica-Bold').fontSize(8).fillColor(COLORS.muted).text('APPROVAL NOTES');
      doc.font('Helvetica').fontSize(9).fillColor(COLORS.slate).text(renewal.managerApprovalNotes, { width: PAGE_WIDTH });
      doc.moveDown(0.4);
    }
    writeSignatureBlock(doc);

    ensureSpace(doc, 40);
    doc.save();
    doc.roundedRect(doc.page.margins.left, doc.y, PAGE_WIDTH, 36, 4).fill('#f8fafc');
    doc.restore();
    doc
      .font('Helvetica-Oblique')
      .fontSize(8)
      .fillColor(COLORS.muted)
      .text(
        'This document is a draft for review only and does not constitute a binding agreement until signed by all parties and activated in the system.',
        doc.page.margins.left + 10,
        doc.y + 8,
        { width: PAGE_WIDTH - 20 },
      );

    drawPageFooter(doc);
    doc.end();
  });
}

export function buildRenewalStatementPdfBuffer(context) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const { payload } = context;
    const { summary, renewal } = payload;
    const b = renewal.balanceBreakdown ?? {};

    drawHeaderBand(doc, 'Account Statement', `Statement date: ${fmtDate(new Date())}`);
    doc.moveDown(0.4);

    writeSummaryGrid(doc, [
      ['Contract', summary.contractNumber],
      ['Tenant', summary.tenantName],
      ['Unit', summary.unitNumber],
      ['Outstanding Total', fmtMoney(renewal.outstandingBalance)],
    ]);

    sectionTitle(doc, 'Balance Breakdown');
    writeTable(
      doc,
      [
        { label: 'CATEGORY', width: 220 },
        { label: 'AMOUNT', width: PAGE_WIDTH - 220, align: 'right' },
      ],
      [
        ['Outstanding Rent', fmtMoney(b.outstandingRent)],
        ['Utilities', fmtMoney(b.utilities)],
        ['Penalties', fmtMoney(b.penalties)],
        ['Parking Fees', fmtMoney(b.parkingFees)],
        ['Other Charges', fmtMoney(b.otherCharges)],
        ['Total Outstanding', fmtMoney(renewal.outstandingBalance)],
      ],
    );

    drawPageFooter(doc);
    doc.end();
  });
}

export async function streamRenewalDraftPdf(res, context) {
  const buffer = await buildRenewalDraftPdfBuffer(context);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'attachment; filename="lease-renewal-draft.pdf"');
  res.setHeader('Cache-Control', 'no-store');
  res.send(buffer);
}

export async function streamRenewalStatementPdf(res, context) {
  const buffer = await buildRenewalStatementPdfBuffer(context);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'attachment; filename="lease-renewal-statement.pdf"');
  res.setHeader('Cache-Control', 'no-store');
  res.send(buffer);
}
