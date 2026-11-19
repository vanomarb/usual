import test from 'node:test'
import assert from 'node:assert/strict'
import { addStamp, cardWords, redeem, settleOrder } from './rewards.ts'

test('the 9th stamp earns a free drink', () => {
  assert.deepEqual(addStamp({ stamps: 7, free: 0 }), { stamps: 8, free: 0 })
  assert.deepEqual(addStamp({ stamps: 8, free: 0 }), { stamps: 0, free: 1 })
  assert.deepEqual(redeem({ stamps: 2, free: 1 }), { stamps: 2, free: 0 })
})

test('redeeming with no free drink changes nothing', () => {
  assert.deepEqual(redeem({ stamps: 4, free: 0 }), { stamps: 4, free: 0 })
})

test('stamping and redeeming return new cards', () => {
  const card = { stamps: 3, free: 1 }
  addStamp(card); redeem(card)
  assert.deepEqual(card, { stamps: 3, free: 1 })
})

test('a bites-only order earns no stamp and says nothing about a free drink', () => {
  const result = settleOrder({ stamps: 0, free: 0 }, { drinks: 0, usedFree: false })
  assert.deepEqual(result.card, { stamps: 0, free: 0 })
  assert.equal(result.stamps, 0)
  assert.equal(result.note, 'no-drinks')
  assert.equal(result.earnedFree, false)
})

test('a bites-only order leaves a free drink on the card alone', () => {
  const result = settleOrder({ stamps: 3, free: 1 }, { drinks: 0, usedFree: false })
  assert.deepEqual(result.card, { stamps: 3, free: 1 })
  assert.equal(result.note, 'no-drinks')
})

test('one drink paid with the free drink earns no stamp, and the note says so', () => {
  const result = settleOrder({ stamps: 2, free: 1 }, { drinks: 1, usedFree: true })
  assert.deepEqual(result.card, { stamps: 2, free: 0 })
  assert.equal(result.stamps, 0)
  assert.equal(result.note, 'free-only')
})

test('a free drink covers one of several drinks; the rest earn stamps', () => {
  const result = settleOrder({ stamps: 2, free: 1 }, { drinks: 3, usedFree: true })
  assert.deepEqual(result.card, { stamps: 4, free: 0 })
  assert.equal(result.stamps, 2)
  assert.equal(result.note, 'stamps')
})

test('ten drinks fill a card and earn the next free drink', () => {
  const result = settleOrder({ stamps: 0, free: 0 }, { drinks: 10, usedFree: false })
  assert.equal(result.stamps, 10)
  assert.deepEqual(result.card, { stamps: 1, free: 1 })
  assert.equal(result.earnedFree, true)
})

test('using a free drink and filling a card in one order still reports the new free drink', () => {
  const result = settleOrder({ stamps: 8, free: 1 }, { drinks: 2, usedFree: true })
  assert.deepEqual(result.card, { stamps: 0, free: 1 })
  assert.equal(result.earnedFree, true)
})

test('the card says how far it is to the free drink', () => {
  assert.deepEqual(cardWords({ stamps: 0, free: 0 }), { progress: '0 of 9 stamps', note: 'No stamps yet. Your first drink ordered ahead adds one.' })
  assert.deepEqual(cardWords({ stamps: 4, free: 0 }), { progress: '4 of 9 stamps', note: '5 more stamps to a free drink.' })
  assert.deepEqual(cardWords({ stamps: 8, free: 0 }), { progress: '8 of 9 stamps', note: 'One more stamp to a free drink.' })
  assert.equal(cardWords({ stamps: 2, free: 1 }).progress, 'A free drink is waiting')
  assert.equal(cardWords({ stamps: 0, free: 3 }).progress, '3 free drinks waiting')
  assert.match(cardWords({ stamps: 2, free: 1 }).note, /Use my free drink/)
})
