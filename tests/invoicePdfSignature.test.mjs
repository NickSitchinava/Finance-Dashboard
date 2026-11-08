import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const whole = await readFile(new URL('../src/lib/invoices.ts', import.meta.url), 'utf8');
const model = whole.slice(whole.indexOf('export function invoiceDocumentFromInvoice'), whole.indexOf('const PDF_WIDTH_MM'));
const pagination = whole.slice(whole.indexOf('const PDF_WIDTH_MM'), whole.indexOf('export async function downloadInvoicePdf'));
const helpers = `const cents=value=>Math.round(Number(value)*100);
const invoiceMoney=(value,currency)=>currency+' '+(value/100).toFixed(2);
const dateLabel=value=>value||'—';
const normalizeSignature=value=>value;
`;
const compiled = ts.transpileModule(helpers+model+pagination+'\nexport {pageBreaks,pdfPageWidth};', { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
const { invoiceDocumentFromInvoice, pageBreaks, pdfPageWidth } = await import(`data:text/javascript,${encodeURIComponent(compiled)}`);
const invoice = {
  invoice_number:'INV-1', issuer_snapshot:{name:'Sender',email:'sender@example.com',address:'One Street'},
  recipient_snapshot:{name:'Client',email:'client@example.com',address:'Two Street'},
  client_name:'Client', issue_date:'2026-11-01', due_date:'2026-11-30',
  items:[{id:'item-1',description:'Design',quantity:2,unit_rate:50}], amount:100,
  currency:'USD',paidCents:2500,remainingCents:7500,description:'Monthly design services',notes:'Thank you',payment_terms:'Net 30',
  signature:{version:1,strokes:[[{x:1,y:1,w:2},{x:4,y:5,w:2}]]},
};

test('saved invoice becomes the same document data used by Live Preview',()=>{
  const document=invoiceDocumentFromInvoice(invoice);
  assert.equal(document.number,'INV-1');
  assert.equal(document.from.name,'Sender');
  assert.equal(document.to.name,'Client');
  assert.equal(document.items[0].description,'Design');
  assert.equal(document.items[0].amount,'USD 100.00');
  assert.equal(document.paid,'USD 25.00');
  assert.equal(document.remaining,'USD 75.00');
  assert.equal(document.terms,'Net 30');
  assert.equal(document.description,'Monthly design services');
  assert.equal(Object.hasOwn(document,'notes'),false);
  assert.deepEqual(document.signature,invoice.signature);
});

test('pagination cuts before item and section boundaries when space permits',()=>{
  const document={getBoundingClientRect:()=>({top:0,height:1200}),querySelectorAll:()=>[300,570,590,900].map(top=>({getBoundingClientRect:()=>({top})}))};
  assert.deepEqual(pageBreaks(document,600),[0,590,900,1200]);
});

test('a signed invoice with slight overflow fits on one PDF page',()=>{
  const height=800;
  const width=pdfPageWidth(height,true);
  assert.ok(width>=125&&width<150);
  const document={getBoundingClientRect:()=>({top:0,height}),querySelectorAll:()=>[]};
  assert.deepEqual(pageBreaks(document,269/width*400),[0,height]);
  assert.equal(pdfPageWidth(height,false),150);
  assert.equal(pdfPageWidth(1100,true),150);
});
