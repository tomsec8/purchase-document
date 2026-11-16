export const CURRENCY_CODES = [
  'ILS', 'USD', 'EUR', 'GBP', 'CAD', 'AUD', 'CNY', 'JPY', 'RUB', 'INR', 'TRY', 'BRL',
  'KRW', 'PLN', 'SEK', 'NOK', 'DKK', 'CHF', 'MXN', 'SGD', 'HKD', 'NZD', 'ZAR', 'THB',
  'PHP', 'MYR', 'IDR', 'VND', 'AED', 'SAR', 'EGP', 'NGN', 'KZT', 'UAH',
] as const

const MONTHS = 'Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec'
const DATE_PATTERN = new RegExp(`\\b(?:${MONTHS})[a-z]*\\.?\\s+\\d{1,2},?\\s*\\d{4}`, 'i')

export function normalizeLabel(text: string): string {
  return text
    .toLowerCase()
    .replace(/[:：]/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function cleanText(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

export interface MoneyReading {
  value: number
  loose: boolean
}

export function parseMoney(text: string): number | null {
  return readMoney(text)?.value ?? null
}

export function readMoney(text: string): MoneyReading | null {
  const matches = text.match(/\d{1,3}(?:[ ,]\d{3})*[.,]\d{2}|\d+[.,]\d{2}/g)
  if (matches?.length) {
    const raw = matches[matches.length - 1].replace(/ /g, '')
    const lastDot = raw.lastIndexOf('.')
    const lastComma = raw.lastIndexOf(',')
    const normalized = lastComma > lastDot
      ? raw.replace(/\./g, '').replace(',', '.')
      : raw.replace(/,/g, '')
    const value = Number(normalized)
    if (Number.isFinite(value)) {
      return { value: roundMoney(Math.abs(value)), loose: false }
    }
  }

  const collapsed = text.match(/\b\d{3}\b/g)
  const digits = collapsed?.[collapsed.length - 1]
  if (digits) {
    return {
      value: roundMoney(Number(`${digits[0]}.${digits.slice(1)}`)),
      loose: true,
    }
  }

  if (/[x×]\s*\d{1,3}/i.test(text)) {
    const four = text.match(/\d{4}/)
    if (four?.[0]) {
      return {
        value: roundMoney(Number(`${four[0].slice(0, 2)}.${four[0].slice(2)}`)),
        loose: true,
      }
    }
  }

  return null
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

export function matchDate(text: string): string | null {
  const match = text.match(DATE_PATTERN)
  if (!match) return null
  return match[0].replace(/\s+/g, ' ').replace(/,(\d)/, ', $1').replace(/\.$/, '')
}

export function matchOrderId(text: string): string | null {
  const groups = text.match(/\d{15,18}/g)
  if (groups?.length) return groups.find((group) => group.length === 16) ?? groups[0]
  const digits = text.replace(/\D/g, '')
  if (digits.length >= 15 && digits.length <= 18) return digits
  return null
}

export function quantityToken(text: string): number | null {
  const match = text.trim().replace(/[.,]$/, '').match(/^(?:[x×]\s*)?(\d{1,3})$/i)
  if (!match) return null
  if (!/[x×]/i.test(text) && match[1].length > 2) return null
  const value = Number(match[1])
  if (!Number.isInteger(value) || value <= 0 || value > 999) return null
  return value
}

export function isStoreLine(text: string): boolean {
  return /\bstore\b/i.test(text)
}

export function currencyToken(text: string): string | null {
  const token = text.replace(/[^A-Za-z]/g, '').toUpperCase()
  return CURRENCY_CODES.find((code) => code === token) ?? null
}

const CARD_BRANDS: Record<string, string> = {
  visa: 'VISA',
  mastercard: 'Mastercard',
  maestro: 'Maestro',
  amex: 'Amex',
  americanexpress: 'Amex',
  discover: 'Discover',
  jcb: 'JCB',
  unionpay: 'UnionPay',
  diners: 'Diners',
  dinersclub: 'Diners',
}

export function cardBrand(text: string): string | null {
  const key = text.toLowerCase().replace(/[^a-z]/g, '')
  return Object.hasOwn(CARD_BRANDS, key) ? CARD_BRANDS[key] : null
}

export function isCardPiece(text: string): boolean {
  const compact = text.replace(/[\s-]/g, '')
  if (!/^[\d*]+$/.test(compact)) return false
  if (compact.includes('*')) return /\d/.test(compact)
  return (compact.length >= 4 && compact.length <= 6) || (compact.length >= 12 && compact.length <= 19)
}

export function maskCard(text: string): string | null {
  const compact = text.replace(/[\s-]/g, '')
  if (!compact || !/^[\d*]+$/.test(compact)) return null
  const digits = compact.replace(/\D/g, '')
  let body = compact
  if (!compact.includes('*')) {
    if (digits.length < 12 || digits.length > 19) return null
    body = `${digits.slice(0, 6)}${'*'.repeat(Math.max(digits.length - 10, 2))}${digits.slice(-4)}`
  } else if (digits.length < 4 || compact.length < 8) {
    return null
  }
  return body.replace(/(.{4})/g, '$1 ').trim()
}

export function redactCard(text: string): string {
  const cleaned = text.replace(/[^\d*\s-]/g, '')
  const maskedRuns = cleaned.replace(/\d{12,}/g, (run) => maskCard(run.slice(0, 19)) ?? '')
  const digits = maskedRuns.replace(/\D/g, '')
  if (digits.length >= 12 && !maskedRuns.includes('*')) {
    return maskCard(digits.slice(0, 19)) ?? ''
  }
  return maskCard(maskedRuns) ?? maskedRuns.trim()
}

export function splitBuyerLine(text: string): { name: string; phone: string } | null {
  const match = text.match(/(\+?\d[\d\s-]{6,16}\d)/)
  if (!match || match.index == null) return null
  const digits = match[1].replace(/\D/g, '')
  if (digits.length < 8 || digits.length > 15) return null
  return {
    name: cleanText(text.slice(0, match.index)),
    phone: match[1].replace(/\s+/g, ' ').trim(),
  }
}
