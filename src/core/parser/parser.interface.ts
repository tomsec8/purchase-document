import type { ConfidenceMap, Receipt } from '../receipt/receipt.types.ts'
import type { OcrPage } from '../ocr/ocr.types.ts'

export interface ParseResult {
  receipt: Receipt
  confidence: ConfidenceMap
  rawText: string
}

export interface ReceiptParser {
  id: string
  name: string
  supportedLanguages: string[]
  parse(page: OcrPage, source: Receipt['source']): ParseResult
}
