export const aliexpressLabels = {
  orderId: /^order id\b/,
  orderTime: /^order time\b/,
  subtotal: /^subtotal\b/,
  discount: /^al{1,2} discount\b/,
  shipping: /^shipping fee\b/,
  total: /^total\b/,
  shippingAddress: /^shipping address\b/,
  payment: /^payment method\b/,
  item: /^item detail\b/,
  notes: /^things to note\b/,
} as const
