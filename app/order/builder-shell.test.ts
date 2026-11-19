import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { cupLayers } from '../shared/cup.ts'
import { ADDONS, DRINKS, drinkById } from '../lib/menu.ts'
import { BRANCHES } from '../lib/branches.ts'
import { DEFAULT_CHOICE, priceOf } from '../lib/order.ts'

// The order page prerenders the builder and the menu page prints the prices; these keep that markup equal to the data.
const html = readFileSync(new URL('./index.html', import.meta.url), 'utf8')
const menuPage = readFileSync(new URL('../menu/index.html', import.meta.url), 'utf8')
const checked = (name: string) => [...html.matchAll(new RegExp(`name="${name}" value="([^"]+)" checked`, 'g'))].map((m) => m[1])

test('the prerendered drink chips are the menu, with each drink’s lowest price', () => {
  const chips = [...html.matchAll(/<label class="chip chip--drink"><input type="radio" name="drink" value="([^"]+)"(?: checked)? \/><span class="chip__face">([^<]+) <span class="chip__price">₱(\d+)<\/span>/g)]
    .map((m) => ({ id: m[1], name: m[2], price: Number(m[3]) }))
  assert.deepEqual(chips, DRINKS.map((d) => ({ id: d.id, name: d.name, price: Math.min(...Object.values(d.prices)) })))
})

test('the prerendered choices are the default order', () => {
  const drink = drinkById(DEFAULT_CHOICE.drinkId)!
  assert.deepEqual(checked('drink'), [DEFAULT_CHOICE.drinkId])
  assert.deepEqual(checked('size'), [DEFAULT_CHOICE.size])
  assert.deepEqual(checked('milk'), [DEFAULT_CHOICE.milk])
  assert.deepEqual(checked('sugar'), [String(DEFAULT_CHOICE.sugar)])
  assert.deepEqual(checked('temp'), [DEFAULT_CHOICE.iced ? 'iced' : 'hot'])
  assert.doesNotMatch(html, /name="iced"/, 'hot or iced is a choice of two, not an extra')
  assert.ok(html.indexOf('data-step="temp"') > html.indexOf('data-step="size"') && html.indexOf('data-step="temp"') < html.indexOf('data-step="milk"'), 'Hot or iced sits between Size and Milk')
  const sizes = [...html.matchAll(/name="size" value="(\w+)"(?: checked)? \/><span class="chip__face">[^<]+ <span class="chip__price">₱(\d+)</g)].map((m) => [m[1], Number(m[2])])
  assert.deepEqual(sizes, Object.entries(drink.prices))
  assert.match(html, new RegExp(`data-summary-drink>${drink.name}<`))
  assert.match(html, new RegExp(`data-price>₱${priceOf(DEFAULT_CHOICE)}<`))
  for (const [key, price] of Object.entries(ADDONS)) assert.match(html, new RegExp(`data-addon="${key}">\\+₱${price}<`))
})

test('the prerendered branch picks are the branches, IT Park first and chosen', () => {
  const picks = [...html.matchAll(/name="branch" value="([^"]+)"(?: checked)? \/><span class="pick__face"><span class="pick__name">([^<]+)</g)].map((m) => [m[1], m[2]])
  assert.deepEqual(picks, BRANCHES.map((b) => [b.id, b.name]))
  assert.deepEqual(checked('branch'), ['it-park'])
})

test('the prerendered cup shows the default order at its levels', () => {
  const rects = [...html.matchAll(/<rect class="cup__layer"[^>]*?(?: data-layer="([^"]+)")? style="transform: translateY\(([\d.]+)px\)"/g)].map((m) => ({ kind: m[1], top: Number(m[2]) }))
  assert.equal(rects.length, 6)
  const layers = cupLayers(DEFAULT_CHOICE)
  const height = (DEFAULT_CHOICE.iced ? 0.9 : 0.84) * (264 - 54)
  let top = 264
  const expected = layers.map((layer) => ({ kind: layer.kind, top: Number((top -= layer.share * height).toFixed(2)) })).reverse()
  assert.deepEqual(rects.slice(6 - layers.length), expected)
  assert.match(html, new RegExp(`data-cup data-size="${DEFAULT_CHOICE.size}"${DEFAULT_CHOICE.iced ? ' data-iced' : ''}>`))
})

test('the printed menu shows every drink at its starting price (the item sheet shows each size)', () => {
  for (const drink of DRINKS) {
    const row = menuPage.match(new RegExp(`id="item-${drink.id}-price">(.*?)</span>\\s*</span>`))
    assert.ok(row, `${drink.name} is on the menu`)
    const prices = Object.values(drink.prices)
    assert.equal(row[1], prices.length > 1 ? `<span class="font-normal text-muted">From</span> ₱${Math.min(...prices)}` : `₱${prices[0]}`, drink.name)
  }
})
