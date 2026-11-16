interface ProcessingViewProps {
  label: string
  detail: string
  ratio: number
  count: number
  onCancel: () => void
}

export function ProcessingView({ label, detail, ratio, count, onCancel }: ProcessingViewProps) {
  const percent = Math.round(Math.min(1, Math.max(0, ratio)) * 100)
  const status = detail ? `${detail} · ${percent}%` : `${percent}%`
  return (
    <section className="panel processing" aria-live="polite">
      <h2>{count > 1 ? 'Reading the order images' : 'Reading the order image'}</h2>
      <p>{label}</p>
      <progress value={ratio} max={1} aria-label="OCR progress" />
      <p className="hint">{status} · The first run takes longer while the text model loads.</p>
      <button type="button" className="secondary" onClick={onCancel}>Cancel</button>
    </section>
  )
}
