import { aliexpressParser } from '../../platforms/aliexpress/aliexpress.parser.ts'
import type { ReceiptParser } from './parser.interface.ts'

const parsers: ReceiptParser[] = [aliexpressParser]

export function listParsers(): readonly ReceiptParser[] {
  return parsers
}

export function getParser(id: string): ReceiptParser | undefined {
  return parsers.find((parser) => parser.id === id)
}
