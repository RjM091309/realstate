import fs from 'fs';

const path = new URL('../src/components/views/CRMView/CRMView.tsx', import.meta.url);
let s = fs.readFileSync(path, 'utf8');
const start = s.indexOf('<TabsContent value="brokers"');
const end = s.indexOf('<TabsContent value="blacklist"');
if (start === -1 || end === -1) {
  console.error('markers not found', start, end);
  process.exit(1);
}
const replacement = `<TabsContent value="brokers" className="mt-4 w-full outline-none">
          <BrokersPanel
            canCreate={canCreate}
            canUpdate={canUpdate}
            canDelete={canDelete}
          />
        </TabsContent>
        `;
s = s.slice(0, start) + replacement + s.slice(end);
fs.writeFileSync(path, s);
console.log('replaced brokers tab');
