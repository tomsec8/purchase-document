import { useState } from 'react'

interface ImageUploaderProps {
  onFiles: (files: File[], note: string | null) => void
}

const TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
const MAX_FILES = 15
const MAX_BYTES = 20 * 1024 * 1024

export function ImageUploader({ onFiles }: ImageUploaderProps) {
  const [over, setOver] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  function take(list: FileList | File[] | undefined) {
    const files = [...(list ?? [])]
    if (files.length === 0) return
    const accepted: File[] = []
    let wrongType = 0
    let tooBig = 0
    let extra = 0
    for (const file of files) {
      const typeOk = TYPES.has(file.type) || (
        (file.type === '' || file.type === 'application/octet-stream') &&
        /\.(jpe?g|png|webp)$/i.test(file.name)
      )
      if (!typeOk) {
        wrongType += 1
        continue
      }
      if (file.size > MAX_BYTES) {
        tooBig += 1
        continue
      }
      if (accepted.length >= MAX_FILES) {
        extra += 1
        continue
      }
      accepted.push(file)
    }
    if (accepted.length === 0) {
      setMessage(rejectedMessage(wrongType, tooBig))
      return
    }
    setMessage(null)
    onFiles(accepted, skippedNote(wrongType, tooBig, extra))
  }

  return (
    <div className="uploader">
      <label
        className={over ? 'dropzone over' : 'dropzone'}
        onDragOver={(event) => {
          event.preventDefault()
          setOver(true)
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(event) => {
          event.preventDefault()
          setOver(false)
          take(event.dataTransfer.files)
        }}
      >
        <input
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
          onChange={(event) => {
            take(event.target.files ?? undefined)
            event.target.value = ''
          }}
        />
        <strong>Drop AliExpress order images</strong>
        <span>JPG, PNG, or WEBP. One image or up to 15.</span>
      </label>
      {message ? <p className="alert" role="alert">{message}</p> : null}
    </div>
  )
}

function rejectedMessage(wrongType: number, tooBig: number): string {
  if (tooBig > 0 && wrongType === 0) return 'Each image must be 20 MB or smaller.'
  if (wrongType > 0 && tooBig === 0) return 'Use JPG, PNG, or WEBP images.'
  return 'Choose JPG, PNG, or WEBP images under 20 MB.'
}

function skippedNote(wrongType: number, tooBig: number, extra: number): string | null {
  const parts: string[] = []
  if (wrongType === 1) parts.push('1 file was not a JPG, PNG, or WEBP image')
  if (wrongType > 1) parts.push(`${wrongType} files were not JPG, PNG, or WEBP images`)
  if (tooBig === 1) parts.push('1 image was larger than 20 MB')
  if (tooBig > 1) parts.push(`${tooBig} images were larger than 20 MB`)
  if (extra > 0) parts.push(`only the first ${MAX_FILES} images were kept`)
  if (parts.length === 0) return null
  const sentence = parts.join(', and ')
  return `${sentence.charAt(0).toUpperCase()}${sentence.slice(1)}.`
}
