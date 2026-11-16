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

const WIDTH = 600
const PAD = 52
const RIGHT = WIDTH - PAD
const CENTER = WIDTH / 2

export const receiptWidth = WIDTH

export function paintReceipt(ctx: CanvasRenderingContext2D, receipt: Receipt): number {
  const currency = receipt.order.currency
  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = ACCENT
  ctx.fillRect(0, 0, WIDTH, 5)

  ctx.font = `600 11px ${SANS}`
  ctx.fillStyle = ACCENT
  ctx.textAlign = 'center'
  spaced(ctx, 'RECEIPT', CENTER, 64, 4)

  let y = 96
  if (receipt.merchant.name) {
    paintSeal(ctx, CENTER, y, receipt.merchant.name, 34)
    y += 40
    ctx.font = `700 26px ${SERIF}`
    ctx.fillStyle = INK
    ctx.textAlign = 'center'
    for (const line of wrapText(ctx, receipt.merchant.name, RIGHT - PAD)) {
      ctx.fillText(line, CENTER, y)
      y += 32
    }
  }
  if (receipt.merchant.seller) {
    ctx.font = `400 13px ${SANS}`
    ctx.fillStyle = MUTED
    for (const line of wrapText(ctx, receipt.merchant.seller, RIGHT - PAD)) {
      ctx.fillText(line, CENTER, y - 8)
      y += 20
    }
  }

  y += 8
  doubleRule(ctx, PAD, RIGHT, y)
  y += 40

  const detailsTop = y
  y = detail(ctx, y, 'Order number', receipt.order.orderId)
  y = detail(ctx, y, 'Order date', receipt.order.date)
  y = detail(ctx, y, 'Currency', currency)
  if (y > detailsTop) {
    hairline(ctx, PAD, RIGHT, y - 8)
    y += 26
  } else {
    y += 10
  }

  const card = receipt.payment.card ? redactCard(receipt.payment.card) : ''
  const beforeParties = y
  y = textBlock(ctx, y, 'Buyer', [receipt.buyer.name, receipt.buyer.phone, receipt.buyer.address])
  y = textBlock(ctx, y, 'Payment', [
    [receipt.payment.brand, card].filter(Boolean).join('   '),
    receipt.payment.paidOn ? `Paid on ${receipt.payment.paidOn}` : '',
  ])
  if (y > beforeParties) {
    hairline(ctx, PAD, RIGHT, y - 6)
    y += 24
  }

  const visible = receipt.items.filter((item) => item.name || item.unitPrice != null || item.quantity != null)
  if (!visible.length) {
    ctx.font = `400 14px ${SANS}`
    ctx.fillStyle = MUTED
    ctx.textAlign = 'left'
    ctx.fillText('No items entered.', PAD, y)
    y += 32
  }
  for (const item of visible) y = itemBlock(ctx, y, item, currency)

  hairline(ctx, PAD, RIGHT, y - 8)
  y += 26
  y = amount(ctx, y, 'Subtotal', receipt.totals.subtotal, currency, false)
  y = amount(ctx, y, 'Discount', receipt.totals.discount, currency, true)
  y = amount(ctx, y, 'Shipping', receipt.totals.shipping, currency, false)
  y = amount(ctx, y, 'Tax', receipt.totals.tax, currency, false)

  if (receipt.totals.grandTotal != null) {
    y += 2
    ctx.fillStyle = BAND
    ctx.fillRect(PAD - 14, y, RIGHT - PAD + 28, 54)
    hairline(ctx, PAD - 14, RIGHT + 14, y, ACCENT, 1.5)
    ctx.textAlign = 'left'
    ctx.font = `600 11px ${SANS}`
    ctx.fillStyle = ACCENT
    spaced(ctx, 'TOTAL', PAD, y + 33, 2)
    ctx.textAlign = 'right'
    ctx.font = `700 20px ${SANS}`
    ctx.fillStyle = INK
    ctx.fillText(formatMoney(receipt.totals.grandTotal, currency), RIGHT, y + 35)
    y += 54
  }

  y += 44
  ctx.font = `400 11px ${SANS}`
  ctx.fillStyle = MUTED
  ctx.textAlign = 'center'
  ctx.fillText(`Generated on ${generatedOn()}`, CENTER, y)
  return y + 40
}

function textBlock(ctx: CanvasRenderingContext2D, y: number, label: string, lines: Array<string | undefined>): number {
  const visible = lines.filter((line): line is string => Boolean(line))
  if (!visible.length) return y
  ctx.font = `600 10.5px ${SANS}`
  ctx.fillStyle = MUTED
  ctx.textAlign = 'left'
  spaced(ctx, label.toUpperCase(), PAD, y, 1.6)
  y += 22
  ctx.font = `400 14px ${SANS}`
  ctx.fillStyle = INK
  for (const line of visible) {
    for (const wrapped of wrapText(ctx, line, RIGHT - PAD)) {
      ctx.fillText(wrapped, PAD, y)
      y += 20
    }
  }
  return y + 14
}

function detail(ctx: CanvasRenderingContext2D, y: number, label: string, value?: string): number {
  if (!value) return y
  ctx.font = `600 10.5px ${SANS}`
  ctx.fillStyle = MUTED
  ctx.textAlign = 'left'
  spaced(ctx, label.toUpperCase(), PAD, y, 1.6)
  ctx.font = `400 14px ${SANS}`
  ctx.fillStyle = INK
  ctx.textAlign = 'right'
  ctx.fillText(value, RIGHT, y)
  return y + 30
}

function itemBlock(ctx: CanvasRenderingContext2D, y: number, item: ReceiptItem, currency: string): number {
  if (item.name) {
    ctx.font = `400 14px ${SANS}`
    ctx.fillStyle = INK
    ctx.textAlign = 'left'
    for (const line of wrapText(ctx, item.name, RIGHT - PAD)) {
      ctx.fillText(line, PAD, y)
      y += 21
    }
    y += 2
  }

  const quantity = item.quantity != null ? String(item.quantity) : ''
  const unit = item.unitPrice != null ? formatMoney(item.unitPrice, currency) : ''
  const left = quantity && unit ? `${quantity} × ${unit}` : [quantity && `${quantity} ×`, unit].filter(Boolean).join(' ')
  const right = item.totalPrice != null ? formatMoney(item.totalPrice, currency) : ''
  if (left || right) {
    ctx.font = `400 13px ${SANS}`
    ctx.fillStyle = MUTED
    ctx.textAlign = 'left'
    ctx.fillText(left, PAD, y)
    ctx.font = `600 14px ${SANS}`
    ctx.fillStyle = INK
    ctx.textAlign = 'right'
    ctx.fillText(right, RIGHT, y)
    y += 22
  }
  return y + 14
}

function amount(
  ctx: CanvasRenderingContext2D,
  y: number,
  label: string,
  value: number | undefined,
  currency: string,
  discount: boolean,
): number {
  if (value == null) return y
  ctx.font = `400 14px ${SANS}`
  ctx.fillStyle = MUTED
  ctx.textAlign = 'left'
  ctx.fillText(label, PAD, y)
  ctx.fillStyle = INK
  ctx.textAlign = 'right'
  ctx.fillText(discount ? formatDiscount(value, currency) : formatMoney(value, currency), RIGHT, y)
  return y + 28
}
