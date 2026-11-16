import { jsPDF } from 'jspdf'
import type { TemplateId } from './render-document.ts'
import { wait } from './save-file.ts'

const GAP_MS = 400

function pageFormat(canvas: HTMLCanvasElement, template: TemplateId): string | [number, number] {
  if (template === 'invoice') return 'a4'
  return [320, 320 * (canvas.height / canvas.width)]
}

function place(pdf: jsPDF, canvas: HTMLCanvasElement, alias: string) {
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  pdf.addImage(canvas, 'PNG', 0, 0, pageWidth, pageHeight, alias, 'SLOW')
}

export function downloadPdf(canvas: HTMLCanvasElement, filename: string, template: TemplateId) {
  const pdf = new jsPDF({ unit: 'pt', format: pageFormat(canvas, template), compress: true })
  place(pdf, canvas, 'page-1')
  pdf.save(filename)
}

export function downloadCombinedPdf(canvases: HTMLCanvasElement[], template: TemplateId, filename: string) {
  const first = canvases[0]
  if (!first) return
  const pdf = new jsPDF({ unit: 'pt', format: pageFormat(first, template), compress: true })
  place(pdf, first, 'page-1')
  canvases.slice(1).forEach((canvas, index) => {
    pdf.addPage(pageFormat(canvas, template))
    place(pdf, canvas, `page-${index + 2}`)
  })
  pdf.save(filename)
}

export async function downloadSeparatePdfs(
  pages: { canvas: HTMLCanvasElement, filename: string }[],
  template: TemplateId,
) {
  for (let index = 0; index < pages.length; index += 1) {
    const page = pages[index]
    if (!page) continue
    downloadPdf(page.canvas, page.filename, template)
    if (index < pages.length - 1) await wait(GAP_MS)
  }
}
