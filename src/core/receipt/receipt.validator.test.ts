import { describe, expect, it } from 'vitest'
import { batchFilename, documentFilename, documentFilenames, formatDiscount, formatMoney } from './money.ts'
import { manualReceipt } from './receipt.types.ts'
import { receiptWarnings } from './receipt.validator.ts'

describe('money formatting', () => {
  it('formats shekels with the ILS code', () => {
    expect(formatMoney(17.51, 'ILS')).toBe('ILS\u00a017.51')
    expect(formatDiscount(0.29, 'ILS')).toBe('ILS −17.51'.replace('17.51', '0.29'))
  })
})

describe('download filenames', () => {
  it('gives each order its own filename', () => {
    expect(documentFilenames(['A1', 'A1', undefined], 'pdf')).toEqual([
      'purchase-A1.pdf',
      'purchase-A1-2.pdf',
      'purchase-document.pdf',
    ])
    expect(documentFilename('12/34', 'png')).toBe('purchase-1234.png')
    expect(batchFilename('pdf')).toBe('purchases.pdf')
  })
})

describe('receipt warnings', () => {
  it('warns when the total does not match the other amounts', () => {
    const receipt = manualReceipt()
    receipt.order.currency = 'ILS'
    receipt.totals = { subtotal: 17.8, discount: 0.29, shipping: 0, grandTotal: 10 }
    expect(receiptWarnings(receipt)[0]).toContain('comes to')
    expect(receiptWarnings(receipt)[0]).toContain('ILS')
  })

  it('stays quiet when a figure is missing', () => {
    const receipt = manualReceipt()
    receipt.totals = { subtotal: 10, grandTotal: 10 }
    expect(receiptWarnings(receipt)).toEqual([])
  })
})
