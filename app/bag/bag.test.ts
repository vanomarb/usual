import { after, test } from 'node:test'
import assert from 'node:assert/strict'
import { closeAll, loadPage } from '../../tests/harness.ts'
import type { Page, PageOptions } from '../../tests/harness.ts'
import { addToBag, bagTotals } from '../lib/cart.ts'
import type { Bag, BagItem } from '../lib/cart.ts'
import { menuChoice } from '../lib/order.ts'
import { peso } from '../lib/format.ts'

after(closeAll)

const latte: BagItem = { kind: 'drink', choice: { ...menuChoice('spanish-latte'), size: '16oz' } }
const bread: BagItem = { kind: 'bite', biteId: 'banana-bread' }
const make = (...lines: [BagItem, number][]): Bag => lines.reduce<Bag>((bag, [item, qty]) => addToBag(bag, item, qty), [])
const unit = (item: BagItem) => bagTotals(make([item, 1])).total

function start(bag: Bag, options: PageOptions = {}) {
  const p = loadPage('bag/index.html', { ...options, storage: { 'usual:bag': bag, ...options.storage } })
  assert.deepEqual(p.boot(), [], 'starts without errors')
  return p
}

const rows = (p: Page) => p.$$('[data-bag-lines] > *')
const place = (p: Page) => p.$<HTMLButtonElement>('button[type="submit"][form="checkout-form"]').click()
const firstSlot = (p: Page) => p.$$<HTMLInputElement>('input[name="slot"]')[0]

test('an empty bag says so, and the checkout stays out of the way', () => {
  const p = start([])
  assert.equal(p.$('[data-bag-empty]').hidden, false)
  assert.equal(p.$('[data-bag-full]').hidden, true)
})

test('each line shows its photo, name, details, note, quantity and total; the summary adds them up', () => {
  const p = start(make([{ ...latte, note: 'less ice' }, 2], [bread, 1]))
  assert.equal(p.$('[data-bag-full]').hidden, false)
  const [first, second] = rows(p)
  assert.equal(first.querySelector('[data-line-name]')!.textContent, 'Spanish latte')
  assert.match(first.querySelector('[data-line-details]')!.textContent!, /^16 oz, /)
  const note = first.querySelector<HTMLElement>('[data-line-note]')!
  assert.equal(note.textContent, 'Note: less ice')
  assert.equal(note.hidden, false)
  const photo = first.querySelector<HTMLImageElement>('[data-line-photo]')!
  assert.match(photo.src, /\/usual\/photos\/menu-spanish-latte-160\.webp$/)
  assert.match(photo.srcset, /menu-spanish-latte-320\.webp 320w/)
  assert.equal(first.querySelector('[data-qty]')!.textContent, '2')
  assert.equal(first.querySelector('[data-line-total]')!.textContent, peso(unit(latte) * 2))
  assert.equal(second.querySelector('[data-line-name]')!.textContent, 'Banana bread')
  assert.equal(second.querySelector('[data-line-details]')!.textContent, 'Baked this morning')
  assert.equal(second.querySelector<HTMLElement>('[data-line-note]')!.hidden, true, 'no note, no note line')
  assert.match(second.querySelector<HTMLImageElement>('[data-line-photo]')!.src, /menu-banana-bread-160\.webp$/)
  assert.equal(p.text('[data-bag-count-label]'), '3 items')
  assert.equal(p.text('[data-bag-total]'), peso(unit(latte) * 2 + unit(bread)))
})

test('the plus and minus buttons change a quantity, say so, keep focus, and stop at 10', () => {
  const p = start(make([bread, 1]))
  const plus = () => p.$<HTMLButtonElement>('[data-role="plus"]')
  const minus = () => p.$<HTMLButtonElement>('[data-role="minus"]')
  assert.equal(minus().disabled, true)
  plus().focus()
  plus().click()
  assert.equal(p.text('[data-qty]'), '2')
  assert.equal(p.text('[data-bag-live]'), 'Banana bread: 2 in your bag.')
  assert.equal(p.document.activeElement, plus(), 'focus stays on the button after the list redraws')
  assert.equal(p.text('[data-bag-total]'), peso(unit(bread) * 2))
  assert.equal(plus().getAttribute('aria-label'), 'One more Banana bread')
  for (let i = 0; i < 8; i++) plus().click()
  assert.equal(p.text('[data-qty]'), '10')
  assert.equal(plus().disabled, true)
  assert.equal((p.storage('usual:bag') as { qty: number }[])[0].qty, 10, 'the bag is saved')
})

test('removing a line says so and moves focus to the next line; removing the last one shows the empty bag', () => {
  const p = start(make([latte, 1], [bread, 1]))
  p.$<HTMLButtonElement>('[data-role="remove"]').click()
  assert.equal(p.text('[data-bag-live]'), 'Spanish latte removed from your bag.')
  assert.equal(rows(p).length, 1)
  const target = p.document.activeElement as HTMLElement
  assert.ok(rows(p)[0].contains(target), 'focus is on the remaining line')
  p.$<HTMLButtonElement>('[data-role="remove"]').click()
  assert.equal(p.$('[data-bag-empty]').hidden, false)
  assert.equal(p.document.activeElement, p.$('#bag-title'))
})

test('with a drink in the bag the name is for the cups; with bites only it is "Name for the order"', () => {
  const drinks = start(make([latte, 1]))
  assert.equal(drinks.text('[data-name-label]'), 'Name for the cups')
  assert.equal(drinks.text('[data-name-help]'), 'Up to 16 characters, so it fits on the sleeve.')
  const bites = start(make([bread, 2]))
  assert.equal(bites.text('[data-name-label]'), 'Name for the order')
  assert.equal(bites.text('[data-name-help]'), 'Up to 16 characters.')
  // Removing the only drink changes the label on the same page.
  const mixed = start(make([latte, 1], [bread, 1]))
  mixed.$$<HTMLButtonElement>('[data-role="remove"]')[0].click()
  assert.equal(mixed.text('[data-name-label]'), 'Name for the order')
})

test('the name starts as the signed-in first name, cut to the 16 the sleeve holds', () => {
  const p = start(make([latte, 1]), { storage: { 'usual:account': { firstName: 'Maximiliana-Alexandra', contact: 'a@example.com' } } })
  assert.equal(p.$<HTMLInputElement>('#bag-name').value, 'Maximiliana-Alex')
})

test('a free drink offered on the card takes off the dearest drink, and shows in the totals', () => {
  const p = start(make([latte, 1], [bread, 1]), { storage: { 'usual:card': { stamps: 3, free: 1 } } })
  const box = p.$('[data-bag-free]')
  assert.equal(box.hidden, false)
  const total = unit(latte) + unit(bread)
  assert.equal(p.$('[data-bag-discount-row]').hidden, true)
  p.$<HTMLInputElement>('[data-bag-free] input').click()
  assert.equal(p.$('[data-bag-discount-row]').hidden, false)
  assert.equal(p.text('[data-bag-discount]'), `−${peso(unit(latte))}`)
  assert.equal(p.text('[data-bag-total]'), peso(total - unit(latte)))
  p.$<HTMLInputElement>('[data-bag-free] input').click()
  assert.equal(p.text('[data-bag-total]'), peso(total))
})

test('no free drink is offered without one on the card, or with bites only', () => {
  assert.equal(start(make([latte, 1])).$('[data-bag-free]').hidden, true)
  assert.equal(start(make([bread, 1]), { storage: { 'usual:card': { stamps: 0, free: 1 } } }).$('[data-bag-free]').hidden, true)
})

test('a free drink earned in another tab is offered without a reload', () => {
  const p = start(make([latte, 1]))
  assert.equal(p.$('[data-bag-free]').hidden, true)
  p.otherTabSaves('usual:card', { stamps: 0, free: 1 })
  assert.equal(p.$('[data-bag-free]').hidden, false)
})

test('placing an order with drinks writes the confirmation, a stamp per drink, clears the bag and focuses the confirmation', () => {
  const p = start(make([latte, 2], [bread, 1]), { storage: { 'usual:card': { stamps: 1, free: 0 } } })
  firstSlot(p).click()
  p.type('#bag-name', 'Lea')
  place(p)
  const done = p.$('[data-bag-done]')
  assert.equal(done.hidden, false)
  assert.equal(p.document.activeElement, done)
  assert.equal(p.$('[data-bag-full]').hidden, true)
  assert.equal(p.text('[data-done-title]'), 'Order for Lea')
  assert.equal(p.text('[data-done-time]'), '10:10 AM')
  assert.equal(p.text('[data-done-branch]'), 'at IT Park')
  assert.deepEqual(p.$$('[data-done-lines] li').map((li) => li.firstElementChild!.textContent), ['2 × Spanish latte', '1 × Banana bread'])
  assert.equal(p.text('[data-done-total]'), peso(unit(latte) * 2 + unit(bread)))
  assert.equal(p.text('[data-done-payment]'), 'Payment: GCash. Nothing was charged.')
  assert.equal(p.text('[data-done-stamps]'), '2 stamps added. 3 of 9 on your card.')
  assert.deepEqual(p.storage('usual:card'), { stamps: 3, free: 0 })
  assert.deepEqual(p.storage('usual:bag'), [])
  assert.match(p.text('[data-bag-live]'), /^Order placed\. Ready 10:10 AM at IT Park\./)
})

test('an order of bites only earns no stamp and says so', () => {
  const p = start(make([bread, 2]))
  firstSlot(p).click()
  p.type('#bag-name', 'Lea')
  place(p)
  assert.equal(p.text('[data-done-stamps]'), 'Bites don’t earn stamps.')
  assert.deepEqual(p.storage('usual:card'), { stamps: 0, free: 0 })
})

test('a free drink that covers the only drink earns no stamp; ten stamps in one order fill a card', () => {
  const free = start(make([latte, 1]), { storage: { 'usual:card': { stamps: 4, free: 1 } } })
  free.$<HTMLInputElement>('[data-bag-free] input').click()
  firstSlot(free).click()
  free.type('#bag-name', 'Lea')
  place(free)
  assert.match(free.text('[data-done-stamps]'), /^Your free drink covered the drink in this order/)
  assert.deepEqual(free.storage('usual:card'), { stamps: 4, free: 0 })
  assert.equal(free.text('[data-done-total]'), peso(0))

  const full = start(make([latte, 5]), { storage: { 'usual:card': { stamps: 4, free: 0 } } })
  firstSlot(full).click()
  full.type('#bag-name', 'Lea')
  place(full)
  assert.match(full.text('[data-done-stamps]'), /You filled a card, so your next drink is free\.$/)
  assert.deepEqual(full.storage('usual:card'), { stamps: 0, free: 1 })
})

test('the order uses the card as another tab left it, not as this page loaded it', () => {
  const p = start(make([latte, 1]), { storage: { 'usual:card': { stamps: 1, free: 0 } } })
  firstSlot(p).click()
  p.type('#bag-name', 'Lea')
  p.window.localStorage.setItem('usual:card', JSON.stringify({ stamps: 5, free: 0 }))
  place(p)
  assert.deepEqual(p.storage('usual:card'), { stamps: 6, free: 0 })
})

test('submitting without a pickup time or a name says what is missing and moves focus there', () => {
  const p = start(make([latte, 1]))
  place(p)
  assert.equal(p.text('[data-slot-error]'), 'Pick a pickup time.')
  assert.equal(p.document.activeElement, firstSlot(p))
  assert.equal(p.$('[data-bag-done]').hidden, true)
  firstSlot(p).click()
  assert.equal(p.text('[data-slot-error]'), '', 'picking a time clears the message')
  place(p)
  assert.equal(p.$('#bag-name-error').hidden, false)
  assert.equal(p.$('#bag-name').getAttribute('aria-invalid'), 'true')
  assert.equal(p.document.activeElement, p.$('#bag-name'))
  p.type('#bag-name', 'A name that is far too long')
  assert.match(p.text('#bag-name-error'), /16/)
  p.type('#bag-name', 'Lea')
  assert.equal(p.$('#bag-name-error').hidden, true)
})

test('payment and branch choices carry into the confirmation; a closed branch offers no times and says when it opens', () => {
  // Ten to midnight: Banilad is closed, and IT Park's times run past midnight.
  const p = start(make([latte, 1]), { now: '2026-11-19T23:50:00+08:00' })
  assert.match(p.text('[data-branch-picks]'), /Banilad.*Closed, opens 7:00 AM/)
  p.$<HTMLInputElement>('input[name="branch"][value="banilad"]').click()
  assert.equal(p.$$('input[name="slot"]').length, 0)
  assert.equal(p.$('[data-slot-note]').hidden, false)
  assert.equal(p.text('[data-slot-note]'), 'Banilad is closed right now and opens at 7:00 AM. IT Park is open all night.')
  assert.equal(p.$('[data-slot-hint]').hidden, true)
  p.$<HTMLInputElement>('input[name="branch"][value="it-park"]').click()
  assert.equal(p.$('[data-slot-note]').hidden, true)
  assert.ok(p.$$('input[name="slot"]').length > 0)
  const slot = p.$$<HTMLInputElement>('input[name="slot"]').find((input) => Number(input.value) >= 1440)
  assert.ok(slot, 'IT Park offers times past midnight')
  slot.click()
  p.$<HTMLInputElement>('input[name="payment"][value="maya"]').click()
  p.type('#bag-name', 'Lea')
  place(p)
  assert.equal(p.text('[data-done-label]'), 'Ready tomorrow')
  assert.equal(p.text('[data-done-payment]'), 'Payment: Maya. Nothing was charged.')
})
