// Identical items share a line; a saved line that no longer matches the menu is dropped on read.

import { BITES } from './menu.ts'
import { priceOf } from './order.ts'
import { defaultStore, isRecord, parseDrinkChoice, read, write } from './storage.ts'
import type { DrinkChoice } from './storage.ts'

const BAG_KEY = 'usual:bag'
export const QTY_MAX = 10
export const NOTE_MAX = 140

export type BagItem = ({ kind: 'drink'; choice: DrinkChoice } | { kind: 'bite'; biteId: string }) & { note?: string }

export function cleanNote(note: string | undefined): string {
  return (note ?? '').replace(/\s+/g, ' ').trim().slice(0, NOTE_MAX)
}

export interface BagLine {
  key: string
  item: BagItem
  qty: number
}

export type Bag = BagLine[]

export interface BagTotals {
  items: number
  drinks: number
  subtotal: number
  /** What a free drink takes off: the dearest drink in the bag. */
  discount: number
  total: number
}

const clampQty = (qty: number) => Math.min(QTY_MAX, Math.max(0, Math.floor(qty)))

export function lineKey(item: BagItem): string {
  const note = cleanNote(item.note)
  const withNote = (key: string) => (note ? `${key}:note=${note}` : key)
  if (item.kind === 'bite') return withNote(`bite:${item.biteId}`)
  const c = item.choice
  return withNote(['drink', c.drinkId, c.size, c.milk, c.sugar, c.iced ? 'iced' : 'hot', c.extraShot ? 'shot' : '', c.syrup ? 'syrup' : ''].join(':'))
}

export function unitPrice(item: BagItem): number {
  if (item.kind === 'drink') return priceOf({ ...item.choice, name: '' })
  const bite = BITES.find((b) => b.id === item.biteId)
  if (!bite) throw new RangeError(`Unknown bite: ${item.biteId}`)
  return bite.price
}

export function addToBag(bag: Bag, item: BagItem, qty = 1): Bag {
  const note = cleanNote(item.note)
  if (item.note !== undefined && item.note !== note) item = note ? { ...item, note } : (({ note: _note, ...rest }) => rest as BagItem)(item)
  const key = lineKey(item)
  const found = bag.find((line) => line.key === key)
  if (found) return setQty(bag, key, found.qty + qty)
  const added = clampQty(qty)
  return added > 0 ? [...bag, { key, item, qty: added }] : bag
}

/** Adds an item and says how many went in: a line never holds more than QTY_MAX. */
export function addAndCount(bag: Bag, item: BagItem, qty = 1): { bag: Bag; added: number } {
  const key = lineKey(item)
  const before = bag.find((line) => line.key === key)?.qty ?? 0
  const next = addToBag(bag, item, qty)
  const after = next.find((line) => line.key === key)?.qty ?? 0
  return { bag: next, added: after - before }
}

/** A quantity of 0 or less removes the line; more than QTY_MAX is held at QTY_MAX. */
export function setQty(bag: Bag, key: string, qty: number): Bag {
  const next = clampQty(qty)
  if (next === 0) return removeLine(bag, key)
  return bag.map((line) => (line.key === key ? { ...line, qty: next } : line))
}

export function removeLine(bag: Bag, key: string): Bag {
  return bag.filter((line) => line.key !== key)
}

export function bagTotals(bag: Bag, useFree = false): BagTotals {
  let items = 0
  let drinks = 0
  let subtotal = 0
  let dearest = 0
  for (const line of bag) {
    const price = unitPrice(line.item)
    items += line.qty
    subtotal += price * line.qty
    if (line.item.kind === 'drink') {
      drinks += line.qty
      dearest = Math.max(dearest, price)
    }
  }
  const discount = useFree ? dearest : 0
  return { items, drinks, subtotal, discount, total: subtotal - discount }
}

function parseItem(value: unknown): BagItem | null {
  if (!isRecord(value)) return null
  const note = typeof value.note === 'string' ? cleanNote(value.note) : ''
  const noted = <T extends BagItem>(item: T): T => (note ? { ...item, note } : item)
  if (value.kind === 'bite') return typeof value.biteId === 'string' && BITES.some((b) => b.id === value.biteId) ? noted({ kind: 'bite', biteId: value.biteId }) : null
  if (value.kind !== 'drink') return null
  const choice = parseDrinkChoice(value.choice)
  return choice ? noted({ kind: 'drink', choice }) : null
}

export function loadBag(store: Storage | null = defaultStore()): Bag {
  const value = read(store, BAG_KEY)
  if (!Array.isArray(value)) return []
  let bag: Bag = []
  for (const line of value) {
    if (!isRecord(line) || !Number.isInteger(line.qty) || (line.qty as number) < 1) continue
    const item = parseItem(line.item)
    if (item) bag = addToBag(bag, item, line.qty as number)
  }
  return bag
}

export function saveBag(bag: Bag, store: Storage | null = defaultStore()): void {
  write(store, BAG_KEY, bag)
}
