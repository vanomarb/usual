import { initConceptDialog } from './shared/concept.ts'
import { initNav } from './shared/nav.ts'
import { initReveal } from './shared/reveal.ts'
import { initBag } from './shared/bag.ts'
import { initItemSheet } from './shared/item-sheet.ts'
import { initAccountLabels, initAccountPage } from './shared/account.ts'
import { initStampCard } from './shared/stamp-card.ts'
import { initOrderBuilder } from './order/order-builder.ts'
import { initBagPage } from './bag/bag-page.ts'
import { initBranches } from './branches/branches.ts'
import { initBranchStatus } from './shared/branch-status.ts'
import { initContactForm } from './contact/forms.ts'

/** Starts each feature whose markup is on the page; tests/harness.ts runs this same function in jsdom. */
export function boot(): void {
  initConceptDialog()
  initNav()
  initReveal()
  initBag()
  initItemSheet()
  initAccountLabels()
  initBranchStatus()

  // Before the builder and the bag, so the card hears every order they place.
  const stampCard = document.querySelector<HTMLElement>('[data-stamp-card]')
  if (stampCard) initStampCard(stampCard)

  const account = document.querySelector<HTMLElement>('[data-signin]')?.parentElement
  if (account) initAccountPage(account)

  const builder = document.querySelector<HTMLElement>('[data-order-builder]')
  if (builder) initOrderBuilder(builder)

  const bag = document.querySelector<HTMLElement>('[data-bag]')
  if (bag) initBagPage(bag)

  const branches = document.querySelector<HTMLElement>('[data-branches]')
  if (branches) initBranches(branches)

  const contact = document.querySelector<HTMLFormElement>('[data-contact-form]')
  if (contact) initContactForm(contact)
}
