import test from 'node:test'
import assert from 'node:assert/strict'
import { canRemember, loadCard, loadUsual, saveCard, saveUsual } from './storage.ts'
import type { OrderChoice } from './order.ts'

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

const usual: OrderChoice = { drinkId: 'sea-salt-latte', size: '16oz', milk: 'oat', sugar: 50, extraShot: false, syrup: true, iced: true, name: 'Van' }

test('storage survives a blocked or corrupt store', () => {
  const blocked = { getItem() { throw new Error('blocked') }, setItem() { throw new Error('blocked') } } as unknown as Storage
  assert.equal(loadUsual(blocked), null); assert.doesNotThrow(() => saveCard({ stamps: 1, free: 0 }, blocked))
  assert.deepEqual(loadCard(blocked), { stamps: 0, free: 0 })
  const corrupt = { getItem: () => '{nope', setItem() {} } as unknown as Storage
  assert.equal(loadUsual(corrupt), null)
})

test('the usual and the card round-trip through a working store', () => {
  const store = memoryStore()
  saveUsual(usual, store); saveCard({ stamps: 4, free: 1 }, store)
  assert.deepEqual(loadUsual(store), usual)
  assert.deepEqual(loadCard(store), { stamps: 4, free: 1 })
})

test('saved data with the wrong shape is ignored', () => {
  const store = memoryStore()
  for (const bad of [{ ...usual, drinkId: 'flat-white' }, { ...usual, drinkId: 'cortado', size: '16oz' }, { ...usual, sugar: 30 }, { ...usual, name: '   ' }, { ...usual, iced: 'yes' }, [usual], 'latte', 42]) {
    store.setItem('usual:usual', JSON.stringify(bad))
    assert.equal(loadUsual(store), null, JSON.stringify(bad))
  }
  for (const bad of [{ stamps: 12, free: 0 }, { stamps: -1, free: 0 }, { stamps: 2.5, free: 0 }, { stamps: 2 }, null]) {
    store.setItem('usual:card', JSON.stringify(bad))
    assert.deepEqual(loadCard(store), { stamps: 0, free: 0 }, JSON.stringify(bad))
  }
})

test('canRemember says whether saving will last', () => {
  const blocked = { getItem() { throw new Error('blocked') }, setItem() { throw new Error('blocked') }, removeItem() {} } as unknown as Storage
  assert.equal(canRemember(memoryStore()), true)
  assert.equal(canRemember(blocked), false)
  assert.equal(canRemember(null), false)
})

test('no store at all means nothing is remembered and nothing breaks', () => {
  assert.equal(loadUsual(null), null)
  assert.deepEqual(loadCard(null), { stamps: 0, free: 0 })
  assert.doesNotThrow(() => { saveUsual(usual, null); saveCard({ stamps: 1, free: 0 }, null) })
})
