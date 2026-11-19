// index.html beside this prerenders the default order, so the page has its final height before this runs.

import { ADDONS, DRINKS, drinkById } from '../lib/menu.ts'
import type { Milk, Size, Sugar } from '../lib/menu.ts'
import { DEFAULT_CHOICE, SIZE_NAMES, describe, optionsFor, priceOf, switchDrink, validName } from '../lib/order.ts'
import type { OrderChoice } from '../lib/order.ts'
import { BRANCHES, branchById, pickupSlots } from '../lib/branches.ts'
import type { BranchId, ChosenSlot } from '../lib/branches.ts'
import { STAMPS_PER_CARD, addStamp, redeem } from '../lib/rewards.ts'
import { canRemember, loadCard, loadUsual, saveCard, saveUsual } from '../lib/storage.ts'
import { peso } from '../lib/format.ts'
import { formatClock, formatSlot, isNextDay, manilaTime } from '../lib/time.ts'
import { drawCup, writeName } from '../shared/cup.ts'
import { CARD_EVENT, paintStamps, watchCard } from '../shared/stamp-card.ts'
import { PAYMENT_NAMES, PICKUP_COPY, chip, createSlotList, paintBranchStatus } from '../shared/pickup.ts'
import type { Payment } from '../shared/pickup.ts'
import { showError } from '../shared/account.ts'
import { BAG_EVENT, addItemToBag, getBag } from '../shared/bag.ts'
import { bagTotals } from '../lib/cart.ts'
import type { Bag } from '../lib/cart.ts'
import type { CardChange } from '../shared/stamp-card.ts'

const COPY = {
  sleeve: 'Your name',
  bagHas: (n: number) => `Your bag has ${n} ${n === 1 ? 'item' : 'items'}. Add this drink to the bag to order them together.`,
  bagHintEmpty: 'Ordering for more than one? Add this drink to your bag and build the next.',
  oneSize: (drink: string) => `${drink} comes in one size.`,
  noMilk: (drink: string) => `${drink} is made without milk.`,
  ready: (time: string, branch: string) => `Ready ${time} at ${branch}`,
  pickupNone: (branch: string) => `Pickup at ${branch}, time not picked yet`,
  nothingSent: 'Nothing was sent or charged.',
  ticketTitle: (name: string) => `Order for ${name}`,
  liveReceived: (time: string, branch: string) => `Order received. Ready ${time} at ${branch}.`,
  liveBrewing: (drink: string) => `Brewing your ${drink} now.`,
  liveReady: (drink: string, branch: string) => `Your ${drink} is ready at ${branch}.`,
  stampAdded: (n: number) => `Stamp ${n} of ${STAMPS_PER_CARD} is on your card.`,
  stampFree: 'That was your ninth stamp. Your next drink is free.',
  freeUsed: 'Your free drink covered this one, so there’s no stamp for it.',
  savedUsual: 'Saved as your usual on this device. Nothing was sent.',
  savedSession: 'Saved as your usual for this visit only, because this browser isn’t keeping site data. Nothing was sent.',
}

const STATUS = ['received', 'brewing', 'ready'] as const
// The demo runs the ticket faster than a real bar would.
const BREWING_AFTER_MS = 1800
const READY_AFTER_MS = 4600

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

export function initOrderBuilder(root: HTMLElement): void {
  const q = <T extends Element>(selector: string) => root.querySelector<T>(selector)!
  const form = q<HTMLFormElement>('#order-form')
  const cup = q<SVGSVGElement>('[data-cup]')
  const sizeBox = q<HTMLElement>('[data-sizes]')
  const sizeNote = q<HTMLElement>('[data-size-note]')
  const milkBox = q<HTMLElement>('[data-milks]')
  const milkNote = q<HTMLElement>('[data-milk-note]')
  const shotOption = q<HTMLElement>('[data-extra="shot"]')
  const tempStep = q<HTMLElement>('[data-step="temp"]')
  const picks = q<HTMLElement>('[data-branch-picks]')
  const slotBox = q<HTMLElement>('[data-slots]')
  const slotHint = q<HTMLElement>('[data-slot-hint]')
  const slotNote = q<HTMLElement>('[data-slot-note]')
  const slotError = q<HTMLElement>('[data-slot-error]')
  const nameInput = q<HTMLInputElement>('#cup-name')
  const nameError = q<HTMLElement>('#name-error')
  const total = q<HTMLElement>('[data-total]')
  const summaryDrink = q<HTMLElement>('[data-summary-drink]')
  const summaryDetails = q<HTMLElement>('[data-summary-details]')
  const summaryPickup = q<HTMLElement>('[data-summary-pickup]')
  const freeBox = q<HTMLElement>('[data-free]')
  const freeInput = freeBox.querySelector<HTMLInputElement>('input')!
  const price = q<HTMLOutputElement>('[data-price]')
  const submit = q<HTMLButtonElement>('[data-submit]')
  const usualStrip = q<HTMLElement>('[data-usual]')
  const usualButton = q<HTMLButtonElement>('[data-usual-order]')
  const addButtons = [...root.querySelectorAll<HTMLButtonElement>('[data-add-to-bag]')]
  const bagNote = q<HTMLElement>('[data-bag-note]')
  const bagHint = q<HTMLElement>('[data-bag-hint]')
  const ticket = q<HTMLElement>('[data-ticket]')
  const statusSteps = [...ticket.querySelectorAll<HTMLElement>('.status__step')]
  const ticketLive = q<HTMLElement>('[data-ticket-live]')
  // Never hidden, so the first status is announced although the ticket only appears once the order is placed.
  const orderLive = q<HTMLElement>('[data-order-live]')
  const ticketStamps = [...ticket.querySelectorAll<HTMLElement>('.stamp-slot')]
  const savedNote = q<HTMLElement>('[data-saved-note]')

  let card = loadCard()
  let usual = loadUsual()
  const remembers = canRemember()
  const state = {
    choice: { ...DEFAULT_CHOICE },
    branch: 'it-park' as BranchId,
    // Only a time the visitor picked; nothing is preselected, so nothing can move under them.
    slot: null as ChosenSlot | null,
    prefersIced: DEFAULT_CHOICE.iced,
    useFree: false,
    payment: 'gcash' as Payment,
    placed: null as OrderChoice | null,
  }
  let timers: number[] = []

  // Built once from the menu data, replacing the identical prerendered chips.
  for (const category of ['coffee', 'not-coffee'] as const) {
    const box = q<HTMLElement>(`[data-drinks="${category}"]`)
    box.replaceChildren(...DRINKS.filter((d) => d.category === category).map((drink) => {
      const option = chip('drink', drink.id, drink.name, peso(Math.min(...Object.values(drink.prices))))
      option.classList.add('chip--drink')
      return option
    }))
  }
  picks.replaceChildren(...BRANCHES.map((branch) => {
    const option = document.createElement('label')
    option.className = 'pick'
    option.innerHTML = `<input type="radio" name="branch" value="${branch.id}"><span class="pick__face"><span class="pick__name"></span> <span class="pick__status"></span></span>`
    option.querySelector('.pick__name')!.textContent = branch.name
    return option
  }))
  for (const el of root.querySelectorAll<HTMLElement>('[data-addon]')) {
    el.textContent = `+${peso(ADDONS[el.dataset.addon as keyof typeof ADDONS])}`
  }

  const setRadio = (name: string, value: string) => {
    const group = form.elements.namedItem(name)
    if (group instanceof RadioNodeList) group.value = value
    else if (group instanceof HTMLInputElement) group.checked = group.value === value
  }
  const checkbox = (name: string) => form.elements.namedItem(name) as HTMLInputElement

  function syncForm(): void {
    const { choice } = state
    setRadio('drink', choice.drinkId)
    setRadio('size', choice.size)
    setRadio('milk', choice.milk)
    setRadio('sugar', String(choice.sugar))
    checkbox('extraShot').checked = choice.extraShot
    checkbox('syrup').checked = choice.syrup
    setRadio('temp', choice.iced ? 'iced' : 'hot')
    setRadio('branch', state.branch)
    if (state.slot) setRadio('slot', String(state.slot.minutes))
    if (nameInput.value !== choice.name) nameInput.value = choice.name
  }

  function renderOptions(): void {
    const drink = drinkById(state.choice.drinkId)!
    const options = optionsFor(drink.id)
    sizeBox.replaceChildren(...options.sizes.map((size) => chip('size', size, SIZE_NAMES[size], peso(drink.prices[size] ?? 0))))
    q<HTMLElement>('[data-step="size"]').toggleAttribute('data-skip', options.sizes.length < 2)
    sizeNote.hidden = options.sizes.length > 1
    sizeNote.textContent = COPY.oneSize(drink.name)

    for (const option of milkBox.querySelectorAll<HTMLElement>('[data-milk]')) {
      option.hidden = !options.milks.includes(option.dataset.milk as Milk)
    }
    const milkFixed = options.milks.length < 2
    milkBox.hidden = milkFixed
    milkNote.hidden = !milkFixed
    milkNote.textContent = COPY.noMilk(drink.name)

    shotOption.hidden = !options.shot
    // Hot or iced is a choice only for drinks that come both ways; the others are made one way.
    tempStep.hidden = options.ice !== 'choice'
  }

  const slotList = createSlotList({ box: slotBox, hint: slotHint, note: slotNote, error: slotError })
  /** True if a time the visitor picked had to be dropped. */
  function renderSlots(now: Date, announce = false): boolean {
    const { slot, dropped } = slotList.render(state.branch, state.slot, now, announce)
    state.slot = slot
    return dropped
  }

  function renderPickup(): void {
    const branchName = branchById(state.branch).name
    summaryPickup.textContent = state.slot ? COPY.ready(formatSlot(state.slot.minutes), branchName) : COPY.pickupNone(branchName)
  }

  function renderSummary(): void {
    const { drink, details } = describe(state.choice)
    summaryDrink.textContent = drink
    summaryDetails.textContent = details
    renderPickup()
    freeBox.hidden = card.free === 0
    if (card.free === 0) state.useFree = false
    freeInput.checked = state.useFree
    price.value = peso(state.useFree ? 0 : priceOf(state.choice))
    drawCup(cup, state.choice)
    writeName(cup, state.choice.name, COPY.sleeve)
  }

  function reorderTarget(now: Date): { branch: BranchId; slot: number } | null {
    for (const id of [state.branch, 'it-park'] as BranchId[]) {
      const slots = pickupSlots(id, now)
      if (slots.length) return { branch: id, slot: slots[0] }
    }
    return null
  }

  function renderUsual(now: Date): void {
    usualStrip.hidden = !usual
    if (!usual) return
    const { drink, details } = describe(usual)
    q<HTMLElement>('[data-usual-drink]').textContent = `${drink}, ${details}. For ${usual.name}.`
    q<HTMLElement>('[data-usual-price]').textContent = peso(priceOf(usual))
    const target = reorderTarget(now)
    q<HTMLElement>('[data-usual-ready]').textContent = target ? COPY.ready(formatSlot(target.slot), branchById(target.branch).name) : ''
  }

  const steps = () => [...form.querySelectorAll<HTMLElement>('[data-step]')]
  const visible = (el: HTMLElement) => !el.closest('[hidden]') && el.getClientRects().length > 0

  function focusTarget(step: HTMLElement): HTMLElement | null {
    if (step.hasAttribute('data-skip')) return null
    const inputs = [...step.querySelectorAll<HTMLInputElement>('input')].filter((input) => !input.disabled && visible(input))
    // A choice lands on its selected option; a set of extras starts at the first.
    return inputs.find((input) => input.type === 'radio' && input.checked) ?? inputs[0] ?? null
  }

  function bottomInset(): number {
    return !total.hidden && getComputedStyle(total).position === 'sticky' ? total.offsetHeight : 0
  }

  // Clear of the header and the phone total bar; tall things (the ticket) line up under the header.
  function reveal(el: HTMLElement): void {
    const rect = el.getBoundingClientRect()
    if (rect.top < 88 || rect.bottom > window.innerHeight - bottomInset() - 8) {
      const block = rect.height > window.innerHeight / 2 ? 'start' : 'center'
      el.scrollIntoView({ block, behavior: reducedMotion() ? 'auto' : 'smooth' })
    }
  }

  function moveOn(from: HTMLElement): void {
    const all = steps()
    const current = from.closest<HTMLElement>('[data-step]')
    for (const step of all.slice(all.indexOf(current!) + 1)) {
      const target = focusTarget(step)
      if (target) {
        target.focus({ preventScroll: true })
        reveal(target)
        return
      }
    }
    submit.focus({ preventScroll: true })
    reveal(submit)
  }

  form.addEventListener('keydown', (event) => {
    const input = event.target
    if (!(input instanceof HTMLInputElement)) return
    if (input.type === 'radio' && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault()
      if (!input.checked) {
        input.checked = true
        input.dispatchEvent(new Event('change', { bubbles: true }))
      }
      moveOn(input)
    } else if (input.type === 'checkbox' && event.key === 'Enter') {
      event.preventDefault()
      moveOn(input)
    }
  })
  freeInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') event.preventDefault()
  })

  form.addEventListener('change', (event) => {
    const input = event.target as HTMLInputElement
    const { choice } = state
    switch (input.name) {
      case 'drink': {
        state.choice = switchDrink(choice, input.value)
        if (optionsFor(input.value).ice === 'choice') state.choice.iced = state.prefersIced
        renderOptions()
        syncForm()
        break
      }
      case 'size': choice.size = input.value as Size; break
      case 'milk': choice.milk = input.value as Milk; break
      case 'sugar': choice.sugar = Number(input.value) as Sugar; break
      case 'extraShot': choice.extraShot = input.checked; break
      case 'syrup': choice.syrup = input.checked; break
      case 'temp': choice.iced = state.prefersIced = input.value === 'iced'; break
      // A picked time carries over to the new branch if that branch offers it too.
      case 'branch': state.branch = input.value as BranchId; renderSlots(new Date()); break
      case 'slot': {
        state.slot = { day: slotList.day(), minutes: Number(input.value) }
        slotList.say('')
        break
      }
      case 'payment': state.payment = input.value as Payment; break
    }
    renderSummary()
  })
  freeInput.addEventListener('change', () => {
    state.useFree = freeInput.checked
    renderSummary()
  })
  nameInput.addEventListener('input', () => {
    state.choice.name = nameInput.value
    writeName(cup, nameInput.value, COPY.sleeve)
    const problem = validName(nameInput.value)
    // Too long shows straight away; an empty name only matters when ordering.
    if (problem && nameInput.value.trim()) showError(nameError, problem, nameInput)
    else if (!nameError.hidden) showError(nameError, problem && nameInput.value.trim() ? problem : null, nameInput)
  })

  function lock(locked: boolean): void {
    for (const fieldset of form.querySelectorAll('fieldset')) fieldset.disabled = locked
    nameInput.disabled = locked
    usualButton.disabled = locked
    for (const button of addButtons) button.disabled = locked
    total.hidden = locked
    ticket.hidden = !locked
  }

  function setStatus(index: number, drink: string, branchName: string, time: string, announce = true): void {
    statusSteps.forEach((step, i) => {
      step.toggleAttribute('data-done', i < index)
      if (i === index) step.setAttribute('aria-current', 'step')
      else step.removeAttribute('aria-current')
    })
    const text = [COPY.liveReceived(time, branchName), COPY.liveBrewing(drink), COPY.liveReady(drink, branchName)][index]
    ticketLive.textContent = text
    ticket.dataset.status = STATUS[index]
    if (announce) orderLive.textContent = index === 0 ? `${text} ${COPY.nothingSent}` : text
  }

  function placeOrder(choice: OrderChoice, branchId: BranchId, slot: number): void {
    // Read the card again: another tab may have added a stamp since this page loaded.
    card = loadCard()
    const before = card
    const usedFree = state.useFree && card.free > 0
    card = usedFree ? redeem(card) : addStamp(card)
    saveCard(card)
    const earnedFree = card.free > before.free
    const landed = usedFree ? null : earnedFree ? STAMPS_PER_CARD : card.stamps - 1
    document.dispatchEvent(new CustomEvent<CardChange>(CARD_EVENT, { detail: { card, landed } }))

    const { drink, details } = describe(choice)
    const branchName = branchById(branchId).name
    const time = formatSlot(slot)
    q<HTMLElement>('[data-ticket-label]').textContent = isNextDay(slot) ? PICKUP_COPY.readyTomorrow : PICKUP_COPY.readyLabel
    q<HTMLElement>('[data-ticket-time]').textContent = formatClock(slot)
    q<HTMLElement>('[data-ticket-branch]').textContent = `at ${branchName}`
    q<HTMLElement>('[data-ticket-title]').textContent = COPY.ticketTitle(choice.name)
    q<HTMLElement>('[data-ticket-drink]').textContent = drink
    q<HTMLElement>('[data-ticket-price]').textContent = peso(usedFree ? 0 : priceOf(choice))
    q<HTMLElement>('[data-ticket-details]').textContent = details
    q<HTMLElement>('[data-ticket-payment]').textContent = PICKUP_COPY.payment(PAYMENT_NAMES[state.payment])
    paintStamps(ticketStamps, earnedFree ? { stamps: STAMPS_PER_CARD, free: card.free } : card, landed)
    q<HTMLElement>('[data-ticket-stamp-note]').textContent = usedFree ? COPY.freeUsed : earnedFree ? COPY.stampFree : COPY.stampAdded(card.stamps)
    savedNote.textContent = ''

    state.placed = choice
    state.useFree = false
    timers.forEach(clearTimeout)
    orderLive.textContent = ''
    lock(true)
    // Written after the ticket appears, so screen readers hear it as a change, not as content that came with it.
    setStatus(0, drink, branchName, time, false)
    // Next frame or 100 ms, whichever is first: background tabs pause frames but not timers, so never after "brewing".
    let announced = false
    const announceReceived = () => {
      if (announced) return
      announced = true
      if (ticket.dataset.status === STATUS[0]) setStatus(0, drink, branchName, time)
    }
    requestAnimationFrame(announceReceived)
    window.setTimeout(announceReceived, 100)
    timers = [
      window.setTimeout(() => setStatus(1, drink, branchName, time), BREWING_AFTER_MS),
      window.setTimeout(() => setStatus(2, drink, branchName, time), READY_AFTER_MS),
    ]
    ticket.focus({ preventScroll: true })
    reveal(ticket)
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault()
    if (state.placed && !ticket.hidden) return
    // A pick that is no longer offered is cleared (and said so) before anything is placed.
    const dropped = renderSlots(new Date(), true)
    renderPickup()
    const chosen = state.slot
    if (!chosen && !dropped) slotList.say(PICKUP_COPY.slotMissing)
    const nameProblem = validName(state.choice.name)
    showError(nameError, nameProblem, nameInput)
    if (!chosen) {
      // Back to the times if there are any; otherwise to the (closed) branch choice.
      const target = focusTarget(q<HTMLElement>('[data-step="slot"]')) ?? focusTarget(q<HTMLElement>('[data-step="branch"]'))
      target?.focus({ preventScroll: true })
      reveal(q<HTMLElement>('[data-step="slot"]'))
      return
    }
    if (nameProblem) {
      nameInput.focus({ preventScroll: true })
      reveal(nameInput)
      return
    }
    placeOrder({ ...state.choice, name: state.choice.name.trim() }, state.branch, chosen.minutes)
  })

  for (const button of addButtons) {
    button.addEventListener('click', () => {
      const { name: _name, ...choice } = state.choice
      addItemToBag({ kind: 'drink', choice })
    })
  }

  // The bag has its own checkout, so say plainly when this drink would leave the bag's items behind.
  // From 60rem the summary carries the bag note, so the step keeps its general hint and the note isn't said twice.
  const wide = window.matchMedia('(min-width: 60rem)')
  function renderBagNote(bag: Bag): void {
    const { items } = bagTotals(bag)
    bagNote.hidden = items === 0
    q<HTMLElement>('[data-bag-note-text]').textContent = items ? COPY.bagHas(items) : ''
    bagHint.textContent = items && !wide.matches ? COPY.bagHas(items) : COPY.bagHintEmpty
  }
  wide.addEventListener('change', () => renderBagNote(getBag()))

  usualButton.addEventListener('click', () => {
    if (!usual) return
    const now = new Date()
    const target = reorderTarget(now)
    if (!target) return
    state.choice = { ...usual }
    state.prefersIced = usual.iced
    state.branch = target.branch
    state.slot = { day: manilaTime(now).isoDate, minutes: target.slot }
    renderOptions()
    renderSlots(now)
    syncForm()
    slotList.say('')
    showError(nameError, null, nameInput)
    renderSummary()
    placeOrder({ ...usual }, target.branch, target.slot)
  })

  q<HTMLButtonElement>('[data-save-usual]').addEventListener('click', () => {
    if (!state.placed) return
    usual = { ...state.placed }
    saveUsual(usual)
    savedNote.textContent = remembers ? COPY.savedUsual : COPY.savedSession
    renderUsual(new Date())
  })

  q<HTMLButtonElement>('[data-new-order]').addEventListener('click', () => {
    timers.forEach(clearTimeout)
    timers = []
    state.placed = null
    // A new order starts with no pickup time picked, like the first one.
    state.slot = null
    slotList.say('')
    orderLive.textContent = ''
    lock(false)
    const now = new Date()
    renderSlots(now)
    renderUsual(now)
    renderSummary()
    const first = focusTarget(q<HTMLElement>('[data-step="drink"]'))
    if (first) {
      first.focus({ preventScroll: true })
      reveal(first)
    }
  })

  const now = new Date()
  renderOptions()
  paintBranchStatus(picks, now)
  renderSlots(now)
  syncForm()
  renderSummary()
  renderUsual(now)
  renderBagNote(getBag())
  document.addEventListener(BAG_EVENT, (event) => renderBagNote((event as CustomEvent<Bag>).detail))
  // A free drink earned (or spent) in another tab shows here too; the ticket keeps the card it was placed with.
  watchCard((saved) => {
    card = saved
    if (ticket.hidden) renderSummary()
  })
  document.fonts?.ready.then(() => writeName(cup, state.choice.name, COPY.sleeve))
  window.setInterval(() => {
    const at = new Date()
    paintBranchStatus(picks, at)
    // Announce here too: a picked time can run out while the visitor is elsewhere on the page.
    if (ticket.hidden) {
      renderSlots(at, true)
      renderPickup()
    }
    renderUsual(at)
  }, 30_000)
}
