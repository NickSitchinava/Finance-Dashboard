// NBG official daily rates. A rate is GEL for `quantity` units of currency.
// This function is read-only and requires the caller's Supabase JWT.
const origin = 'https://nbg.gov.ge/gw/api/ct/monetarypolicy/currencies/en/json/';
const cache = new Map<string, { at: number; value: unknown }>();
const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };

async function getDay(date: string) {
  const hit = cache.get(date);
  if (hit && Date.now() - hit.at < 86_400_000) return hit.value;
  const response = await fetch(`${origin}?date=${date}`, { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`Rate source unavailable (${response.status})`);
  const body = await response.json();
  const item = body?.[0];
  const usd = item?.currencies?.find((currency: { code: string }) => currency.code === 'USD');
  const eur = item?.currencies?.find((currency: { code: string }) => currency.code === 'EUR');
  if (!usd?.rate || !eur?.rate || !usd?.quantity || !eur?.quantity || !item?.date) throw new Error('Incomplete exchange-rate data');
  const value = { date, sourceDate: String(item.date).slice(0, 10), USD: usd.rate / usd.quantity, EUR: eur.rate / eur.quantity, GEL: 1, source: 'National Bank of Georgia' };
  cache.set(date, { at: Date.now(), value });
  return value;
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { headers });
  if (request.method !== 'POST') return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers });
  try {
    const payload = await request.json();
    const dates: unknown[] = payload?.dates;
    if (!Array.isArray(dates) || dates.length > 60 || dates.some(date => typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date))) {
      return new Response(JSON.stringify({ error: 'Send up to 60 valid ISO dates.' }), { status: 400, headers });
    }
    const results = await Promise.all([...new Set(dates)].map(async date => {
      try { return { date, rate: await getDay(date) }; }
      catch (error) { return { date, error: error instanceof Error ? error.message : 'Rates unavailable' }; }
    }));
    return new Response(JSON.stringify({ results }), { headers });
  } catch {
    return new Response(JSON.stringify({ error: 'Could not load rates.' }), { status: 502, headers });
  }
});
