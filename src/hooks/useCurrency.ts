export function useCurrency() {
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