import { formatMoney } from './money.ts'
import { round2, type Receipt } from './receipt.types.ts'

export interface TotalsCheck {
  status: 'ok' | 'mismatch' | 'incomplete'
  expected?: number
}

export function checkTotals(totals: Receipt['totals']): TotalsCheck {
  const { subtotal, discount, shipping, tax, grandTotal } = totals
  if (subtotal == null || discount == null || shipping == null || grandTotal == null) {
    return { status: 'incomplete' }
  }

  const expected = round2(subtotal - discount + shipping + (tax ?? 0))
  if (Math.abs(expected - grandTotal) > 0.02) return { status: 'mismatch', expected }
  return { status: 'ok', expected }
}

export function receiptWarnings(receipt: Receipt): string[] {
  const warnings: string[] = []
  const check = checkTotals(receipt.totals)
  if (check.status === 'mismatch' && check.expected != null && receipt.totals.grandTotal != null) {
    const taxNote = receipt.totals.tax != null ? ' + tax' : ''
    warnings.push(
      `Subtotal − discount + shipping${taxNote} comes to ${formatMoney(check.expected, receipt.order.currency)}, while the total is ${formatMoney(receipt.totals.grandTotal, receipt.order.currency)}. Nothing was changed automatically.`,
    )
  }

  if (receipt.source.type === 'image' && !receipt.order.currency && receipt.totals.grandTotal != null) {
    warnings.push('Currency was not found. The field was left empty.')
  }

  if (receipt.items.length === 1) {
    const [item] = receipt.items
    if (item?.unitPrice != null && item.quantity != null && receipt.totals.subtotal != null) {
      const line = round2(item.unitPrice * item.quantity)
      if (Math.abs(line - receipt.totals.subtotal) > 0.02) {
        warnings.push('The item price times quantity does not match the subtotal.')
      }
    }
  }

  return warnings
}
