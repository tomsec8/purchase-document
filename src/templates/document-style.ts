export const INK = '#241820'
export const MUTED = '#7a6570'
export const HAIRLINE = '#eadfe4'
export const ACCENT = '#6e2f45'
export const BAND = '#f8f1f4'

export const SERIF = '"Times New Roman", Times, Cambria, serif'
export const SANS = '"Times New Roman", Times, Cambria, serif'

export function paintSeal(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  letter: string,
  size = 30,
) {
  const mark = letter.trim().charAt(0).toUpperCase()
  if (!mark) return
  ctx.save()
  ctx.strokeStyle = ACCENT
  ctx.lineWidth = 1.15
  ctx.beginPath()
  ctx.arc(x, y, size / 2, 0, Math.PI * 2)
  ctx.stroke()
  ctx.lineWidth = 0.6
  ctx.beginPath()
  ctx.arc(x, y, size / 2 - 3.5, 0, Math.PI * 2)
  ctx.stroke()
  ctx.fillStyle = ACCENT
  ctx.font = `700 ${Math.round(size * 0.46)}px ${SERIF}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(mark, x, y + 1)
  ctx.restore()
}

export function generatedOn(now = new Date()): string {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(now)
}

export function spaced(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  spacing: number,
) {
  ctx.save()
  ctx.letterSpacing = `${spacing}px`
  const width = ctx.measureText(text).width
  if (ctx.textAlign === 'right') {
    ctx.textAlign = 'left'
    ctx.fillText(text, x - width + spacing, y)
  } else if (ctx.textAlign === 'center') {
    ctx.textAlign = 'left'
    ctx.fillText(text, x - (width - spacing) / 2, y)
  } else {
    ctx.fillText(text, x, y)
  }
  ctx.restore()
}

export function hairline(ctx: CanvasRenderingContext2D, x1: number, x2: number, y: number, color = HAIRLINE, width = 1) {
  ctx.save()
  ctx.strokeStyle = color
  ctx.lineWidth = width
  ctx.beginPath()
  ctx.moveTo(x1, y + 0.5)
  ctx.lineTo(x2, y + 0.5)
  ctx.stroke()
  ctx.restore()
}

export function doubleRule(ctx: CanvasRenderingContext2D, x1: number, x2: number, y: number) {
  hairline(ctx, x1, x2, y, ACCENT, 1.5)
  hairline(ctx, x1, x2, y + 4, ACCENT, 0.5)
}
