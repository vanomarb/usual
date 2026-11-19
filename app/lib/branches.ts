import { formatClock, formatSlot, manilaTime } from './time.ts'

export type BranchId = 'it-park' | 'banilad' | 'capitol'
export type Busyness = 0 | 1 | 2 | 3

export interface Branch {
  id: BranchId
  name: string
  area: string
  /** Minutes since Manila midnight. */
  hours: 'always' | { open: number; close: number }
}

export const BRANCHES: Branch[] = [
  { id: 'it-park', name: 'IT Park', area: 'Cebu City', hours: 'always' },
  { id: 'banilad', name: 'Banilad', area: 'Cebu City', hours: { open: 420, close: 1320 } },
  { id: 'capitol', name: 'Capitol Site', area: 'Cebu City', hours: { open: 420, close: 1320 } },
]

/** Pickup is never sooner than this many minutes from now. */
export const PICKUP_LEAD = 10
export const SLOT_STEP = 5
/** The last pickup is this many minutes before closing. */
export const LAST_CALL = 15

// By Manila hour, 0 (closed) to 3: IT Park's night-shift breaks, Banilad's school run, Capitol Site's office lunch.
const TYPICAL: Record<BranchId, readonly Busyness[]> = {
  'it-park': [3, 2, 1, 3, 2, 1, 2, 3, 3, 2, 1, 2, 3, 2, 1, 1, 2, 2, 1, 1, 2, 2, 1, 2],
  banilad: [0, 0, 0, 0, 0, 0, 0, 3, 2, 1, 1, 2, 2, 1, 1, 3, 3, 2, 2, 1, 1, 1, 0, 0],
  capitol: [0, 0, 0, 0, 0, 0, 0, 2, 3, 2, 1, 2, 3, 3, 2, 2, 2, 2, 1, 1, 1, 1, 0, 0],
}

export function branchById(id: BranchId): Branch {
  const branch = BRANCHES.find((b) => b.id === id)
  if (!branch) throw new RangeError(`Unknown branch: ${id}`)
  return branch
}

export function isOpen(id: BranchId, at: Date): boolean {
  const { hours } = branchById(id)
  if (hours === 'always') return true
  const { minutes } = manilaTime(at)
  return minutes >= hours.open && minutes < hours.close
}

/** Minutes since Manila midnight of `at`; IT Park never closes, so its slots can run past 1440. */
export function pickupSlots(id: BranchId, at: Date, count = 6): number[] {
  const { hours } = branchById(id)
  // Count a started minute as gone, so the first time is never less than PICKUP_LEAD away.
  const minutes = manilaTime(at).minutes + (at.getTime() % 60_000 > 0 ? 1 : 0)
  const first = Math.ceil((minutes + PICKUP_LEAD) / SLOT_STEP) * SLOT_STEP
  const last = hours === 'always' ? Infinity : hours.close - LAST_CALL
  if (!isOpen(id, at)) return []
  const slots: number[] = []
  for (let slot = first; slot <= last && slots.length < count; slot += SLOT_STEP) slots.push(slot)
  return slots
}

/** A pickup time someone chose: minutes since Manila midnight of `day` (1440 and up is the next day). */
export interface ChosenSlot {
  day: string
  minutes: number
}

/** Clears a chosen time once it's no longer offered; it is moved to today's minutes, so 12:30 AM survives midnight. */
export function keepSlot(chosen: ChosenSlot | null, offered: readonly number[], today: string): { minutes: number | null; dropped: boolean } {
  if (!chosen) return { minutes: null, dropped: false }
  const daysLater = Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${chosen.day}T00:00:00Z`)) / 86_400_000)
  const minutes = chosen.minutes - daysLater * 1440
  return offered.includes(minutes) ? { minutes, dropped: false } : { minutes: null, dropped: true }
}

/** A typical day at this Manila hour, not a live count. */
export function typicalBusyness(id: BranchId, at: Date): Busyness {
  if (!isOpen(id, at)) return 0
  return TYPICAL[id][Math.floor(manilaTime(at).minutes / 60)]
}

export interface BranchNow {
  open: boolean
  /** "Open now", "Open now, until 10:00 PM" or "Closed, opens 7:00 AM". */
  status: string
  /** "Earliest pickup 7:15 AM", "Last pickup was 9:45 PM" in the last quarter hour, or null while closed. */
  pickup: string | null
}

/** A branch at this moment, in the words the footer, Home and the Branches page show. */
export function branchNow(id: BranchId, at: Date): BranchNow {
  const { hours } = branchById(id)
  const open = isOpen(id, at)
  if (!open) return { open, status: hours === 'always' ? 'Closed now' : `Closed, opens ${formatClock(hours.open)}`, pickup: null }
  const [first] = pickupSlots(id, at, 1)
  const pickup = first !== undefined ? `Earliest pickup ${formatSlot(first)}` : hours === 'always' ? null : `Last pickup was ${formatClock(hours.close - LAST_CALL)}`
  return { open, status: hours === 'always' ? 'Open now' : `Open now, until ${formatClock(hours.close)}`, pickup }
}
