import { ADDONS, SIZES, drinkById } from './menu.ts'
import type { Milk, Size, Sugar } from './menu.ts'

export interface OrderChoice {
  drinkId: string
  size: Size
  milk: Milk
  sugar: Sugar
  extraShot: boolean
  syrup: boolean
  iced: boolean
  name: string
}

export interface DrinkOptions {
  sizes: Size[]
  milks: Milk[]
  shot: boolean
  ice: 'choice' | 'always' | 'never'
}

export const NAME_MAX = 16

export function sizesFor(drinkId: string): Size[] {
  const drink = drinkById(drinkId)
  return drink ? SIZES.filter((size) => drink.prices[size] !== undefined) : []
}

export function optionsFor(drinkId: string): DrinkOptions {
  const drink = drinkById(drinkId)
  if (!drink) return { sizes: [], milks: [], shot: false, ice: 'never' }
  // Lattes always have milk; black coffee can take some; the soda takes none.
  const milks: Milk[] = drink.defaultMilk !== 'none'
    ? ['fresh', 'oat', 'soy']
    : drink.category === 'coffee' ? ['none', 'fresh', 'oat', 'soy'] : ['none']
  return {
    sizes: sizesFor(drinkId),
    milks,
    shot: !(drink.category === 'not-coffee' && drink.defaultMilk === 'none'),
    ice: drink.alwaysIced ? 'always' : drink.canIce ? 'choice' : 'never',
  }
}

/** Keeps the size, milk and extras that still apply; a plant milk carries over between milk drinks, black drinks start black. */
export function switchDrink(choice: OrderChoice, drinkId: string): OrderChoice {
  const drink = drinkById(drinkId)
  if (!drink) return choice
  const options = optionsFor(drinkId)
  const size = options.sizes.includes(choice.size) ? choice.size : options.sizes[0]
  const milk = drink.defaultMilk === 'none'
    ? 'none'
    : choice.milk !== 'none' && options.milks.includes(choice.milk) ? choice.milk : drink.defaultMilk
  const iced = options.ice === 'always' ? true : options.ice === 'never' ? false : choice.iced
  return { ...choice, drinkId, size, milk, extraShot: options.shot && choice.extraShot, iced }
}

export function priceOf(choice: OrderChoice): number {
  const drink = drinkById(choice.drinkId)
  if (!drink) throw new RangeError(`Unknown drink: ${choice.drinkId}`)
  const base = drink.prices[choice.size]
  if (base === undefined) throw new RangeError(`${drink.name} doesn't come in ${choice.size}`)
  const milk = choice.milk === 'oat' ? ADDONS.oat : choice.milk === 'soy' ? ADDONS.soy : 0
  return base + milk + (choice.extraShot ? ADDONS.extraShot : 0) + (choice.syrup ? ADDONS.syrup : 0)
}

/** The message to show for a name that won't work on the sleeve, or null. */
export function validName(name: string): string | null {
  const trimmed = name.trim()
  if (!trimmed) return 'Add a name for the cup.'
  if ([...trimmed].length > NAME_MAX) return 'That won’t fit on the sleeve. Keep it to 16 characters.'
  return null
}

/** The order the builder starts with, and the way a drink is made when added from the menu. */
export const DEFAULT_CHOICE: OrderChoice = {
  drinkId: 'sea-salt-latte', size: '12oz', milk: 'fresh', sugar: 50, extraShot: false, syrup: false, iced: true, name: '',
}

export const SIZE_NAMES: Record<Size, string> = { '12oz': '12 oz', '16oz': '16 oz' }
const MILK_NAMES: Record<Milk, string> = { fresh: 'fresh milk', oat: 'oat milk', soy: 'soy milk', none: 'no milk' }

/** "Spanish latte" and "16 oz, iced, oat milk, 50% sugar, extra shot". */
export function describe(choice: Omit<OrderChoice, 'name'>): { drink: string; details: string } {
  const drink = drinkById(choice.drinkId)
  if (!drink) return { drink: '', details: '' }
  const options = optionsFor(drink.id)
  const parts = [SIZE_NAMES[choice.size]]
  if (options.ice === 'choice') parts.push(choice.iced ? 'iced' : 'hot')
  if (choice.milk !== 'none' || drink.defaultMilk !== 'none') parts.push(MILK_NAMES[choice.milk])
  parts.push(`${choice.sugar}% sugar`)
  if (choice.extraShot) parts.push('extra shot')
  if (choice.syrup) parts.push('syrup')
  return { drink: drink.name, details: parts.join(', ') }
}

/** A drink the way a tap on the menu makes it: fresh milk or none, 50% sugar, hot or iced as the menu pictures it. */
export function menuChoice(drinkId: string, size?: Size): Omit<OrderChoice, 'name'> {
  const { name: _name, ...choice } = switchDrink(DEFAULT_CHOICE, drinkId)
  if (size && optionsFor(drinkId).sizes.includes(size)) choice.size = size
  if (drinkById(drinkId)?.servedHot) choice.iced = false
  return choice
}
