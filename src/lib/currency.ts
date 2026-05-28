export type CountryCurrency = {
  country: string;
  currency: string;
  locale: string;
};

export const COUNTRY_OPTIONS: CountryCurrency[] = [
  { country: 'United States', currency: 'USD', locale: 'en-US' },
  { country: 'India', currency: 'INR', locale: 'en-IN' },
  { country: 'United Kingdom', currency: 'GBP', locale: 'en-GB' },
  { country: 'European Union', currency: 'EUR', locale: 'de-DE' },
  { country: 'United Arab Emirates', currency: 'AED', locale: 'en-AE' },
  { country: 'Canada', currency: 'CAD', locale: 'en-CA' },
  { country: 'Australia', currency: 'AUD', locale: 'en-AU' },
  { country: 'Singapore', currency: 'SGD', locale: 'en-SG' },
  { country: 'Japan', currency: 'JPY', locale: 'ja-JP' },
  { country: 'South Korea', currency: 'KRW', locale: 'ko-KR' },
];

export const DEFAULT_COUNTRY = COUNTRY_OPTIONS[0];

export function getCountryOption(country?: string | null, currency?: string | null) {
  return (
    COUNTRY_OPTIONS.find(option => option.country === country) ||
    COUNTRY_OPTIONS.find(option => option.currency === currency) ||
    DEFAULT_COUNTRY
  );
}

export function formatCurrency(amount: number, option: CountryCurrency) {
  return new Intl.NumberFormat(option.locale, {
    style: 'currency',
    currency: option.currency,
    maximumFractionDigits: option.currency === 'JPY' || option.currency === 'KRW' ? 0 : 2,
  }).format(amount);
}

export async function getExchangeRate(target: string) {
  if (target === 'USD') return 1;
  const apiBase = import.meta.env.VITE_API_URL || '/api';
  const response = await fetch(`${apiBase}/exchange-rate?base=USD&target=${target}`);
  const payload = await response.json();
  if (!response.ok || payload.error || !payload.data?.rate) {
    throw new Error(payload.error || 'Exchange rate unavailable');
  }
  return Number(payload.data.rate);
}
