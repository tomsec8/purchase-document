interface OrderSwitcherProps {
  labels: string[]
  index: number
  onIndex: (index: number) => void
}

export function OrderSwitcher({ labels, index, onIndex }: OrderSwitcherProps) {
  return (
    <nav className="order-switch" aria-label="Orders">
      {labels.map((label, item) => (
        <button
          key={item}
          type="button"
          aria-current={item === index ? 'true' : undefined}
          onClick={() => onIndex(item)}
        >
          <small>Order {item + 1}</small>
          <strong>{label}</strong>
        </button>
      ))}
    </nav>
  )
}
