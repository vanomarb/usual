// Layers draw the order builder's cup bottom to top, shares adding up to 1; styles/main.css colours each kind.

export type Size = '12oz' | '16oz'
export type Milk = 'fresh' | 'oat' | 'soy' | 'none'
export type Sugar = 0 | 25 | 50 | 75 | 100

export interface Drink {
  id: string
  name: string
  category: 'coffee' | 'not-coffee'
  prices: Partial<Record<Size, number>>
  defaultMilk: Milk
  canIce: boolean
  /** Cold brew and calamansi soda only come over ice. */
  alwaysIced?: boolean
  /** Pictured hot on the menu, so a tap there adds it hot; the order page can still ice it. */
  servedHot?: boolean
  layers: { kind: LayerKind; share: number }[]
}

export const SIZES: Size[] = ['12oz', '16oz']
export const SUGARS: Sugar[] = [0, 25, 50, 75, 100]

export const LAYER_KINDS = [
  'espresso', 'crema', 'americano', 'cold-brew', 'milk', 'oat-milk', 'soy-milk', 'foam', 'condensed',
  'salt-cream', 'ube', 'ube-milk', 'matcha', 'tablea', 'froth', 'calamansi', 'soda', 'syrup',
] as const

export type LayerKind = (typeof LAYER_KINDS)[number]

export const DRINKS: Drink[] = [
  {
    id: 'americano', name: 'Americano', category: 'coffee', prices: { '12oz': 120, '16oz': 140 }, defaultMilk: 'none', canIce: true, servedHot: true,
    layers: [{ kind: 'americano', share: 0.92 }, { kind: 'crema', share: 0.08 }],
  },
  {
    id: 'cafe-latte', name: 'Café latte', category: 'coffee', prices: { '12oz': 150, '16oz': 170 }, defaultMilk: 'fresh', canIce: true, servedHot: true,
    layers: [{ kind: 'espresso', share: 0.24 }, { kind: 'milk', share: 0.6 }, { kind: 'foam', share: 0.16 }],
  },
  {
    id: 'spanish-latte', name: 'Spanish latte', category: 'coffee', prices: { '12oz': 165, '16oz': 185 }, defaultMilk: 'fresh', canIce: true,
    layers: [{ kind: 'condensed', share: 0.16 }, { kind: 'milk', share: 0.5 }, { kind: 'espresso', share: 0.22 }, { kind: 'foam', share: 0.12 }],
  },
  {
    id: 'sea-salt-latte', name: 'Sea salt latte', category: 'coffee', prices: { '12oz': 175, '16oz': 195 }, defaultMilk: 'fresh', canIce: true,
    layers: [{ kind: 'espresso', share: 0.25 }, { kind: 'milk', share: 0.5 }, { kind: 'salt-cream', share: 0.25 }],
  },
  {
    id: 'cortado', name: 'Cortado', category: 'coffee', prices: { '12oz': 140 }, defaultMilk: 'fresh', canIce: false,
    layers: [{ kind: 'espresso', share: 0.48 }, { kind: 'milk', share: 0.4 }, { kind: 'foam', share: 0.12 }],
  },
  {
    id: 'cold-brew', name: 'Cold brew', category: 'coffee', prices: { '12oz': 150, '16oz': 170 }, defaultMilk: 'none', canIce: true, alwaysIced: true,
    layers: [{ kind: 'cold-brew', share: 1 }],
  },
  {
    id: 'ube-latte', name: 'Ube latte', category: 'not-coffee', prices: { '12oz': 170, '16oz': 190 }, defaultMilk: 'fresh', canIce: true,
    layers: [{ kind: 'ube', share: 0.26 }, { kind: 'ube-milk', share: 0.34 }, { kind: 'milk', share: 0.4 }],
  },
  {
    id: 'matcha-latte', name: 'Matcha latte', category: 'not-coffee', prices: { '12oz': 170, '16oz': 190 }, defaultMilk: 'fresh', canIce: true,
    layers: [{ kind: 'milk', share: 0.56 }, { kind: 'matcha', share: 0.44 }],
  },
  {
    id: 'dirty-matcha', name: 'Dirty matcha', category: 'not-coffee', prices: { '12oz': 185, '16oz': 205 }, defaultMilk: 'fresh', canIce: true,
    layers: [{ kind: 'matcha', share: 0.3 }, { kind: 'milk', share: 0.5 }, { kind: 'espresso', share: 0.2 }],
  },
  {
    id: 'tablea', name: 'Tablea hot chocolate', category: 'not-coffee', prices: { '12oz': 150, '16oz': 170 }, defaultMilk: 'fresh', canIce: false,
    layers: [{ kind: 'tablea', share: 0.86 }, { kind: 'froth', share: 0.14 }],
  },
  {
    id: 'calamansi-soda', name: 'Calamansi soda', category: 'not-coffee', prices: { '12oz': 110, '16oz': 130 }, defaultMilk: 'none', canIce: true, alwaysIced: true,
    layers: [{ kind: 'calamansi', share: 0.36 }, { kind: 'soda', share: 0.64 }],
  },
]

export const BITES: { id: string; name: string; price: number }[] = [
  { id: 'ensaymada', name: 'Ensaymada', price: 85 },
  { id: 'banana-bread', name: 'Banana bread', price: 95 },
  { id: 'cheese-pandesal', name: 'Cheese pandesal, 3 pieces', price: 75 },
]

export const ADDONS = { extraShot: 40, oat: 35, soy: 30, syrup: 25 } as const

export function drinkById(id: string): Drink | undefined {
  return DRINKS.find((drink) => drink.id === id)
}
