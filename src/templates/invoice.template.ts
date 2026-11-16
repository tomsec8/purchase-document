import { wrapText } from '../core/export/canvas-text.ts'
import { formatDiscount, formatMoney } from '../core/receipt/money.ts'
import type { Receipt, ReceiptItem } from '../core/receipt/receipt.types.ts'
import { redactCard } from '../platforms/aliexpress/aliexpress.patterns.ts'
import {
  ACCENT,
  BAND,
  doubleRule,
  generatedOn,
  hairline,
  INK,
  MUTED,
  paintSeal,
  SANS,
  SERIF,
  spaced,
} from './document-style.ts'

const WIDTH = 794
const PAD = 64
const RIGHT = WIDTH - PAD
const QTY_X = 470
const UNIT_X = 590
const TOTALS_X = RIGHT - 270

export const invoiceWidth = WIDTH

export function paintInvoice(ctx: CanvasRenderingContext2D, receipt: Receipt, pageHeight = 0): number {
  const currency = receipt.order.currency
  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = ACCENT
  ctx.fillRect(0, 0, WIDTH, 6)

  ctx.font = `400 34px ${SERIF}`
  ctx.fillStyle = ACCENT
  ctx.textAlign = 'left'
  spaced(ctx, 'INVOICE', PAD, 104, 6)

  let headerY = 90
  ctx.textAlign = 'right'
  if (receipt.merchant.name) {
    ctx.font = `700 18px ${SERIF}`
    const nameWidth = ctx.measureText(receipt.merchant.name).width
    paintSeal(ctx, RIGHT - nameWidth - 24, headerY - 5, receipt.merchant.name, 28)
    ctx.textAlign = 'right'
    ctx.textBaseline = 'alphabetic'
    ctx.fillStyle = INK
    ctx.font = `700 18px ${SERIF}`
    ctx.fillText(receipt.merchant.name, RIGHT, headerY)
    headerY += 22
  }
  if (receipt.merchant.seller) {
    ctx.font = `400 13px ${SANS}`
    ctx.fillStyle = MUTED
    for (const line of wrapText(ctx, receipt.merchant.seller, 300)) {
      ctx.fillText(line, RIGHT, headerY)
      headerY += 18
    }
  }

  let y = Math.max(136, headerY + 10)
  doubleRule(ctx, PAD, RIGHT, y)
  y += 44

  const details = [
    ['Order number', receipt.order.orderId],
    ['Order date', receipt.order.date],
    ['Currency', currency],
  ].filter((entry): entry is [string, string] => Boolean(entry[1]))
  if (details.length) {
    details.forEach(([label, value], index) => {
      const x = PAD + index * 230
      ctx.textAlign = 'left'
      ctx.font = `600 10.5px ${SANS}`
      ctx.fillStyle = MUTED
      spaced(ctx, label.toUpperCase(), x, y, 1.6)
      ctx.font = `400 15px ${SANS}`
      ctx.fillStyle = INK
      ctx.fillText(value, x, y + 24)
    })
    y += 70
  }

  y = parties(ctx, y, receipt)
  y = tableHeader(ctx, y)
  const visible = receipt.items.filter((item) => item.name || item.unitPrice != null || item.quantity != null)
  if (!visible.length) {
    y = tableRow(ctx, y, { id: 'empty', name: 'No items entered.' }, currency, true)
  }
  for (const item of visible) y = tableRow(ctx, y, item, currency, false)

  y += 30
  y = total(ctx, y, 'Subtotal', receipt.totals.subtotal, currency, false)
  y = total(ctx, y, 'Discount', receipt.totals.discount, currency, true)
  y = total(ctx, y, 'Shipping', receipt.totals.shipping, currency, false)
  y = total(ctx, y, 'Tax', receipt.totals.tax, currency, false)
  if (receipt.totals.grandTotal != null) {
    y += 4
    ctx.fillStyle = BAND
    ctx.fillRect(TOTALS_X - 16, y, RIGHT - TOTALS_X + 32, 52)
    hairline(ctx, TOTALS_X - 16, RIGHT + 16, y, ACCENT, 1.5)
    ctx.textAlign = 'left'
    ctx.font = `600 11px ${SANS}`
    ctx.fillStyle = ACCENT
    spaced(ctx, 'TOTAL', TOTALS_X, y + 32, 2)
    ctx.textAlign = 'right'
    ctx.font = `700 20px ${SANS}`
    ctx.fillStyle = INK
    ctx.fillText(formatMoney(receipt.totals.grandTotal, currency), RIGHT, y + 34)
    y += 52
  }

  const footerY = Math.max(y + 80, pageHeight - 64)
  hairline(ctx, PAD, RIGHT, footerY)
  ctx.font = `400 11px ${SANS}`
  ctx.fillStyle = MUTED
  ctx.textAlign = 'left'
  if (receipt.order.orderId) ctx.fillText(`Order ${receipt.order.orderId}`, PAD, footerY + 22)
  ctx.textAlign = 'right'
  ctx.fillText(`Generated on ${generatedOn()}`, RIGHT, footerY + 22)
  return footerY + 48
}

function parties(ctx: CanvasRenderingContext2D, y: number, receipt: Receipt): number {
  const card = receipt.payment.card ? redactCard(receipt.payment.card) : ''
  const columns = [
    {
      label: 'Buyer',
      lines: [receipt.buyer.name, receipt.buyer.phone, receipt.buyer.address].filter((line): line is string => Boolean(line)),
    },
    {
      label: 'Payment',
      lines: [
        [receipt.payment.brand, card].filter(Boolean).join('   '),
        receipt.payment.paidOn ? `Paid on ${receipt.payment.paidOn}` : '',
      ].filter((line): line is string => Boolean(line)),
    },
  ].filter((column) => column.lines.length)
  if (!columns.length) return y

  const gap = 36
  const width = columns.length === 2 ? (RIGHT - PAD - gap) / 2 : RIGHT - PAD
  let bottom = y
  columns.forEach((column, index) => {
    const x = PAD + index * (width + gap)
    ctx.textAlign = 'left'
    ctx.font = `600 10.5px ${SANS}`
    ctx.fillStyle = MUTED
    spaced(ctx, column.label.toUpperCase(), x, y, 1.6)
    ctx.font = `400 14px ${SANS}`
    ctx.fillStyle = INK
    let textY = y + 24
    for (const line of column.lines) {
      for (const wrapped of wrapText(ctx, line, width)) {
        ctx.fillText(wrapped, x, textY)
        textY += 20
      }
    }
    bottom = Math.max(bottom, textY)
  })
  return bottom + 16
}

function tableHeader(ctx: CanvasRenderingContext2D, y: number): number {
  ctx.font = `600 10.5px ${SANS}`
  ctx.fillStyle = MUTED
  ctx.textAlign = 'left'
  spaced(ctx, 'DESCRIPTION', PAD, y, 1.6)
  ctx.textAlign = 'right'
  spaced(ctx, 'QTY', QTY_X, y, 1.6)
  spaced(ctx, 'UNIT PRICE', UNIT_X, y, 1.6)
  spaced(ctx, 'AMOUNT', RIGHT, y, 1.6)
  hairline(ctx, PAD, RIGHT, y + 14, INK, 1)
  return y + 15
}

function tableRow(
  ctx: CanvasRenderingContext2D,
  y: number,
  item: ReceiptItem,
  currency: string,
  muted: boolean,
): number {
  ctx.font = `400 14px ${SANS}`
  const lines = wrapText(ctx, item.name || ' ', QTY_X - PAD - 70)
  const rowHeight = Math.max(52, lines.length * 21 + 31)
  const firstLine = y + 32
  ctx.fillStyle = muted ? MUTED : INK
  ctx.textAlign = 'left'
  lines.forEach((line, index) => ctx.fillText(line, PAD, firstLine + index * 21))
  ctx.textAlign = 'right'
  if (item.quantity != null) ctx.fillText(String(item.quantity), QTY_X, firstLine)
  if (item.unitPrice != null) ctx.fillText(formatMoney(item.unitPrice, currency), UNIT_X, firstLine)
  if (item.totalPrice != null) {
    ctx.font = `600 14px ${SANS}`
    ctx.fillText(formatMoney(item.totalPrice, currency), RIGHT, firstLine)
  }
  hairline(ctx, PAD, RIGHT, y + rowHeight)
  return y + rowHeight
}

function total(
  ctx: CanvasRenderingContext2D,
  y: number,
  label: string,
  amount: number | undefined,
  currency: string,
  discount: boolean,
): number {
  if (amount == null) return y
  ctx.font = `400 14px ${SANS}`
  ctx.fillStyle = MUTED
  ctx.textAlign = 'left'
  ctx.fillText(label, TOTALS_X, y)
  ctx.fillStyle = INK
  ctx.textAlign = 'right'
  ctx.fillText(discount ? formatDiscount(amount, currency) : formatMoney(amount, currency), RIGHT, y)
  return y + 28
}
