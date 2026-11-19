import { clearSession, codeMatches, demoCode, loadSession, parseContact, saveSession, validFirstName } from '../lib/account.ts'
import type { Contact, Session } from '../lib/account.ts'
import { describe } from '../lib/order.ts'
import { loadUsual } from '../lib/storage.ts'
import { addItemToBag } from './bag.ts'
import { writeName } from './cup.ts'
import { showToast } from './toast.ts'

export const ACCOUNT_EVENT = 'usual:account'

const COPY = {
  signIn: 'Sign in',
  menuSignedIn: (name: string) => `Account: ${name}`,
  // The contact form shares these two through initContactChoice.
  badEmail: 'Enter an email address, like lea@example.com.',
  badMobile: 'Enter a mobile number that starts with 09 or +63.',
}

const SIGNIN = {
  cupPlaceholder: 'Your name',
  noName: 'We need a name for the cup.',
  badEmail: 'That email doesn’t look right. Try one like lea@example.com.',
  badMobile: 'That number doesn’t look right. It should start with 09 or +63.',
  codeTitle: (name: string) => `Here’s your code, ${name}`,
  emailed: (to: string) => `We’d email it to ${to}, but this demo sends nothing, so here it is.`,
  texted: (to: string) => `We’d text it to ${to}, but this demo sends nothing, so here it is.`,
  noCode: 'Type the 4 digits from the box above.',
  wrongCode: 'Not quite. Check the digits in the box above.',
  greeting: (name: string) => `Hi, ${name}`,
  greetingUsual: (name: string) => `Hi, ${name}. The usual?`,
  signedInAs: (contact: string) => `Signed in on this device with ${contact}.`,
  signedIn: (name: string) => `You’re in, ${name}.`,
  signedOut: 'Signed out. See you on your next break.',
}

// Kept in memory too, so signing in lasts for the visit when the browser keeps no site data.
let session: Session | null | undefined

export function currentSession(): Session | null {
  if (session === undefined) session = loadSession()
  return session
}

function setSession(next: Session | null): void {
  session = next
  if (next) saveSession(next)
  else clearSession()
  document.dispatchEvent(new CustomEvent<Session | null>(ACCOUNT_EVENT, { detail: next }))
}

export function initAccountLabels(): void {
  // Read the session afresh when a page starts; the copy in memory only carries it between changes.
  session = undefined
  const paint = () => {
    const now = currentSession()
    document.querySelectorAll<HTMLElement>('[data-account-label]').forEach((label) => {
      const inMenu = Boolean(label.closest('[data-nav-menu]'))
      label.textContent = now ? (inMenu ? COPY.menuSignedIn(now.firstName) : now.firstName) : COPY.signIn
    })
  }
  paint()
  document.addEventListener(ACCOUNT_EVENT, paint)
  window.addEventListener('storage', (event) => {
    if (event.key !== 'usual:account') return
    session = loadSession()
    paint()
  })
}

const VIA = {
  email: { label: 'Email address', hint: 'For example lea@example.com.', type: 'email', inputMode: 'email', autocomplete: 'email', error: COPY.badEmail },
  mobile: { label: 'Mobile number', hint: 'A mobile number starting with 09 or +63.', type: 'tel', inputMode: 'tel', autocomplete: 'tel', error: COPY.badMobile },
} as const

/** Sets the contact field's label, hint, type, keyboard and autofill to match the Email or Mobile number choice. */
export function initContactChoice(form: HTMLElement): () => { kind: Contact['kind']; error: string } {
  const input = form.querySelector<HTMLInputElement>('[data-contact-input]')!
  const label = form.querySelector<HTMLElement>('[data-contact-label]')!
  const hint = form.querySelector<HTMLElement>('[data-contact-hint]')!
  const picked = () => (form.querySelector<HTMLInputElement>('[data-contact-via] input:checked')?.value === 'mobile' ? 'mobile' : 'email')
  const apply = () => {
    const via = VIA[picked()]
    label.textContent = via.label
    hint.textContent = via.hint
    input.type = via.type
    input.inputMode = via.inputMode
    input.autocomplete = via.autocomplete
  }
  form.querySelector('[data-contact-via]')!.addEventListener('change', apply)
  apply()
  return () => ({ kind: picked(), error: VIA[picked()].error })
}

export function showError(el: HTMLElement, message: string | null, field?: HTMLElement): void {
  el.hidden = !message
  const text = el.querySelector<HTMLElement>('[data-msg]') ?? el
  text.textContent = message ?? ''
  field?.setAttribute('aria-invalid', String(Boolean(message)))
}

export function initAccountPage(root: HTMLElement): void {
  const q = <T extends Element>(selector: string) => root.querySelector<T>(selector)!
  const signinView = q<HTMLElement>('[data-signin]')
  const signedInView = q<HTMLElement>('[data-signed-in]')
  const signinForm = q<HTMLFormElement>('[data-signin-form]')
  const codeForm = q<HTMLFormElement>('[data-code-form]')
  const nameInput = q<HTMLInputElement>('#signin-name')
  const contactInput = q<HTMLInputElement>('#signin-contact')
  const codeInput = q<HTMLInputElement>('#signin-code')
  const nameError = q<HTMLElement>('#signin-name-error')
  const contactError = q<HTMLElement>('#signin-contact-error')
  const codeError = q<HTMLElement>('#signin-code-error')
  const greeting = q<HTMLElement>('[data-greeting]')
  const usualBox = q<HTMLElement>('[data-account-usual]')
  const noUsualBox = q<HTMLElement>('[data-account-no-usual]')
  const cup = root.querySelector<SVGSVGElement>('[data-signin-cup]')
  greeting.tabIndex = -1
  const via = initContactChoice(signinForm)
  const writeCup = () => { if (cup) writeName(cup, nameInput.value, SIGNIN.cupPlaceholder) }
  nameInput.addEventListener('input', writeCup)

  let pending: { session: Session; code: string } | null = null

  function renderSignedIn(now: Session): void {
    const usual = loadUsual()
    greeting.textContent = usual ? SIGNIN.greetingUsual(now.firstName) : SIGNIN.greeting(now.firstName)
    q<HTMLElement>('[data-signed-in-as]').textContent = SIGNIN.signedInAs(now.contact)
    usualBox.hidden = !usual
    noUsualBox.hidden = Boolean(usual)
    if (usual) {
      const { drink, details } = describe(usual)
      q<HTMLElement>('[data-account-usual-drink]').textContent = drink
      q<HTMLElement>('[data-account-usual-details]').textContent = details
    }
  }

  function show(now: Session | null): void {
    signinView.hidden = Boolean(now)
    signedInView.hidden = !now
    if (now) renderSignedIn(now)
  }

  signinForm.addEventListener('submit', (event) => {
    event.preventDefault()
    const nameProblem = nameInput.value.trim() ? validFirstName(nameInput.value) : SIGNIN.noName
    const { kind } = via()
    const contact = parseContact(contactInput.value, kind)
    showError(nameError, nameProblem, nameInput)
    showError(contactError, contact ? null : kind === 'mobile' ? SIGNIN.badMobile : SIGNIN.badEmail, contactInput)
    if (nameProblem) return nameInput.focus()
    if (!contact) return contactInput.focus()
    pending = { session: { firstName: nameInput.value.trim(), contact: contact.value }, code: demoCode() }
    q<HTMLElement>('[data-code-title]').textContent = SIGNIN.codeTitle(pending.session.firstName)
    q<HTMLElement>('[data-code-sent]').textContent = contact.kind === 'email' ? SIGNIN.emailed(contact.value) : SIGNIN.texted(contact.value)
    q<HTMLElement>('[data-demo-code]').textContent = pending.code
    codeInput.value = ''
    showError(codeError, null, codeInput)
    signinForm.hidden = true
    codeForm.hidden = false
    codeInput.focus()
  })

  codeForm.addEventListener('submit', (event) => {
    event.preventDefault()
    if (!pending) return
    if (!codeInput.value.trim()) {
      showError(codeError, SIGNIN.noCode, codeInput)
      return codeInput.focus()
    }
    if (!codeMatches(codeInput.value, pending.code)) {
      showError(codeError, SIGNIN.wrongCode, codeInput)
      return codeInput.focus()
    }
    const signedIn = pending.session
    pending = null
    setSession(signedIn)
    codeForm.hidden = true
    signinForm.hidden = false
    show(signedIn)
    greeting.focus()
    showToast(SIGNIN.signedIn(signedIn.firstName))
  })

  q<HTMLButtonElement>('[data-code-back]').addEventListener('click', () => {
    pending = null
    codeForm.hidden = true
    signinForm.hidden = false
    contactInput.focus()
    contactInput.select()
  })

  q<HTMLButtonElement>('[data-account-usual-add]').addEventListener('click', () => {
    const usual = loadUsual()
    if (!usual) return
    const { name: _name, ...choice } = usual
    addItemToBag({ kind: 'drink', choice })
  })

  // Two buttons, one shown per layout: the phone's sits after the stamp card.
  for (const button of root.querySelectorAll<HTMLButtonElement>('[data-sign-out]')) {
    button.addEventListener('click', () => {
      setSession(null)
      nameInput.value = ''
      contactInput.value = ''
      writeCup()
      show(null)
      nameInput.focus()
      showToast(SIGNIN.signedOut)
    })
  }

  show(currentSession())
  // A name the browser kept from an earlier visit goes on the cup once the form is on screen to measure it.
  writeCup()
}
