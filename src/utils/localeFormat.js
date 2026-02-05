const DIGIT_MAP = {
  '0': '०',
  '1': '१',
  '2': '२',
  '3': '३',
  '4': '४',
  '5': '५',
  '6': '६',
  '7': '७',
  '8': '८',
  '9': '९'
};

const REVERSE_DIGIT_MAP = Object.fromEntries(
  Object.entries(DIGIT_MAP).map(([latin, nepali]) => [nepali, latin])
);

function toNepaliNumerals(value) {
  if (value === null || value === undefined) {
    return '';
  }
  return String(value).replace(/\d/g, digit => DIGIT_MAP[digit] || digit);
}

function toEnglishNumerals(value) {
  if (value === null || value === undefined) {
    return '';
  }
  return String(value).replace(/[०-९]/g, digit => REVERSE_DIGIT_MAP[digit] || digit);
}

function getUiLang(language) {
  const currentLanguage = language ?? (typeof localStorage !== 'undefined' ? localStorage.getItem('language') : '');
  return isNepaliLanguage(currentLanguage) ? 'np' : 'en';
}

function getNumberLocale(language) {
  return getUiLang(language) === 'np' ? 'ne-NP' : 'en-US';
}

function parseNumeric(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === 'string') {
    const cleaned = value.trim().replace(/,/g, '');
    const parsed = Number.parseFloat(cleaned);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function isNepaliLanguage(language) {
  const normalized = String(language || '').trim().toLowerCase();
  return normalized === 'nepali' || normalized === 'ne' || normalized === 'np';
}

function formatNumber(value, opts = {}, language = 'english') {
  const {
    decimals,
    useCommas = false,
    prefix = '',
    suffix = '',
    fallback = '—'
  } = opts;
  const numericValue = parseNumeric(value);
  if (numericValue === null) {
    return fallback;
  }

  const locale = getNumberLocale(language);
  const formatOptions = {
    useGrouping: Boolean(useCommas)
  };

  if (typeof decimals === 'number') {
    formatOptions.minimumFractionDigits = decimals;
    formatOptions.maximumFractionDigits = decimals;
  } else {
    formatOptions.minimumFractionDigits = 0;
    formatOptions.maximumFractionDigits = 20;
  }

  const formatted = new Intl.NumberFormat(locale, formatOptions).format(numericValue);
  return `${prefix}${formatted}${suffix}`;
}

function formatCurrencyNPR(value, language = 'english', opts = {}) {
  const prefix = isNepaliLanguage(language) ? 'रु. ' : 'Rs. ';
  return formatNumber(value, { ...opts, prefix }, language);
}

function formatPercent(value, language = 'english', opts = {}) {
  const { decimals = 2, showSign = true, fallback = '—' } = opts;
  const numericValue = parseNumeric(value);
  if (numericValue === null) {
    return fallback;
  }
  const sign = showSign && numericValue > 0 ? '+' : '';
  const formatted = formatNumber(numericValue, { decimals, useCommas: true, fallback }, language);
  return `${sign}${formatted}%`;
}

function formatPrice(value, language = 'english') {
  return formatNumber(value, { decimals: 2, useCommas: true }, language);
}

function formatPoints(value, language = 'english') {
  return formatNumber(value, { decimals: 2, useCommas: true }, language);
}

function formatCompactInt(value, language = 'english', opts = {}) {
  const { fallback = '—' } = opts;
  const numericValue = parseNumeric(value);
  if (numericValue === null) {
    return fallback;
  }
  const locale = getNumberLocale(language);
  return new Intl.NumberFormat(locale, {
    notation: 'compact',
    maximumFractionDigits: 0
  }).format(numericValue);
}

window.toNepaliNumerals = toNepaliNumerals;
window.toEnglishNumerals = toEnglishNumerals;
window.getUiLang = getUiLang;
window.isNepaliLanguage = isNepaliLanguage;
window.formatNumber = formatNumber;
window.formatCurrencyNPR = formatCurrencyNPR;
window.formatPercent = formatPercent;
window.formatPrice = formatPrice;
window.formatPoints = formatPoints;
window.formatCompactInt = formatCompactInt;
