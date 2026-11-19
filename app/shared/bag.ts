import { QTY_MAX, addAndCount, bagTotals, loadBag, saveBag } from '../lib/cart.ts'
import type { Bag, BagItem } from '../lib/cart.ts'
import { BASE_URL } from '../lib/base.ts'
import { BITES } from '../lib/menu.ts'
import { describe } from '../lib/order.ts'
import { showToast } from './toast.ts'

export const BAG_EVENT = 'usual:bag'

// Kept in memory too, so the bag works for the visit when the browser keeps no site data.
let current: Bag | null = null

export function getBag(): Bag {
  current ??= loadBag()
  return current
}

export function setBag(bag: Bag): void {
  current = bag
  saveBag(bag)
  document.dispatchEvent(new CustomEvent<Bag>(BAG_EVENT, { detail: bag }))
}

/** "Spanish latte, 12 oz, iced, fresh milk, 50% sugar" or "Banana bread". */
export function itemLabel(item: BagItem): { name: string; details: string } {
  if (item.kind === 'bite') return { name: BITES.find((b) => b.id === item.biteId)?.name ?? '', details: 'Baked this morning' }
  const { drink, details } = describe(item.choice)
  return { name: drink, details }
}

/** A line holds at most QTY_MAX, and the toast never claims more went in than did. */
export function addItemToBag(item: BagItem, qty = 1): void {
  const { bag, added } = addAndCount(getBag(), item, qty)
  setBag(bag)
  const { name, details } = itemLabel(item)
  const { items } = bagTotals(bag)
  const what = `${name}${item.kind === 'drink' ? `, ${details}` : ''}`
  const text = added === 0
    ? `Your bag already has ${QTY_MAX} of ${what}, the most one order takes.`
    : `Added ${added > 1 ? `${added} × ` : ''}${what}.${added < qty ? ` Your bag holds ${QTY_MAX} at most, so ${added} went in.` : ''}`
  showToast(text, { href: `${BASE_URL}bag/`, label: `View bag (${items})` })
}

export function initBag(): void {
  // Read the bag afresh when a page starts; the copy in memory only carries it between changes.
  current = null
  const link = document.querySelector<HTMLElement>('[data-bag-link]')
  const count = document.querySelector<HTMLElement>('[data-bag-count]')
  const paint = (bag: Bag) => {
    if (!link || !count) return
    const { items } = bagTotals(bag)
    count.hidden = items === 0
    count.textContent = items > 99 ? '99+' : String(items)
    link.setAttribute('aria-label', items ? `Your bag, ${items} ${items === 1 ? 'item' : 'items'}` : 'Your bag')
  }
  paint(getBag())
  document.addEventListener(BAG_EVENT, (event) => paint((event as CustomEvent<Bag>).detail))
  // Another tab changed the bag.
  window.addEventListener('storage', (event) => {
    if (event.key !== 'usual:bag') return
    current = loadBag()
    // The bag page listens too, so its list follows the other tab.
    document.dispatchEvent(new CustomEvent<Bag>(BAG_EVENT, { detail: current }))
  })
}
