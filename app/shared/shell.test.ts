import { after, test } from 'node:test'
import assert from 'node:assert/strict'
import { MORNING, NIGHT, closeAll, loadPage } from '../../tests/harness.ts'
import type { PageOptions } from '../../tests/harness.ts'

after(closeAll)

function start(file = 'menu/index.html', options: PageOptions = {}) {
  const p = loadPage(file, options)
  assert.deepEqual(p.boot(), [], 'starts without errors')
  const button = p.$<HTMLButtonElement>('[data-menu-open]')
  const sheet = p.$<HTMLDialogElement>('#site-menu')
  return { p, button, sheet }
}

test('the phone menu opens as a sheet from the menu button, with focus inside, and Escape closes it and returns focus to the button', () => {
  const { p, button, sheet } = start()
  assert.equal(button.getAttribute('aria-controls'), 'site-menu')
  assert.equal(button.getAttribute('aria-expanded'), 'false')
  assert.equal(sheet.open, false)
  button.focus()
  button.click()
  assert.equal(sheet.open, true)
  assert.equal(button.getAttribute('aria-expanded'), 'true')
  assert.ok(sheet.contains(p.document.activeElement), 'focus moves into the sheet')
  p.key('Escape')
  assert.equal(sheet.open, false)
  assert.equal(button.getAttribute('aria-expanded'), 'false')
  assert.equal(p.document.activeElement, button, 'focus is back on the menu button')
})

test('the phone menu lists every page, the account row and Order ahead last, with the current page marked', () => {
  const { sheet } = start('rewards/index.html')
  const links = [...sheet.querySelectorAll('a')].map((a) => `${a.textContent?.trim()} ${a.getAttribute('href')}`)
  assert.deepEqual(links, [
    'Home /usual/', 'Menu /usual/menu/', 'Rewards /usual/rewards/', 'Branches /usual/branches/', 'About /usual/about/',
    'Contact /usual/contact/', 'Sign in /usual/account/', 'Order ahead /usual/order/',
  ])
  assert.deepEqual([...sheet.querySelectorAll('[aria-current="page"]')].map((a) => a.textContent?.trim()), ['Rewards'])
  assert.ok([...sheet.querySelectorAll('a')].pop()!.classList.contains('btn-primary'), 'Order ahead is the primary button')
})

test('the Close button closes the phone menu and hands focus back', () => {
  const { p, button, sheet } = start()
  button.click()
  const close = p.$<HTMLButtonElement>('[data-menu-close]')
  assert.equal(close.getAttribute('aria-label'), 'Close')
  close.click()
  assert.equal(sheet.open, false)
  assert.equal(p.document.activeElement, button)
})

test('a tap on the scrim closes the phone menu, but a drag that began inside the sheet does not', () => {
  const { p, button, sheet } = start()
  button.click()
  // Pressed inside the sheet, released on the scrim: the click lands on the dialog but didn't start there.
  p.$('#site-menu nav').dispatchEvent(new p.window.MouseEvent('pointerdown', { bubbles: true }))
  sheet.dispatchEvent(new p.window.MouseEvent('click', { bubbles: true }))
  assert.equal(sheet.open, true, 'still open')
  p.backdropClick(sheet)
  assert.equal(sheet.open, false)
  assert.equal(p.document.activeElement, button)
})

test('following a link in the phone menu closes it first', () => {
  const { p, button, sheet } = start()
  button.click()
  p.$<HTMLAnchorElement>('#site-menu a[href="/usual/branches/"]').click()
  assert.equal(sheet.open, false)
})

test('the phone menu closes when the window reaches the desktop layout', () => {
  const { p, button, sheet } = start()
  button.click()
  p.resize(1024)
  assert.equal(sheet.open, false)
  p.resize(390)
  assert.equal(sheet.open, false, 'and does not come back')
})

test('the menu button keeps the attributes that open the sheet without JavaScript', () => {
  const { button, sheet } = start()
  assert.equal(button.getAttribute('commandfor'), 'site-menu')
  assert.equal(button.getAttribute('command'), 'show-modal')
  assert.equal(sheet.getAttribute('closedby'), 'any')
  assert.equal(sheet.querySelector('[data-menu-close]')!.getAttribute('command'), 'close')
})

test('the header takes a hairline once the page scrolls', async () => {
  const { p } = start()
  const header = p.$('[data-header]')
  assert.equal(header.hasAttribute('data-scrolled'), false)
  Object.defineProperty(p.window, 'scrollY', { value: 120, configurable: true })
  p.window.dispatchEvent(new p.window.Event('scroll'))
  await p.wait(60)
  assert.equal(header.hasAttribute('data-scrolled'), true)
})

test('the About this site dialog opens from the footer, closes with Escape, Close and the scrim, and returns focus', () => {
  const { p } = start('about/index.html')
  const dialog = p.$<HTMLDialogElement>('#concept-dialog')
  const opener = p.$<HTMLButtonElement>('footer [data-concept]')
  opener.focus()
  opener.click()
  assert.equal(dialog.open, true)
  p.key('Escape')
  assert.equal(dialog.open, false)
  assert.equal(p.document.activeElement, opener)
  opener.click()
  p.$<HTMLButtonElement>('[data-concept-close]').click()
  assert.equal(dialog.open, false)
  assert.equal(p.document.activeElement, opener)
  opener.click()
  p.backdropClick(dialog)
  assert.equal(dialog.open, false)
})

test('the footer says which branches are open, in Cebu time', () => {
  const morning = start('about/index.html', { now: MORNING })
  assert.equal(morning.p.text('footer [data-branch-status="banilad"]'), 'Open now, until 10:00 PM')
  assert.equal(morning.p.text('footer [data-branch-status="it-park"]'), 'Open now')
  const night = start('about/index.html', { now: NIGHT })
  assert.equal(night.p.text('footer [data-branch-status="banilad"]'), 'Closed, opens 7:00 AM')
  assert.equal(night.p.text('footer [data-branch-status="capitol"]'), 'Closed, opens 7:00 AM')
  assert.equal(night.p.text('footer [data-branch-status="it-park"]'), 'Open now')
})

test('the header shows Sign in, or the signed-in first name and "Account: Name" in the phone menu', () => {
  const out = start()
  assert.deepEqual(out.p.$$('[data-account-label]').map((el) => el.textContent), ['Sign in', 'Sign in'])
  const signedIn = start('menu/index.html', { storage: { 'usual:account': { firstName: 'Lea', contact: 'lea@example.com' } } })
  assert.deepEqual(signedIn.p.$$('[data-account-label]').map((el) => el.textContent), ['Lea', 'Account: Lea'])
})

test('the bag button counts what is in the bag, and follows another tab', () => {
  const bag = [{ key: 'bite:ensaymada', item: { kind: 'bite', biteId: 'ensaymada' }, qty: 2 }]
  const { p } = start('menu/index.html', { storage: { 'usual:bag': bag } })
  const link = p.$('[data-bag-link]')
  assert.equal(p.text('[data-bag-count]'), '2')
  assert.equal(link.getAttribute('aria-label'), 'Your bag, 2 items')
  p.otherTabSaves('usual:bag', [])
  assert.equal(p.$('[data-bag-count]').hidden, true)
  assert.equal(link.getAttribute('aria-label'), 'Your bag')
})
