import PDFDocument from 'pdfkit';

const SLUGS = new Set(['house-rules', 'move-in-clearance']);

export function isValidPortalArtifactSlug(slug) {
  return typeof slug === 'string' && SLUGS.has(slug);
}

function buildHouseRulesPdf(doc) {
  doc.fontSize(20).text('House Rules Handbook', { underline: true });
  doc.moveDown();
  doc.fontSize(11);
  doc.text(
    'This document summarizes standard community and building rules. For the full policy, contact property management.',
  );
  doc.moveDown();
  const rules = [
    'Quiet hours: 10:00 PM – 7:00 AM.',
    'No structural alterations without written approval.',
    'Dispose of trash only in designated areas and on scheduled collection days.',
    'Pets are subject to building policy and registration requirements.',
    'Smoking is prohibited in common areas and inside units unless otherwise permitted in writing.',
    'Report leaks, electrical issues, or safety concerns to management immediately.',
  ];
  rules.forEach((line, i) => {
    doc.text(`${i + 1}. ${line}`, { indent: 12 });
    doc.moveDown(0.35);
  });
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
  const doc = new PDFDocument({ margin: 50 });
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
