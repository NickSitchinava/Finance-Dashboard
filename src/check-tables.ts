// Script to check database tables
import { supabase } from './lib/supabase';

async function checkTables() {
  const { data: inv, error: invErr } = await supabase.from('invoices').select('*').limit(1);
  console.log('invoices table:', inv ? 'exists' : 'does not exist', invErr?.message);

  const { data: pay, error: payErr } = await supabase.from('client_payments').select('*').limit(1);
  console.log('client_payments table:', pay ? 'exists' : 'does not exist', payErr?.message);
}

checkTables();
