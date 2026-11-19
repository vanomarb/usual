// The element is always in the page (components/footer.html) as a status region, so each message is announced.

const SHOW_MS = 5000
let timer = 0

export function showToast(text: string, link?: { href: string; label: string }): void {
  const toast = document.querySelector<HTMLElement>('[data-toast]')
  if (!toast) return
  const message = document.createElement('span')
  message.textContent = text
  const parts: Node[] = [message]
  if (link) {
    const a = document.createElement('a')
    a.href = link.href
    a.textContent = link.label
    parts.push(a)
  }
  toast.replaceChildren(...parts)
  toast.setAttribute('data-show', '')
  schedule(toast)

  if (!toast.dataset.bound) {
    toast.dataset.bound = ''
    const hold = () => window.clearTimeout(timer)
    toast.addEventListener('pointerenter', hold)
    toast.addEventListener('focusin', hold)
    toast.addEventListener('pointerleave', () => schedule(toast))
    toast.addEventListener('focusout', () => schedule(toast))
  }
}

function schedule(toast: HTMLElement): void {
  window.clearTimeout(timer)
  timer = window.setTimeout(() => {
    toast.removeAttribute('data-show')
    // Empty it once it has faded, so a hidden link can't take focus.
    window.setTimeout(() => {
      if (!toast.hasAttribute('data-show')) toast.replaceChildren()
    }, 300)
  }, SHOW_MS)
}
