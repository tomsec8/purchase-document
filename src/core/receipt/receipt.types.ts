export interface ReceiptItem {
  id: string
  name: string
  quantity?: number
  unitPrice?: number
  totalPrice?: number
}

export interface Receipt {
  source: { type: 'image'; filename?: string } | { type: 'manual' }
  merchant: {
    name: string
    seller?: string
  }
  order: {
    orderId?: string
    date?: string
    currency: string
  }
  items: ReceiptItem[]
  totals: {
    subtotal?: number
    shipping?: number
    discount?: number
    tax?: number
    grandTotal?: number
  }
  buyer: {
    name?: string
    phone?: string
    address?: string
  }
  payment: {
    brand?: string
    card?: string
    paidOn?: string
  }
}

export type ConfidenceMap = Record<string, number>

export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

export function createEmptyItem(): ReceiptItem {
  return { id: crypto.randomUUID(), name: '' }
}

export function withLineTotals(receipt: Receipt): Receipt {
  return {
    ...receipt,
    items: receipt.items.map((item) => ({
      ...item,
      totalPrice:
        item.unitPrice != null && item.quantity != null
          ? round2(item.unitPrice * item.quantity)
          : undefined,
    })),
  }
}

export function manualReceipt(merchantName = ''): Receipt {
  return {
    source: { type: 'manual' },
    merchant: { name: merchantName },
    order: { currency: '' },
    items: [createEmptyItem()],
    totals: {},
    buyer: {},
    payment: {},
  }
}
