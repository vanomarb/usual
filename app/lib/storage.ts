// Blocked or broken storage reads as "nothing saved" and skips writes, so ordering always works.

import { SUGARS } from './menu.ts'
import type { Sugar } from './menu.ts'
import { optionsFor, validName } from './order.ts'
import type { OrderChoice } from './order.ts'
import { STAMPS_PER_CARD } from './rewards.ts'
import type { StampCard } from './rewards.ts'

const USUAL_KEY = 'usual:usual'
export const CARD_KEY = 'usual:card'

export function defaultStore(): Storage | null {
  try {
    return globalThis.localStorage ?? null
  } catch {
    return null
  }
}

export function read(store: Storage | null, key: string): unknown {
  if (!store) return null
  try {
    const raw = store.getItem(key)
    return raw === null ? null : JSON.parse(raw)
  } catch {
    return null
  }
}

export function write(store: Storage | null, key: string, value: unknown): void {
  if (!store) return
  try {
    store.setItem(key, JSON.stringify(value))
  } catch {
    // Full or blocked: keep going without saving.
  }
}

export function remove(store: Storage | null, key: string): void {
  if (!store) return
  try {
    store.removeItem(key)
  } catch {
  }
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** The bag keeps drinks without the name for the cup. */
export type DrinkChoice = Omit<OrderChoice, 'name'>

export function parseDrinkChoice(value: unknown): DrinkChoice | null {
  if (!isRecord(value) || typeof value.drinkId !== 'string') return null
  const options = optionsFor(value.drinkId)
  const { size, milk, sugar, extraShot, syrup, iced } = value
  const valid =
    options.sizes.includes(size as OrderChoice['size']) &&
    options.milks.includes(milk as OrderChoice['milk']) &&
    SUGARS.includes(sugar as Sugar) &&
    typeof extraShot === 'boolean' && (options.shot || !extraShot) &&
    typeof syrup === 'boolean' &&
    typeof iced === 'boolean' && (options.ice === 'choice' || iced === (options.ice === 'always'))
  if (!valid) return null
  return {
    drinkId: value.drinkId,
    size: size as OrderChoice['size'],
    milk: milk as OrderChoice['milk'],
    sugar: sugar as Sugar,
    extraShot: extraShot as boolean,
    syrup: syrup as boolean,
    iced: iced as boolean,
  }
}

function parseChoice(value: unknown): OrderChoice | null {
  const drink = parseDrinkChoice(value)
  if (!drink || !isRecord(value) || typeof value.name !== 'string' || validName(value.name) !== null) return null
  return { ...drink, name: value.name.trim() }
}

function parseCard(value: unknown): StampCard | null {
  if (!isRecord(value)) return null
  const { stamps, free } = value
  const ok = (n: unknown, max: number): n is number => Number.isInteger(n) && (n as number) >= 0 && (n as number) <= max
  return ok(stamps, STAMPS_PER_CARD - 1) && ok(free, 99) ? { stamps, free } : null
}

/** False in private windows or with site data blocked, so the page can say so. */
export function canRemember(store: Storage | null = defaultStore()): boolean {
  if (!store) return false
  try {
    store.setItem('usual:probe', '1')
    store.removeItem('usual:probe')
    return true
  } catch {
    return false
  }
}

export function loadUsual(store: Storage | null = defaultStore()): OrderChoice | null {
  return parseChoice(read(store, USUAL_KEY))
}

export function saveUsual(choice: OrderChoice, store: Storage | null = defaultStore()): void {
  write(store, USUAL_KEY, choice)
}

export function loadCard(store: Storage | null = defaultStore()): StampCard {
  return parseCard(read(store, CARD_KEY)) ?? { stamps: 0, free: 0 }
}

export function saveCard(card: StampCard, store: Storage | null = defaultStore()): void {
  write(store, CARD_KEY, card)
}
