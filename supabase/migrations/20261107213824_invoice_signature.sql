-- Store editable SVG pad strokes on the owning invoice. Existing invoices remain unsigned.
alter table public.invoices add column if not exists signature jsonb;
alter table public.invoices add constraint invoices_signature_shape_check check (
  signature is null or (
    jsonb_typeof(signature) = 'object' and signature->>'version' = '1' and
    jsonb_typeof(signature->'strokes') = 'array' and octet_length(signature::text) <= 262144
  )
);

-- Save the invoice document and its line items as one transaction.
create or replace function public.save_invoice_document(p_invoice_id uuid,p_document jsonb,p_items jsonb)
returns public.invoices language plpgsql security definer set search_path=public,pg_temp as $$
declare v_owner uuid:=(select auth.uid()); v_invoice public.invoices; v_total numeric(14,2); v_paid numeric(14,2):=0; v_client uuid; v_project uuid; v_item jsonb; v_index integer:=0;
begin
  if v_owner is null then raise exception 'Sign in required'; end if;
  if jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)=0 then raise exception 'Add at least one line item'; end if;
  if coalesce(trim(p_document->>'client_name'),'')='' then raise exception 'Recipient is required'; end if;
  if p_document->>'currency' not in ('USD','EUR','GEL') then raise exception 'Choose a valid currency'; end if;
  if (p_document->>'due_date') is null or (p_document->>'issue_date') is null then raise exception 'Invoice and due dates are required'; end if;
  if p_document->'signature' is not null and p_document->'signature' <> 'null'::jsonb and
    (jsonb_typeof(p_document->'signature') <> 'object' or p_document->'signature'->>'version' <> '1' or
     jsonb_typeof(p_document->'signature'->'strokes') <> 'array' or
     octet_length((p_document->'signature')::text) > 262144) then
    raise exception 'Invalid invoice signature';
  end if;
  v_total:=0;
  for v_item in select value from jsonb_array_elements(p_items) loop
    if coalesce(trim(v_item->>'description'),'')='' or (v_item->>'quantity')::numeric<=0 or (v_item->>'unit_rate')::numeric<0 then
      raise exception 'Complete each line item with a description, quantity and nonnegative rate';
    end if;
    v_total:=v_total+round((v_item->>'quantity')::numeric*(v_item->>'unit_rate')::numeric,2);
  end loop;
  if v_total<=0 then raise exception 'Invoice total must be positive'; end if;
  v_client:=nullif(p_document->>'client_id','')::uuid;
  v_project:=nullif(p_document->>'project_id','')::uuid;
  if v_client is not null and not exists(select 1 from public.clients where id=v_client and user_id=v_owner) then raise exception 'Client does not belong to you'; end if;
  if v_project is not null and not exists(select 1 from public.projects where id=v_project and user_id=v_owner and (v_client is null or client_id is null or client_id=v_client)) then raise exception 'Project does not match the recipient'; end if;
  if p_invoice_id is not null then
    select * into v_invoice from public.invoices where id=p_invoice_id and user_id=v_owner for update;
    if not found then raise exception 'Invoice not found'; end if;
    select coalesce(sum(amount),0) into v_paid from public.invoice_payments where invoice_id=p_invoice_id and reversed_at is null;
    if v_total<v_paid then raise exception 'Invoice total cannot be less than recorded payments'; end if;
    update public.invoices set client_id=v_client,client_name=trim(p_document->>'client_name'),project_id=v_project,
      amount=v_total,currency=p_document->>'currency',due_date=(p_document->>'due_date')::date,
      issue_date=(p_document->>'issue_date')::date,description=nullif(p_document->>'description',''),
      notes=nullif(p_document->>'notes',''),payment_terms=nullif(p_document->>'payment_terms',''),
      recipient_snapshot=coalesce(p_document->'recipient_snapshot','{}'::jsonb),
      issuer_snapshot=coalesce(p_document->'issuer_snapshot','{}'::jsonb),
      signature=nullif(p_document->'signature','null'::jsonb),
      status=case when v_invoice.lifecycle_state='issued' and v_paid>=v_total then 'Paid' else 'Pending' end,
      updated_at=now() where id=p_invoice_id returning * into v_invoice;
  else
    insert into public.invoices(user_id,client_id,client_name,project_id,invoice_number,amount,currency,due_date,issue_date,status,lifecycle_state,description,notes,payment_terms,recipient_snapshot,issuer_snapshot,signature)
      values(v_owner,v_client,trim(p_document->>'client_name'),v_project,'DRAFT-'||gen_random_uuid()::text,v_total,p_document->>'currency',
        (p_document->>'due_date')::date,(p_document->>'issue_date')::date,'Pending','draft',
        nullif(p_document->>'description',''),nullif(p_document->>'notes',''),nullif(p_document->>'payment_terms',''),
        coalesce(p_document->'recipient_snapshot','{}'::jsonb),coalesce(p_document->'issuer_snapshot','{}'::jsonb),nullif(p_document->'signature','null'::jsonb))
      returning * into v_invoice;
  end if;
  delete from public.invoice_line_items where invoice_id=v_invoice.id;
  for v_item in select value from jsonb_array_elements(p_items) loop
    insert into public.invoice_line_items(invoice_id,user_id,description,quantity,unit_rate,sort_order)
      values(v_invoice.id,v_owner,trim(v_item->>'description'),(v_item->>'quantity')::numeric,(v_item->>'unit_rate')::numeric,v_index);
    v_index:=v_index+1;
  end loop;
  return v_invoice;
end $$;
revoke all on function public.save_invoice_document(uuid,jsonb,jsonb) from public,anon;
grant execute on function public.save_invoice_document(uuid,jsonb,jsonb) to authenticated;
