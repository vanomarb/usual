import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { cupLayers } from './cup.ts'
import { DRINKS, LAYER_KINDS } from '../lib/menu.ts'
import type { OrderChoice } from '../lib/order.ts'

const latte: OrderChoice = { drinkId: 'cafe-latte', size: '16oz', milk: 'fresh', sugar: 50, extraShot: false, syrup: false, iced: false, name: 'Van' }
const kinds = (choice: OrderChoice) => cupLayers(choice).map((layer) => layer.kind)

test('a hot latte is drawn bottom to top as espresso, milk and foam', () => {
  assert.deepEqual(kinds(latte), ['espresso', 'milk', 'foam'])
})

test('oat or soy milk replaces the milk layer', () => {
  assert.deepEqual(kinds({ ...latte, milk: 'oat' }), ['espresso', 'oat-milk', 'foam'])
  assert.deepEqual(kinds({ ...latte, milk: 'soy' }), ['espresso', 'soy-milk', 'foam'])
})

test('milk in a black coffee hides the crema and settles on top', () => {
  const americano: OrderChoice = { ...latte, drinkId: 'americano', milk: 'none' }
  assert.deepEqual(kinds(americano), ['americano', 'crema'])
  assert.deepEqual(kinds({ ...americano, milk: 'oat' }), ['americano', 'oat-milk'])
})

test('ice drops the foam, an extra shot sits under it, syrup goes to the bottom', () => {
  assert.deepEqual(kinds({ ...latte, iced: true }), ['espresso', 'milk'])
  assert.deepEqual(kinds({ ...latte, extraShot: true }), ['espresso', 'milk', 'espresso', 'foam'])
  assert.deepEqual(kinds({ ...latte, syrup: true }), ['syrup', 'espresso', 'milk', 'foam'])
  assert.deepEqual(kinds({ ...latte, drinkId: 'tablea', iced: false, extraShot: true }), ['tablea', 'espresso', 'froth'])
})

test('layer shares always fill the cup', () => {
  const total = cupLayers({ ...latte, extraShot: true, syrup: true }).reduce((sum, layer) => sum + layer.share, 0)
  assert.ok(Math.abs(total - 1) < 1e-9)
})

test('every layer kind has an oklch token and a fill rule in the stylesheet', () => {
  const css = readFileSync(new URL('../styles/main.css', import.meta.url), 'utf8')
  const used = new Set<string>([...DRINKS.flatMap((drink) => drink.layers.map((layer) => layer.kind)), 'oat-milk', 'soy-milk', 'syrup'])
  for (const kind of used) assert.ok((LAYER_KINDS as readonly string[]).includes(kind), `${kind} is a known layer kind`)
  for (const kind of LAYER_KINDS) {
    assert.match(css, new RegExp(`--color-drink-${kind}: oklch\\(`), `--color-drink-${kind} is defined as oklch()`)
    assert.match(css, new RegExp(`data-layer='${kind}'\\]\\s*\\{\\s*fill: var\\(--color-drink-${kind}\\)`), `${kind} layers are filled from their token`)
  }
})
