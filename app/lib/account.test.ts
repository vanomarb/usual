import test from 'node:test'
import assert from 'node:assert/strict'
import { clearSession, codeMatches, demoCode, loadSession, parseContact, saveSession, validFirstName } from './account.ts'

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

const blocked = {
  getItem() { throw new Error('blocked') },
  setItem() { throw new Error('blocked') },
  removeItem() { throw new Error('blocked') },
} as unknown as Storage

test('an email address or a Philippine mobile number is a contact', () => {
  assert.deepEqual(parseContact('  Lea@Example.com '), { kind: 'email', value: 'lea@example.com' })
  assert.deepEqual(parseContact('0917 123 4567'), { kind: 'mobile', value: '+63 917 123 4567' })
  assert.deepEqual(parseContact('+63-917-123-4567'), { kind: 'mobile', value: '+63 917 123 4567' })
  assert.deepEqual(parseContact('639171234567'), { kind: 'mobile', value: '+63 917 123 4567' })
  for (const bad of ['', 'lea', 'lea@', '@example.com', 'lea@example', '0917 123', '0817 123 4567', '+1 415 555 0100', '09171234567890']) {
    assert.equal(parseContact(bad), null, bad)
  }
})

test('a contact can be held to the kind the visitor picked', () => {
  assert.deepEqual(parseContact('lea@example.com', 'email'), { kind: 'email', value: 'lea@example.com' })
  assert.equal(parseContact('lea@example.com', 'mobile'), null)
  assert.deepEqual(parseContact('0917 123 4567', 'mobile'), { kind: 'mobile', value: '+63 917 123 4567' })
  assert.equal(parseContact('0917 123 4567', 'email'), null)
})

test('a first name is needed and kept short', () => {
  assert.equal(validFirstName('Lea'), null)
  assert.equal(validFirstName(' María José '), null)
  assert.match(validFirstName('   ') ?? '', /first name/)
  assert.match(validFirstName('A'.repeat(25)) ?? '', /24/)
})

test('the demo code is four digits and matches with spaces around it', () => {
  assert.equal(demoCode(() => 0), '1000')
  assert.equal(demoCode(() => 0.99999), '9999')
  assert.match(demoCode(), /^\d{4}$/)
  assert.equal(codeMatches(' 48 21 ', '4821'), true)
  assert.equal(codeMatches('4812', '4821'), false)
  assert.equal(codeMatches('', '4821'), false)
})

test('a session round-trips, is cleared on sign out, and ignores a bad shape', () => {
  const store = memoryStore()
  assert.equal(loadSession(store), null)
  saveSession({ firstName: 'Lea', contact: 'lea@example.com' }, store)
  assert.deepEqual(loadSession(store), { firstName: 'Lea', contact: 'lea@example.com' })
  clearSession(store)
  assert.equal(loadSession(store), null)
  for (const bad of [{ firstName: '', contact: 'lea@example.com' }, { firstName: 'Lea' }, { firstName: 'Lea', contact: 'nope' }, ['Lea'], 'Lea']) {
    store.setItem('usual:account', JSON.stringify(bad))
    assert.equal(loadSession(store), null, JSON.stringify(bad))
  }
})

test('blocked storage signs nobody in and never throws', () => {
  assert.equal(loadSession(blocked), null)
  assert.doesNotThrow(() => saveSession({ firstName: 'Lea', contact: 'lea@example.com' }, blocked))
  assert.doesNotThrow(() => clearSession(blocked))
  assert.equal(loadSession(null), null)
})
