import { useEffect, useRef, useState } from 'react'
import { OrderSwitcher } from './OrderSwitcher.tsx'
import { downloadCombinedPdf, downloadSeparatePdfs } from '../core/export/pdf.export.ts'
import { downloadCombinedPng, downloadPng, downloadPngs } from '../core/export/png.export.ts'
import { renderDocument, type TemplateId } from '../core/export/render-document.ts'
import { batchFilename, documentFilename, documentFilenames } from '../core/receipt/money.ts'
import type { Receipt } from '../core/receipt/receipt.types.ts'

type DownloadMode = 'separate' | 'combined'

interface PreviewProps {
  receipts: Receipt[]
  labels: string[]
  index: number
  onIndex: (index: number) => void
  template: TemplateId
  onTemplate: (template: TemplateId) => void
  onBack: () => void
}

export function Preview({
  receipts,
  labels,
  index,
  onIndex,
  template,
  onTemplate,
  onBack,
}: PreviewProps) {
  const frame = useRef<HTMLDivElement>(null)
  const [ready, setReady] = useState(false)
  const [busy, setBusy] = useState<'pdf' | 'png' | null>(null)
  const [problem, setProblem] = useState<string | null>(null)
  const [mode, setMode] = useState<DownloadMode>('separate')
  const receipt = receipts[index] ?? receipts[0]
  const several = receipts.length > 1

  useEffect(() => {
    const node = frame.current
    if (!node || !receipt) return
    const canvas = renderDocument(receipt, template)
    canvas.style.width = '100%'
    canvas.style.maxWidth = `${canvas.width / 2}px`
    canvas.style.height = 'auto'
    node.replaceChildren(canvas)
    setReady(true)
  }, [receipt, template])

  async function save(kind: 'pdf' | 'png') {
    setProblem(null)
    setBusy(kind)
    try {
      const canvases = receipts.map((item) => renderDocument(item, template))
      const names = documentFilenames(receipts.map((item) => item.order.orderId), kind)
      if (!several) {
        const canvas = canvases[0]
        const filename = documentFilename(receipt?.order.orderId, kind)
        if (!canvas) return
        if (kind === 'pdf') downloadCombinedPdf([canvas], template, filename)
        else await downloadPng(canvas, filename)
        return
      }
      if (mode === 'combined') {
        if (kind === 'pdf') downloadCombinedPdf(canvases, template, batchFilename('pdf'))
        else await downloadCombinedPng(canvases, batchFilename('png'))
        return
      }
      const pages = canvases.map((canvas, item) => ({ canvas, filename: names[item] ?? documentFilename(undefined, kind) }))
      if (kind === 'pdf') await downloadSeparatePdfs(pages, template)
      else await downloadPngs(pages)
    } catch (error) {
      setProblem(error instanceof Error ? error.message : 'The file could not be created.')
    } finally {
      setBusy(null)
    }
  }

  if (!receipt) return null
  const pdfLabel = several && mode === 'separate' ? 'Download PDFs' : 'Download PDF'
  const pngLabel = several && mode === 'separate' ? 'Download PNGs' : 'Download PNG'

  return (
    <section>
      {several ? (
        <div className="batch-bar">
          <OrderSwitcher labels={labels} index={index} onIndex={onIndex} />
          <p className="hint batch-hint">The layout and the download apply to every order.</p>
        </div>
      ) : null}
      <div className="preview-layout">
        <div className="panel preview-controls">
          <h2>Choose a layout</h2>
          <p>
            {several
              ? 'This layout is used for every order.'
              : 'Both layouts use the details you confirmed.'}
          </p>
          <fieldset className="templates">
            <legend>Design</legend>
            <label className={template === 'receipt' ? 'template selected' : 'template'}>
              <input
                type="radio"
                name="template"
                checked={template === 'receipt'}
                onChange={() => onTemplate('receipt')}
              />
              <span>Receipt</span>
              <small>Compact, single column.</small>
            </label>
            <label className={template === 'invoice' ? 'template selected' : 'template'}>
              <input
                type="radio"
                name="template"
                checked={template === 'invoice'}
                onChange={() => onTemplate('invoice')}
              />
              <span>Invoice</span>
              <small>A4 page with an item table.</small>
            </label>
          </fieldset>
          {several ? (
            <fieldset className="templates">
              <legend>Download</legend>
              <label className={mode === 'separate' ? 'template selected' : 'template'}>
                <input
                  type="radio"
                  name="download-mode"
                  checked={mode === 'separate'}
                  onChange={() => setMode('separate')}
                />
                <span>Separate files</span>
                <small>One file for each order.</small>
              </label>
              <label className={mode === 'combined' ? 'template selected' : 'template'}>
                <input
                  type="radio"
                  name="download-mode"
                  checked={mode === 'combined'}
                  onChange={() => setMode('combined')}
                />
                <span>One file</span>
                <small>Every order in a single PDF or PNG.</small>
              </label>
            </fieldset>
          ) : null}
          {problem ? <p className="alert" role="alert">{problem}</p> : null}
          <div className="actions">
            <button type="button" className="primary" disabled={!ready || busy !== null} onClick={() => void save('pdf')}>
              {busy === 'pdf' ? 'Preparing…' : pdfLabel}
            </button>
            <button type="button" className="secondary" disabled={!ready || busy !== null} onClick={() => void save('png')}>
              {busy === 'png' ? 'Preparing…' : pngLabel}
            </button>
            <button type="button" className="text-button" onClick={onBack}>Edit details</button>
          </div>
        </div>
        <div className="document-frame" ref={frame} role="img" aria-label="Document preview" />
      </div>
    </section>
  )
}
