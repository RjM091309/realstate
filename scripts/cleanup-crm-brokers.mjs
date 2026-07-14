import fs from 'fs';

const filePath = new URL('../src/components/views/CRMView/CRMView.tsx', import.meta.url);
let s = fs.readFileSync(filePath, 'utf8');

function removeBetween(startMarker, endMarker, label) {
  const start = s.indexOf(startMarker);
  const end = s.indexOf(endMarker, start);
  if (start === -1 || end === -1) {
    console.error('Failed:', label, start, end);
    process.exit(1);
  }
  s = s.slice(0, start) + s.slice(end);
  console.log('OK:', label);
}

removeBetween(
  '      <Modal\n        isOpen={isBrokerDeleteOpen}',
  '      <Modal\n        isOpen={isTenantActivateOpen}',
  'broker modals batch 1',
);

removeBetween(
  '      <Modal\n        isOpen={isBrokerFormOpen}',
  '      <Modal\n        isOpen={isBlacklistDetailsOpen}',
  'broker form modal',
);

removeBetween(
  'function brokerParseExpiry(raw?: string): Date | null {',
  'export function CRMView() {',
  'broker helpers',
);

fs.writeFileSync(filePath, s);
console.log('done pass 1');
