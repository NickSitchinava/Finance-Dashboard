import { useSyncExternalStore } from 'react';

function readCurrency() {
  let currency = "USD";
  try {
    const saved = localStorage.getItem("user_preferences");
    if (saved) {
      const prefs = JSON.parse(saved);
      currency = prefs.currency || "USD";
    }
  } catch {
    currency = "USD";
  }

  return ['USD', 'EUR', 'GEL'].includes(currency) ? currency : 'USD';
}

function subscribeCurrency(onChange: () => void) {
  window.addEventListener('storage', onChange);
  window.addEventListener('f-dash:preferences-changed', onChange);
  return () => { window.removeEventListener('storage', onChange); window.removeEventListener('f-dash:preferences-changed', onChange); };
}

export function useCurrency() {
  const currency = useSyncExternalStore(subscribeCurrency, readCurrency, () => 'USD');
  const symbols: Record<string, string> = {
    USD: "$",
    EUR: "€",
    GEL: "₾",
  };

  const symbol = symbols[currency] || "$";

  function format(amount: number): string {
    return `${symbol}${amount.toLocaleString()}`;
  }

  function formatRate(amount: number): string {
    return `${symbol}${amount}/h`;
  }

  return { currency, symbol, format, formatRate };
}
