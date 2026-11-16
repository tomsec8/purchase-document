import type { OcrPage, OcrWord } from '../../core/ocr/ocr.types.ts'
import type { ParseResult, ReceiptParser } from '../../core/parser/parser.interface.ts'
import { round2, withLineTotals, type Receipt, type ReceiptItem } from '../../core/receipt/receipt.types.ts'
import { aliexpressLabels } from './aliexpress.fields.ts'
import {
  cardBrand,
  cleanText,
  currencyToken,
  isCardPiece,
  isStoreLine,
  redactCard,
  matchDate,
  matchOrderId,
  normalizeLabel,
  parseMoney,
  quantityToken,
  readMoney,
  splitBuyerLine,
} from './aliexpress.patterns.ts'

interface Line {
  words: OcrWord[]
  text: string
  y: number
  confidence: number
}

interface LabeledValue {
  text: string
  lineText: string
  confidence: number
}

interface DraftItem {
  name: string
  quantity?: number
  unitPrice?: number
  nameConfidence: number
  priceConfidence: number
  quantityConfidence: number
}

const THUMBNAIL_CUTOFF = 0.22

export function parseAliExpress(page: OcrPage, source: Receipt['source']): ParseResult {
  const lines = groupLines(page.words)
  const confidence: Record<string, number> = {}
  const itemHeader = findLine(lines, aliexpressLabels.item)
  const notesHeader = findLine(lines, aliexpressLabels.notes)
  const paymentHeader = findLine(lines, aliexpressLabels.payment)

  const summaryLines = lines.filter((line) => {
    if (itemHeader && line.y >= itemHeader.y) return false
    if (notesHeader && line.y >= notesHeader.y) return false
    return true
  })
  const paymentLines = lines.filter((line) => {
    if (!paymentHeader || line.y <= paymentHeader.y) return false
    if (itemHeader && line.y >= itemHeader.y) return false
    return true
  })

  const receipt: Receipt = {
    source,
    merchant: { name: '' },
    order: { currency: '' },
    items: [],
    totals: {},
    buyer: {},
    payment: {},
  }

  const merchant = findMerchant(page.words)
  if (merchant) {
    receipt.merchant.name = 'AliExpress'
    confidence['merchant.name'] = merchant.confidence
  }

  const orderIdLine = firstLabel(summaryLines, aliexpressLabels.orderId)
  const orderId = orderIdLine
    ? matchOrderId(orderIdLine.text) ?? matchOrderId(orderIdLine.lineText)
    : null
  if (orderId) {
    receipt.order.orderId = orderId
    const rawConfidence = orderIdLine?.confidence ?? 0
    const plausibleLength = orderId.length === 16 || orderId.length === 17
    confidence['order.orderId'] = !plausibleLength
      ? Math.min(rawConfidence, 40)
      : rawConfidence >= 95
        ? rawConfidence
        : Math.min(rawConfidence, 70)
  }

  const orderTime = firstLabel(summaryLines, aliexpressLabels.orderTime)
  const paidOn = paymentLines.map((line) => matchDate(line.text)).find((date) => date != null) ?? null
  const date = (orderTime ? matchDate(orderTime.text) ?? matchDate(orderTime.lineText) : null) ?? paidOn
  if (date) {
    receipt.order.date = date
    confidence['order.date'] = orderTime?.confidence ?? average(paymentLines.flatMap((line) => line.words))
  }

  const currencyWord = [...paymentLines, ...summaryLines]
    .flatMap((line) => line.words)
    .map((word) => ({ code: currencyToken(word.text), confidence: word.confidence }))
    .find((entry) => entry.code != null)
  if (currencyWord?.code) {
    receipt.order.currency = currencyWord.code
    confidence['order.currency'] = currencyWord.confidence
  }

  assignMoney(receipt, confidence, summaryLines, 'subtotal', aliexpressLabels.subtotal, 'totals.subtotal')
  assignMoney(receipt, confidence, summaryLines, 'discount', aliexpressLabels.discount, 'totals.discount')
  assignMoney(receipt, confidence, summaryLines, 'shipping', aliexpressLabels.shipping, 'totals.shipping')
  assignMoney(receipt, confidence, summaryLines, 'grandTotal', aliexpressLabels.total, 'totals.grandTotal')

  const addressHeader = findLine(lines, aliexpressLabels.shippingAddress)
  readBuyer(receipt, confidence, lines.filter((line) => between(line, addressHeader, paymentHeader ?? itemHeader)))
  readPayment(receipt, confidence, paymentLines)

  const itemLines = visibleItemLines(
    lines.filter((line) => {
      if (!itemHeader || line.y <= itemHeader.y) return false
      if (notesHeader && line.y >= notesHeader.y) return false
      return true
    }),
    page,
  )
  const { items, seller, sellerConfidence } = readItems(itemLines)
  if (seller) {
    receipt.merchant.seller = seller
    confidence['merchant.seller'] = sellerConfidence
  }
  receipt.items = items.map((item, index) => {
    const id = `item-${index + 1}`
    const next: ReceiptItem = { id, name: item.name }
    if (item.name) confidence[`items.${id}.name`] = item.nameConfidence
    if (item.quantity != null) {
      next.quantity = item.quantity
      confidence[`items.${id}.quantity`] = item.quantityConfidence
    }
    if (item.unitPrice != null) {
      next.unitPrice = item.unitPrice
      confidence[`items.${id}.unitPrice`] = item.priceConfidence
    }
    return next
  })

  reconcileShekelPrefix(receipt, confidence)

  return {
    receipt: withLineTotals(receipt),
    confidence,
    rawText: page.text,
  }
}

export const aliexpressParser: ReceiptParser = {
  id: 'aliexpress',
  name: 'AliExpress',
  supportedLanguages: ['en'],
  parse: parseAliExpress,
}

function between(line: Line, start: Line | undefined, end: Line | undefined): boolean {
  if (!start || line.y <= start.y) return false
  if (end && line.y >= end.y) return false
  return true
}

function readBuyer(receipt: Receipt, confidence: Record<string, number>, lines: Line[]) {
  const address: Line[] = []
  for (const line of lines) {
    const split = splitBuyerLine(line.text)
    if (split && !receipt.buyer.phone) {
      receipt.buyer.phone = split.phone
      confidence['buyer.phone'] = line.confidence
      if (split.name && !receipt.buyer.name) {
        receipt.buyer.name = split.name
        confidence['buyer.name'] = line.confidence
      }
      continue
    }
    if (!receipt.buyer.name && /[A-Za-z]/.test(line.text) && address.length === 0) {
      receipt.buyer.name = cleanText(line.text)
      confidence['buyer.name'] = line.confidence
      continue
    }
    address.push(line)
  }
  if (!address.length) return
  receipt.buyer.address = cleanText(address.map((line) => line.text).join(', '))
  confidence['buyer.address'] = average(address.flatMap((line) => line.words))
}

function readPayment(receipt: Receipt, confidence: Record<string, number>, lines: Line[]) {
  const brand = lines.flatMap((line) => line.words).find((word) => cardBrand(word.text))
  if (brand) {
    receipt.payment.brand = cardBrand(brand.text) ?? undefined
    confidence['payment.brand'] = brand.confidence
  }

  const pieces = lines.flatMap((line) => {
    const dated = matchDate(line.text) != null
    return line.words.filter((word) => {
      if (!isCardPiece(word.text)) return false
      return !(dated && /^20\d{2}$/.test(word.text.replace(/\D/g, '')))
    })
  })
  const masked = redactCard(pieces.map((word) => word.text).join(''))
  if (masked.includes('*')) {
    receipt.payment.card = masked
    confidence['payment.card'] = Math.min(average(pieces), 70)
  }

  const paid = lines.find((line) => /\bpaid\b/i.test(line.text) && matchDate(line.text))
  const paidOn = paid ? matchDate(paid.text) : null
  if (paid && paidOn) {
    receipt.payment.paidOn = paidOn
    confidence['payment.paidOn'] = paid.confidence
  }
}

function assignMoney(
  receipt: Receipt,
  confidence: Record<string, number>,
  lines: Line[],
  field: keyof Receipt['totals'],
  pattern: RegExp,
  key: string,
) {
  const labeled = firstLabel(lines, pattern)
  if (!labeled) return
  const reading = readMoney(labeled.text) ?? readMoney(labeled.lineText)
  if (!reading) return
  receipt.totals[field] = reading.value
  confidence[key] = reading.loose ? Math.min(labeled.confidence, 48) : labeled.confidence
}

function readItems(lines: Line[]): { items: DraftItem[]; seller: string; sellerConfidence: number } {
  const items: DraftItem[] = []
  const sellers: Array<{ name: string; confidence: number }> = []
  let buffer: Line[] = []
  let expectingSeller = false

  const pushBufferedName = (extra: OcrWord[] = [], priceConfidence = 0, quantity?: number, quantityConfidence = 0, unitPrice?: number) => {
    const nameWords = [
      ...buffer.flatMap((line) => line.words),
      ...extra,
    ]
    const name = cleanItemName(nameWords.map((word) => word.text).join(' '))
    if (!name && unitPrice == null && quantity == null) {
      buffer = []
      return
    }
    items.push({
      name,
      quantity,
      unitPrice,
      nameConfidence: average(nameWords),
      priceConfidence,
      quantityConfidence,
    })
    buffer = []
  }

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]
    if (!line) continue
    const money = linePrice(line)
    const quantityWord = line.words.find((word) => countsAsQuantity(word.text, money != null))
    const quantity = quantityWord ? quantityToken(wordQuantity(quantityWord.text)) : null

    if (money) {
      const extra = line.words.filter((word) => !countsAsQuantity(word.text, true) && !isPriceWord(word.text))
      const quantityConfidence = quantityWord
        ? (/^[x×]/i.test(quantityWord.text) ? quantityWord.confidence : Math.min(quantityWord.confidence, 50))
        : 0
      pushBufferedName(extra, money.confidence, quantity ?? undefined, quantityConfidence, money.value)
      expectingSeller = true
      continue
    }

    if (expectingSeller) {
      const laterPrice = lines.slice(index + 1).some((later) => linePrice(later) != null)
      const store = isStoreLine(line.text) || (!laterPrice && line.text.length <= 80)
      if (store) {
        sellers.push({ name: cleanStoreName(line.text), confidence: line.confidence })
        expectingSeller = false
        continue
      }
      expectingSeller = false
    }

    const onlyQuantity = line.words.length > 0 && line.words.every((word) => quantityToken(word.text) != null)
    if (onlyQuantity) {
      const value = quantityToken(wordQuantity(line.words[0]?.text ?? ''))
      const current = items.at(-1)
      if (value != null && current && current.quantity == null) {
        current.quantity = value
        const marked = /^[x×]/i.test(line.words[0]?.text ?? '')
        current.quantityConfidence = marked ? line.confidence : Math.min(line.confidence, 50)
        continue
      }
    }

    buffer.push(line)
  }

  return {
    items,
    seller: sellers.map((entry) => entry.name).filter(Boolean).join(', '),
    sellerConfidence: sellers.length
      ? sellers.reduce((sum, entry) => sum + entry.confidence, 0) / sellers.length
      : 0,
  }
}

function visibleItemLines(lines: Line[], page: OcrPage): Line[] {
  return lines.flatMap((line) => {
    const words = page.positioned
      ? line.words.filter((word) => wordCenter(word) >= page.width * THUMBNAIL_CUTOFF)
      : line.words
    if (!words.length) return []
    return [{
      words,
      text: words.map((word) => word.text).join(' '),
      y: line.y,
      confidence: average(words),
    }]
  })
}

function linePrice(line: Line): { value: number; confidence: number } | null {
  const reading = readMoney(line.text)
  if (!reading) return null
  if (!reading.loose) return { value: reading.value, confidence: line.confidence }
  const hasCount = line.words.some((word) => countsAsQuantity(word.text, true))
  if (!hasCount) return null
  return { value: reading.value, confidence: Math.min(line.confidence, 48) }
}

function isPriceWord(text: string): boolean {
  return text.replace(/\D/g, '').length >= 3 || parseMoney(text) != null
}

function countsAsQuantity(text: string, allowBareNumber: boolean): boolean {
  const token = text.trim().replace(/[.,]$/, '')
  if (/^[x×]\s*\d{1,3}$/i.test(token)) return true
  return allowBareNumber && /^\d{1,2}$/.test(token)
}

function wordQuantity(text: string): string {
  return /^[x×]/i.test(text.trim()) ? text : `x${text.trim()}`
}

function cleanItemName(text: string): string {
  return cleanText(text)
    .split(' ')
    .filter((word) => /[A-Za-z0-9]/.test(word))
    .filter((word) => !/^0{2,}$/.test(word.replace(/[^\d]/g, '')))
    .join(' ')
}

function reconcileShekelPrefix(receipt: Receipt, confidence: Record<string, number>) {
  const item = receipt.items.length === 1 ? receipt.items[0] : undefined
  if (!item || item.unitPrice == null || item.quantity == null || receipt.totals.subtotal == null) return
  if (Math.abs(round2(item.unitPrice * item.quantity) - receipt.totals.subtotal) <= 0.02) return
  const printed = item.unitPrice.toFixed(2)
  if (printed.length < 5) return
  const repaired = Number(printed.slice(1))
  if (!Number.isFinite(repaired)) return
  if (Math.abs(round2(repaired * item.quantity) - receipt.totals.subtotal) > 0.02) return
  item.unitPrice = repaired
  const key = `items.${item.id}.unitPrice`
  confidence[key] = Math.min(confidence[key] ?? 45, 45)
}

function cleanStoreName(text: string): string {
  const words = cleanText(text).split(' ').filter(Boolean)
  while (words.length > 1 && /^[a-z]{1,5}$/.test(words[0] ?? '')) words.shift()
  return words.join(' ')
}

function findMerchant(words: OcrWord[]): OcrWord | undefined {
  return words.find((word) => normalizeLabel(word.text).replace(/[^a-z]/g, '') === 'aliexpress')
}

function groupLines(words: OcrWord[]): Line[] {
  const sorted = words
    .filter((word) => word.text.trim())
    .sort((a, b) => a.bbox.y0 - b.bbox.y0 || a.bbox.x0 - b.bbox.x0)
  const heights = sorted.map((word) => word.bbox.y1 - word.bbox.y0).sort((a, b) => a - b)
  const median = heights[Math.floor(heights.length / 2)] ?? 12
  const tolerance = Math.max(6, median * 0.65)
  const groups: Array<{ anchor: number; words: OcrWord[] }> = []

  for (const word of sorted) {
    const middle = (word.bbox.y0 + word.bbox.y1) / 2
    const group = groups.find((entry) => Math.abs(entry.anchor - middle) <= tolerance)
    if (group) group.words.push(word)
    else groups.push({ anchor: middle, words: [word] })
  }

  return groups
    .map((group) => {
      const groupWords = group.words.sort((a, b) => a.bbox.x0 - b.bbox.x0)
      return {
        words: groupWords,
        text: groupWords.map((word) => word.text).join(' '),
        y: group.anchor,
        confidence: average(groupWords),
      }
    })
    .sort((a, b) => a.y - b.y)
}

function findLine(lines: Line[], pattern: RegExp): Line | undefined {
  return lines.find((line) => pattern.test(normalizeLabel(line.text)))
}

function firstLabel(lines: Line[], pattern: RegExp): LabeledValue | null {
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]
    if (!line) continue
    const value = readLabel(line, pattern)
    if (!value) continue
    if (value.text) return value
    const next = lines[index + 1]
    if (next && next.y - line.y < 34 && !startsWithLabel(next)) {
      return {
        text: next.text,
        lineText: `${line.text} ${next.text}`,
        confidence: average([...valueWords(line), ...next.words]),
      }
    }
    return value
  }
  return null
}

function startsWithLabel(line: Line): boolean {
  const text = normalizeLabel(line.text)
  return Object.values(aliexpressLabels).some((pattern) => pattern.test(text))
}

function valueWords(line: Line): OcrWord[] {
  return line.words
}

function readLabel(line: Line, pattern: RegExp): LabeledValue | null {
  let accumulated = ''
  let consumed = -1
  for (let index = 0; index < line.words.length; index += 1) {
    accumulated = normalizeLabel(`${accumulated} ${line.words[index].text}`)
    if (pattern.test(accumulated)) {
      consumed = index + 1
      break
    }
    if (index >= 5) return null
  }

  if (consumed < 0) {
    if (!pattern.test(normalizeLabel(line.text))) return null
    consumed = line.words.length
  }

  const valueWords = line.words.slice(consumed)
  const direct = cleanText(valueWords.map((word) => word.text).join(' '))
  return {
    text: direct || textAfterColon(line.text),
    lineText: line.text,
    confidence: average(valueWords.length ? valueWords : line.words),
  }
}

function textAfterColon(text: string): string {
  const index = text.search(/[:：]/)
  if (index < 0) return ''
  return cleanText(text.slice(index + 1))
}

function average(words: OcrWord[]): number {
  if (!words.length) return 0
  return words.reduce((sum, word) => sum + word.confidence, 0) / words.length
}

function wordCenter(word: OcrWord): number {
  return (word.bbox.x0 + word.bbox.x1) / 2
}
