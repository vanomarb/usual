import { after, test } from 'node:test'
import assert from 'node:assert/strict'
import { closeAll, loadPage } from '../../tests/harness.ts'
import type { Page, PageOptions } from '../../tests/harness.ts'

after(closeAll)

const SESSION = { firstName: 'Lea', contact: 'lea@example.com' }
const USUAL = { drinkId: 'spanish-latte', size: '16oz', milk: 'oat', sugar: 25, extraShot: false, syrup: false, iced: true, name: 'Lea' }

function start(options: PageOptions = {}) {
  const p = loadPage('account/index.html', options)
  assert.deepEqual(p.boot(), [], 'starts without errors')
  return p
}

const sendCode = (p: Page) => p.$<HTMLButtonElement>('[data-signin-form] button[type="submit"]').click()
const demoCode = (p: Page) => p.text('[data-demo-code]')

function signIn(p: Page, name = 'Lea', contact = 'lea@example.com') {
  p.type('#signin-name', name)
  p.type('#signin-contact', contact)
  sendCode(p)
  p.type('#signin-code', demoCode(p))
  p.$<HTMLButtonElement>('[data-code-form] button[type="submit"]').click()
}

test('signed out, the page asks for the name on the cup and writes it on the cup as it is typed', () => {
  const p = start()
  assert.equal(p.$('[data-signin]').hidden, false)
  assert.equal(p.$('[data-signed-in]').hidden, true)
  assert.equal(p.text('#signin-title'), 'What name goes on the cup?')
  assert.equal(p.text('[data-signin-cup] .cup__name'), 'Your name')
  p.type('#signin-name', 'Lea')
  assert.equal(p.text('[data-signin-cup] .cup__name'), 'Lea')
})

test('the email or text choice sets the contact field’s label, hint and keyboard', () => {
  const p = start()
  assert.equal(p.text('[data-contact-label]'), 'Email address')
  assert.equal(p.$<HTMLInputElement>('#signin-contact').type, 'email')
  p.$<HTMLInputElement>('[data-contact-via] input[value="mobile"]').click()
  assert.equal(p.text('[data-contact-label]'), 'Mobile number')
  assert.equal(p.$<HTMLInputElement>('#signin-contact').type, 'tel')
  assert.equal(p.$<HTMLInputElement>('#signin-contact').autocomplete, 'tel')
})

test('a missing name, then a bad email, are named in the barista’s words and focus goes to the field', () => {
  const p = start()
  sendCode(p)
  assert.equal(p.text('#signin-name-error'), 'We need a name for the cup.')
  assert.equal(p.$('#signin-name').getAttribute('aria-invalid'), 'true')
  assert.equal(p.document.activeElement, p.$('#signin-name'))
  p.type('#signin-name', 'Lea')
  p.type('#signin-contact', 'lea@')
  sendCode(p)
  assert.equal(p.$('#signin-name-error').hidden, true)
  assert.equal(p.text('#signin-contact-error'), 'That email doesn’t look right. Try one like lea@example.com.')
  assert.equal(p.document.activeElement, p.$('#signin-contact'))
  assert.equal(p.$('[data-code-form]').hidden, true)
})

test('"Send my code" shows the code on the page and puts focus in the code field', () => {
  const p = start()
  p.type('#signin-name', 'Lea')
  p.type('#signin-contact', 'Lea@Example.com')
  sendCode(p)
  assert.equal(p.$('[data-signin-form]').hidden, true)
  assert.equal(p.$('[data-code-form]').hidden, false)
  assert.equal(p.document.activeElement, p.$('#signin-code'), 'the code field is focused')
  assert.equal(p.text('[data-code-title]'), 'Here’s your code, Lea')
  assert.equal(p.text('[data-code-sent]'), 'We’d email it to lea@example.com, but this demo sends nothing, so here it is.')
  assert.match(demoCode(p), /^[1-9]\d{3}$/)
})

test('a mobile number is texted, and shown in the +63 form', () => {
  const p = start()
  p.$<HTMLInputElement>('[data-contact-via] input[value="mobile"]').click()
  p.type('#signin-name', 'Lea')
  p.type('#signin-contact', '0917 123 4567')
  sendCode(p)
  assert.equal(p.text('[data-code-sent]'), 'We’d text it to +63 917 123 4567, but this demo sends nothing, so here it is.')
})

test('an empty or wrong code is refused with its own message and keeps focus in the field', () => {
  const p = start()
  p.type('#signin-name', 'Lea')
  p.type('#signin-contact', 'lea@example.com')
  sendCode(p)
  const submit = () => p.$<HTMLButtonElement>('[data-code-form] button[type="submit"]').click()
  submit()
  assert.equal(p.text('#signin-code-error'), 'Type the 4 digits from the box above.')
  p.type('#signin-code', demoCode(p) === '1234' ? '4321' : '1234')
  submit()
  assert.equal(p.text('#signin-code-error'), 'Not quite. Check the digits in the box above.')
  assert.equal(p.document.activeElement, p.$('#signin-code'))
  assert.equal(p.storage('usual:account'), null, 'nothing is signed in')
})

test('"Change my details" goes back to the contact field', () => {
  const p = start()
  p.type('#signin-name', 'Lea')
  p.type('#signin-contact', 'lea@example.com')
  sendCode(p)
  p.$<HTMLButtonElement>('[data-code-back]').click()
  assert.equal(p.$('[data-code-form]').hidden, true)
  assert.equal(p.$('[data-signin-form]').hidden, false)
  assert.equal(p.document.activeElement, p.$('#signin-contact'))
})

test('the right code signs in: a greeting that takes focus, a toast, the header name and the saved session', () => {
  const p = start()
  signIn(p)
  assert.equal(p.$('[data-signed-in]').hidden, false)
  assert.equal(p.$('[data-signin]').hidden, true)
  assert.equal(p.text('[data-greeting]'), 'Hi, Lea')
  assert.equal(p.document.activeElement, p.$('[data-greeting]'))
  assert.equal(p.text('[data-signed-in-as]'), 'Signed in on this device with lea@example.com.')
  assert.equal(p.text('[data-toast]'), 'You’re in, Lea.')
  assert.deepEqual(p.$$('[data-account-label]').map((el) => el.textContent), ['Lea', 'Account: Lea'])
  assert.deepEqual(p.storage('usual:account'), SESSION)
  assert.equal(p.$('[data-account-no-usual]').hidden, false)
})

test('a saved session opens on the greeting, "The usual?" with a saved usual, and the usual goes into the bag', () => {
  const p = start({ storage: { 'usual:account': SESSION, 'usual:usual': USUAL } })
  assert.equal(p.$('[data-signed-in]').hidden, false)
  assert.equal(p.text('[data-greeting]'), 'Hi, Lea. The usual?')
  assert.equal(p.text('[data-account-usual-drink]'), 'Spanish latte')
  assert.equal(p.text('[data-account-usual-details]'), '16 oz, iced, oat milk, 25% sugar')
  p.$<HTMLButtonElement>('[data-account-usual-add]').click()
  const bag = p.storage('usual:bag') as { qty: number; item: { choice: { drinkId: string; milk: string } } }[]
  assert.equal(bag[0].item.choice.drinkId, 'spanish-latte')
  assert.equal(bag[0].item.choice.milk, 'oat')
  assert.match(p.text('[data-toast]'), /^Added Spanish latte, 16 oz, iced, oat milk, 25% sugar\./)
})

test('either Sign out button signs out: the form is empty again, the cup is blank, focus is on the name, and a toast says so', () => {
  for (const index of [0, 1]) {
    const p = start({ storage: { 'usual:account': SESSION } })
    const buttons = p.$$<HTMLButtonElement>('[data-sign-out]')
    assert.equal(buttons.length, 2, 'one for desktop, one after the stamp card on phones')
    buttons[index].click()
    assert.equal(p.$('[data-signin]').hidden, false)
    assert.equal(p.$('[data-signed-in]').hidden, true)
    assert.equal(p.document.activeElement, p.$('#signin-name'))
    assert.equal(p.$<HTMLInputElement>('#signin-name').value, '')
    assert.equal(p.text('[data-signin-cup] .cup__name'), 'Your name')
    assert.equal(p.text('[data-toast]'), 'Signed out. See you on your next break.')
    assert.equal(p.storage('usual:account'), null)
    assert.deepEqual(p.$$('[data-account-label]').map((el) => el.textContent), ['Sign in', 'Sign in'])
  }
})

test('the account page’s stamp card shows what is saved and follows another tab', () => {
  const p = start({ storage: { 'usual:account': SESSION, 'usual:card': { stamps: 4, free: 0 } } })
  assert.equal(p.text('[data-stamp-progress]'), '4 of 9 stamps')
  assert.equal(p.text('[data-stamp-note]'), '5 more stamps to a free drink.')
  p.otherTabSaves('usual:card', { stamps: 8, free: 0 })
  assert.equal(p.text('[data-stamp-progress]'), '8 of 9 stamps')
  assert.equal(p.text('[data-stamp-note]'), 'One more stamp to a free drink.')
})
