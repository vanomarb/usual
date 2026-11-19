import test from 'node:test'
import assert from 'node:assert/strict'
import { peso } from './format.ts'

test('peso formats without decimals', () => {
  assert.equal(peso(85), '₱85'); assert.equal(peso(1290), '₱1,290'); assert.equal(peso(45000), '₱45,000')
})
