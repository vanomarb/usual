const wholePesos = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })

/** Peso amounts as printed on the menu: ₱1,290, no decimals. */
export function peso(amount: number): string {
  return `₱${wholePesos.format(amount)}`
}
