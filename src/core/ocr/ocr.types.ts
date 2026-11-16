export interface OcrWord {
  text: string
  confidence: number
  bbox: { x0: number; y0: number; x1: number; y1: number }
}

export interface OcrPage {
  text: string
  confidence: number
  width: number
  height: number
  words: OcrWord[]
  positioned: boolean
}

export interface RawOcrWord {
  text?: string
  confidence?: number
  bbox?: { x0: number; y0: number; x1: number; y1: number }
}

export interface RawOcrPage {
  text?: string | null
  confidence?: number
  blocks?: Array<{
    paragraphs?: Array<{
      lines?: Array<{ words?: RawOcrWord[] }>
    }>
  }> | null
}

export function toOcrPage(data: RawOcrPage, width: number, height: number): OcrPage {
  const words: OcrWord[] = []
  for (const block of data.blocks ?? []) {
    for (const paragraph of block.paragraphs ?? []) {
      for (const line of paragraph.lines ?? []) {
        for (const word of line.words ?? []) {
          const text = word.text?.trim()
          if (!text || !word.bbox) continue
          words.push({
            text,
            confidence: Number.isFinite(word.confidence) ? word.confidence ?? 0 : 0,
            bbox: word.bbox,
          })
        }
      }
    }
  }

  if (words.length > 0) {
    return {
      text: data.text ?? '',
      confidence: data.confidence ?? 0,
      width,
      height,
      words,
      positioned: true,
    }
  }

  const fallback: OcrWord[] = []
  let top = 0
  for (const line of (data.text ?? '').split(/\n+/)) {
    const text = line.trim()
    if (!text) continue
    fallback.push({
      text,
      confidence: data.confidence ?? 0,
      bbox: { x0: 0, y0: top, x1: Math.max(width, 1), y1: top + 20 },
    })
    top += 24
  }

  return {
    text: data.text ?? '',
    confidence: data.confidence ?? 0,
    width,
    height,
    words: fallback,
    positioned: false,
  }
}
