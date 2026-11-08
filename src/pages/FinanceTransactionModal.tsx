import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../lib/supabase';
import type { Currency, FinanceTransaction, TxType } from '../lib/finance';

export type Category = { id: string; name: string; type: TxType; color: string; icon: string; archived_at: string | null };
export type Named = { id: string; name: string };
export type LinkedInvoice = { id: string; invoice_number: string; status: string; amount: number; client_id: string | null; lifecycle_state?: string; archived_at?: string | null };
export type ScheduleDraft = { type: TxType; amount: number; currency: Currency; description: string; category_id: string | null; client_id: string | null; project_id: string | null; notes: string | null; due_on: string };
type Props = { open: boolean; onClose: () => void; onSaved: (message: string) => void; userId: string; categories: Category[]; clients: Named[]; projects: Named[]; invoices: LinkedInvoice[]; edit: FinanceTransaction | null; defaultCurrency: Currency; occurrenceId?: string | null; scheduled?: ScheduleDraft | null };
const today = () => new Date().toISOString().slice(0, 10);
const nextDate = (start: string, frequency: string) => {
  const [year, month, day] = start.split('-').map(Number);
  if (frequency === 'monthly' || frequency === 'yearly') {
    const nextYear = frequency === 'yearly' ? year + 1 : month === 12 ? year + 1 : year;
    const nextMonth = frequency === 'yearly' ? month : month === 12 ? 1 : month + 1;
    const lastDay = new Date(Date.UTC(nextYear,nextMonth,0)).getUTCDate();
    return `${nextYear}-${String(nextMonth).padStart(2,'0')}-${String(Math.min(day,lastDay)).padStart(2,'0')}`;
  }
  const value = new Date(`${start}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + (frequency === 'weekly' ? 7 : 1));
  return value.toISOString().slice(0,10);
};

export default function FinanceTransactionModal({ open, onClose, onSaved, userId, categories, clients, projects, invoices, edit, defaultCurrency, occurrenceId, scheduled }: Props) {
  const [step, setStep] = useState<1 | 2>(1);
  const [type, setType] = useState<TxType>('Income');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState<Currency | ''>(defaultCurrency);
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [date, setDate] = useState(today());
  const [clientId, setClientId] = useState('');
  const [projectId, setProjectId] = useState('');
  const [invoiceId, setInvoiceId] = useState('');
  const [notes, setNotes] = useState('');
  const [recurring, setRecurring] = useState(false);
  const [frequency, setFrequency] = useState('monthly');
  const [endOn, setEndOn] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const dialog = useRef<HTMLDivElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const dirty = !!(amount || description || notes || clientId || projectId || categoryId);

  useEffect(() => {
    if (!open) return;
    previousFocus.current = document.activeElement as HTMLElement;
    setStep(edit || occurrenceId ? 2 : 1);
    setType(edit?.type ?? scheduled?.type ?? 'Income');
    setAmount(edit ? String(edit.amount) : scheduled ? String(scheduled.amount) : '');
    setCurrency(edit ? (edit.currency ?? '') : scheduled?.currency ?? defaultCurrency);
    setDescription(edit?.description ?? scheduled?.description ?? '');
    setCategoryId(edit?.category_id ?? (edit ? categories.find(item => item.type === edit.type && item.name === (edit.type === 'Income' ? edit.income_category || edit.category : edit.expense_category || edit.category))?.id : null) ?? scheduled?.category_id ?? '');
    setDate(edit?.date ?? scheduled?.due_on ?? today());
    setClientId(edit?.client_id ?? scheduled?.client_id ?? '');
    setProjectId(edit?.project_id ?? scheduled?.project_id ?? '');
    setInvoiceId(edit?.invoice_id ?? '');
    setNotes(edit ? edit.type === 'Income' ? edit.income_notes ?? '' : edit.expense_notes ?? '' : scheduled?.notes ?? '');
    setRecurring(false); setFrequency('monthly'); setEndOn(''); setError('');
    document.body.style.overflow = 'hidden';
    const timer = window.setTimeout(() => dialog.current?.querySelector<HTMLElement>('button, input')?.focus(), 0);
    return () => { window.clearTimeout(timer); document.body.style.overflow = ''; previousFocus.current?.focus(); };
  }, [open, edit, occurrenceId, scheduled, defaultCurrency, categories]);

  function close() {
    if (busy) return;
    if (dirty && !window.confirm('Discard your unsaved transaction?')) return;
    onClose();
  }
  function keyDown(event: React.KeyboardEvent) {
    if (event.key === 'Escape') { event.preventDefault(); close(); }
    if (event.key !== 'Tab' || !dialog.current) return;
    const focusable = [...dialog.current.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled])')];
    if (!focusable.length) return;
    const first = focusable[0], last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }
  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0 || !/^\d+(\.\d{1,2})?$/.test(amount)) { setError('Enter an amount greater than zero with up to two decimals.'); return; }
    if (!description.trim() || !categoryId || !date) { setError('Add a description, category, and date.'); return; }
    if (!currency) { setError('Choose the original currency of this amount.'); return; }
    if (endOn && endOn < date) { setError('The schedule end date must follow the transaction date.'); return; }
    const selected = categories.find(item => item.id === categoryId && item.type === type && !item.archived_at);
    if (!selected) { setError('Select an active category for this transaction type.'); return; }
    setBusy(true); setError('');
    const payload = {
      user_id: userId, type, amount: value, currency, description: description.trim(), date,
      category: selected.name, category_id: categoryId,
      income_amount: type === 'Income' ? value : 0, expense_amount: type === 'Expense' ? value : 0,
      income_category: type === 'Income' ? selected.name : null, expense_category: type === 'Expense' ? selected.name : null,
      income_notes: type === 'Income' ? notes.trim() || null : null, expense_notes: type === 'Expense' ? notes.trim() || null : null,
      client_id: clientId || null, project_id: projectId || null, invoice_id: type === 'Income' ? invoiceId || null : null,
      recurring_occurrence_id: occurrenceId || edit?.recurring_occurrence_id || null,
    };
    try {
      const result = edit
        ? await supabase.from('transactions').update(payload).eq('id', edit.id).eq('user_id', userId)
        : await supabase.from('transactions').insert(payload);
      if (result.error) throw result.error;
      if (occurrenceId) {
        const { data: transaction } = await supabase.from('transactions').select('id').eq('recurring_occurrence_id', occurrenceId).single();
        const marked = await supabase.from('recurring_occurrences').update({ status: 'recorded', transaction_id: transaction?.id ?? null }).eq('id', occurrenceId).eq('user_id', userId);
        if (marked.error) { onSaved('Transaction recorded, but its expected item could not be marked. Refresh and review it.'); onClose(); return; }
      }
      if (recurring && !edit) {
        const schedule = await supabase.from('recurring_schedules').insert({
          user_id: userId, type, amount: value, currency, description: description.trim(), category_id: categoryId, category: selected.name,
          client_id: clientId || null, project_id: projectId || null, notes: notes.trim() || null,
          frequency, start_on: date, end_on: endOn || null, next_on: nextDate(date, frequency), occurrence_index: 1, time_zone: 'Asia/Tbilisi', status: 'active',
        });
        if (schedule.error) { onSaved('Transaction recorded, but the recurring schedule could not be created. Review your entries before trying again.'); onClose(); return; }
      }
      onSaved(edit ? 'Transaction updated.' : recurring ? 'Transaction recorded and schedule created.' : 'Transaction recorded.');
      onClose();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not save transaction. Try again.'); }
    finally { setBusy(false); }
  }
  if (!open) return null;
  const availableCategories = categories.filter(item => item.type === type && !item.archived_at);
  return createPortal(<div className="finance-dialog-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) close(); }}>
    <div className="finance-dialog" ref={dialog} role="dialog" aria-modal="true" aria-labelledby="finance-dialog-title" onKeyDown={keyDown}>
      <div className="finance-dialog__head"><div><span>{edit ? 'Edit recorded transaction' : `Step ${step} of 2`}</span><h2 id="finance-dialog-title">{edit ? 'Edit transaction' : step === 1 ? 'What would you like to add?' : `Record ${type.toLowerCase()}`}</h2></div><button type="button" className="finance-icon-btn" onClick={close} aria-label="Close transaction dialog">×</button></div>
      {step === 1 ? <div className="finance-type-grid">
        {(['Income','Expense'] as TxType[]).map(option => <button key={option} type="button" className={`finance-type-card finance-type-card--${option.toLowerCase()}`} onClick={() => { setType(option); setCategoryId(''); setStep(2); window.setTimeout(() => dialog.current?.querySelector<HTMLInputElement>('#finance-amount')?.focus(), 40); }}><span className="finance-type-card__icon" aria-hidden="true">{option === 'Income' ? '↙' : '↗'}</span><strong>{option}</strong><small>{option === 'Income' ? 'Record money received from your work.' : 'Record a business cost or payment.'}</small><span className="finance-type-card__arrow">Continue →</span></button>)}
      </div> : <form onSubmit={save} className="finance-form">
        {error && <div className="finance-error" role="alert">{error}</div>}
        <div className="finance-form__row"><label>Amount<input id="finance-amount" type="number" min="0.01" step="0.01" required value={amount} onChange={event => setAmount(event.target.value)} placeholder="0.00" /></label><label>Original currency<select required value={currency} onChange={event => setCurrency(event.target.value as Currency | '')}>{edit && !edit.currency && <option value="">Select currency</option>}<option>USD</option><option>EUR</option><option>GEL</option></select></label></div>
        {edit && !edit.currency && <p className="finance-form__hint">This older amount has no saved currency. Choose the currency it was originally entered in before saving.</p>}
        <label>Description<input required maxLength={160} value={description} onChange={event => setDescription(event.target.value)} placeholder={type === 'Income' ? 'Website design payment' : 'Software subscription'} /></label>
        <div className="finance-form__row"><label>Category<select required value={categoryId} onChange={event => setCategoryId(event.target.value)}><option value="">Select category</option>{availableCategories.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label>Date<input type="date" required value={date} onChange={event => setDate(event.target.value)} /></label></div>
        {availableCategories.length === 0 && <p className="finance-form__hint">Create a {type.toLowerCase()} category in Manage categories first.</p>}
        <div className="finance-form__row"><label>Client <small>optional</small><select value={clientId} onChange={event => setClientId(event.target.value)}><option value="">No client</option>{clients.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label>Project <small>optional</small><select value={projectId} onChange={event => setProjectId(event.target.value)}><option value="">No project</option>{projects.filter(item => !clientId || !('client_id' in item) || (item as Named & { client_id?: string }).client_id === clientId).map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label></div>
        {type === 'Income' && <label>Related invoice <small>optional</small><select value={invoiceId} onChange={event => setInvoiceId(event.target.value)}><option value="">No invoice linked</option>{invoices.filter(item => !clientId || item.client_id === clientId).map(item => <option key={item.id} value={item.id}>{item.invoice_number} · {item.status}</option>)}</select><small>Link the payment for reference. Invoices do not add income to cash totals.</small></label>}
        <label>Notes <small>optional</small><textarea rows={2} value={notes} onChange={event => setNotes(event.target.value)} placeholder="Add context for your records" /></label>
        {!edit && !occurrenceId && <div className="finance-recurring"><label className="finance-checkbox"><input type="checkbox" checked={recurring} onChange={event => setRecurring(event.target.checked)} /> Repeat this transaction</label>{recurring && <><p>Today’s entry is recorded. Future occurrences will appear as expected until you record them.</p><div className="finance-form__row"><label>Frequency<select value={frequency} onChange={event => setFrequency(event.target.value)}><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option><option value="yearly">Yearly</option></select></label><label>End date <small>optional</small><input type="date" min={date} value={endOn} onChange={event => setEndOn(event.target.value)} /></label></div></>}</div>}
        <div className="finance-dialog__actions">{!edit && !occurrenceId && <button type="button" className="finance-secondary" onClick={() => setStep(1)}>← Back</button>}<button type="submit" className="finance-primary" disabled={busy || !availableCategories.length}>{busy ? 'Saving…' : edit ? 'Save changes' : 'Record transaction'}</button></div>
      </form>}
    </div>
  </div>, document.body);
}
