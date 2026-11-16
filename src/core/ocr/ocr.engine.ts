import Tesseract from 'tesseract.js'
import { toOcrPage, type OcrPage } from './ocr.types.ts'

export interface OcrProgress {
  status: string
  progress: number
}

type ProgressListener = (message: OcrProgress) => void

let workerPromise: Promise<Tesseract.Worker> | null = null
let listener: ProgressListener | null = null

function localAsset(path: string): string {
  const base = import.meta.env.BASE_URL
  const prefix = base.endsWith('/') ? base : `${base}/`
  return `${prefix}${path.replace(/^\//, '')}`
}

function getWorker(): Promise<Tesseract.Worker> {
  if (!workerPromise) {
    workerPromise = Tesseract.createWorker('eng', Tesseract.OEM.LSTM_ONLY, {
      workerPath: localAsset('tesseract/worker.min.js'),
      corePath: localAsset('tesseract'),
      langPath: localAsset('tessdata'),
      cacheMethod: 'none',
      gzip: true,
      workerBlobURL: false,
      logger: (message) => listener?.(message),
    }).catch((error: unknown) => {
      workerPromise = null
      throw error
    })
  }
  return workerPromise
}

export async function recognizeCanvas(
  canvas: HTMLCanvasElement,
  onProgress?: ProgressListener,
): Promise<OcrPage> {
  listener = onProgress ?? null
  try {
    const worker = await getWorker()
    await worker.setParameters({
      tessedit_pageseg_mode: Tesseract.PSM.SINGLE_BLOCK,
      preserve_interword_spaces: '1',
      user_defined_dpi: '300',
    })
    const result = await worker.recognize(canvas, {}, { text: true, blocks: true })
    return toOcrPage(result.data, canvas.width, canvas.height)
  } finally {
    listener = null
  }
}

export async function terminateOcr(): Promise<void> {
  const pending = workerPromise
  workerPromise = null
  listener = null
  if (!pending) return
  try {
    const worker = await pending
    await worker.terminate()
  } catch {
    // A worker that failed to start has nothing left to clear.
  }
}
