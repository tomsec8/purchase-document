import { paintInvoice, invoiceWidth } from '../../templates/invoice.template.ts'
import { paintReceipt, receiptWidth } from '../../templates/receipt.template.ts'
import type { Receipt } from '../receipt/receipt.types.ts'

export type TemplateId = 'receipt' | 'invoice'

const SCALE = 2

export function renderDocument(receipt: Receipt, template: TemplateId): HTMLCanvasElement {
  const width = template === 'receipt' ? receiptWidth : invoiceWidth
  const minHeight = template === 'invoice' ? 1123 : 0
  const paint = template === 'receipt' ? paintReceipt : paintInvoice

  const measure = document.createElement('canvas').getContext('2d')
  if (!measure) throw new Error('Could not draw the document.')
  const contentHeight = Math.ceil(paint(measure, receipt))
  const height = Math.max(minHeight, contentHeight)

  const canvas = document.createElement('canvas')
  canvas.width = width * SCALE
  canvas.height = height * SCALE
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Could not draw the document.')
  context.scale(SCALE, SCALE)
  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, width, height)
  paint(context, receipt, height)
  return canvas
}
