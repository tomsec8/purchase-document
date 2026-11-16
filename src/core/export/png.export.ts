import { saveBlob, wait } from './save-file.ts'

const GAP = 48
const MAX_EDGE = 16_384
const GAP_MS = 400

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('The image could not be created.'))
    }, 'image/png')
  })
}

export function combineCanvases(canvases: HTMLCanvasElement[]): HTMLCanvasElement {
  const width = Math.max(...canvases.map((canvas) => canvas.width))
  const height = canvases.reduce((sum, canvas) => sum + canvas.height, 0) + GAP * Math.max(0, canvases.length - 1)
  if (width < 1 || height < 1 || width > MAX_EDGE || height > MAX_EDGE) {
    throw new Error('These orders are too large to combine into one image. Download them separately, or choose PDF.')
  }
  const combined = document.createElement('canvas')
  combined.width = width
  combined.height = height
  const context = combined.getContext('2d')
  if (!context) throw new Error('The image could not be created.')
  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, width, height)
  let y = 0
  for (const canvas of canvases) {
    context.drawImage(canvas, Math.round((width - canvas.width) / 2), y)
    y += canvas.height + GAP
  }
  return combined
}

export async function downloadPng(canvas: HTMLCanvasElement, filename: string) {
  saveBlob(await canvasToBlob(canvas), filename)
}

export async function downloadPngs(items: { canvas: HTMLCanvasElement, filename: string }[]) {
  for (let index = 0; index < items.length; index += 1) {
    const item = items[index]
    if (!item) continue
    await downloadPng(item.canvas, item.filename)
    if (index < items.length - 1) await wait(GAP_MS)
  }
}

export async function downloadCombinedPng(canvases: HTMLCanvasElement[], filename: string) {
  await downloadPng(combineCanvases(canvases), filename)
}
