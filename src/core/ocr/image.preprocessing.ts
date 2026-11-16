export interface PreparedImage {
  canvas: HTMLCanvasElement
  width: number
  height: number
}

const MAX_SOURCE_PIXELS = 40_000_000

export class ImageTooLarge extends Error {
  constructor() {
    super('That image has too many pixels to read. Use the original order image.')
    this.name = 'ImageTooLarge'
  }
}

export async function prepareImage(file: Blob, strong = false): Promise<PreparedImage> {
  const bitmap = await createImageBitmap(file)
  try {
    if (bitmap.width * bitmap.height > MAX_SOURCE_PIXELS) throw new ImageTooLarge()
    const longEdge = Math.max(bitmap.width, bitmap.height)
    const targetWidth = strong ? 1800 : 1400
    const ceiling = strong ? 4800 : 4000
    let scale = Math.max(targetWidth / bitmap.width, (strong ? 3400 : 2800) / longEdge, 1)
    scale = Math.min(scale, strong ? 5 : 4)
    if (longEdge * scale > ceiling) scale = ceiling / longEdge

    const width = Math.max(1, Math.round(bitmap.width * scale))
    const height = Math.max(1, Math.round(bitmap.height * scale))
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d', { willReadFrequently: true })
    if (!context) throw new Error('Could not prepare the image.')

    context.drawImage(bitmap, 0, 0, width, height)
    const image = context.getImageData(0, 0, width, height)
    const pixels = image.data
    const contrast = strong ? 1.7 : 1.25
    for (let index = 0; index < pixels.length; index += 4) {
      const gray = pixels[index] * 0.299 + pixels[index + 1] * 0.587 + pixels[index + 2] * 0.114
      const next = clamp((gray - 128) * contrast + 134)
      pixels[index] = next
      pixels[index + 1] = next
      pixels[index + 2] = next
    }
    context.putImageData(image, 0, 0)
    return { canvas, width, height }
  } finally {
    bitmap.close()
  }
}

function clamp(value: number): number {
  if (value < 0) return 0
  if (value > 255) return 255
  return value
}
