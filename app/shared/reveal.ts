// Sections already on screen are marked shown before the js class turns on the hidden state, so nothing blinks out.

const STAGGER_MAX = 8

export function initReveal(): void {
  const root = document.documentElement
  const sections = [...document.querySelectorAll<HTMLElement>('main > section, main > article')]
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches

  for (const section of sections) {
    section.setAttribute('data-reveal', '')
    section.querySelectorAll<HTMLElement>('[data-stagger]').forEach((group) => {
      ;[...group.children].forEach((child, i) => (child as HTMLElement).style.setProperty('--reveal-i', String(Math.min(i, STAGGER_MAX))))
    })
  }

  const show = (el: Element) => el.setAttribute('data-revealed', '')
  if (reduced || !('IntersectionObserver' in window)) {
    sections.forEach(show)
    root.classList.add('js')
    return
  }

  // Anything that starts within the first screen is shown as it is, without motion.
  for (const section of sections) {
    if (section.getBoundingClientRect().top < window.innerHeight) show(section)
  }

  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue
      show(entry.target)
      observer.unobserve(entry.target)
    }
  }, { rootMargin: '0px 0px -8% 0px' })

  for (const section of sections) {
    if (!section.hasAttribute('data-revealed')) observer.observe(section)
  }
  root.classList.add('js')
}
