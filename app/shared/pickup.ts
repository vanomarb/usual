// Shared by the order builder and the bag's checkout, so a wording change can't reach one page and miss the other.

import { branchById, isOpen, keepSlot, pickupSlots } from '../lib/branches.ts'
import type { BranchId, ChosenSlot } from '../lib/branches.ts'
import { formatClock, isNextDay, manilaTime } from '../lib/time.ts'

export const PICKUP_COPY = {
  openAllNight: 'Open all night',
  openUntil: (time: string) => `Open until ${time}`,
  closedOpensAt: (time: string) => `Closed, opens ${time}`,
  slotsClosed: (branch: string, time: string) => `${branch} is closed right now and opens at ${time}. IT Park is open all night.`,
  slotsLate: (branch: string, time: string) => `It’s too close to closing for a pickup at ${branch}. It opens again at ${time}.`,
  slotMissing: 'Pick a pickup time.',
  slotGone: (time: string) => `Your ${time} pickup is no longer available. Pick another time.`,
  tomorrow: '(tomorrow)',
  readyLabel: 'Ready',
  readyTomorrow: 'Ready tomorrow',
  payment: (method: string) => `Payment: ${method}. Nothing was charged.`,
}

export const PAYMENT_NAMES = { gcash: 'GCash', maya: 'Maya', card: 'Card' } as const
export type Payment = keyof typeof PAYMENT_NAMES

export function chip(name: string, value: string, label: string, price?: string, note?: string): HTMLLabelElement {
  const wrap = document.createElement('label')
  wrap.className = 'chip'
  const input = document.createElement('input')
  input.type = 'radio'
  input.name = name
  input.value = value
  const face = document.createElement('span')
  face.className = 'chip__face'
  face.append(label)
  for (const [text, className] of [[price, 'chip__price'], [note, 'chip__note']]) {
    if (!text) continue
    const tag = document.createElement('span')
    tag.className = className!
    tag.textContent = text
    face.append(' ', tag)
  }
  wrap.append(input, face)
  return wrap
}

/** "Open all night", "Open until 10:00 PM" or "Closed, opens 7:00 AM". */
export function branchStatusText(id: BranchId, now: Date): string {
  const { hours } = branchById(id)
  if (hours === 'always') return PICKUP_COPY.openAllNight
  return isOpen(id, now) ? PICKUP_COPY.openUntil(formatClock(hours.close)) : PICKUP_COPY.closedOpensAt(formatClock(hours.open))
}

export function paintBranchStatus(picks: HTMLElement, now: Date): void {
  for (const option of picks.querySelectorAll<HTMLElement>('.pick')) {
    option.querySelector('.pick__status')!.textContent = branchStatusText(option.querySelector('input')!.value as BranchId, now)
  }
}

export interface SlotListParts {
  box: HTMLElement
  hint: HTMLElement
  note: HTMLElement
  /** The step's error line, whose [data-msg] (or the line itself) carries the message. */
  error: HTMLElement
}

/** A picked time stays picked while it is offered; once it isn't, `render` clears it and, with `announce`, says so. */
export function createSlotList({ box, hint, note, error }: SlotListParts) {
  const message = error.querySelector<HTMLElement>('[data-msg]') ?? error
  let shown = ''
  // The Manila day the listed minutes count from; a pick is stored against it.
  let day = ''
  return {
    day: () => day,
    say(text: string): void {
      message.textContent = text
    },
    render(branchId: BranchId, chosen: ChosenSlot | null, now: Date, announce = false): { slot: ChosenSlot | null; dropped: boolean } {
      const branch = branchById(branchId)
      const slots = pickupSlots(branchId, now)
      const today = manilaTime(now).isoDate
      const kept = keepSlot(chosen, slots, today)
      const slot = kept.minutes === null ? null : { day: today, minutes: kept.minutes }
      const key = `${branchId}:${slots.join(',')}`
      const hadFocus = box.contains(document.activeElement)
      if (key !== shown) {
        shown = key
        // The prerendered list reserves room for one set of times until the first render.
        box.removeAttribute('data-pending')
        day = today
        box.replaceChildren(...slots.map((minutes) =>
          chip('slot', String(minutes), formatClock(minutes), undefined, isNextDay(minutes) ? PICKUP_COPY.tomorrow : undefined)))
      }
      for (const input of box.querySelectorAll<HTMLInputElement>('input')) {
        input.checked = slot !== null && Number(input.value) === slot.minutes
      }
      // Times refresh while the page is open; keep the keyboard inside the list.
      if (hadFocus && !box.contains(document.activeElement)) {
        (box.querySelector<HTMLInputElement>('input:checked') ?? box.querySelector<HTMLInputElement>('input'))?.focus()
      }
      if (kept.dropped && announce && chosen) message.textContent = PICKUP_COPY.slotGone(formatClock(chosen.minutes))
      hint.hidden = slots.length === 0
      note.hidden = slots.length > 0
      if (!slots.length && branch.hours !== 'always') {
        const opens = formatClock(branch.hours.open)
        note.textContent = isOpen(branchId, now) ? PICKUP_COPY.slotsLate(branch.name, opens) : PICKUP_COPY.slotsClosed(branch.name, opens)
      }
      return { slot, dropped: kept.dropped }
    },
  }
}
