// Anything that would need a real café (directions, "about") opens this one dialog.

export function initConceptDialog(): void {
  const dialog = document.querySelector<HTMLDialogElement>('#concept-dialog')
  if (!dialog) return
  let opener: HTMLElement | null = null

  document.addEventListener('click', (event) => {
    const trigger = (event.target as Element | null)?.closest<HTMLElement>('[data-concept]')
    if (!trigger) return
    event.preventDefault()
    opener = trigger
    if (!dialog.open) dialog.showModal()
  })

  dialog.querySelector('[data-concept-close]')?.addEventListener('click', () => dialog.close())

  // A click on the dimmed backdrop lands on the dialog element itself; it has to start there too.
  let downOnBackdrop = false
  dialog.addEventListener('pointerdown', (event) => { downOnBackdrop = event.target === dialog })
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog && downOnBackdrop) dialog.close()
  })

  dialog.addEventListener('close', () => {
    opener?.focus()
    opener = null
  })
}
