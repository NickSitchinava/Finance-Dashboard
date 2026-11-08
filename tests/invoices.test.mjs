import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';

const source="const money=(value,currency)=>`${currency} ${(value/100).toFixed(2)}`;\n"+
  (await readFile(new URL('../src/lib/invoices.ts',import.meta.url),'utf8'))
    .replace(/^import .*;$/gm,'')
    .split('export function invoiceDocumentFromInvoice')[0];
const compiled=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const {viewInvoice,cents,invoiceCsv}=await import(`data:text/javascript,${encodeURIComponent(compiled)}`);
const invoice={id:'one',amount:1000,currency:'GEL',lifecycle_state:'issued',due_date:'2099-01-01',status:'Pending'};
const payments=[
  {id:'p1',invoice_id:'one',amount:300,reversed_at:null},
  {id:'p2',invoice_id:'one',amount:200,reversed_at:null},
  {id:'p3',invoice_id:'one',amount:100,reversed_at:'2026-11-05T00:00:00Z'}
];

test('installments count once and reversed payments do not reduce balance',()=>{
  const view=viewInvoice(invoice,[],payments);
  assert.equal(view.paidCents,50000);
  assert.equal(view.remainingCents,50000);
  assert.equal(view.condition,'Partial');
});
test('drafts stay outside the payable lifecycle',()=>{
  const view=viewInvoice({...invoice,lifecycle_state:'draft',due_date:'2000-01-01'},[],[]);
  assert.equal(view.condition,'Draft');
  assert.equal(view.overdue,false);
});
test('a fully covered invoice is paid even if the stored legacy status is pending',()=>{
  const view=viewInvoice(invoice,[],[{id:'p',invoice_id:'one',amount:1000,reversed_at:null}]);
  assert.equal(view.condition,'Paid');
  assert.equal(view.remainingCents,0);
  assert.equal(cents('10.01'),1001);
});
test('CSV export neutralizes spreadsheet formulas in client text',()=>{
  const view=viewInvoice({...invoice,client_name:'=HYPERLINK("https://bad.example")',invoice_number:'INV-1',issue_date:'2026-11-05',project_name:'',description:'Normal'},[],[]);
  const csv=invoiceCsv([view]);
  assert.match(csv,/"'=HYPERLINK\(""https:\/\/bad.example""\)"/);
});
