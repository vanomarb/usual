// The status rows keep their space in the markup, so nothing moves when they fill in.

import { branchNow } from '../lib/branches.ts'
import type { BranchId, BranchNow } from '../lib/branches.ts'

export function statusLine(now: BranchNow): HTMLParagraphElement {
  const line = document.createElement('p')
  line.className = now.open ? 'flex items-center gap-2 font-semibold text-success' : 'flex items-center gap-2 font-semibold text-muted'
  const dot = document.createElement('span')
  dot.className = now.open ? 'size-2 shrink-0 rounded-full bg-success' : 'size-2 shrink-0 rounded-full border border-muted'
  dot.setAttribute('aria-hidden', 'true')
  line.append(dot, now.status)
  return line
}

export function initBranchStatus(): void {
  const statuses = [...document.querySelectorAll<HTMLElement>('[data-branch-status]')]
  const pickups = [...document.querySelectorAll<HTMLElement>('[data-branch-pickup]')]
  if (!statuses.length && !pickups.length) return
  const render = () => {
    const at = new Date()
    for (const el of statuses) el.replaceChildren(statusLine(branchNow(el.dataset.branchStatus as BranchId, at)))
    for (const el of pickups) el.textContent = branchNow(el.dataset.branchPickup as BranchId, at).pickup ?? ''
  }
  render()
  window.setInterval(render, 60_000)
}
