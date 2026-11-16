import { useEffect, useRef, useState } from 'react'
import { DataEditor } from './components/DataEditor.tsx'
import { ImageUploader } from './components/ImageUploader.tsx'
import { OrderSwitcher } from './components/OrderSwitcher.tsx'
import { PlatformSelector } from './components/PlatformSelector.tsx'
import { Preview } from './components/Preview.tsx'
import { ProcessingView } from './components/ProcessingView.tsx'
import { Cancelled, extractReceipt, type ProgressUpdate } from './core/extract.ts'
import { terminateOcr } from './core/ocr/ocr.engine.ts'
import type { TemplateId } from './core/export/render-document.ts'
import { listParsers } from './core/parser/parser.registry.ts'
import {
  manualReceipt,
  withLineTotals,
  type ConfidenceMap,
  type Receipt,
} from './core/receipt/receipt.types.ts'
import './App.css'

type Step = 'upload' | 'processing' | 'edit' | 'preview'

interface OrderDraft {
  id: string
  imageUrl: string | null
  filename: string | null
  receipt: Receipt
  confidence: ConfidenceMap
  rawText: string
  notice: string | null
}

interface ProgressState extends ProgressUpdate {
  detail: string
}

export default function App() {
  const [step, setStep] = useState<Step>('upload')
  const [parserId, setParserId] = useState('aliexpress')
  const [orders, setOrders] = useState<OrderDraft[]>([])
  const [active, setActive] = useState(0)
  const [batchNote, setBatchNote] = useState<string | null>(null)
  const [readingCount, setReadingCount] = useState(1)
  const [template, setTemplate] = useState<TemplateId>('receipt')
  const [progress, setProgress] = useState<ProgressState>({ label: 'Starting', detail: '', ratio: 0 })
  const run = useRef(0)
  const imageUrls = useRef<string[]>([])

  useEffect(() => {
    const clear = () => {
      for (const url of imageUrls.current) URL.revokeObjectURL(url)
      imageUrls.current = []
    }
    window.addEventListener('pagehide', clear)
    return () => window.removeEventListener('pagehide', clear)
  }, [])

  function holdImages(urls: string[]) {
    const next = new Set(urls)
    for (const url of imageUrls.current) {
      if (!next.has(url)) URL.revokeObjectURL(url)
    }
    imageUrls.current = urls
  }

  function reset() {
    run.current += 1
    void terminateOcr()
    holdImages([])
    setOrders([])
    setActive(0)
    setBatchNote(null)
    setReadingCount(1)
    setTemplate('receipt')
    setStep('upload')
  }

  function updateOrder(id: string, next: Receipt, editedKey: string) {
    setOrders((current) => current.map((order) => {
      if (order.id !== id) return order
      const confidence = { ...order.confidence }
      if (editedKey) delete confidence[editedKey]
      return { ...order, receipt: withLineTotals(next), confidence }
    }))
  }

  async function onFiles(files: File[], note: string | null) {
    const id = run.current + 1
    run.current = id
    const merchantName = listParsers().find((parser) => parser.id === parserId)?.name ?? ''
    setBatchNote(note)
    setReadingCount(files.length)
    setTemplate('receipt')
    setStep('processing')
    setProgress({
      label: files.length > 1 ? `Image 1 of ${files.length}` : 'Preparing the image',
      detail: files.length > 1 ? 'Preparing the image' : '',
      ratio: 0.02,
    })
    const created: string[] = []
    const drafts: OrderDraft[] = []
    let kept = false
    try {
      for (let index = 0; index < files.length; index += 1) {
        if (run.current !== id) throw new Cancelled()
        const file = files[index]
        if (!file) continue
        const imageUrl = URL.createObjectURL(file)
        created.push(imageUrl)
        try {
          const outcome = await extractReceipt(
            file,
            parserId,
            (update) => {
              if (run.current !== id) return
              setProgress(files.length > 1
                ? {
                    label: `Image ${index + 1} of ${files.length}`,
                    detail: update.label,
                    ratio: (index + update.ratio) / files.length,
                  }
                : { label: update.label, detail: '', ratio: update.ratio })
            },
            () => run.current !== id,
          )
          if (run.current !== id) throw new Cancelled()
          drafts.push({
            id: crypto.randomUUID(),
            imageUrl,
            filename: file.name,
            receipt: withLineTotals(outcome.result.receipt),
            confidence: outcome.result.confidence,
            rawText: outcome.result.rawText,
            notice: outcome.note,
          })
        } catch (error) {
          if (run.current !== id || error instanceof Cancelled) throw new Cancelled()
          drafts.push({
            id: crypto.randomUUID(),
            imageUrl,
            filename: file.name,
            receipt: withLineTotals(manualReceipt(merchantName)),
            confidence: {},
            rawText: '',
            notice: error instanceof Error ? error.message : 'The image could not be read.',
          })
        }
      }
      if (run.current !== id) throw new Cancelled()
      holdImages(created)
      kept = true
      setOrders(drafts)
      setActive(0)
      setStep('edit')
    } catch (error) {
      if (!(error instanceof Cancelled) && run.current === id) {
        setBatchNote(error instanceof Error ? error.message : 'The images could not be read.')
        setStep('upload')
      }
      if (!kept) {
        for (const url of created) URL.revokeObjectURL(url)
      }
    }
  }

  function onManual() {
    const merchantName = listParsers().find((parser) => parser.id === parserId)?.name ?? ''
    run.current += 1
    void terminateOcr()
    holdImages([])
    setOrders([{
      id: crypto.randomUUID(),
      imageUrl: null,
      filename: null,
      receipt: manualReceipt(merchantName),
      confidence: {},
      rawText: '',
      notice: null,
    }])
    setActive(0)
    setBatchNote(null)
    setTemplate('receipt')
    setStep('edit')
  }

  const order = orders[active] ?? orders[0]
  const labels = orders.map(orderLabel)
  const stepIndex = step === 'preview' ? 2 : step === 'edit' ? 1 : 0

  return (
    <div className="page">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true" />
          <div>
            <p className="eyebrow">Receipts from order images</p>
            <h1>Purchase Document</h1>
          </div>
        </div>
        {step !== 'upload' ? (
          <button type="button" className="secondary" onClick={reset}>Start over</button>
        ) : null}
      </header>
      <ol className="steps">
        {['Images', 'Review', 'Document'].map((label, index) => (
          <li
            key={label}
            className={index === stepIndex ? 'current' : index < stepIndex ? 'done' : undefined}
            aria-current={index === stepIndex ? 'step' : undefined}
          >
            <span className="step-number" aria-hidden="true">{index + 1}</span>
            {label}
          </li>
        ))}
      </ol>

      {step === 'upload' ? (
        <section className="panel upload-panel">
          <p className="lead">
            Turn AliExpress order images into receipts or invoices.
          </p>
          <PlatformSelector value={parserId} onChange={setParserId} />
          <ImageUploader onFiles={(files, note) => void onFiles(files, note)} />
          <button type="button" className="text-button" onClick={onManual}>Enter details manually</button>
          <ul className="privacy">
            <li>Images are not uploaded.</li>
            <li>Nothing is saved in this browser after you start over.</li>
            <li>Missing details stay empty.</li>
          </ul>
        </section>
      ) : null}

      {step === 'processing' ? (
        <ProcessingView
          label={progress.label}
          detail={progress.detail}
          ratio={progress.ratio}
          count={readingCount}
          onCancel={reset}
        />
      ) : null}

      {step === 'edit' && order ? (
        <>
          {orders.length > 1 || batchNote ? (
            <div className="batch-bar">
              {orders.length > 1 ? (
                <OrderSwitcher labels={labels} index={orders[active] ? active : 0} onIndex={setActive} />
              ) : null}
              {orders.length > 1 ? (
                <p className="hint batch-hint">Review each order, then continue.</p>
              ) : null}
              {batchNote ? <p className="notice" role="status">{batchNote}</p> : null}
            </div>
          ) : null}
          <DataEditor
            key={order.id}
            receipt={order.receipt}
            confidence={order.confidence}
            imageUrl={order.imageUrl}
            imageName={order.filename}
            rawText={order.rawText}
            notice={order.notice}
            summary={orders.length > 1 ? `Order ${orders.indexOf(order) + 1} of ${orders.length}.` : null}
            onCommit={(next, editedKey) => updateOrder(order.id, next, editedKey)}
            onContinue={() => setStep('preview')}
          />
        </>
      ) : null}

      {step === 'preview' && orders.length > 0 ? (
        <Preview
          receipts={orders.map((item) => item.receipt)}
          labels={labels}
          index={orders[active] ? active : 0}
          onIndex={setActive}
          template={template}
          onTemplate={setTemplate}
          onBack={() => setStep('edit')}
        />
      ) : null}

      <footer className="site-footer">
        Images are read and documents are created in this browser. Nothing is uploaded.
      </footer>
    </div>
  )
}

function orderLabel(order: OrderDraft): string {
  const orderId = order.receipt.order.orderId?.trim()
  if (orderId) return orderId
  if (order.filename) return order.filename.replace(/\.[^.]+$/, '')
  return 'Manual entry'
}
