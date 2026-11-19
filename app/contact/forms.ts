import { parseContact, validFirstName } from '../lib/account.ts'
import { initContactChoice, showError } from '../shared/account.ts'

const COPY = {
  noMessage: 'Write your message.',
  thanks: (name: string) => `Thanks, ${name}`,
}

export function initContactForm(form: HTMLFormElement): void {
  const doneBox = document.querySelector<HTMLElement>('[data-contact-done]')!
  const name = form.querySelector<HTMLInputElement>('#contact-name')!
  const reach = form.querySelector<HTMLInputElement>('#contact-reach')!
  const message = form.querySelector<HTMLTextAreaElement>('#contact-message')!
  const via = initContactChoice(form)
  const errors = {
    name: form.querySelector<HTMLElement>('#contact-name-error')!,
    reach: form.querySelector<HTMLElement>('#contact-reach-error')!,
    message: form.querySelector<HTMLElement>('#contact-message-error')!,
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault()
    const nameProblem = validFirstName(name.value)
    const { kind, error } = via()
    const reachProblem = parseContact(reach.value, kind) ? null : error
    const messageProblem = message.value.trim() ? null : COPY.noMessage
    showError(errors.name, nameProblem, name)
    showError(errors.reach, reachProblem, reach)
    showError(errors.message, messageProblem, message)
    const firstBad = [nameProblem && name, reachProblem && reach, messageProblem && message].find(Boolean)
    if (firstBad) return (firstBad as HTMLElement).focus()
    doneBox.querySelector('[data-contact-done-title]')!.textContent = COPY.thanks(name.value.trim())
    form.hidden = true
    doneBox.hidden = false
    doneBox.focus()
  })

  doneBox.querySelector('[data-contact-again]')!.addEventListener('click', () => {
    form.reset()
    form.querySelector('[data-contact-via]')!.dispatchEvent(new Event('change'))
    doneBox.hidden = true
    form.hidden = false
    name.focus()
  })
}
