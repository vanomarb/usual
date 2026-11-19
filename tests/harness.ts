import { readFileSync } from 'node:fs'
import { JSDOM, VirtualConsole } from 'jsdom'
import type { DOMWindow } from 'jsdom'
import { includePartials, pageKey } from '../build/includes.ts'
import { boot } from '../app/boot.ts'

// Pages get the same includePartials as the build and run the real boot(), so markup and scripts can't drift apart.
// jsdom lacks layout, matchMedia, IntersectionObserver and <dialog>, so the "Stand-in" code below imitates them.
// Not covered: focus trapping and inertness behind a modal, the scroll lock, layout, CSS and motion.

const root = new URL('../app/', import.meta.url)
const read = (path: string) => readFileSync(new URL(path, root), 'utf8')
const PARTIALS = Object.fromEntries(['head', 'header', 'footer'].map((name) => [`components/${name}.html`, read(`components/${name}.html`)]))
const SITE = 'https://example.test/usual/'

/** Thursday 19 November 2026, 10:00 in Cebu: every branch is open. */
export const MORNING = '2026-11-19T10:00:00+08:00'
/** The same Thursday at 11:00 at night: Banilad and Capitol Site are closed, IT Park is open. */
export const NIGHT = '2026-11-19T23:00:00+08:00'

export interface PageOptions {
  /** Storage to have in place before the page parses, as key to value (values that aren't strings are JSON-encoded). */
  storage?: Record<string, unknown>
  /** The window width in CSS pixels. Default: a 390 px phone. */
  width?: number
  /** The visitor asks for reduced motion. Default true, so nothing waits on an animation. */
  reducedMotion?: boolean
  /** The moment the page believes it is, as an ISO string with an offset. Default MORNING. */
  now?: string
}

export interface Page {
  window: DOMWindow
  document: Document
  /** Runs boot() on this page and returns any start-up errors it logged. */
  boot(): string[]
  $<T extends Element = HTMLElement>(selector: string): T
  $$<T extends Element = HTMLElement>(selector: string): T[]
  /** The visible text of an element, spaces tidied. */
  text(selector: string): string
  /** Types into a field: sets its value and sends an input event. */
  type(selector: string, text: string): void
  /** Presses a key on the focused element (or `target`) and returns the event, so a test can see if it was cancelled. */
  key(key: string, target?: Element): KeyboardEvent
  /** A press on the dimmed area around a dialog: pointer down and click on the dialog itself. */
  backdropClick(dialog: HTMLDialogElement): void
  wait(ms?: number): Promise<void>
  /** Resizes the window, telling every media query that changed. */
  resize(width: number): void
  /** What another tab does: writes the key and sends this page the `storage` event for it. */
  otherTabSaves(key: string, value: unknown): void
  storage(key: string): unknown
  close(): void
}

const open: Page[] = []

/** Closes every page opened so far (their timers would otherwise keep the test process alive). */
export function closeAll(): void {
  while (open.length) open.pop()!.close()
}

/** The globals the feature modules read, pointed at the page that was just started. */
const BROWSER_GLOBALS = [
  'window', 'document', 'Node', 'Element', 'HTMLElement', 'HTMLInputElement', 'HTMLTextAreaElement', 'HTMLButtonElement',
  'RadioNodeList', 'Event', 'CustomEvent', 'KeyboardEvent', 'getComputedStyle', 'CSS', 'localStorage',
  'requestAnimationFrame', 'cancelAnimationFrame', 'IntersectionObserver',
] as const

const RealDate = Date

/** Loads a page by its file under app/ ('menu/index.html'), at the address the site has it. */
export function loadPage(file: string, options: PageOptions = {}): Page {
  const { storage = {}, reducedMotion = true } = options
  let width = options.width ?? 390
  const nowMs = RealDate.parse(options.now ?? MORNING)
  const key = pageKey(file)
  const html = includePartials(read(file), key, PARTIALS, { base: '/usual/', site: SITE })
  const listeners = new Set<{ query: string; was: boolean; call: (event: { matches: boolean }) => void }>()
  const virtualConsole = new VirtualConsole()
  const problems: string[] = []
  virtualConsole.on('jsdomError', (error: Error) => problems.push(error.message))

  /** Whether a media query holds at the current width. Only the two the site asks are known. */
  const matches = (query: string): boolean => {
    if (query.includes('prefers-reduced-motion: reduce')) return reducedMotion
    const min = query.match(/min-width:\s*([\d.]+)rem/)
    return min ? width >= Number(min[1]) * 16 : false
  }

  const dom = new JSDOM(html, {
    url: `${SITE}${key === 'home' ? '' : `${key}/`}`,
    pretendToBeVisual: true,
    // The module script isn't loaded (no resources are); boot() below stands in for it.
    runScripts: 'dangerously',
    virtualConsole,
    beforeParse(window) {
      // Stand-in: matchMedia answers from the window width and reports breakpoint changes.
      window.matchMedia = ((query: string) => ({
        media: query,
        get matches() { return matches(query) },
        addEventListener: (_type: string, call: (event: { matches: boolean }) => void) => { listeners.add({ query, was: matches(query), call }) },
        removeEventListener: () => {},
      })) as unknown as typeof window.matchMedia

      // Stand-in: an IntersectionObserver that never reports, as if nothing scrolled into view.
      window.IntersectionObserver = class {
        observe() {}
        unobserve() {}
        disconnect() {}
        takeRecords() { return [] }
      } as unknown as typeof window.IntersectionObserver

      // Stand-in: no layout, so a thing "has boxes" when nothing hides it (not hidden, not in a closed dialog).
      const shown = (el: Element) => el.isConnected && !el.closest('[hidden], dialog:not([open])')
      window.Element.prototype.getClientRects = function (this: Element) {
        return (shown(this) ? [{ x: 0, y: 0, top: 0, left: 0, right: 100, bottom: 40, width: 100, height: 40 }] : []) as unknown as DOMRectList
      }
      window.Element.prototype.scrollIntoView = () => {}
      // Stand-in: a text is as wide as 7 units a letter, so a long name on the cup squeezes.
      ;(window.SVGElement.prototype as unknown as { getComputedTextLength(): number }).getComputedTextLength = function (this: SVGElement) {
        return (this.textContent ?? '').length * 7
      }

      // Stand-in for <dialog>, without handing focus back on close: the site's own code must, and the tests check it.
      const dialog = window.HTMLDialogElement.prototype as HTMLDialogElement
      dialog.showModal = function (this: HTMLDialogElement) {
        if (this.open) throw new window.DOMException('The dialog is already open.', 'InvalidStateError')
        this.setAttribute('open', '')
        const target = this.querySelector<HTMLElement>('[autofocus]') ?? this.querySelector<HTMLElement>('a[href], button, input, select, textarea')
        target?.focus()
      }
      dialog.close = function (this: HTMLDialogElement) {
        if (!this.open) return
        this.removeAttribute('open')
        this.dispatchEvent(new window.Event('close'))
      }
      window.document.addEventListener('keydown', (event) => {
        if (event.key !== 'Escape') return
        const top = [...window.document.querySelectorAll<HTMLDialogElement>('dialog[open]')].pop()
        if (top && top.dispatchEvent(new window.Event('cancel', { cancelable: true }))) top.close()
      })
      // Stand-in: a form with method="dialog" that nothing cancelled closes its dialog, as in a browser.
      window.document.addEventListener('submit', (event) => {
        const form = event.target as HTMLFormElement
        if (event.defaultPrevented || form.getAttribute('method') !== 'dialog') return
        event.preventDefault()
        form.closest('dialog')?.close()
      })
      // jsdom can't navigate. Links are stopped once every handler on the page has seen the click.
      window.addEventListener('click', (event) => {
        if ((event.target as Element | null)?.closest?.('a[href]')) event.preventDefault()
      })

      for (const [name, value] of Object.entries(storage)) window.localStorage.setItem(name, typeof value === 'string' ? value : JSON.stringify(value))
    },
  })
  const window = dom.window
  const document = window.document

  const page: Page = {
    window,
    document,
    boot() {
      // The feature modules use the browser's globals, so point them at this page.
      for (const name of BROWSER_GLOBALS) {
        const value = (window as unknown as Record<string, unknown>)[name]
        Object.defineProperty(globalThis, name, { value: typeof value === 'function' && name !== 'IntersectionObserver' && /^[a-z]/.test(name) ? (value as (...args: unknown[]) => unknown).bind(window) : value, configurable: true, writable: true })
      }
      // Stand-in clock: "now" is the fixed moment, everything else about Date is real.
      class FixedDate extends RealDate {
        constructor(...args: [] | [number | string | Date] | [number, number, ...number[]]) {
          if (args.length === 0) super(nowMs)
          else super(...(args as [number]))
        }
        static override now(): number { return nowMs }
      }
      globalThis.Date = FixedDate as DateConstructor
      const logged: string[] = []
      const original = console.error
      console.error = (...args: unknown[]) => void logged.push(args.map(String).join(' '))
      try {
        boot()
      } finally {
        console.error = original
      }
      return [...logged, ...problems]
    },
    $<T extends Element = HTMLElement>(selector: string) {
      const found = document.querySelector<T>(selector)
      if (!found) throw new Error(`No element matches ${selector}`)
      return found
    },
    $$<T extends Element = HTMLElement>(selector: string) {
      return [...document.querySelectorAll<T>(selector)]
    },
    text(selector) {
      return (page.$(selector).textContent ?? '').replace(/\s+/g, ' ').trim()
    },
    type(selector, text) {
      const field = page.$<HTMLInputElement | HTMLTextAreaElement>(selector)
      field.value = text
      field.dispatchEvent(new window.Event('input', { bubbles: true }))
    },
    key(name, target = document.activeElement ?? document.body) {
      const event = new window.KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true })
      target.dispatchEvent(event)
      return event
    },
    backdropClick(dialog) {
      dialog.dispatchEvent(new window.MouseEvent('pointerdown', { bubbles: true }))
      dialog.dispatchEvent(new window.MouseEvent('click', { bubbles: true }))
    },
    wait(ms = 80) {
      return new Promise((resolve) => window.setTimeout(resolve, ms))
    },
    resize(next) {
      width = next
      for (const listener of listeners) {
        const now = matches(listener.query)
        if (now !== listener.was) {
          listener.was = now
          listener.call({ matches: now })
        }
      }
    },
    otherTabSaves(name, value) {
      window.localStorage.setItem(name, JSON.stringify(value))
      window.dispatchEvent(new window.StorageEvent('storage', { key: name }))
    },
    storage(name) {
      const text = window.localStorage.getItem(name)
      return text === null ? null : JSON.parse(text)
    },
    close() {
      globalThis.Date = RealDate
      window.close()
    },
  }
  open.push(page)
  return page
}
