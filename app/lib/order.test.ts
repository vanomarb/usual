import test from 'node:test'
import assert from 'node:assert/strict'
import { menuChoice, optionsFor, priceOf, sizesFor, switchDrink, validName } from './order.ts'
import type { OrderChoice } from './order.ts'
import { DRINKS } from './menu.ts'

test('priceOf adds size, milk and add-ons', () => {
  assert.equal(priceOf({ drinkId: 'spanish-latte', size: '16oz', milk: 'oat', sugar: 50, extraShot: true, syrup: false, iced: true, name: 'Van' }), 260)
  assert.equal(priceOf({ drinkId: 'americano', size: '12oz', milk: 'none', sugar: 0, extraShot: false, syrup: true, iced: false, name: 'Van' }), 145)
})

test('cortado comes in one size', () => { assert.deepEqual(sizesFor('cortado'), ['12oz']) })

test('validName trims and limits length', () => {
  assert.ok(validName('')); assert.ok(validName('   ')); assert.equal(validName(' Van '), null); assert.ok(validName('A'.repeat(17)))
})

test('validName accepts exactly 16 characters', () => {
  assert.equal(validName('A'.repeat(16)), null)
})

test('the menu has every drink from the brief with its prices', () => {
  assert.equal(DRINKS.length, 11)
  assert.deepEqual(DRINKS.find((d) => d.id === 'dirty-matcha')?.prices, { '12oz': 185, '16oz': 205 })
  for (const drink of DRINKS) {
    const total = drink.layers.reduce((sum, layer) => sum + layer.share, 0)
    assert.ok(Math.abs(total - 1) < 1e-9, `${drink.id} layers add up to 1`)
  }
})

test('options follow the drink', () => {
  assert.deepEqual(optionsFor('calamansi-soda'), { sizes: ['12oz', '16oz'], milks: ['none'], shot: false, ice: 'always' })
  assert.deepEqual(optionsFor('cortado').ice, 'never')
  assert.deepEqual(optionsFor('cafe-latte').milks, ['fresh', 'oat', 'soy'])
  assert.deepEqual(optionsFor('americano').milks, ['none', 'fresh', 'oat', 'soy'])
})

test('switching drinks keeps what still fits and resets what does not', () => {
  const latte: OrderChoice = { drinkId: 'cafe-latte', size: '16oz', milk: 'oat', sugar: 25, extraShot: true, syrup: true, iced: true, name: 'Ana' }
  assert.deepEqual(switchDrink(latte, 'spanish-latte'), { ...latte, drinkId: 'spanish-latte' })
  assert.deepEqual(switchDrink(latte, 'americano'), { ...latte, drinkId: 'americano', milk: 'none' })
  assert.deepEqual(switchDrink(latte, 'cortado'), { ...latte, drinkId: 'cortado', size: '12oz', iced: false })
  assert.deepEqual(switchDrink(latte, 'calamansi-soda'), { ...latte, drinkId: 'calamansi-soda', milk: 'none', extraShot: false })
  const americano: OrderChoice = { ...latte, drinkId: 'americano', milk: 'none', iced: false }
  assert.equal(switchDrink(americano, 'cafe-latte').milk, 'fresh')
  assert.equal(switchDrink(americano, 'cold-brew').iced, true)
})

test('priceOf refuses a size the drink does not come in', () => {
  assert.throws(() => priceOf({ drinkId: 'cortado', size: '16oz', milk: 'fresh', sugar: 50, extraShot: false, syrup: false, iced: false, name: 'Van' }), RangeError)
})

test('a tap on the menu makes each drink the way the menu shows it: hot in a cup, or iced in a takeaway cup', () => {
  const hot = ['americano', 'cafe-latte', 'cortado', 'tablea']
  for (const drink of DRINKS) {
    assert.equal(menuChoice(drink.id, '12oz').iced, !hot.includes(drink.id), `${drink.name} is made ${hot.includes(drink.id) ? 'hot' : 'iced'}`)
  }
})
