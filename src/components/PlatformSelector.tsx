import { listParsers } from '../core/parser/parser.registry.ts'

interface PlatformSelectorProps {
  value: string
  onChange: (id: string) => void
}

export function PlatformSelector({ value, onChange }: PlatformSelectorProps) {
  return (
    <fieldset className="sources">
      <legend>Source</legend>
      {listParsers().map((parser) => (
        <label key={parser.id} className={value === parser.id ? 'source selected' : 'source'}>
          <input
            type="radio"
            name="source"
            value={parser.id}
            checked={value === parser.id}
            onChange={() => onChange(parser.id)}
          />
          <span>{parser.name}</span>
          <small>English order image</small>
        </label>
      ))}
    </fieldset>
  )
}
