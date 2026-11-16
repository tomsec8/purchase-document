import { describe, expect, it } from 'vitest'
import { previewBlob } from './preview-url.ts'

describe('preview blob', () => {
  it('keeps a real image type', () => {
    const file = new File(['jpeg'], 'order.jpg', { type: 'image/jpeg' })
    expect(previewBlob(file).type).toBe('image/jpeg')
  })

  it('does not keep a script type when the name looks like an image', () => {
    const file = new File(['<script>'], 'order.png', { type: 'text/html' })
    expect(previewBlob(file).type).toBe('image/png')
  })

  it('uses a non-script type for any other file', () => {
    const file = new File(['<script>'], 'order.html', { type: 'text/html' })
    expect(previewBlob(file).type).toBe('application/octet-stream')
  })
})
