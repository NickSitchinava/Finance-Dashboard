alter table public.invoice_recurrences add column if not exists anchor_day integer;
update public.invoice_recurrences r set anchor_day=extract(day from i.due_date)::integer
  from public.invoices i where i.id=r.template_invoice_id and r.anchor_day is null;
update public.invoice_recurrences set anchor_day=extract(day from next_on)::integer where anchor_day is null;
alter table public.invoice_recurrences alter column anchor_day set not null;
alter table public.invoice_recurrences add constraint invoice_recurrence_anchor_day_check check(anchor_day between 1 and 31);

create or replace function public.generate_recurring_invoice_drafts()
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare v public.invoice_recurrences; v_template public.invoices; v_new_id uuid; v_next date; v_step integer; v_month date; v_last integer;
begin
  for v in select * from public.invoice_recurrences where state='active' and next_on <= (now() at time zone 'Asia/Tbilisi')::date for update skip locked loop
    select * into v_template from public.invoices where id=v.template_invoice_id and user_id=v.user_id;
    if not found or v_template.archived_at is not null then continue; end if;
    while v.next_on <= (now() at time zone 'Asia/Tbilisi')::date loop
      if (v.end_on is not null and v.next_on>v.end_on) or (v.max_occurrences is not null and v.generated_count>=v.max_occurrences) then
        update public.invoice_recurrences set state='cancelled' where id=v.id; exit;
      end if;
      insert into public.invoices(user_id,client_id,client_name,project_id,invoice_number,amount,currency,due_date,status,description,lifecycle_state,issue_date,notes,payment_terms,recipient_snapshot,issuer_snapshot,recurrence_id,recurrence_occurrence)
        values(v.user_id,v_template.client_id,v_template.client_name,v_template.project_id,'DRAFT-'||gen_random_uuid()::text,v_template.amount,v_template.currency,v.next_on,'Pending',v_template.description,'draft',v.next_on,v_template.notes,v_template.payment_terms,v_template.recipient_snapshot,v_template.issuer_snapshot,v.id,v.next_on)
        on conflict do nothing returning id into v_new_id;
      if v_new_id is not null then
        insert into public.invoice_line_items(invoice_id,user_id,description,quantity,unit_rate,sort_order)
          select v_new_id,v.user_id,description,quantity,unit_rate,sort_order from public.invoice_line_items where invoice_id=v.template_invoice_id;
        v.generated_count:=v.generated_count+1;
      end if;
      if v.frequency='weekly' then v_next:=v.next_on+7;
      else
        v_step:=case v.frequency when 'monthly' then 1 when 'quarterly' then 3 else 12 end;
        v_month:=(date_trunc('month',v.next_on)::date + make_interval(months=>v_step))::date;
        v_last:=extract(day from ((v_month+interval '1 month')::date-1))::integer;
        v_next:=v_month+least(v.anchor_day,v_last)-1;
      end if;
      v.next_on:=v_next;
      update public.invoice_recurrences set next_on=v.next_on,generated_count=v.generated_count where id=v.id;
      v_new_id:=null;
    end loop;
  end loop;
end $$;
revoke all on function public.generate_recurring_invoice_drafts() from public,anon,authenticated;
