const IMAGE_TYPES = new Map<string, string>([
  ['image/jpeg', 'image/jpeg'],
  ['image/jpg', 'image/jpeg'],
  ['image/png', 'image/png'],
  ['image/webp', 'image/webp'],
])

function typeFromName(name: string): string | null {
  const lower = name.toLowerCase()
  if (lower.endsWith('.png')) return 'image/png'
  if (lower.endsWith('.webp')) return 'image/webp'
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg'
  return null
}

export function previewBlob(file: File): Blob {
  const type = IMAGE_TYPES.get(file.type) ?? typeFromName(file.name) ?? 'application/octet-stream'
  return new Blob([file], { type })
}
