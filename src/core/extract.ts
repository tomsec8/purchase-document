import { recognizeCanvas, type OcrProgress } from './ocr/ocr.engine.ts'
import { ImageTooLarge, prepareImage } from './ocr/image.preprocessing.ts'
import { getParser } from './parser/parser.registry.ts'
import type { ParseResult } from './parser/parser.interface.ts'
import type { Receipt } from './receipt/receipt.types.ts'

export interface ProgressUpdate {
  label: string
  ratio: number
}

export interface ExtractOutcome {
  result: ParseResult
  note: string | null
}

export class Cancelled extends Error {
  constructor() {
    super('cancelled')
    this.name = 'Cancelled'
  }
}

export async function extractReceipt(
  file: File,
  parserId: string,
  onProgress: (update: ProgressUpdate) => void,
  isCancelled: () => boolean,
): Promise<ExtractOutcome> {
  const parser = getParser(parserId)
  if (!parser) throw new Error('This source is not available.')

  const source: Receipt['source'] = { type: 'image', filename: file.name }
  try {
    onProgress({ label: 'Preparing the image', ratio: 0.04 })
    const first = await prepareImage(file, false)
    stop(isCancelled)
    const firstPage = await recognizeCanvas(first.canvas, (message) => {
      onProgress(progressLabel(message, false))
    })
    stop(isCancelled)
    let best = parser.parse(firstPage, source)

    if (score(best) < 6) {
      onProgress({ label: 'Reading the image again', ratio: 0.45 })
      const second = await prepareImage(file, true)
      stop(isCancelled)
      const secondPage = await recognizeCanvas(second.canvas, (message) => {
        onProgress(progressLabel(message, true))
      })
      stop(isCancelled)
      const alternate = parser.parse(secondPage, source)
      if (score(alternate) > score(best)) best = alternate
    }

    const note = best.receipt.order.orderId || best.receipt.items.some((item) => item.name) || best.rawText.trim()
      ? null
      : 'No text was found in the image. Enter the details yourself. Nothing was guessed.'

    return { result: best, note }
  } catch (error) {
    if (error instanceof Cancelled || isCancelled()) throw new Cancelled()
    if (error instanceof ImageTooLarge) throw error
    console.error(error)
    const message = error instanceof Error ? error.message : ''
    if (/fetch|network|traineddata|tesseract core|Failed to load/i.test(message)) {
      throw new Error('The OCR files in this app could not be loaded. Reload the page and try again.')
    }
    throw new Error('The image could not be read. You can enter the details yourself.')
  }
}

function stop(isCancelled: () => boolean) {
  if (isCancelled()) throw new Cancelled()
}

function score(result: ParseResult): number {
  const { receipt } = result
  let points = 0
  if (receipt.order.orderId?.length === 16) points += 2
  if (receipt.order.date) points += 1
  if (receipt.order.currency) points += 1
  if (receipt.totals.subtotal != null) points += 1
  if (receipt.totals.grandTotal != null) points += 1
  if (receipt.items.some((item) => item.name.trim())) points += 2
  if (receipt.merchant.seller) points += 1
  return points
}

function progressLabel(message: OcrProgress, retry: boolean): ProgressUpdate {
  const labels: Record<string, string> = {
    'loading tesseract core': 'Loading the OCR engine',
    'loading language traineddata': 'Loading the English language data',
    'initializing api': 'Preparing OCR',
    'initializing tesseract': 'Preparing OCR',
    'recognizing text': retry ? 'Reading the image again' : 'Reading the image',
  }
  const ratio = Number.isFinite(message.progress) ? Math.min(1, Math.max(0, message.progress)) : 0
  const span = retry ? 0.5 : 0.85
  const start = retry ? 0.45 : 0.08
  return {
    label: Object.hasOwn(labels, message.status) ? labels[message.status] : 'Reading the image',
    ratio: start + ratio * span,
  }
}
