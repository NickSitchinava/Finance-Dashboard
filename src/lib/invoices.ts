import { jsPDF } from 'jspdf';
import { createElement } from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { money } from './finance';
import type { Currency } from './finance';
import { normalizeSignature } from './invoiceSignature';
import type { InvoiceSignature } from './invoiceSignature';
import { InvoiceDocument } from '../components/ui/InvoiceDocument';
import type { InvoiceDocumentData } from '../components/ui/InvoiceDocument';

export type Invoice = {
  id:string; user_id:string; client_id:string|null; client_name:string; project_id:string|null;
  invoice_number:string; amount:number; currency:Currency|null; due_date:string; status:string;
  lifecycle_state:'draft'|'issued'; issue_date:string|null; description:string|null; notes:string|null;
  payment_terms:string|null; recipient_snapshot:Record<string,string>; issuer_snapshot:Record<string,string>;
  archived_at:string|null; created_at:string; updated_at:string; recurrence_id:string|null; signature:InvoiceSignature|null;
};
export type InvoiceItem = {id:string;invoice_id:string;user_id:string;description:string;quantity:number;unit_rate:number;sort_order:number};
export type InvoicePayment = {id:string;invoice_id:string;amount:number;currency:Currency;paid_on:string;note:string|null;method:string|null;reference:string|null;reversed_at:string|null;created_at:string};
export type InvoiceView = Invoice & {items:InvoiceItem[];payments:InvoicePayment[];project_name:string;paidCents:number;remainingCents:number;condition:string;overdue:boolean};
export const cents=(value:number|string)=>Math.round(Number(value)*100);
export const invoiceMoney=(value:number,currency:Currency|null)=>currency?money(value,currency):`${(value/100).toFixed(2)} · currency unknown`;
export const dateLabel=(value:string|null)=>value?new Date(`${value.slice(0,10)}T12:00:00`).toLocaleDateString(undefined,{day:'numeric',month:'short',year:'numeric'}):'—';
export const localDay=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
export const daysFromToday=(due:string)=>Math.round((Date.parse(`${due}T00:00:00Z`)-Date.parse(`${localDay()}T00:00:00Z`))/86400000);
export function viewInvoice(invoice:Invoice,items:InvoiceItem[],payments:InvoicePayment[],projectName=''):InvoiceView{
  const ownPayments=payments.filter(p=>p.invoice_id===invoice.id&& !p.reversed_at);
  const paidCents=ownPayments.reduce((sum,p)=>sum+cents(p.amount),0);
  const remainingCents=Math.max(0,cents(invoice.amount)-paidCents);
  const overdue=invoice.lifecycle_state==='issued'&&remainingCents>0&&daysFromToday(invoice.due_date)<0;
  const condition=invoice.lifecycle_state==='draft'?'Draft':remainingCents===0?'Paid':paidCents>0?'Partial':overdue?'Overdue':'Awaiting Payment';
  return {...invoice,items:items.filter(item=>item.invoice_id===invoice.id).sort((a,b)=>a.sort_order-b.sort_order),payments:payments.filter(p=>p.invoice_id===invoice.id).sort((a,b)=>(b.paid_on||'').localeCompare(a.paid_on||'')||(b.created_at||'').localeCompare(a.created_at||'')),project_name:projectName,paidCents,remainingCents,condition,overdue};
}
export function invoiceCsv(rows:InvoiceView[]){
  const cell=(value:unknown)=>{const raw=String(value??'');const safe=typeof value==='string'&&/^[\s]*[=+\-@]/.test(raw)?`'${raw}`:raw;return `"${safe.replaceAll('"','""')}"`};
  const lines=[['Client','Invoice','Project','Amount','Paid','Remaining','Currency','Issue date','Due date','Status','Description'].map(cell).join(',')];
  for(const i of rows)lines.push([i.client_name,i.invoice_number,i.project_name,i.amount,i.paidCents/100,i.remainingCents/100,i.currency??'',i.issue_date,i.due_date,i.condition,i.description].map(cell).join(','));
  return '\ufeff'+lines.join('\r\n');
}
export function downloadBlob(contents:string,name:string,type:string){const url=URL.createObjectURL(new Blob([contents],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();window.setTimeout(()=>URL.revokeObjectURL(url),1000)}
export function invoiceDocumentFromInvoice(invoice:InvoiceView):InvoiceDocumentData{
  const number=invoice.invoice_number&&!invoice.invoice_number.startsWith('DRAFT-')?invoice.invoice_number:'Number assigned on activation';
  const issuer=invoice.issuer_snapshot||{};
  const recipient=invoice.recipient_snapshot||{};
  return {
    number,
    from:{name:issuer.name||'Your name',email:issuer.email||'',address:issuer.address||''},
    to:{name:recipient.name||invoice.client_name||'Recipient name',email:recipient.email||'',address:recipient.address||''},
    issued:dateLabel(invoice.issue_date),due:dateLabel(invoice.due_date),
    items:invoice.items.length?invoice.items.map(item=>({
      key:item.id,description:item.description||'Item description',
      detail:`${item.quantity} × ${invoiceMoney(cents(item.unit_rate),invoice.currency)}`,
      amount:invoiceMoney(cents(item.quantity*item.unit_rate),invoice.currency),
    })):[{key:'legacy',description:invoice.description||'Invoice amount',detail:'',amount:invoiceMoney(cents(invoice.amount),invoice.currency)}],
    total:invoiceMoney(cents(invoice.amount),invoice.currency),
    paid:invoice.paidCents?invoiceMoney(invoice.paidCents,invoice.currency):undefined,
    remaining:invoice.paidCents?invoiceMoney(invoice.remainingCents,invoice.currency):undefined,
    description:invoice.items.length?invoice.description||'':'',terms:invoice.payment_terms||'',
    signature:normalizeSignature(invoice.signature),
  };
}

const PDF_WIDTH_MM=150;
const PDF_LEFT_MARGIN_MM=30;
const PDF_TOP_MARGIN_MM=14;
const PDF_CONTENT_HEIGHT_MM=269;
const DOCUMENT_WIDTH_PX=400;
const PDF_MIN_SIGNED_WIDTH_MM=125;

function pdfPageWidth(documentHeight:number,hasSignature:boolean){
  if(!hasSignature)return PDF_WIDTH_MM;
  const widthToFit=PDF_CONTENT_HEIGHT_MM*DOCUMENT_WIDTH_PX/documentHeight;
  return widthToFit>=PDF_MIN_SIGNED_WIDTH_MM?Math.min(PDF_WIDTH_MM,widthToFit*0.995):PDF_WIDTH_MM;
}

function pageBreaks(documentNode:HTMLElement,maxHeight:number){
  const height=documentNode.getBoundingClientRect().height;
  const top=documentNode.getBoundingClientRect().top;
  const boundaries=[...documentNode.querySelectorAll('.invoice-preview-top,.invoice-preview-parties,.invoice-preview-dates,.invoice-preview-items > div,.invoice-preview-total,.invoice-preview-payment,.invoice-preview p,.invoice-preview-signature')]
    .map(node=>node.getBoundingClientRect().top-top)
    .filter(value=>value>0&&value<height)
    .sort((a,b)=>a-b);
  const cuts=[0];
  while(cuts[cuts.length-1]<height){
    const from=cuts[cuts.length-1];
    const target=Math.min(height,from+maxHeight);
    if(target===height){cuts.push(height);break}
    const safe=boundaries.filter(value=>value>from+80&&value<=target);
    const cut=safe.length?safe[safe.length-1]:target;
    cuts.push(cut);
  }
  return cuts;
}

export async function downloadInvoicePdf(input:InvoiceView|InvoiceView[]){
  const invoices=Array.isArray(input)?input:[input];
  if(!invoices.length)throw new Error('No invoices selected');
  const {default:html2canvas}=await import('html2canvas');
  const pdf=new jsPDF({unit:'mm',format:'a4'});
  let firstPage=true;
  for(const invoice of invoices){
    const host=document.createElement('div');
    host.setAttribute('aria-hidden','true');
    host.style.cssText=`position:fixed;left:0;top:0;z-index:-1;width:${DOCUMENT_WIDTH_PX}px;pointer-events:none`;
    document.body.appendChild(host);
    const root=createRoot(host);
    try{
      flushSync(()=>root.render(createElement(InvoiceDocument,{data:invoiceDocumentFromInvoice(invoice)})));
      const documentNode=host.querySelector<HTMLElement>('.invoice-preview');
      if(!documentNode)throw new Error('Invoice document did not render');
      documentNode.style.width=`${DOCUMENT_WIDTH_PX}px`;
      documentNode.style.maxHeight='none';
      documentNode.style.overflow='visible';
      await document.fonts.ready;
      await Promise.all([...documentNode.querySelectorAll('img')].map(image=>image.decode()));
      const canvas=await html2canvas(documentNode,{backgroundColor:'#ffffff',scale:3,logging:false,useCORS:false});
      const cssHeight=documentNode.getBoundingClientRect().height;
      const pixelsPerCss=canvas.height/cssHeight;
      const pageWidth=pdfPageWidth(cssHeight,Boolean(documentNode.querySelector('.invoice-preview-signature')));
      const maxCssHeight=PDF_CONTENT_HEIGHT_MM/pageWidth*DOCUMENT_WIDTH_PX;
      const cuts=pageBreaks(documentNode,maxCssHeight);
      for(let index=1;index<cuts.length;index++){
        if(!firstPage)pdf.addPage();
        firstPage=false;
        const from=Math.round(cuts[index-1]*pixelsPerCss);
        const to=index===cuts.length-1?canvas.height:Math.round(cuts[index]*pixelsPerCss);
        const slice=document.createElement('canvas');
        slice.width=canvas.width;
        slice.height=Math.max(1,to-from);
        slice.getContext('2d')?.drawImage(canvas,0,from,canvas.width,to-from,0,0,canvas.width,to-from);
        pdf.addImage(slice.toDataURL('image/jpeg',0.97),'JPEG',PDF_LEFT_MARGIN_MM+(PDF_WIDTH_MM-pageWidth)/2,PDF_TOP_MARGIN_MM,pageWidth,(cuts[index]-cuts[index-1])*pageWidth/DOCUMENT_WIDTH_PX);
      }
    }finally{
      flushSync(()=>root.unmount());
      host.remove();
    }
  }
  pdf.save(invoices.length===1?`${invoices[0].invoice_number.replace(/[^\w-]/g,'-')}.pdf`:`f-dash-invoices-${localDay()}.pdf`);
}
