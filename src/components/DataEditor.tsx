import { useState } from 'react'
import { formatMoney } from '../core/receipt/money.ts'
import { redactCard } from '../platforms/aliexpress/aliexpress.patterns.ts'
import { receiptWarnings } from '../core/receipt/receipt.validator.ts'
import {
  createEmptyItem,
  type ConfidenceMap,
  type Receipt,
  type ReceiptItem,
} from '../core/receipt/receipt.types.ts'

interface DataEditorProps {
  receipt: Receipt
  confidence: ConfidenceMap
  imageUrl: string | null
  imageName: string | null
  rawText: string
  notice: string | null
  summary: string | null
  onCommit: (receipt: Receipt, editedKey: string) => void
  onContinue: () => void
}

export function DataEditor({
  receipt,
  confidence,
  imageUrl,
  imageName,
  rawText,
  notice,
  summary,
  onCommit,
  onContinue,
}: DataEditorProps) {
  const warnings = receiptWarnings(receipt)
  const uncertain = Object.values(confidence).filter((value) => value < 55).length
  const guidance = uncertain > 0
    ? `${uncertain} ${uncertain === 1 ? 'field is' : 'fields are'} uncertain. Empty fields were left blank.`
    : 'Empty fields were left blank. Change anything that looks wrong.'

  function update(next: Receipt, editedKey: string) {
    onCommit(next, editedKey)
  }

  return (
    <form
      className="editor-layout"
      onSubmit={(event) => {
        event.preventDefault()
        onContinue()
      }}
    >
      <div className="panel editor-form">
        <div className="editor-heading">
          <h2>Check the details</h2>
          <p>{summary ? `${summary} ${guidance}` : guidance}</p>
        </div>
        {notice ? <p className="notice" role="status">{notice}</p> : null}
        {warnings.map((warning) => (
          <p key={warning} className="alert" role="alert">{warning}</p>
        ))}

        <p className="section-label">Order</p>
        <div className="fields">
          <TextField
            id="merchant-name"
            label="Merchant"
            value={receipt.merchant.name}
            confidence={confidence['merchant.name']}
            onChange={(value) => update({ ...receipt, merchant: { ...receipt.merchant, name: value } }, 'merchant.name')}
          />
          <TextField
            id="merchant-seller"
            label="Seller"
            value={receipt.merchant.seller ?? ''}
            confidence={confidence['merchant.seller']}
            onChange={(value) => update({
              ...receipt,
              merchant: { ...receipt.merchant, seller: value || undefined },
            }, 'merchant.seller')}
          />
          <TextField
            id="order-id"
            label="Order ID"
            value={receipt.order.orderId ?? ''}
            confidence={confidence['order.orderId']}
            spellCheck={false}
            onChange={(value) => update({
              ...receipt,
              order: { ...receipt.order, orderId: value || undefined },
            }, 'order.orderId')}
          />
          <TextField
            id="order-date"
            label="Order date"
            value={receipt.order.date ?? ''}
            confidence={confidence['order.date']}
            placeholder="e.g. Nov 15, 2026"
            onChange={(value) => update({
              ...receipt,
              order: { ...receipt.order, date: value || undefined },
            }, 'order.date')}
          />
          <TextField
            id="order-currency"
            label="Currency"
            value={receipt.order.currency}
            confidence={confidence['order.currency']}
            spellCheck={false}
            placeholder="e.g. ILS"
            onChange={(value) => update({
              ...receipt,
              order: { ...receipt.order, currency: value.toUpperCase() },
            }, 'order.currency')}
          />
        </div>

        <p className="section-label">Buyer</p>
        <div className="fields">
          <TextField
            id="buyer-name"
            label="Buyer"
            value={receipt.buyer.name ?? ''}
            confidence={confidence['buyer.name']}
            placeholder="e.g. Jane Example"
            onChange={(value) => update({
              ...receipt,
              buyer: { ...receipt.buyer, name: value || undefined },
            }, 'buyer.name')}
          />
          <TextField
            id="buyer-phone"
            label="Phone"
            value={receipt.buyer.phone ?? ''}
            confidence={confidence['buyer.phone']}
            spellCheck={false}
            placeholder="e.g. +1 555 0100"
            onChange={(value) => update({
              ...receipt,
              buyer: { ...receipt.buyer, phone: value || undefined },
            }, 'buyer.phone')}
          />
          <TextField
            id="buyer-address"
            label="Shipping address"
            value={receipt.buyer.address ?? ''}
            confidence={confidence['buyer.address']}
            multiline
            wide
            onChange={(value) => update({
              ...receipt,
              buyer: { ...receipt.buyer, address: value || undefined },
            }, 'buyer.address')}
          />
        </div>

        <p className="section-label">Payment</p>
        <div className="fields">
          <TextField
            id="payment-brand"
            label="Card"
            value={receipt.payment.brand ?? ''}
            confidence={confidence['payment.brand']}
            spellCheck={false}
            placeholder="e.g. VISA"
            onChange={(value) => update({
              ...receipt,
              payment: { ...receipt.payment, brand: value || undefined },
            }, 'payment.brand')}
          />
          <TextField
            id="payment-card"
            label="Card number"
            value={receipt.payment.card ?? ''}
            confidence={confidence['payment.card']}
            spellCheck={false}
            placeholder="e.g. 4000 00** **** 0002"
            onChange={(value) => {
              const card = redactCard(value)
              update({
                ...receipt,
                payment: { ...receipt.payment, card: card || undefined },
              }, 'payment.card')
            }}
          />
          <TextField
            id="payment-paid"
            label="Paid on"
            value={receipt.payment.paidOn ?? ''}
            confidence={confidence['payment.paidOn']}
            placeholder="e.g. Nov 15, 2026"
            onChange={(value) => update({
              ...receipt,
              payment: { ...receipt.payment, paidOn: value || undefined },
            }, 'payment.paidOn')}
          />
        </div>

        <p className="section-label">Items</p>
        <div className="items">
          {receipt.items.map((item, index) => (
            <ItemFields
              key={item.id}
              item={item}
              index={index}
              currency={receipt.order.currency}
              confidence={confidence}
              onItem={(next, key) => update({
                ...receipt,
                items: receipt.items.map((current) => current.id === item.id ? next : current),
              }, key)}
              onRemove={() => update({
                ...receipt,
                items: receipt.items.filter((current) => current.id !== item.id),
              }, '')}
            />
          ))}
          <button
            type="button"
            className="secondary"
            onClick={() => update({ ...receipt, items: [...receipt.items, createEmptyItem()] }, '')}
          >
            Add item
          </button>
        </div>

        <p className="section-label">Amounts</p>
        <div className="fields totals-fields">
          <MoneyField
            id="total-subtotal"
            label="Subtotal"
            value={receipt.totals.subtotal}
            confidence={confidence['totals.subtotal']}
            onChange={(value) => update({ ...receipt, totals: { ...receipt.totals, subtotal: value } }, 'totals.subtotal')}
          />
          <MoneyField
            id="total-discount"
            label="Discount"
            value={receipt.totals.discount}
            confidence={confidence['totals.discount']}
            onChange={(value) => update({ ...receipt, totals: { ...receipt.totals, discount: value } }, 'totals.discount')}
          />
          <MoneyField
            id="total-shipping"
            label="Shipping"
            value={receipt.totals.shipping}
            confidence={confidence['totals.shipping']}
            onChange={(value) => update({ ...receipt, totals: { ...receipt.totals, shipping: value } }, 'totals.shipping')}
          />
          <MoneyField
            id="total-tax"
            label="Tax"
            value={receipt.totals.tax}
            confidence={confidence['totals.tax']}
            onChange={(value) => update({ ...receipt, totals: { ...receipt.totals, tax: value } }, 'totals.tax')}
          />
          <MoneyField
            id="total-grand"
            label="Total"
            value={receipt.totals.grandTotal}
            confidence={confidence['totals.grandTotal']}
            onChange={(value) => update({ ...receipt, totals: { ...receipt.totals, grandTotal: value } }, 'totals.grandTotal')}
          />
        </div>

        {rawText ? (
          <details className="raw-text">
            <summary>Raw recognized text</summary>
            <pre>{rawText}</pre>
          </details>
        ) : null}

        <div className="actions">
          <button type="submit" className="primary">
            {summary ? 'Continue to documents' : 'Continue to document'}
          </button>
        </div>
      </div>

      {imageUrl ? (
        <aside className="source-image">
          <h2>Original image</h2>
          {imageName ? <p className="hint">{imageName}</p> : null}
          <PreviewImage url={imageUrl} />
        </aside>
      ) : null}
    </form>
  )
}

function PreviewImage({ url }: { url: string }) {
  let src: string | undefined
  try {
    if (new URL(url).protocol === 'blob:') src = url
  } catch {
    src = undefined
  }
  if (!src) return null
  return <img src={src} alt="Uploaded order image" />
}

function ItemFields({
  item,
  index,
  currency,
  confidence,
  onItem,
  onRemove,
}: {
  item: ReceiptItem
  index: number
  currency: string
  confidence: ConfidenceMap
  onItem: (item: ReceiptItem, key: string) => void
  onRemove: () => void
}) {
  return (
    <fieldset className="item-card">
      <legend>Item {index + 1}</legend>
      <TextField
        id={`${item.id}-name`}
        label="Product"
        value={item.name}
        confidence={confidence[`items.${item.id}.name`]}
        multiline
        onChange={(value) => onItem({ ...item, name: value }, `items.${item.id}.name`)}
      />
      <div className="split">
        <NumberField
          id={`${item.id}-quantity`}
          label="Quantity"
          value={item.quantity}
          confidence={confidence[`items.${item.id}.quantity`]}
          decimal={false}
          onChange={(value) => onItem({ ...item, quantity: value }, `items.${item.id}.quantity`)}
        />
        <MoneyField
          id={`${item.id}-unit`}
          label="Unit price"
          value={item.unitPrice}
          confidence={confidence[`items.${item.id}.unitPrice`]}
          onChange={(value) => onItem({ ...item, unitPrice: value }, `items.${item.id}.unitPrice`)}
        />
      </div>
      <p className="calculated">
        Line amount:{' '}
        {item.totalPrice != null
          ? formatMoney(item.totalPrice, currency)
          : 'Calculated when quantity and unit price are both filled.'}
      </p>
      <button type="button" className="text-button" onClick={onRemove}>Remove item</button>
    </fieldset>
  )
}

function TextField({
  id,
  label,
  value,
  confidence,
  onChange,
  placeholder,
  spellCheck = true,
  multiline = false,
  wide = false,
  onBlur,
}: {
  id: string
  label: string
  value: string
  confidence?: number
  onChange: (value: string) => void
  placeholder?: string
  spellCheck?: boolean
  multiline?: boolean
  wide?: boolean
  onBlur?: (value: string) => void
}) {
  return (
    <label className={wide ? 'field wide' : 'field'} htmlFor={id}>
      <span>
        {label}
        <Confidence value={confidence} />
      </span>
      {multiline ? (
        <textarea
          id={id}
          value={value}
          maxLength={400}
          placeholder={placeholder}
          spellCheck={spellCheck}
          rows={2}
          className={confidence != null && confidence < 55 ? 'uncertain' : undefined}
          onChange={(event) => onChange(event.target.value)}
          onBlur={onBlur ? (event) => onBlur(event.target.value) : undefined}
        />
      ) : (
        <input
          id={id}
          value={value}
          maxLength={120}
          placeholder={placeholder}
          spellCheck={spellCheck}
          autoComplete="off"
          className={confidence != null && confidence < 55 ? 'uncertain' : undefined}
          onChange={(event) => onChange(event.target.value)}
          onBlur={onBlur ? (event) => onBlur(event.target.value) : undefined}
        />
      )}
    </label>
  )
}

function MoneyField({
  id,
  label,
  value,
  confidence,
  onChange,
}: {
  id: string
  label: string
  value?: number
  confidence?: number
  onChange: (value: number | undefined) => void
}) {
  return (
    <NumberField
      id={id}
      label={label}
      value={value}
      confidence={confidence}
      decimal
      onChange={onChange}
    />
  )
}

function NumberField({
  id,
  label,
  value,
  confidence,
  decimal,
  onChange,
}: {
  id: string
  label: string
  value?: number
  confidence?: number
  decimal: boolean
  onChange: (value: number | undefined) => void
}) {
  const [text, setText] = useState(value == null ? '' : String(value))
  return (
    <label className="field" htmlFor={id}>
      <span>
        {label}
        <Confidence value={confidence} />
      </span>
      <input
        id={id}
        value={text}
        inputMode={decimal ? 'decimal' : 'numeric'}
        autoComplete="off"
        spellCheck={false}
        className={confidence != null && confidence < 55 ? 'uncertain' : undefined}
        onChange={(event) => {
          const next = event.target.value
          if (next !== '' && !(decimal ? /^\d*\.?\d{0,2}$/ : /^\d{0,6}$/).test(next)) return
          setText(next)
          if (next === '' || next === '.') onChange(undefined)
          else onChange(Number(next))
        }}
      />
    </label>
  )
}

function Confidence({ value }: { value?: number }) {
  if (value == null) return null
  const level = value >= 80 ? 'high' : value >= 55 ? 'medium' : 'low'
  const label = level === 'high' ? 'Clear' : level === 'medium' ? 'Check' : 'Uncertain'
  return <em className={`confidence ${level}`} title={`${Math.round(value)}% OCR confidence`}>{label}</em>
}
