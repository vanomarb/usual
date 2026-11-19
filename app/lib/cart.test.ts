import test from 'node:test'
import assert from 'node:assert/strict'
import { NOTE_MAX, QTY_MAX, addAndCount, addToBag, bagTotals, cleanNote, lineKey, loadBag, removeLine, saveBag, setQty, unitPrice } from './cart.ts'
import type { BagItem } from './cart.ts'

function memoryStore(): Storage {
  const items = new Map<string, string>()
  return {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => { items.set(key, String(value)) },
    removeItem: (key: string) => { items.delete(key) },
    clear: () => items.clear(),
    key: (index: number) => [...items.keys()][index] ?? null,
    get length() { return items.size },
  }
}

const latte: BagItem = { kind: 'drink', choice: { drinkId: 'spanish-latte', size: '16oz', milk: 'oat', sugar: 50, extraShot: true, syrup: false, iced: true } }
const americano: BagItem = { kind: 'drink', choice: { drinkId: 'americano', size: '12oz', milk: 'none', sugar: 0, extraShot: false, syrup: false, iced: false } }
const bread: BagItem = { kind: 'bite', biteId: 'banana-bread' }

test('a unit price includes the add-ons', () => {
  assert.equal(unitPrice(latte), 185 + 35 + 40)
  assert.equal(unitPrice(americano), 120)
  assert.equal(unitPrice(bread), 95)
})

test('adding the same item again raises its quantity; a different item gets its own line', () => {
  let bag = addToBag([], latte)
  bag = addToBag(bag, latte)
  bag = addToBag(bag, bread, 2)
  bag = addToBag(bag, { ...latte, choice: { ...latte.choice, sugar: 25 } } as BagItem)
  assert.equal(bag.length, 3)
  assert.equal(bag[0].qty, 2)
  assert.equal(bag[1].qty, 2)
  assert.equal(lineKey(latte), bag[0].key)
  assert.notEqual(bag[0].key, bag[2].key)
})

test('quantities stay between 1 and the maximum; zero removes the line', () => {
  let bag = addToBag([], americano, QTY_MAX + 5)
  assert.equal(bag[0].qty, QTY_MAX)
  bag = setQty(bag, bag[0].key, 3)
  assert.equal(bag[0].qty, 3)
  bag = setQty(bag, bag[0].key, 99)
  assert.equal(bag[0].qty, QTY_MAX)
  assert.deepEqual(setQty(bag, bag[0].key, 0), [])
  assert.deepEqual(setQty(bag, 'missing', 2), bag)
})

test('removing a line leaves the others', () => {
  const bag = addToBag(addToBag([], latte), bread)
  assert.deepEqual(removeLine(bag, bag[0].key).map((line) => line.key), [bag[1].key])
})

test('totals count items, drinks and pesos, and a free drink covers the dearest drink', () => {
  const bag = addToBag(addToBag(addToBag([], latte, 2), americano), bread)
  assert.deepEqual(bagTotals(bag), { items: 4, drinks: 3, subtotal: 260 * 2 + 120 + 95, discount: 0, total: 735 })
  assert.deepEqual(bagTotals(bag, true), { items: 4, drinks: 3, subtotal: 735, discount: 260, total: 475 })
  assert.deepEqual(bagTotals(addToBag([], bread), true), { items: 1, drinks: 0, subtotal: 95, discount: 0, total: 95 })
  assert.deepEqual(bagTotals([]), { items: 0, drinks: 0, subtotal: 0, discount: 0, total: 0 })
})

test('the bag round-trips through storage and drops lines that no longer make sense', () => {
  const store = memoryStore()
  const bag = addToBag(addToBag([], latte, 2), bread)
  saveBag(bag, store)
  assert.deepEqual(loadBag(store), bag)
  store.setItem('usual:bag', JSON.stringify([
    ...bag,
    { key: 'x', item: { kind: 'drink', choice: { ...americano.choice, drinkId: 'flat-white' } }, qty: 1 },
    { key: 'y', item: { kind: 'bite', biteId: 'croissant' }, qty: 1 },
    { key: 'z', item: bread, qty: 0 },
    'latte',
  ]))
  assert.deepEqual(loadBag(store), bag)
  store.setItem('usual:bag', '{nope')
  assert.deepEqual(loadBag(store), [])
})

test('blocked storage gives an empty bag and never throws', () => {
  const blocked = { getItem() { throw new Error('blocked') }, setItem() { throw new Error('blocked') } } as unknown as Storage
  assert.deepEqual(loadBag(blocked), [])
  assert.doesNotThrow(() => saveBag(addToBag([], bread), blocked))
  assert.deepEqual(loadBag(null), [])
})

test('a note for the barista keeps its own line, is tidied and capped, and survives storage', () => {
  const lessIce: BagItem = { ...latte, note: '  less   ice ' }
  assert.equal(cleanNote(lessIce.note), 'less ice')
  assert.equal(cleanNote('x'.repeat(NOTE_MAX + 20)).length, NOTE_MAX)
  assert.equal(cleanNote('   '), '')
  const bag = addToBag(addToBag(addToBag([], latte), { ...latte, note: 'less ice' }), { ...bread, note: 'warm it up' })
  assert.equal(bag.length, 3, 'the same drink with a note is its own line')
  assert.notEqual(lineKey(latte), lineKey({ ...latte, note: 'less ice' }))
  assert.equal(lineKey(latte), lineKey({ ...latte, note: '  ' }), 'a blank note is no note')
  const store = memoryStore()
  saveBag(bag, store)
  const back = loadBag(store)
  assert.deepEqual(back.map((line) => line.item.note ?? ''), ['', 'less ice', 'warm it up'])
  store.setItem('usual:bag', JSON.stringify([{ key: 'k', item: { ...bread, note: 42 }, qty: 1 }]))
  assert.equal(loadBag(store)[0].item.note, undefined, 'a note that is not text is dropped, the item kept')
})

test('adding past the limit says how many actually went in', () => {
  const nine = addToBag([], latte, 9)
  const some = addAndCount(nine, latte, 3)
  assert.equal(some.added, 1, 'only one more fits')
  assert.equal(some.bag[0].qty, QTY_MAX)
  assert.equal(addAndCount(some.bag, latte, 2).added, 0, 'a full line takes none')
  assert.equal(addAndCount([], bread, 2).added, 2)
})
