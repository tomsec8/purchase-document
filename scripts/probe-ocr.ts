import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { toOcrPage } from '../src/core/ocr/ocr.types.ts'
import { parseAliExpress } from '../src/platforms/aliexpress/aliexpress.parser.ts'

const require = createRequire(import.meta.url)
const { createWorker, PSM } = require('tesseract.js') as typeof import('tesseract.js')

const imagePath = path.resolve(process.argv[2] ?? '')
if (!imagePath || process.argv.length < 3) {
  console.error('Usage: npm run probe -- path/to/order.jpg')
  process.exit(1)
}

const size = imageSize(readFileSync(imagePath))
const langPath = path.resolve('node_modules/@tesseract.js-data/eng/4.0.0_best_int')
const worker = await createWorker('eng', 1, {
  langPath,
  cacheMethod: 'none',
  gzip: true,
})

await worker.setParameters({
  tessedit_pageseg_mode: PSM.SINGLE_BLOCK,
  preserve_interword_spaces: '1',
  user_defined_dpi: '300',
})

const result = await worker.recognize(imagePath, {}, { text: true, blocks: true })
await worker.terminate()

const page = toOcrPage(result.data, size.width, size.height)
const parsed = parseAliExpress(page, { type: 'image', filename: path.basename(imagePath) })
console.log(JSON.stringify({
  confidence: parsed.confidence,
  merchant: parsed.receipt.merchant,
  order: parsed.receipt.order,
  items: parsed.receipt.items,
  totals: parsed.receipt.totals,
}, null, 2))

function imageSize(buffer: Buffer): { width: number; height: number } {
  if (buffer[0] === 0xff && buffer[1] === 0xd8) return jpegSize(buffer)
  if (buffer.toString('ascii', 1, 4) === 'PNG') {
    return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) }
  }
  return { width: 1000, height: 1000 }
}

function jpegSize(buffer: Buffer): { width: number; height: number } {
  let offset = 2
  while (offset < buffer.length) {
    if (buffer[offset] !== 0xff) break
    const marker = buffer[offset + 1] ?? 0
    const length = buffer.readUInt16BE(offset + 2)
    if (marker >= 0xc0 && marker <= 0xc3) {
      return {
        height: buffer.readUInt16BE(offset + 5),
        width: buffer.readUInt16BE(offset + 7),
      }
    }
    offset += 2 + length
  }
  return { width: 1000, height: 1000 }
}
