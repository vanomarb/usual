import { STAMPS_PER_CARD, cardWords } from '../lib/rewards.ts'
import type { StampCard } from '../lib/rewards.ts'
import { CARD_KEY, canRemember, loadCard } from '../lib/storage.ts'

export const CARD_EVENT = 'usual:card'

export interface CardChange {
  card: StampCard
  /** Index of the stamp that just landed (9 is the free slot), or null. */
  landed: number | null
}

const COPY = {
  storageOff: 'This browser isn’t keeping site data, so the card resets when you leave.',
}

/** In ms: the Home card's first stamp lands after the card's own load-in, then one every INTRO_STEP. */
const INTRO_DELAY = 760
const INTRO_STEP = 80

/** Calls `onChange` when another tab saves the card, so nothing on this page works from a stale one. */
export function watchCard(onChange: (card: StampCard) => void): void {
  window.addEventListener('storage', (event) => {
    if (event.key === CARD_KEY) onChange(loadCard())
  })
}

/** Nine stamp slots and the free one; `stamps` may be 9 to show a full card turning into a free drink. */
export function paintStamps(slots: HTMLElement[], card: { stamps: number; free: number }, landed: number | null): void {
  slots.forEach((slot, index) => {
    const earned = index < STAMPS_PER_CARD ? index < card.stamps : card.free > 0
    slot.toggleAttribute('data-earned', earned)
    slot.classList.remove('stamp-slot--landed')
    slot.style.removeProperty('--stamp-delay')
    if (earned && index === landed) {
      // Restart the animation even if this slot played it before.
      void slot.offsetWidth
      slot.classList.add('stamp-slot--landed')
    }
  })
}

export function initStampCard(root: HTMLElement): void {
  const slots = [...root.querySelectorAll<HTMLElement>('.stamp-slot')]
  const progress = root.querySelector<HTMLElement>('[data-stamp-progress]')
  const note = root.querySelector<HTMLElement>('[data-stamp-note]')
  if (slots.length !== STAMPS_PER_CARD + 1 || !progress || !note) return
  let card = loadCard()

  if (!canRemember()) {
    const off = document.createElement('p')
    off.className = 'mt-2 text-sm text-muted'
    off.textContent = COPY.storageOff
    note.after(off)
  }

  const render = (landed: number | null) => {
    paintStamps(slots, card, landed)
    const words = cardWords(card)
    progress.textContent = words.progress
    note.textContent = words.note
  }

  render(null)
  if (root.hasAttribute('data-stamp-intro') && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    slots.filter((slot) => slot.hasAttribute('data-earned')).forEach((slot, i) => {
      slot.style.setProperty('--stamp-delay', `${INTRO_DELAY + i * INTRO_STEP}ms`)
      slot.classList.add('stamp-slot--landed')
    })
  }
  document.addEventListener(CARD_EVENT, (event) => {
    const change = (event as CustomEvent<CardChange>).detail
    card = change.card
    render(change.landed)
  })
  // Another tab placed an order: show its stamps, without the landing animation.
  watchCard((saved) => {
    card = saved
    render(null)
  })
}
