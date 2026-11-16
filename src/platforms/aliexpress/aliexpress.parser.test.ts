import { describe, expect, it } from 'vitest'
import type { OcrPage, OcrWord } from '../../core/ocr/ocr.types.ts'
import { receiptWarnings } from '../../core/receipt/receipt.validator.ts'
import { parseAliExpress } from './aliexpress.parser.ts'
import { redactCard } from './aliexpress.patterns.ts'

function word(text: string, x: number, y: number, confidence = 93): OcrWord {
  return {
    text,
    confidence,
    bbox: { x0: x, y0: y, x1: x + Math.max(16, text.length * 8), y1: y + 18 },
  }
}

function page(words: OcrWord[]): OcrPage {
  return {
    text: words.map((entry) => entry.text).join(' '),
    confidence: 90,
    width: 800,
    height: 1400,
    words,
    positioned: true,
  }
}

function orderPage(): OcrPage {
  return page([
    word('AliExpress', 80, 30),
    word('Summary', 40, 100),
    word('Order', 40, 150),
    word('ID:', 100, 150),
    word('1000000000000001', 520, 150, 88),
    word('Order', 40, 190),
    word('time:', 100, 190),
    word('Nov', 520, 190),
    word('15,', 570, 190),
    word('2026', 620, 190),
    word('Subtotal:', 40, 230),
    word('17.80', 560, 230),
    word('All', 40, 270),
    word('discount:', 80, 270),
    word('0.29', 560, 270),
    word('Shipping', 40, 310),
    word('fee:', 130, 310),
    word('0.00', 560, 310),
    word('Total:', 40, 350),
    word('17.51', 560, 350),
    word('Shipping', 40, 430),
    word('address', 130, 430),
    word('Jane', 40, 470),
    word('Example', 90, 470),
    word('+1', 180, 470),
    word('5550100', 220, 470),
    word('12', 40, 510),
    word('Main', 70, 510),
    word('Street', 120, 510),
    word('Payment', 40, 570),
    word('method', 120, 570),
    word('VISA', 40, 610),
    word('4000', 110, 610),
    word('00******', 180, 610),
    word('0002', 280, 610),
    word('ILS', 520, 610, 96),
    word('17.51', 580, 610),
    word('Paid', 40, 650),
    word('on', 90, 650),
    word('Nov', 130, 650),
    word('15,', 180, 650),
    word('2026', 230, 650),
    word('Item', 40, 720),
    word('detail', 90, 720),
    word('100WPD', 24, 780),
    word('Essager', 280, 780),
    word('100W', 360, 780),
    word('C', 420, 780),
    word('To', 450, 780),
    word('C', 480, 780),
    word('Type', 510, 780),
    word('Cable', 570, 780),
    word('1m,100W', 280, 820),
    word('Black', 380, 820),
    word('8.90', 280, 860),
    word('x2', 640, 860),
    word('ESSAGER', 280, 900),
    word('Direct', 380, 900),
    word('Sales', 460, 900),
    word('Store', 530, 900),
    word('Things', 40, 980),
    word('to', 110, 980),
    word('note:', 140, 980),
  ])
}

describe('AliExpress parser', () => {
  it('reads one order image into receipt fields', () => {
    const result = parseAliExpress(orderPage(), { type: 'image', filename: 'order.jpg' })
    const { receipt } = result

    expect(receipt.merchant.name).toBe('AliExpress')
    expect(receipt.merchant.seller).toBe('ESSAGER Direct Sales Store')
    expect(receipt.order.orderId).toBe('1000000000000001')
    expect(receipt.order.date).toBe('Nov 15, 2026')
    expect(receipt.order.currency).toBe('ILS')
    expect(receipt.totals).toEqual({
      subtotal: 17.8,
      discount: 0.29,
      shipping: 0,
      grandTotal: 17.51,
    })
    expect(receipt.items).toHaveLength(1)
    expect(receipt.items[0]).toMatchObject({
      name: 'Essager 100W C To C Type Cable 1m,100W Black',
      quantity: 2,
      unitPrice: 8.9,
      totalPrice: 17.8,
    })
    expect(receipt.buyer).toEqual({
      name: 'Jane Example',
      phone: '+1 5550100',
      address: '12 Main Street',
    })
    expect(receipt.payment).toEqual({
      brand: 'VISA',
      card: '4000 00** **** 0002',
      paidOn: 'Nov 15, 2026',
    })
    expect(receiptWarnings(receipt)).toEqual([])
    expect(JSON.stringify(receipt)).not.toContain('100WPD')
  })

  it('masks a full card number and keeps only the visible ends', () => {
    const result = parseAliExpress(page([
      word('Payment', 40, 40),
      word('method', 130, 40),
      word('Visa', 40, 90),
      word('4111111111111111', 120, 90),
    ]), { type: 'image' })

    expect(result.receipt.payment.brand).toBe('VISA')
    expect(result.receipt.payment.card).toBe('4111 11** **** 1111')
    expect(JSON.stringify(result.receipt)).not.toContain('4111111111111111')
  })

  it('masks a card number even when extra characters are attached', () => {
    expect(redactCard('4111111111111111.')).toBe('4111 11** **** 1111')
    expect(redactCard('4111 1111 1111 1111')).toBe('4111 11** **** 1111')
    expect(redactCard('note 4111111111111111')).not.toContain('4111111111111111')
    expect(redactCard('4000')).toBe('4000')
    expect(redactCard('4000 00** **** 0002')).toBe('4000 00** **** 0002')
  })

  it('ignores card brand words that match built-in object keys', () => {
    const result = parseAliExpress(page([
      word('Payment', 40, 40),
      word('method', 130, 40),
      word('constructor', 40, 90),
      word('__proto__', 160, 90),
    ]), { type: 'image' })

    expect(result.receipt.payment.brand).toBeUndefined()
  })

  it('leaves a missing order id empty', () => {
    const result = parseAliExpress(page([
      word('AliExpress', 40, 20),
      word('Subtotal:', 40, 80),
      word('10.00', 300, 80),
      word('Total:', 40, 120),
      word('10.00', 300, 120),
    ]), { type: 'image' })

    expect(result.receipt.order.orderId).toBeUndefined()
    expect(result.confidence['order.orderId']).toBeUndefined()
    expect(result.receipt.totals.subtotal).toBe(10)
  })

  it('caps confidence when the order id is not 16 digits', () => {
    const result = parseAliExpress(page([
      word('Order', 40, 40),
      word('ID:', 100, 40),
      word('123456789012345', 300, 40, 90),
    ]), { type: 'image' })

    expect(result.receipt.order.orderId).toBe('123456789012345')
    expect(result.confidence['order.orderId']).toBeLessThanOrEqual(40)
  })

  it('repairs a dropped decimal and a missing x on quantity', () => {
    const result = parseAliExpress(page([
      word('Order', 40, 40),
      word('time:', 110, 40),
      word('Nov', 300, 40),
      word('15,2026', 360, 40),
      word('Al', 40, 80),
      word('discount:', 70, 80),
      word('029', 300, 80),
      word('Shipping', 40, 120),
      word('fee:', 130, 120),
      word('2000', 300, 120),
      word('Item', 40, 180),
      word('detail', 90, 180),
      word('Essager', 280, 230),
      word('100W', 360, 230),
      word('Cable', 430, 230),
      word('890', 280, 280),
      word('2', 640, 280),
      word('ESSAGER', 280, 320),
      word('Store', 380, 320),
    ]), { type: 'image' })

    expect(result.receipt.order.date).toBe('Nov 15, 2026')
    expect(result.receipt.totals.discount).toBe(0.29)
    expect(result.receipt.totals.shipping).toBeUndefined()
    expect(result.receipt.items[0]).toMatchObject({
      name: 'Essager 100W Cable',
      quantity: 2,
      unitPrice: 8.9,
    })
    expect(result.confidence['totals.discount']).toBeLessThanOrEqual(48)
    expect(result.confidence['items.item-1.unitPrice']).toBeLessThanOrEqual(48)
  })

  it('reads a price whose decimal point was lost beside the quantity', () => {
    const result = parseAliExpress(page([
      word('Subtotal:', 40, 40),
      word('48.78', 300, 40),
      word('Item', 40, 100),
      word('detail', 90, 100),
      word('Essager', 280, 150),
      word('Cable', 360, 150),
      word('00', 280, 190),
      word('Blue,1.2m', 320, 190),
      word('=', 430, 190),
      word('m2439', 280, 230),
      word('x2', 640, 230),
      word('ESSAGER', 280, 270),
      word('Store', 360, 270),
    ]), { type: 'image' })

    expect(result.receipt.items[0]).toMatchObject({
      name: 'Essager Cable Blue,1.2m',
      quantity: 2,
      unitPrice: 24.39,
      totalPrice: 48.78,
    })
  })

  it('drops a shekel misread when the subtotal confirms the price', () => {
    const result = parseAliExpress(page([
      word('Subtotal:', 40, 40),
      word('33.58', 300, 40),
      word('Item', 40, 100),
      word('detail', 90, 100),
      word('Cable', 280, 150),
      word('216.79', 280, 190),
      word('x2', 640, 190),
      word('Ugreen', 280, 230),
      word('Store', 360, 230),
    ]), { type: 'image' })

    expect(result.receipt.items[0]?.unitPrice).toBe(16.79)
    expect(result.receipt.items[0]?.totalPrice).toBe(33.58)
    expect(result.confidence['items.item-1.unitPrice']).toBeLessThanOrEqual(45)
  })

  it('drops a stray lowercase word in front of the store name', () => {
    const result = parseAliExpress(page([
      word('Item', 40, 40),
      word('detail', 90, 40),
      word('Cable', 280, 100),
      word('8.90', 280, 140),
      word('x1', 640, 140),
      word('anne', 280, 180),
      word('ESSAGER', 340, 180),
      word('Store', 430, 180),
    ]), { type: 'image' })

    expect(result.receipt.merchant.seller).toBe('ESSAGER Store')
  })

  it('reads two items and ignores the product photo column', () => {
    const result = parseAliExpress(page([
      word('Item', 40, 40),
      word('detail', 90, 40),
      word('BADGE', 20, 100),
      word('Cable', 300, 100),
      word('8.90', 300, 140),
      word('x2', 640, 140),
      word('Cable', 300, 180),
      word('Store', 380, 180),
      word('Charger', 300, 240),
      word('10.00', 300, 280),
      word('x1', 640, 280),
      word('Charger', 300, 320),
      word('Store', 390, 320),
    ]), { type: 'image' })

    expect(result.receipt.items.map((item) => item.name)).toEqual(['Cable', 'Charger'])
    expect(result.receipt.items.map((item) => item.quantity)).toEqual([2, 1])
    expect(result.receipt.merchant.seller).toBe('Cable Store, Charger Store')
    expect(result.receipt.items[0]?.name).not.toContain('BADGE')
  })
})
