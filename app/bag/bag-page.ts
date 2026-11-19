import { QTY_MAX, bagTotals, removeLine, setQty, unitPrice } from '../lib/cart.ts'
import type { Bag } from '../lib/cart.ts'
import { branchById } from '../lib/branches.ts'
import type { BranchId, ChosenSlot } from '../lib/branches.ts'
import { validName } from '../lib/order.ts'
import { STAMPS_PER_CARD, settleOrder } from '../lib/rewards.ts'
import type { StampCard } from '../lib/rewards.ts'
import { BASE_URL } from '../lib/base.ts'
import { loadCard, saveCard } from '../lib/storage.ts'
import { peso } from '../lib/format.ts'
import { formatClock, formatSlot, isNextDay } from '../lib/time.ts'
import { currentSession, showError } from '../shared/account.ts'
import { BAG_EVENT, getBag, itemLabel, setBag } from '../shared/bag.ts'
import { PAYMENT_NAMES, PICKUP_COPY, createSlotList, paintBranchStatus } from '../shared/pickup.ts'
import type { Payment } from '../shared/pickup.ts'
import { CARD_EVENT, watchCard } from '../shared/stamp-card.ts'
import type { CardChange } from '../shared/stamp-card.ts'

const COPY = {
  items: (n: number) => `${n} ${n === 1 ? 'item' : 'items'}`,
  less: (name: string) => `One fewer ${name}`,
  more: (name: string) => `One more ${name}`,
  remove: (name: string) => `Remove ${name}`,
  qtyNow: (name: string, n: number) => `${name}: ${n} in your bag.`,
  removed: (name: string) => `${name} removed from your bag.`,
  nameCups: 'Name for the cups',
  nameOrder: 'Name for the order',
  nameHelpCups: 'Up to 16 characters, so it fits on the sleeve.',
  nameHelpOrder: 'Up to 16 characters.',
  title: (name: string) => `Order for ${name}`,
  stamps: (n: number, on: number) => `${n === 1 ? 'A stamp' : `${n} stamps`} added. ${on} of ${STAMPS_PER_CARD} on your card.`,
  filled: 'You filled a card, so your next drink is free.',
  freeOnly: 'Your free drink covered the drink in this order, so there’s no stamp for it.',
  noDrinks: 'Bites don’t earn stamps.',
  placed: (time: string, branch: string) => `Order placed. Ready ${time} at ${branch}. Nothing was sent or charged.`,
}

export function initBagPage(root: HTMLElement): void {
  const q = <T extends Element>(selector: string) => root.querySelector<T>(selector)!
  const empty = q<HTMLElement>('[data-bag-empty]')
  const full = q<HTMLElement>('[data-bag-full]')
  const done = q<HTMLElement>('[data-bag-done]')
  const list = q<HTMLElement>('[data-bag-lines]')
  const template = q<HTMLTemplateElement>('[data-line-template]')
  const live = q<HTMLElement>('[data-bag-live]')
  const form = q<HTMLFormElement>('#checkout-form')
  const picks = q<HTMLElement>('[data-branch-picks]')
  const slotBox = q<HTMLElement>('[data-slots]')
  const slotHint = q<HTMLElement>('[data-slot-hint]')
  const slotNote = q<HTMLElement>('[data-slot-note]')
  const slotError = q<HTMLElement>('[data-slot-error]')
  const nameInput = q<HTMLInputElement>('#bag-name')
  const nameError = q<HTMLElement>('#bag-name-error')
  const freeBox = q<HTMLElement>('[data-bag-free]')
  const freeInput = freeBox.querySelector<HTMLInputElement>('input')!

  let card = loadCard()
  const state = {
    branch: 'it-park' as BranchId,
    slot: null as ChosenSlot | null,
    payment: 'gcash' as Payment,
    useFree: false,
    placed: false,
  }
  // The sleeve takes 16 characters, so a longer first name is cut to fit before anyone sees an error.
  nameInput.value = (currentSession()?.firstName ?? '').slice(0, 16)

  function renderLines(bag: Bag): void {
    // Keep focus on the same control of the same line when the list is redrawn.
    const focused = document.activeElement?.closest<HTMLElement>('[data-key]')
    const focusedKey = focused?.dataset.key
    const focusedRole = (document.activeElement as HTMLElement | null)?.dataset?.role
    list.replaceChildren(...bag.map((line) => {
      const row = template.content.firstElementChild!.cloneNode(true) as HTMLElement
      const { name, details } = itemLabel(line.item)
      row.dataset.key = line.key
      row.querySelector('[data-line-name]')!.textContent = name
      const photo = row.querySelector<HTMLImageElement>('[data-line-photo]')!
      const id = line.item.kind === 'drink' ? line.item.choice.drinkId : line.item.biteId
      photo.src = `${BASE_URL}photos/menu-${id}-160.webp`
      photo.srcset = `${BASE_URL}photos/menu-${id}-160.webp 160w, ${BASE_URL}photos/menu-${id}-320.webp 320w`
      row.querySelector('[data-line-details]')!.textContent = details
      const note = row.querySelector<HTMLElement>('[data-line-note]')!
      note.textContent = line.item.note ? `Note: ${line.item.note}` : ''
      note.hidden = !line.item.note
      row.querySelector('[data-line-total]')!.textContent = peso(unitPrice(line.item) * line.qty)
      row.querySelector('[data-qty]')!.textContent = String(line.qty)
      const minus = row.querySelector<HTMLButtonElement>('[data-qty-minus]')!
      const plus = row.querySelector<HTMLButtonElement>('[data-qty-plus]')!
      const remove = row.querySelector<HTMLButtonElement>('[data-line-remove]')!
      minus.setAttribute('aria-label', COPY.less(name))
      plus.setAttribute('aria-label', COPY.more(name))
      remove.setAttribute('aria-label', COPY.remove(name))
      minus.dataset.role = 'minus'
      plus.dataset.role = 'plus'
      remove.dataset.role = 'remove'
      minus.disabled = line.qty <= 1
      plus.disabled = line.qty >= QTY_MAX
      return row
    }))
    if (focusedKey && focusedRole) {
      const row = list.querySelector<HTMLElement>(`[data-key="${CSS.escape(focusedKey)}"]`)
      const target = row?.querySelector<HTMLButtonElement>(`[data-role="${focusedRole}"]:not(:disabled)`) ?? row?.querySelector<HTMLButtonElement>('[data-role="remove"]')
      target?.focus()
    }
  }

  function renderTotals(bag: Bag): void {
    const drinks = bagTotals(bag).drinks
    freeBox.hidden = card.free === 0 || drinks === 0
    if (freeBox.hidden) state.useFree = false
    freeInput.checked = state.useFree
    const totals = bagTotals(bag, state.useFree)
    q<HTMLElement>('[data-name-label]').textContent = drinks ? COPY.nameCups : COPY.nameOrder
    q<HTMLElement>('[data-name-help]').textContent = drinks ? COPY.nameHelpCups : COPY.nameHelpOrder
    q<HTMLElement>('[data-bag-count-label]').textContent = COPY.items(totals.items)
    q<HTMLElement>('[data-bag-subtotal]').textContent = peso(totals.subtotal)
    q<HTMLElement>('[data-bag-discount-row]').hidden = totals.discount === 0
    q<HTMLElement>('[data-bag-discount]').textContent = `−${peso(totals.discount)}`
    q<HTMLElement>('[data-bag-total]').textContent = peso(totals.total)
  }

  function render(): void {
    const bag = getBag()
    if (state.placed) return
    empty.hidden = bag.length > 0
    full.hidden = bag.length === 0
    renderLines(bag)
    renderTotals(bag)
  }

  list.addEventListener('click', (event) => {
    const button = (event.target as Element | null)?.closest<HTMLButtonElement>('button[data-role]')
    const row = button?.closest<HTMLElement>('[data-key]')
    if (!button || !row) return
    const bag = getBag()
    const line = bag.find((l) => l.key === row.dataset.key)
    if (!line) return
    const { name } = itemLabel(line.item)
    if (button.dataset.role === 'remove') {
      const index = bag.indexOf(line)
      setBag(removeLine(bag, line.key))
      live.textContent = COPY.removed(name)
      // Focus moves to the next line, or the one before, or the heading of the empty bag.
      const rows = [...list.querySelectorAll<HTMLElement>('[data-key]')]
      const next = rows[index] ?? rows[index - 1]
      ;(next?.querySelector<HTMLElement>('[data-role="minus"]:not(:disabled), [data-role="plus"]:not(:disabled), [data-role="remove"]') ?? q<HTMLElement>('#bag-title')).focus()
    } else {
      const qty = line.qty + (button.dataset.role === 'plus' ? 1 : -1)
      setBag(setQty(bag, line.key, qty))
      live.textContent = COPY.qtyNow(name, Math.min(QTY_MAX, Math.max(1, qty)))
    }
  })

  freeInput.addEventListener('change', () => {
    state.useFree = freeInput.checked
    renderTotals(getBag())
  })

  const slotList = createSlotList({ box: slotBox, hint: slotHint, note: slotNote, error: slotError })
  /** True if a time the visitor picked had to be dropped. */
  function renderSlots(now: Date, announce = false): boolean {
    const { slot, dropped } = slotList.render(state.branch, state.slot, now, announce)
    state.slot = slot
    return dropped
  }

  form.addEventListener('change', (event) => {
    const input = event.target as HTMLInputElement
    if (input.name === 'branch') {
      state.branch = input.value as BranchId
      renderSlots(new Date())
    } else if (input.name === 'slot') {
      state.slot = { day: slotList.day(), minutes: Number(input.value) }
      slotList.say('')
    } else if (input.name === 'payment') {
      state.payment = input.value as Payment
    }
  })

  nameInput.addEventListener('input', () => {
    const problem = validName(nameInput.value)
    if (problem && nameInput.value.trim()) showError(nameError, problem, nameInput)
    else if (!nameError.hidden) showError(nameError, null, nameInput)
  })

  form.addEventListener('submit', (event) => {
    event.preventDefault()
    const bag = getBag()
    if (!bag.length || state.placed) return
    const dropped = renderSlots(new Date(), true)
    const chosen = state.slot
    if (!chosen && !dropped) slotList.say(PICKUP_COPY.slotMissing)
    const nameProblem = validName(nameInput.value)
    showError(nameError, nameProblem, nameInput)
    if (!chosen) {
      const target = slotBox.querySelector<HTMLInputElement>('input') ?? picks.querySelector<HTMLInputElement>('input:checked')
      target?.focus()
      return
    }
    if (nameProblem) return nameInput.focus()

    // Read the card again: another tab may have placed an order since this page loaded.
    card = loadCard()
    const totals = bagTotals(bag, state.useFree)
    const usedFree = totals.discount > 0
    const settled = settleOrder(card, { drinks: totals.drinks, usedFree })
    card = settled.card
    saveCard(card)
    const { stamps, earnedFree } = settled
    document.dispatchEvent(new CustomEvent<CardChange>(CARD_EVENT, { detail: { card, landed: null } }))

    const branchName = branchById(state.branch).name
    const name = nameInput.value.trim()
    q<HTMLElement>('[data-done-title]').textContent = COPY.title(name)
    q<HTMLElement>('[data-done-label]').textContent = isNextDay(chosen.minutes) ? PICKUP_COPY.readyTomorrow : PICKUP_COPY.readyLabel
    q<HTMLElement>('[data-done-time]').textContent = formatClock(chosen.minutes)
    q<HTMLElement>('[data-done-branch]').textContent = `at ${branchName}`
    q<HTMLElement>('[data-done-lines]').replaceChildren(...bag.map((line) => {
      const li = document.createElement('li')
      li.className = 'flex justify-between gap-4'
      const label = document.createElement('span')
      label.textContent = `${line.qty} × ${itemLabel(line.item).name}`
      const price = document.createElement('span')
      price.className = 'tabular-nums'
      price.textContent = peso(unitPrice(line.item) * line.qty)
      li.append(label, price)
      return li
    }))
    q<HTMLElement>('[data-done-total]').textContent = peso(totals.total)
    q<HTMLElement>('[data-done-payment]').textContent = PICKUP_COPY.payment(PAYMENT_NAMES[state.payment])
    const stampNote = settled.note === 'no-drinks' ? COPY.noDrinks : settled.note === 'free-only' ? COPY.freeOnly : COPY.stamps(stamps, card.stamps)
    q<HTMLElement>('[data-done-stamps]').textContent = earnedFree ? `${stampNote} ${COPY.filled}` : stampNote

    state.placed = true
    setBag([])
    full.hidden = true
    empty.hidden = true
    done.hidden = false
    done.focus()
    live.textContent = COPY.placed(formatSlot(chosen.minutes), branchName)
  })

  const now = new Date()
  paintBranchStatus(picks, now)
  renderSlots(now)
  render()
  document.addEventListener(BAG_EVENT, render)
  // Read the card again whenever the page is seen again, so a free drink earned meanwhile shows without a reload.
  const refreshCard = (saved: StampCard = loadCard()) => {
    if (state.placed) return
    card = saved
    renderTotals(getBag())
  }
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') refreshCard()
  })
  window.addEventListener('focus', () => refreshCard())
  watchCard(refreshCard)
  window.setInterval(() => {
    if (state.placed) return
    const at = new Date()
    paintBranchStatus(picks, at)
    renderSlots(at, true)
  }, 30_000)
}
