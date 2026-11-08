import type { Ref } from 'react';
import type { InvoiceSignature } from '../../lib/invoiceSignature';
import { signatureDataUrl } from '../../lib/invoiceSignature';

export type InvoiceDocumentData = {
  number: string;
  from: { name: string; email: string; address: string };
  to: { name: string; email: string; address: string };
  issued: string;
  due: string;
  description?: string;
  items: { key: string; description: string; detail: string; amount: string }[];
  total: string;
  paid?: string;
  remaining?: string;
  terms?: string;
  signature: InvoiceSignature | null;
};

export function InvoiceDocument({ data, documentRef }: { data: InvoiceDocumentData; documentRef?: Ref<HTMLDivElement> }) {
  const signature = signatureDataUrl(data.signature);
  return <div className="invoice-preview" ref={documentRef}>
    <div className="invoice-preview-top"><strong>INVOICE</strong><small>{data.number}</small></div>
    <div className="invoice-preview-parties">
      <div><span>FROM</span><strong>{data.from.name}</strong><small>{data.from.email}</small><small>{data.from.address}</small></div>
      <div><span>BILL TO</span><strong>{data.to.name}</strong><small>{data.to.email}</small><small>{data.to.address}</small></div>
    </div>
    <div className="invoice-preview-dates"><span>Issued {data.issued}</span><span>Due {data.due}</span></div>
    {data.description && <p className="invoice-preview-description"><b>Description</b><br/>{data.description}</p>}
    <div className="invoice-preview-items">{data.items.map(item => <div key={item.key}><span>{item.description}<small>{item.detail}</small></span><strong>{item.amount}</strong></div>)}</div>
    <div className="invoice-preview-total"><span>Total</span><strong>{data.total}</strong></div>
    {data.paid && <div className="invoice-preview-payment"><span>Paid</span><strong>{data.paid}</strong></div>}
    {data.remaining && <div className="invoice-preview-payment"><span>Remaining</span><strong>{data.remaining}</strong></div>}
    {data.terms && <p><b>Payment terms</b><br/>{data.terms}</p>}
    {signature && <div className="invoice-preview-signature"><span>Authorized Signature</span><img src={signature} alt="Handwritten signature"/><i/><small>{data.from.name}</small></div>}
  </div>;
}
