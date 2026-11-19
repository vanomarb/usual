// The sheet lives in the footer; [data-sheet-drink] and [data-sheet-bite] on Menu and Home open it.

import { BITES, drinkById } from '../lib/menu.ts'
import type { Milk, Size, Sugar } from '../lib/menu.ts'
import { menuChoice } from '../lib/order.ts'
import { NOTE_MAX, QTY_MAX, cleanNote, unitPrice } from '../lib/cart.ts'
import type { BagItem } from '../lib/cart.ts'
import { noteHint, sheetGroups } from '../lib/sheet.ts'
import { peso } from '../lib/format.ts'
import { BASE_URL } from '../lib/base.ts'
import { addItemToBag } from './bag.ts'

const COPY = {
  noteRule: (left: number) => `Optional, ${left} left`,
  quantity: (qty: number, total: string) => `${qty} in your order, ${total} in all.`,
  atMost: (total: string) => `One order takes at most ${QTY_MAX} of an item. ${total} in all.`,
  atLeast: 'One is the least you can order.',
}

type Opened = { kind: 'drink'; id: string } | { kind: 'bite'; id: string }

export function initItemSheet(): void {
  const dialog = document.querySelector<HTMLDialogElement>('#item-sheet')
  if (!dialog) return
  const pick = <T extends Element>(hook: string) => dialog.querySelector<T>(`[${hook}]`)!
  const form = pick<HTMLFormElement>('data-sheet-form')
  const body = pick<HTMLElement>('data-sheet-body')
  const photo = pick<HTMLImageElement>('data-sheet-photo')
  const name = pick<HTMLElement>('data-sheet-name')
  const desc = pick<HTMLElement>('data-sheet-desc')
  const price = pick<HTMLElement>('data-sheet-price')
  const groups = pick<HTMLElement>('data-sheet-groups')
  const note = form.elements.namedItem('note') as HTMLTextAreaElement
  const qtyOut = pick<HTMLOutputElement>('data-sheet-qty')
  const less = pick<HTMLButtonElement>('data-sheet-less')
  const more = pick<HTMLButtonElement>('data-sheet-more')
  const add = pick<HTMLButtonElement>('data-sheet-add')
  const noteRule = pick<HTMLElement>('data-sheet-note-rule')
  const live = pick<HTMLElement>('data-sheet-live')
  const base = BASE_URL
  let opener: HTMLElement | null = null
  let opened: Opened | null = null
  let qty = 1

  const value = (field: string) => (form.elements.namedItem(field) as RadioNodeList | null)?.value
  const ticked = (field: string) => form.querySelector<HTMLInputElement>(`input[name="extras"][value="${field}"]`)?.checked ?? false

  const current = (): BagItem | null => {
    if (!opened) return null
    const text = cleanNote(note.value)
    const withNote = <T extends BagItem>(item: T): T => (text ? { ...item, note: text } : item)
    if (opened.kind === 'bite') return withNote({ kind: 'bite', biteId: opened.id })
    const choice = menuChoice(opened.id)
    const size = value('size'); const iced = value('iced'); const milk = value('milk'); const sugar = value('sugar')
    if (size) choice.size = size as Size
    if (iced) choice.iced = iced === 'iced'
    if (milk) choice.milk = milk as Milk
    if (sugar) choice.sugar = Number(sugar) as Sugar
    choice.extraShot = ticked('extraShot')
    choice.syrup = ticked('syrup')
    return withNote({ kind: 'drink', choice })
  }

  const paint = () => {
    const item = current()
    if (!item) return
    qtyOut.textContent = String(qty)
    // aria-disabled, not disabled: a disabled button would drop keyboard focus at the limit.
    less.setAttribute('aria-disabled', String(qty <= 1))
    more.setAttribute('aria-disabled', String(qty >= QTY_MAX))
    add.textContent = `Add ${qty} to bag · ${peso(unitPrice(item) * qty)}`
    noteRule.textContent = COPY.noteRule(Math.max(0, NOTE_MAX - note.value.length))
    note.placeholder = noteHint(item.kind === 'drink' ? { kind: 'drink', iced: item.choice.iced } : { kind: 'bite' })
  }

  const row = (type: 'radio' | 'checkbox', group: string, option: { value: string; label: string; extra?: string; checked: boolean }) => {
    const label = document.createElement('label')
    label.className = 'opt'
    label.innerHTML = `<input class="opt__control" type="${type}"><span class="opt__name"></span><span class="opt__extra"></span>`
    label.querySelector('.opt__name')!.textContent = option.label
    label.querySelector('.opt__extra')!.textContent = option.extra ?? ''
    const input = label.querySelector('input')!
    input.name = group
    input.value = option.value
    input.checked = option.checked
    return label
  }

  const open = (trigger: HTMLElement, item: Opened) => {
    const title = item.kind === 'drink' ? drinkById(item.id)?.name : BITES.find((b) => b.id === item.id)?.name
    if (!title) return
    opener = trigger
    opened = item
    qty = 1
    note.value = ''
    live.textContent = ''
    photo.srcset = `${base}photos/item-${item.id}-640.webp 640w, ${base}photos/item-${item.id}-896.webp 896w`
    photo.src = `${base}photos/item-${item.id}-640.webp`
    photo.loading = 'eager'
    name.textContent = title
    const description = document.querySelector(`[data-desc-for="${CSS.escape(item.id)}"]`)?.textContent?.trim() ?? ''
    desc.textContent = description
    desc.hidden = !description
    if (item.kind === 'drink') {
      const prices = Object.values(drinkById(item.id)!.prices) as number[]
      price.textContent = prices.length > 1 ? `From ${peso(Math.min(...prices))}` : peso(prices[0])
      groups.replaceChildren(...sheetGroups(item.id).map((group) => {
        const set = document.createElement('fieldset')
        set.className = 'opt-group'
        set.innerHTML = '<legend><span class="opt-group__title"></span><span class="opt-group__rule"></span></legend><div class="opt-list"></div>'
        set.querySelector('.opt-group__title')!.textContent = group.title
        set.querySelector('.opt-group__rule')!.textContent = group.required ? 'Pick 1' : 'Optional, pick any'
        set.querySelector('.opt-list')!.replaceChildren(...group.options.map((option) => row(group.kind, group.name, option)))
        return set
      }))
    } else {
      price.textContent = peso(BITES.find((b) => b.id === item.id)!.price)
      groups.replaceChildren()
    }
    groups.hidden = !groups.childElementCount
    paint()
    if (!dialog.open) dialog.showModal()
    form.scrollTop = 0
    body.scrollTop = 0
    // Start on the item's name, so a screen reader announces what opened.
    name.focus({ preventScroll: true })
  }

  document.addEventListener('click', (event) => {
    const trigger = (event.target as Element | null)?.closest<HTMLElement>('[data-sheet-drink], [data-sheet-bite]')
    if (!trigger) return
    const { sheetDrink, sheetBite } = trigger.dataset
    if (sheetDrink) open(trigger, { kind: 'drink', id: sheetDrink })
    else if (sheetBite) open(trigger, { kind: 'bite', id: sheetBite })
  })
  form.addEventListener('change', paint)
  note.addEventListener('input', paint)
  // Said once per press, not on every repaint; a press at a limit says why nothing changed.
  const announceTotal = (limit?: (total: string) => string) => {
    const item = current()
    if (!item) return
    const total = peso(unitPrice(item) * qty)
    live.textContent = limit ? limit(total) : COPY.quantity(qty, total)
  }
  less.addEventListener('click', () => {
    if (qty <= 1) return announceTotal(() => COPY.atLeast)
    qty -= 1
    paint()
    announceTotal()
  })
  more.addEventListener('click', () => {
    if (qty >= QTY_MAX) return announceTotal(COPY.atMost)
    qty += 1
    paint()
    announceTotal()
  })
  // Enter on a choice picks it; it must not submit the form and add the item.
  form.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && event.target instanceof HTMLInputElement) event.preventDefault()
  })
  form.addEventListener('submit', (event) => {
    if ((event.submitter as HTMLElement | null)?.hasAttribute('data-sheet-add') === false) return
    const item = current()
    if (item) addItemToBag(item, qty)
  })
  pick<HTMLButtonElement>('data-sheet-close').addEventListener('click', () => dialog.close())
  // A backdrop click must also start on the backdrop, so a note selection dragged past the edge keeps the sheet open.
  let downOnBackdrop = false
  dialog.addEventListener('pointerdown', (event) => { downOnBackdrop = event.target === dialog })
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog && downOnBackdrop) dialog.close()
  })
  dialog.addEventListener('close', () => {
    opener?.focus()
    opener = null
    opened = null
  })
}
