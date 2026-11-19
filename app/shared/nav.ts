// The current page's link is marked aria-current at build time (build/includes.ts), so nothing here marks the nav.

export function initNav(): void {
  const header = document.querySelector<HTMLElement>('[data-header]')
  if (!header) return

  let ticking = false
  const markScrolled = () => {
    header.toggleAttribute('data-scrolled', window.scrollY > 8)
    ticking = false
  }
  markScrolled()
  window.addEventListener('scroll', () => {
    if (!ticking) {
      ticking = true
      window.requestAnimationFrame(markScrolled)
    }
  }, { passive: true })

  const button = header.querySelector<HTMLButtonElement>('[data-menu-open]')
  const sheet = document.querySelector<HTMLDialogElement>('#site-menu')
  if (!button || !sheet) return

  // The script takes over from commandfor, so every browser opens the sheet the same way.
  button.addEventListener('click', (event) => {
    event.preventDefault()
    if (!sheet.open) sheet.showModal()
    button.setAttribute('aria-expanded', 'true')
  })
  sheet.querySelector('[data-menu-close]')?.addEventListener('click', (event) => {
    event.preventDefault()
    sheet.close()
  })

  // A tap on the scrim lands on the dialog element itself; it has to start there too.
  let downOnBackdrop = false
  sheet.addEventListener('pointerdown', (event) => { downOnBackdrop = event.target === sheet })
  sheet.addEventListener('click', (event) => {
    if (event.target === sheet && downOnBackdrop) sheet.close()
    // Following a link: close first, so the sheet isn't still open if the page comes back from the back button.
    else if ((event.target as Element).closest('a')) sheet.close()
  })

  sheet.addEventListener('close', () => {
    button.setAttribute('aria-expanded', 'false')
    // Hidden from the desktop layout on: nothing to hand focus back to there.
    if (button.getClientRects().length) button.focus()
  })

  window.matchMedia('(min-width: 60rem)').addEventListener('change', (event) => {
    if (event.matches && sheet.open) sheet.close()
  })
}
