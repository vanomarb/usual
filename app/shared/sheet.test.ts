import { after, test } from 'node:test'
import assert from 'node:assert/strict'
import { closeAll, loadPage } from '../../tests/harness.ts'
import type { Page } from '../../tests/harness.ts'
import { ADDONS, drinkById } from '../lib/menu.ts'
import { menuChoice, priceOf } from '../lib/order.ts'
import { peso } from '../lib/format.ts'

after(closeAll)

function start(file = 'menu/index.html', storage: Record<string, unknown> = {}) {
  const p = loadPage(file, { storage })
  assert.deepEqual(p.boot(), [], 'starts without errors')
  const dialog = p.$<HTMLDialogElement>('#item-sheet')
  return { p, dialog }
}

const addLabel = (p: Page) => p.text('[data-sheet-add]')
const radio = (p: Page, name: string, value: string) => p.$<HTMLInputElement>(`#item-sheet input[name="${name}"][value="${value}"]`)
const pick = (p: Page, name: string, value: string) => radio(p, name, value).click()
const groupTitles = (p: Page) => p.$$('#item-sheet .opt-group__title').map((el) => el.textContent)
const priceFor = (drinkId: string, change: Partial<ReturnType<typeof menuChoice>> = {}) => peso(priceOf({ ...menuChoice(drinkId), ...change, name: '' }))

test('a menu row opens the sheet on that drink: focus on its name, its menu way picked, the price on the button', () => {
  const { p, dialog } = start()
  const row = p.$<HTMLButtonElement>('[data-sheet-drink="spanish-latte"]')
  row.focus()
  row.click()
  assert.equal(dialog.open, true)
  assert.equal(p.document.activeElement, p.$('[data-sheet-name]'), 'focus starts on the item name')
  assert.equal(p.text('[data-sheet-name]'), 'Spanish latte')
  assert.equal(p.text('[data-sheet-desc]'), 'Espresso, fresh milk and a spoon of condensed milk.')
  assert.match(p.text('[data-sheet-price]'), /^From ₱\d+/)
  assert.deepEqual(groupTitles(p), ['Size', 'Hot or iced', 'Milk', 'Sugar', 'Extras', 'Note for the barista'])
  const way = menuChoice('spanish-latte')
  assert.equal(radio(p, 'size', way.size).checked, true)
  assert.equal(radio(p, 'milk', way.milk).checked, true)
  assert.equal(radio(p, 'sugar', String(way.sugar)).checked, true)
  assert.equal(radio(p, 'iced', way.iced ? 'iced' : 'hot').checked, true)
  assert.equal(addLabel(p), `Add 1 to bag · ${priceFor('spanish-latte')}`)
  assert.match(p.$<HTMLImageElement>('[data-sheet-photo]').src, /\/usual\/photos\/item-spanish-latte-640\.webp$/)
})

test('Escape closes the sheet and focus goes back to the row that opened it; so do Close and the scrim', () => {
  const { p, dialog } = start()
  const row = p.$<HTMLButtonElement>('[data-sheet-drink="americano"]')
  row.focus()
  row.click()
  p.key('Escape')
  assert.equal(dialog.open, false)
  assert.equal(p.document.activeElement, row)
  row.click()
  p.$<HTMLButtonElement>('[data-sheet-close]').click()
  assert.equal(dialog.open, false)
  assert.equal(p.document.activeElement, row)
  row.click()
  p.backdropClick(dialog)
  assert.equal(dialog.open, false)
  assert.equal(p.document.activeElement, row)
})

test('a drag that starts in the note and ends on the scrim does not close the sheet or lose the note', () => {
  const { p, dialog } = start()
  p.$<HTMLButtonElement>('[data-sheet-drink="americano"]').click()
  p.type('#sheet-note', 'extra hot')
  p.$('#sheet-note').dispatchEvent(new p.window.MouseEvent('pointerdown', { bubbles: true }))
  dialog.dispatchEvent(new p.window.MouseEvent('click', { bubbles: true }))
  assert.equal(dialog.open, true)
  assert.equal(p.$<HTMLTextAreaElement>('#sheet-note').value, 'extra hot')
})

test('a Home favourite card and the Tablea band both open the sheet', () => {
  const { p, dialog } = start('index.html')
  const card = p.$<HTMLButtonElement>('.fav-card[data-sheet-drink="ube-latte"]')
  card.focus()
  card.click()
  assert.equal(p.text('[data-sheet-name]'), 'Ube latte')
  p.key('Escape')
  assert.equal(p.document.activeElement, card)
  const band = p.$<HTMLButtonElement>('[data-promo] [data-sheet-drink="tablea"]')
  band.click()
  assert.equal(dialog.open, true)
  assert.equal(p.text('[data-sheet-name]'), 'Tablea hot chocolate')
  assert.equal(p.text('[data-sheet-desc]'), 'Cebu tablea melted into hot milk. Thick, and not too sweet.')
  p.key('Escape')
  assert.equal(p.document.activeElement, band)
})

test('a bite opens with no choices, its own note hint and its price', () => {
  const { p } = start('index.html')
  p.$<HTMLButtonElement>('[data-sheet-bite="ensaymada"]').click()
  assert.equal(p.text('[data-sheet-name]'), 'Ensaymada')
  assert.equal(p.text('[data-sheet-price]'), '₱85')
  assert.equal(p.$('[data-sheet-groups]').hidden, true)
  assert.equal(p.$<HTMLTextAreaElement>('#sheet-note').placeholder, 'Warm it up, or cut it in half')
  assert.equal(addLabel(p), 'Add 1 to bag · ₱85')
})

test('picking a size, a milk and extras changes the total on the button', () => {
  const { p } = start()
  p.$<HTMLButtonElement>('[data-sheet-drink="spanish-latte"]').click()
  const base = menuChoice('spanish-latte')
  pick(p, 'size', '16oz')
  assert.equal(addLabel(p), `Add 1 to bag · ${priceFor('spanish-latte', { size: '16oz' })}`)
  pick(p, 'milk', 'oat')
  assert.equal(addLabel(p), `Add 1 to bag · ${priceFor('spanish-latte', { size: '16oz', milk: 'oat' })}`)
  radio(p, 'extras', 'extraShot').click()
  radio(p, 'extras', 'syrup').click()
  const full = priceOf({ ...base, size: '16oz', milk: 'oat', extraShot: true, syrup: true, name: '' })
  assert.equal(addLabel(p), `Add 1 to bag · ${peso(full)}`)
  assert.equal(full, priceOf({ ...base, size: '16oz', milk: 'oat', name: '' }) + ADDONS.extraShot + ADDONS.syrup)
  radio(p, 'extras', 'syrup').click()
  assert.equal(addLabel(p), `Add 1 to bag · ${peso(full - ADDONS.syrup)}`)
})

test('the quantity multiplies the total, stops at 1 and 10 with aria-disabled, and keeps focus on the button', () => {
  const { p } = start()
  p.$<HTMLButtonElement>('[data-sheet-drink="spanish-latte"]').click()
  const unit = priceOf({ ...menuChoice('spanish-latte'), name: '' })
  const less = p.$<HTMLButtonElement>('[data-sheet-less]')
  const more = p.$<HTMLButtonElement>('[data-sheet-more]')
  assert.equal(less.getAttribute('aria-disabled'), 'true')
  assert.equal(more.getAttribute('aria-disabled'), 'false')
  less.focus()
  less.click()
  assert.equal(p.text('[data-sheet-qty]'), '1', 'one is the least')
  assert.equal(p.document.activeElement, less, 'focus stays on the button at the limit')
  more.focus()
  more.click()
  more.click()
  assert.equal(p.text('[data-sheet-qty]'), '3')
  assert.equal(addLabel(p), `Add 3 to bag · ${peso(unit * 3)}`)
  assert.equal(less.getAttribute('aria-disabled'), 'false')
  for (let i = 0; i < 12; i++) more.click()
  assert.equal(p.text('[data-sheet-qty]'), '10')
  assert.equal(more.getAttribute('aria-disabled'), 'true')
  assert.equal(p.document.activeElement, more, 'focus stays on the button at the limit')
  assert.equal(addLabel(p), `Add 10 to bag · ${peso(unit * 10)}`)
  assert.match(p.text('[data-sheet-live]'), /at most 10 of an item/)
})

test('a quantity change announces the new total once; repainting for another reason does not announce again', () => {
  const { p } = start()
  p.$<HTMLButtonElement>('[data-sheet-drink="spanish-latte"]').click()
  const live = p.$('[data-sheet-live]')
  assert.equal(live.textContent, '', 'nothing is said on opening')
  const unit = priceOf({ ...menuChoice('spanish-latte'), name: '' })
  p.$<HTMLButtonElement>('[data-sheet-more]').click()
  assert.equal(live.textContent, `2 in your order, ${peso(unit * 2)} in all.`)
  let changes = 0
  new p.window.MutationObserver(() => changes++).observe(live, { childList: true, characterData: true, subtree: true })
  pick(p, 'milk', 'soy')
  p.type('#sheet-note', 'less ice')
  assert.equal(live.textContent, `2 in your order, ${peso(unit * 2)} in all.`, 'unchanged by other repaints')
  assert.equal(changes, 0)
  // The quantity itself is not a second live region.
  assert.equal(p.$('[data-sheet-qty]').getAttribute('aria-live'), 'off')
})

test('the note counts down the characters left beside its rule, up to 140', () => {
  const { p } = start()
  p.$<HTMLButtonElement>('[data-sheet-drink="americano"]').click()
  assert.equal(p.text('#sheet-note-rule'), 'Optional, 140 left')
  p.type('#sheet-note', 'Less ice')
  assert.equal(p.text('#sheet-note-rule'), 'Optional, 132 left')
  p.type('#sheet-note', 'x'.repeat(140))
  assert.equal(p.text('#sheet-note-rule'), 'Optional, 0 left')
  assert.equal(p.$('#sheet-note').getAttribute('maxlength'), '140')
  assert.equal(p.$('#sheet-note').getAttribute('aria-describedby'), 'sheet-note-rule')
  // Opening again starts clean.
  p.key('Escape')
  p.$<HTMLButtonElement>('[data-sheet-drink="americano"]').click()
  assert.equal(p.text('#sheet-note-rule'), 'Optional, 140 left')
})

test('Enter on an option picks nothing extra and does not add the item', () => {
  const { p } = start()
  p.$<HTMLButtonElement>('[data-sheet-drink="spanish-latte"]').click()
  const size = radio(p, 'size', '16oz')
  size.focus()
  const enter = p.key('Enter', size)
  assert.equal(enter.defaultPrevented, true, 'the Enter is cancelled, so the form is not submitted')
  const tick = radio(p, 'extras', 'syrup')
  tick.focus()
  assert.equal(p.key('Enter', tick).defaultPrevented, true)
  assert.equal(p.$<HTMLDialogElement>('#item-sheet').open, true)
  assert.equal(p.storage('usual:bag'), null)
})

test('Add puts the item in the bag with the note, closes the sheet, says so, and returns focus to the row', () => {
  const { p, dialog } = start()
  const row = p.$<HTMLButtonElement>('[data-sheet-drink="spanish-latte"]')
  row.focus()
  row.click()
  pick(p, 'size', '16oz')
  p.$<HTMLButtonElement>('[data-sheet-more]').click()
  p.type('#sheet-note', '  less   ice ')
  p.$<HTMLButtonElement>('[data-sheet-add]').click()
  assert.equal(dialog.open, false)
  assert.equal(p.document.activeElement, row)
  const bag = p.storage('usual:bag') as { qty: number; item: { kind: string; note?: string; choice: { drinkId: string; size: string } } }[]
  assert.equal(bag.length, 1)
  assert.equal(bag[0].qty, 2)
  assert.equal(bag[0].item.note, 'less ice')
  assert.equal(bag[0].item.choice.drinkId, 'spanish-latte')
  assert.equal(bag[0].item.choice.size, '16oz')
  assert.match(p.text('[data-toast]'), /^Added 2 × Spanish latte, 16 oz.*View bag \(2\)$/)
  assert.equal(p.$('[data-toast] a').getAttribute('href'), '/usual/bag/')
  assert.equal(p.text('[data-bag-count]'), '2', 'the header bag count follows')
})

test('adding a bite writes a bite line, and the same item with a different note is its own line', () => {
  const { p } = start('index.html')
  const add = (note: string) => {
    p.$<HTMLButtonElement>('[data-sheet-bite="banana-bread"]').click()
    if (note) p.type('#sheet-note', note)
    p.$<HTMLButtonElement>('[data-sheet-add]').click()
  }
  add('')
  add('warm it up')
  add('')
  const bag = p.storage('usual:bag') as { qty: number; item: { kind: string; biteId: string; note?: string } }[]
  assert.deepEqual(bag.map((line) => [line.item.kind, line.item.biteId, line.item.note ?? '', line.qty]), [
    ['bite', 'banana-bread', '', 2],
    ['bite', 'banana-bread', 'warm it up', 1],
  ])
})

test('a bag that already holds nine of a drink takes one more of three, and the toast says so', () => {
  const choice = menuChoice('spanish-latte')
  const { p } = start('menu/index.html', {
    'usual:bag': [{ key: 'x', item: { kind: 'drink', choice }, qty: 9 }],
  })
  p.$<HTMLButtonElement>('[data-sheet-drink="spanish-latte"]').click()
  for (let i = 0; i < 2; i++) p.$<HTMLButtonElement>('[data-sheet-more]').click()
  p.$<HTMLButtonElement>('[data-sheet-add]').click()
  assert.match(p.text('[data-toast]'), /Your bag holds 10 at most, so 1 went in/)
  const bag = p.storage('usual:bag') as { qty: number }[]
  assert.equal(bag[0].qty, 10)
})

test('every drink the sheet offers opens with its prices consistent with the data', () => {
  const { p } = start()
  for (const id of ['americano', 'tablea', 'calamansi-soda']) {
    if (!drinkById(id)) continue
    p.$<HTMLButtonElement>(`[data-sheet-drink="${id}"]`).click()
    assert.equal(addLabel(p), `Add 1 to bag · ${priceFor(id)}`, id)
    p.key('Escape')
  }
})
