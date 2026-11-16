export function formatMoney(amount: number, currency: string): string {
  if (/^[A-Z]{3}$/.test(currency)) {
    try {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency,
        currencyDisplay: 'code',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(amount)
    } catch {
      // An unknown code falls through to a plain number.
    }
  }

  const number = amount.toFixed(2)
  return currency ? `${number} ${currency}` : number
}

export function formatDiscount(amount: number, currency: string): string {
  if (amount === 0) return formatMoney(0, currency)
  const formatted = formatMoney(Math.abs(amount), currency)
  const coded = formatted.match(/^([A-Z]{3})\s+(.*)$/)
  if (coded) return `${coded[1]} −${coded[2]}`
  return `−${formatted}`
}

function filenameStem(orderId: string | undefined): string {
  const safe = (orderId ?? '').replace(/[^\dA-Za-z_-]/g, '')
  return `purchase-${safe || 'document'}`
}

export function documentFilename(orderId: string | undefined, extension: 'pdf' | 'png'): string {
  return `${filenameStem(orderId)}.${extension}`
}

export function documentFilenames(orderIds: (string | undefined)[], extension: 'pdf' | 'png'): string[] {
  const taken = new Set<string>()
  return orderIds.map((orderId) => {
    const stem = filenameStem(orderId)
    let name = `${stem}.${extension}`
    let suffix = 2
    while (taken.has(name)) {
      name = `${stem}-${suffix}.${extension}`
      suffix += 1
    }
    taken.add(name)
    return name
  })
}

export function batchFilename(extension: 'pdf' | 'png'): string {
  return `purchases.${extension}`
}
