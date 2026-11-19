import { branchNow, typicalBusyness } from '../lib/branches.ts'
import type { BranchId, Busyness } from '../lib/branches.ts'
import { formatClock, manilaTime } from '../lib/time.ts'
import { statusLine } from '../shared/branch-status.ts'

const BUSY_WORDS: Record<Busyness, string> = { 0: 'quiet', 1: 'calm', 2: 'busy', 3: 'at its busiest' }

function hourLabel(at: Date): string {
  return formatClock(Math.floor(manilaTime(at).minutes / 60) * 60).replace(':00', '')
}

function renderRow(row: HTMLElement, at: Date): void {
  const id = row.dataset.branch as BranchId
  const slot = row.querySelector<HTMLElement>('[data-branch-now]')
  if (!slot) return
  const now = branchNow(id, at)
  slot.replaceChildren(statusLine(now))
  if (!now.open) return

  const busy = document.createElement('p')
  busy.className = 'mt-1 text-sm text-muted'
  busy.textContent = `Usually ${BUSY_WORDS[typicalBusyness(id, at)]} around ${hourLabel(at)}`
  slot.append(busy)
}

export function initBranches(root: HTMLElement): void {
  const rows = [...root.querySelectorAll<HTMLElement>('[data-branch]')]
  if (!rows.length) return
  const render = () => {
    const now = new Date()
    for (const row of rows) renderRow(row, now)
  }
  render()
  // The note's space is reserved (invisible) so showing it moves nothing.
  document.querySelector<HTMLElement>('[data-branch-note]')?.classList.remove('invisible')
  window.setInterval(render, 60_000)
}
