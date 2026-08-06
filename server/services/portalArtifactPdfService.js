import PDFDocument from 'pdfkit';

const SLUGS = new Set(['house-rules', 'move-in-clearance']);

const PAGE_WIDTH = 495;

const COLORS = {
  navy: '#1e3a5f',
  navyDark: '#152a45',
  accent: '#4b89cd',
  accentSoft: '#dbeafe',
  slate: '#0f172a',
  muted: '#64748b',
  border: '#e2e8f0',
  cardBg: '#f8fafc',
  white: '#ffffff',
};

const HOUSE_RULES = [
  {
    icon: 'quiet',
    title: 'Quiet Hours',
    body: 'Quiet hours are observed from 10:00 PM to 7:00 AM. Please keep noise levels low to respect neighbors and maintain a peaceful community.',
  },
  {
    icon: 'build',
    title: 'No Structural Alterations',
    body: 'Do not make structural changes, drill into walls, or modify fixtures without prior written approval from property management.',
  },
  {
    icon: 'trash',
    title: 'Trash & Waste Disposal',
    body: 'Dispose of trash only in designated areas and on scheduled collection days. Keep common areas clean and free of clutter.',
  },
  {
    icon: 'pets',
    title: 'Pet Policy',
    body: 'Pets are subject to building policy and registration requirements. Keep pets leashed in common areas and clean up after them.',
  },
  {
    icon: 'smoke',
    title: 'No Smoking',
    body: 'Smoking is prohibited in common areas and inside units unless otherwise permitted in writing by management.',
  },
  {
    icon: 'alert',
    title: 'Report Issues Promptly',
    body: 'Report leaks, electrical issues, or safety concerns to management immediately. Early reporting helps prevent costly damage.',
  },
];

export function isValidPortalArtifactSlug(slug) {
  return typeof slug === 'string' && SLUGS.has(slug);
}

function ensureSpace(doc, minHeight = 72) {
  if (doc.y + minHeight > doc.page.height - doc.page.margins.bottom) {
    doc.addPage();
    drawHouseRulesPageFooter(doc);
  }
}

function drawHouseRulesPageFooter(doc) {
  const y = doc.page.height - doc.page.margins.bottom + 14;
  doc
    .font('Helvetica')
    .fontSize(7)
    .fillColor('#94a3b8')
    .text('House Rules Handbook — Tenant Portal', doc.page.margins.left, y, {
      width: PAGE_WIDTH,
      align: 'center',
    });
}

function drawHeaderBand(doc, title, subtitle) {
  const left = doc.page.margins.left;
  const top = doc.page.margins.top - 10;
  const width = PAGE_WIDTH;

  doc.save();
  doc.rect(left, top, width, 72).fill(COLORS.navy);
  doc.rect(left, top + 58, width, 14).fill(COLORS.navyDark);
  doc.restore();

  drawBuildingIcon(doc, left + width - 52, top + 16, 36, '#ffffff');

  doc.font('Helvetica-Bold').fontSize(22).fillColor(COLORS.white).text(title, left + 18, top + 16, {
    width: width - 80,
  });
  doc.font('Helvetica').fontSize(9.5).fillColor('#bfdbfe').text(subtitle, left + 18, top + 44, {
    width: width - 80,
  });

  doc.y = top + 86;
}

function drawBuildingIcon(doc, x, y, size, color) {
  const s = size / 32;
  doc.save();
  doc.translate(x, y);
  doc.scale(s);
  doc.fillColor(color);

  doc.rect(6, 14, 20, 16).fill();
  doc.rect(10, 8, 12, 6).fill();
  doc.fillColor(COLORS.navy);
  doc.rect(9, 11, 3, 3).fill();
  doc.rect(14, 11, 3, 3).fill();
  doc.rect(19, 11, 3, 3).fill();
  doc.rect(12, 20, 8, 10).fill(COLORS.navyDark);
  doc.restore();
}

function drawIcon(doc, kind, cx, cy, diameter, fg) {
  const r = diameter / 2;
  doc.save();
  doc.circle(cx, cy, r).fill(COLORS.accentSoft);
  doc.strokeColor(COLORS.accent).lineWidth(1.35).lineCap('round').lineJoin('round');

  const s = diameter / 28;
  doc.translate(cx - 14 * s, cy - 14 * s);
  doc.scale(s);

  switch (kind) {
    case 'quiet':
      doc
        .moveTo(14, 8)
        .bezierCurveTo(10, 8, 7, 11, 7, 14)
        .bezierCurveTo(7, 18, 10, 21, 14, 21)
        .bezierCurveTo(16, 21, 18, 20, 19, 18)
        .stroke();
      doc.moveTo(19, 10).lineTo(22, 7).stroke();
      doc.moveTo(19, 10).lineTo(22, 13).stroke();
      break;
    case 'build':
      doc.rect(8, 10, 12, 10).stroke();
      doc.moveTo(8, 10).lineTo(14, 5).lineTo(20, 10).stroke();
      doc.moveTo(12, 14).lineTo(12, 20).stroke();
      doc.moveTo(16, 14).lineTo(16, 20).stroke();
      break;
    case 'trash':
      doc.moveTo(10, 9).lineTo(18, 9).stroke();
      doc.moveTo(11, 9).lineTo(12, 6).lineTo(16, 6).lineTo(17, 9).stroke();
      doc.rect(10, 10, 8, 12).stroke();
      doc.moveTo(12, 13).lineTo(12, 19).stroke();
      doc.moveTo(14, 13).lineTo(14, 19).stroke();
      doc.moveTo(16, 13).lineTo(16, 19).stroke();
      break;
    case 'pets':
      doc.circle(8, 10, 2.2).fill(COLORS.accent);
      doc.circle(20, 10, 2.2).fill(COLORS.accent);
      doc.circle(10, 6, 2).fill(COLORS.accent);
      doc.circle(18, 6, 2).fill(COLORS.accent);
      doc.circle(14, 12, 3.5).fill(COLORS.accent);
      doc.fillColor(COLORS.accentSoft);
      break;
    case 'smoke':
      doc.circle(14, 14, 7).stroke();
      doc.moveTo(9, 19).lineTo(19, 9).stroke();
      doc.moveTo(12, 11).lineTo(12, 16).stroke();
      doc.moveTo(16, 11).lineTo(16, 16).stroke();
      break;
    case 'alert':
      doc.moveTo(14, 6).lineTo(22, 20).lineTo(6, 20).closePath().stroke();
      doc.moveTo(14, 11).lineTo(14, 16).stroke();
      doc.circle(14, 18, 0.8).fill(COLORS.accent);
      break;
    default:
      break;
  }

  doc.restore();
}

function drawIntroBox(doc, text) {
  ensureSpace(doc, 56);
  const left = doc.page.margins.left;
  const width = PAGE_WIDTH;
  const padding = 14;
  const textWidth = width - padding * 2;

  doc.font('Helvetica').fontSize(10);
  const textHeight = doc.heightOfString(text, { width: textWidth });
  const boxHeight = textHeight + padding * 2;

  doc.save();
  doc.roundedRect(left, doc.y, width, boxHeight, 6).fill(COLORS.cardBg);
  doc.roundedRect(left, doc.y, width, boxHeight, 6).strokeColor(COLORS.border).lineWidth(1).stroke();
  doc.restore();

  doc
    .font('Helvetica')
    .fontSize(10)
    .fillColor(COLORS.muted)
    .text(text, left + padding, doc.y + padding, { width: textWidth, lineGap: 2 });

  doc.y += boxHeight + 16;
}

function drawRuleCard(doc, rule, index) {
  const left = doc.page.margins.left;
  const width = PAGE_WIDTH;
  const iconSize = 40;
  const padding = 14;
  const gap = 12;
  const textX = left + padding + iconSize + gap;
  const textWidth = width - padding * 2 - iconSize - gap;

  doc.font('Helvetica-Bold').fontSize(11);
  const titleHeight = doc.heightOfString(rule.title, { width: textWidth });
  doc.font('Helvetica').fontSize(9.5);
  const bodyHeight = doc.heightOfString(rule.body, { width: textWidth, lineGap: 1.5 });
  const innerHeight = Math.max(iconSize, titleHeight + bodyHeight + 4);
  const cardHeight = innerHeight + padding * 2;

  ensureSpace(doc, cardHeight + 10);

  const cardTop = doc.y;

  doc.save();
  doc.roundedRect(left, cardTop, width, cardHeight, 8).fill(COLORS.white);
  doc.roundedRect(left, cardTop, width, cardHeight, 8).strokeColor(COLORS.border).lineWidth(1).stroke();
  doc.rect(left, cardTop + 8, 4, cardHeight - 16).fill(COLORS.accent);
  doc.restore();

  const iconCy = cardTop + padding + innerHeight / 2;
  drawIcon(doc, rule.icon, left + padding + iconSize / 2, iconCy, iconSize, COLORS.accent);

  const numberY = cardTop + padding - 1;
  doc
    .font('Helvetica-Bold')
    .fontSize(8)
    .fillColor(COLORS.accent)
    .text(String(index + 1).padStart(2, '0'), textX, numberY, { width: textWidth });

  doc
    .font('Helvetica-Bold')
    .fontSize(11)
    .fillColor(COLORS.slate)
    .text(rule.title, textX, numberY + 10, { width: textWidth });

  doc
    .font('Helvetica')
    .fontSize(9.5)
    .fillColor(COLORS.muted)
    .text(rule.body, textX, numberY + 10 + titleHeight + 3, { width: textWidth, lineGap: 1.5 });

  doc.y = cardTop + cardHeight + 10;
}

function buildHouseRulesPdf(doc) {
  drawHeaderBand(
    doc,
    'House Rules Handbook',
    'Community & building guidelines for a safe, comfortable home',
  );

  drawIntroBox(
    doc,
    'Welcome to your new home. This handbook summarizes standard community and building rules that help keep our property safe, clean, and enjoyable for everyone. For the complete policy or questions, please contact property management.',
  );

  doc.font('Helvetica-Bold').fontSize(12).fillColor(COLORS.slate).text('Community Guidelines');
  doc.moveDown(0.6);

  HOUSE_RULES.forEach((rule, index) => {
    drawRuleCard(doc, rule, index);
  });

  ensureSpace(doc, 48);
  doc.moveDown(0.5);
  doc.save();
  const footerLeft = doc.page.margins.left;
  const footerWidth = PAGE_WIDTH;
  const footerTop = doc.y;
  doc.roundedRect(footerLeft, footerTop, footerWidth, 36, 6).fill(COLORS.navy);
  doc
    .font('Helvetica-Bold')
    .fontSize(9)
    .fillColor(COLORS.white)
    .text('Questions? Contact property management for the full house rules policy.', footerLeft + 14, footerTop + 12, {
      width: footerWidth - 28,
      align: 'center',
    });
  doc.restore();

  drawHouseRulesPageFooter(doc);
}

function buildMoveInClearancePdf(doc) {
  doc.fontSize(20).text('Move-In Clearance', { underline: true });
  doc.moveDown();
  doc.fontSize(11);
  doc.text(
    'Use this checklist as a reference for your move-in process. Signed copies may be kept on file by management.',
  );
  doc.moveDown();
  const items = [
    'Utilities activated or transferred to tenant name (as applicable).',
    'Initial walkthrough completed; photos of unit condition documented.',
    'Keys, access cards, and parking permits received.',
    'Smoke detectors tested; tenant acknowledges responsibility for battery replacement.',
    'House rules and emergency contacts acknowledged.',
  ];
  items.forEach((line, i) => {
    doc.text(`[ ] ${line}`, { indent: 12 });
    doc.moveDown(0.5);
  });
  doc.moveDown();
  doc.fontSize(10).fillColor('#666666').text('Generated for tenant portal access.', { align: 'center' });
}

/**
 * Streams a generated PDF for the given artifact slug to the response.
 * @param {import('express').Response} res
 * @param {string} slug
 * @param {string} downloadFileName
 */
export function streamPortalArtifactPdf(res, slug, downloadFileName) {
  const doc = new PDFDocument({ margin: 50, size: 'A4' });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${downloadFileName}"`);
  doc.pipe(res);
  if (slug === 'house-rules') {
    buildHouseRulesPdf(doc);
  } else if (slug === 'move-in-clearance') {
    buildMoveInClearancePdf(doc);
  }
  doc.end();
}
