import { after, test } from 'node:test'
import assert from 'node:assert/strict'
import { MORNING, NIGHT, closeAll, loadPage } from '../../tests/harness.ts'
import type { PageOptions } from '../../tests/harness.ts'

after(closeAll)

function start(file: string, options: PageOptions = {}) {
  const p = loadPage(file, options)
  assert.deepEqual(p.boot(), [], 'starts without errors')
  return p
}

const slots = (p: ReturnType<typeof start>) => p.$$('[data-stamp-card] .stamp-slot')
const earned = (p: ReturnType<typeof start>) => slots(p).map((slot) => slot.hasAttribute('data-earned'))

test('Home’s stamp card with nothing saved is ten empty rings, "0 of 9 stamps" and the invitation', () => {
  const p = start('index.html')
  assert.equal(slots(p).length, 10)
  assert.equal(earned(p).some(Boolean), false)
  assert.equal(p.text('[data-stamp-progress]'), '0 of 9 stamps')
  assert.equal(p.text('[data-stamp-note]'), 'No stamps yet. Your first drink ordered ahead adds one.')
  assert.equal(p.$$('[data-stamp-card] .stamp-slot--landed').length, 0)
})

test('Home’s stamp card shows the saved stamps, and with motion allowed they land one after another', () => {
  const p = start('index.html', { storage: { 'usual:card': { stamps: 4, free: 0 } }, reducedMotion: false })
  assert.deepEqual(earned(p), [true, true, true, true, false, false, false, false, false, false])
  assert.equal(p.text('[data-stamp-progress]'), '4 of 9 stamps')
  assert.equal(p.text('[data-stamp-note]'), '5 more stamps to a free drink.')
  const landed = p.$$('[data-stamp-card] .stamp-slot--landed')
  assert.equal(landed.length, 4)
  assert.deepEqual(landed.map((slot) => slot.style.getPropertyValue('--stamp-delay')), ['760ms', '840ms', '920ms', '1000ms'])
})

test('with reduced motion the stamps are simply there', () => {
  const p = start('index.html', { storage: { 'usual:card': { stamps: 4, free: 0 } } })
  assert.equal(earned(p).filter(Boolean).length, 4)
  assert.equal(p.$$('[data-stamp-card] .stamp-slot--landed').length, 0)
})

test('a free drink lights the dashed Free slot and says so', () => {
  const p = start('index.html', { storage: { 'usual:card': { stamps: 2, free: 1 } } })
  assert.equal(slots(p)[9].hasAttribute('data-earned'), true)
  assert.equal(p.text('[data-stamp-progress]'), 'A free drink is waiting')
  assert.match(p.text('[data-stamp-note]'), /Use my free drink/)
})

test('a card in the browser’s storage that is not a card reads as empty', () => {
  const p = start('index.html', { storage: { 'usual:card': { stamps: 40, free: -1 } } })
  assert.equal(p.text('[data-stamp-progress]'), '0 of 9 stamps')
})

test('an order placed in another tab updates every stamp card on the page, and a later order starts from it', () => {
  const p = start('rewards/index.html', { storage: { 'usual:card': { stamps: 1, free: 0 } } })
  assert.equal(p.text('[data-stamp-progress]'), '1 of 9 stamps')
  p.otherTabSaves('usual:card', { stamps: 6, free: 0 })
  assert.equal(p.text('[data-stamp-progress]'), '6 of 9 stamps')
  assert.equal(earned(p).filter(Boolean).length, 6)
  p.otherTabSaves('usual:card', { stamps: 0, free: 1 })
  assert.equal(p.text('[data-stamp-progress]'), 'A free drink is waiting')
  p.window.dispatchEvent(new p.window.StorageEvent('storage', { key: 'usual:bag' }))
  assert.equal(p.text('[data-stamp-progress]'), 'A free drink is waiting', 'another key changes nothing')
})

test('the note under Home’s card opens the About this site dialog and focus comes back; so do the store buttons', () => {
  const p = start('index.html')
  const dialog = p.$<HTMLDialogElement>('#concept-dialog')
  const note = p.$<HTMLButtonElement>('[data-stamp-card] [data-concept]')
  note.focus()
  note.click()
  assert.equal(dialog.open, true)
  p.key('Escape')
  assert.equal(p.document.activeElement, note)
  const store = p.$$<HTMLButtonElement>('#app [data-concept]')
  assert.equal(store.length, 2)
  store[1].focus()
  store[1].click()
  assert.equal(dialog.open, true)
  p.$<HTMLButtonElement>('[data-concept-close]').click()
  assert.equal(p.document.activeElement, store[1])
})

test('Home’s pickup list gives each branch’s status and earliest pickup, in Cebu time', () => {
  const day = start('index.html', { now: MORNING })
  assert.equal(day.text('#branches [data-branch-status="banilad"]'), 'Open now, until 10:00 PM')
  assert.equal(day.text('#branches [data-branch-pickup="banilad"]'), 'Earliest pickup 10:10 AM')
  assert.equal(day.text('#branches [data-branch-status="it-park"]'), 'Open now')
  assert.equal(day.text('#branches [data-branch-pickup="it-park"]'), 'Earliest pickup 10:10 AM')
  const night = start('index.html', { now: NIGHT })
  assert.equal(night.text('#branches [data-branch-status="capitol"]'), 'Closed, opens 7:00 AM')
  assert.equal(night.text('#branches [data-branch-pickup="capitol"]'), '', 'closed: no pickup line')
  assert.equal(night.text('#branches [data-branch-pickup="it-park"]'), 'Earliest pickup 11:10 PM')
  const last = start('index.html', { now: '2026-11-19T21:50:00+08:00' })
  assert.equal(last.text('#branches [data-branch-pickup="banilad"]'), 'Last pickup was 9:45 PM')
})

test('Home keeps the pickup list’s wide name column on one line', () => {
  const p = start('index.html')
  const row = p.$('#branches ul li')
  assert.match(row.className, /sm:grid-cols-\[13rem_minmax\(0,1fr\)\]/)
  assert.ok(p.$$('#branches li p.whitespace-nowrap').length === 3)
})

test('Home is built from the sections it is meant to have, and none of the old template', () => {
  const p = start('index.html')
  assert.deepEqual(p.$$('main > section').map((s) => s.getAttribute('aria-labelledby')), ['hero-title', 'menu-title', 'promo-title', 'branches-title', 'app-title'])
  assert.equal(p.$$('[data-sheet-drink], [data-sheet-bite]').length, 7, 'three cards, three bites and the Tablea band open the sheet')
})

test('Branches says open or closed and how busy it usually is at this hour, and the note stops being hidden', () => {
  const p = start('branches/index.html', { now: MORNING })
  assert.equal(p.$('[data-branch-note]').classList.contains('invisible'), false)
  const status = (id: string) => p.text(`[data-branch="${id}"] [data-branch-now]`)
  assert.equal(status('banilad'), 'Open now, until 10:00 PMUsually calm around 10 AM')
  assert.equal(status('it-park'), 'Open nowUsually calm around 10 AM')
  const night = start('branches/index.html', { now: NIGHT })
  assert.equal(night.text('[data-branch="banilad"] [data-branch-now]'), 'Closed, opens 7:00 AM', 'closed: no busy line')
  assert.equal(night.text('[data-branch="it-park"] [data-branch-now]'), 'Open nowUsually busy around 11 PM')
})

test('Contact: it names what is wrong, focuses the first problem, and then thanks the sender and lets them write again', () => {
  const p = start('contact/index.html')
  const form = p.$<HTMLFormElement>('[data-contact-form]')
  const send = () => p.$<HTMLButtonElement>('[data-contact-form] button[type="submit"]').click()
  send()
  assert.equal(p.text('#contact-name-error'), 'Add your first name.')
  assert.equal(p.text('#contact-message-error'), 'Write your message.')
  assert.equal(p.document.activeElement, p.$('#contact-name'))
  p.type('#contact-name', 'Lea')
  p.type('#contact-reach', 'lea@example.com')
  p.type('#contact-message', 'Do you have oat milk?')
  send()
  assert.equal(form.hidden, true)
  assert.equal(p.text('[data-contact-done-title]'), 'Thanks, Lea')
  assert.equal(p.document.activeElement, p.$('[data-contact-done]'))
  p.$<HTMLButtonElement>('[data-contact-again]').click()
  assert.equal(form.hidden, false)
  assert.equal(p.$<HTMLInputElement>('#contact-name').value, '')
  assert.equal(p.document.activeElement, p.$('#contact-name'))
})

test('scroll reveals: with reduced motion every section is shown; otherwise only the ones already in view', () => {
  const reduced = start('about/index.html')
  const sections = reduced.$$('main > section, main > article')
  assert.ok(sections.length > 0)
  assert.ok(sections.every((s) => s.hasAttribute('data-revealed')))
  assert.equal(reduced.document.documentElement.classList.contains('js'), true)
  const moving = start('about/index.html', { reducedMotion: false })
  const all = moving.$$('main > section, main > article')
  assert.ok(all.every((s) => s.hasAttribute('data-reveal')))
  assert.ok(all.some((s) => s.hasAttribute('data-revealed')), 'the first screen is shown as it is (jsdom puts every box at the top)')
})

test('the 404 page starts without errors and its links keep the base path', () => {
  const p = loadPage('404.html')
  assert.deepEqual(p.boot(), [])
  assert.ok(p.$$<HTMLAnchorElement>('main a').every((a) => !a.getAttribute('href')!.startsWith('/usual') || a.getAttribute('href')!.startsWith('/usual/')))
})
