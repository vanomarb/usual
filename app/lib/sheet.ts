// The item sheet's rows for one drink: only the choices it has, with the menu's way picked.

import { ADDONS, SUGARS, drinkById } from './menu.ts'
import type { Milk } from './menu.ts'
import { SIZE_NAMES, menuChoice, optionsFor } from './order.ts'
import { peso } from './format.ts'

export interface SheetOption {
  value: string
  label: string
  /** Shown at the end of the row: a price, an add-on price or a short note. */
  extra?: string
  checked: boolean
}

export interface SheetGroup {
  name: 'size' | 'iced' | 'milk' | 'sugar' | 'extras'
  title: string
  kind: 'radio' | 'checkbox'
  required: boolean
  options: SheetOption[]
}

const MILK_LABELS: Record<Milk, string> = { none: 'No milk', fresh: 'Fresh milk', oat: 'Oat milk', soy: 'Soy milk' }
const MILK_EXTRAS: Partial<Record<Milk, string>> = { oat: `+${peso(ADDONS.oat)}`, soy: `+${peso(ADDONS.soy)}` }

export function sheetGroups(drinkId: string): SheetGroup[] {
  const drink = drinkById(drinkId)
  if (!drink) return []
  const options = optionsFor(drinkId)
  const choice = menuChoice(drinkId)
  const groups: SheetGroup[] = []
  if (options.sizes.length > 1) {
    groups.push({
      name: 'size', title: 'Size', kind: 'radio', required: true,
      options: options.sizes.map((size) => ({ value: size, label: SIZE_NAMES[size], extra: peso(drink.prices[size]!), checked: size === choice.size })),
    })
  }
  if (options.ice === 'choice') {
    groups.push({
      name: 'iced', title: 'Hot or iced', kind: 'radio', required: true,
      options: [{ value: 'hot', label: 'Hot', checked: !choice.iced }, { value: 'iced', label: 'Iced', checked: choice.iced }],
    })
  }
  if (options.milks.length > 1) {
    groups.push({
      name: 'milk', title: 'Milk', kind: 'radio', required: true,
      options: options.milks.map((milk) => ({ value: milk, label: MILK_LABELS[milk], extra: MILK_EXTRAS[milk], checked: milk === choice.milk })),
    })
  }
  groups.push({
    name: 'sugar', title: 'Sugar', kind: 'radio', required: true,
    options: SUGARS.map((sugar) => ({
      value: String(sugar), label: `${sugar}%`, checked: sugar === choice.sugar,
      extra: sugar === 0 ? 'Unsweetened' : sugar === 100 ? 'Regular sweetness' : undefined,
    })),
  })
  const extras: SheetOption[] = []
  if (options.shot) extras.push({ value: 'extraShot', label: 'Extra shot', extra: `+${peso(ADDONS.extraShot)}`, checked: false })
  extras.push({ value: 'syrup', label: 'Syrup', extra: `+${peso(ADDONS.syrup)}`, checked: false })
  groups.push({ name: 'extras', title: 'Extras', kind: 'checkbox', required: false, options: extras })
  return groups
}

/** The example in the note box, so it never suggests ice for a pastry. */
export function noteHint(item: { kind: 'drink'; iced: boolean } | { kind: 'bite' }): string {
  if (item.kind === 'bite') return 'Warm it up, or cut it in half'
  return item.iced ? 'Less ice, no straw' : 'Extra hot, or a lid for the road'
}
