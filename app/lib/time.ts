// Every "now" on the site is Cebu time, whatever the visitor's own time zone.

export interface ManilaTime {
  /** YYYY-MM-DD */
  isoDate: string
  /** 0 = Sunday. */
  weekday: number
  /** Minutes since Manila midnight. */
  minutes: number
}

const manilaParts = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Asia/Manila',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

export function manilaTime(at: Date): ManilaTime {
  const parts: Record<string, string> = {}
  for (const part of manilaParts.formatToParts(at)) parts[part.type] = part.value
  const isoDate = `${parts.year}-${parts.month}-${parts.day}`
  // Some engines still print midnight as hour 24 in h23 mode.
  const hour = Number(parts.hour) % 24
  return { isoDate, weekday: weekdayOf(isoDate), minutes: hour * 60 + Number(parts.minute) }
}

/** Slots past midnight (1440 and up) wrap to the next day. */
export function formatClock(minutes: number): string {
  const wrapped = ((Math.round(minutes) % 1440) + 1440) % 1440
  const hour = Math.floor(wrapped / 60)
  const minute = wrapped % 60
  const hour12 = hour % 12 === 0 ? 12 : hour % 12
  return `${hour12}:${String(minute).padStart(2, '0')} ${hour < 12 ? 'AM' : 'PM'}`
}

export function isNextDay(minutes: number): boolean {
  return minutes >= 1440
}

/** "7:45 AM", or "12:05 AM (tomorrow)" past midnight. */
export function formatSlot(minutes: number): string {
  return isNextDay(minutes) ? `${formatClock(minutes)} (tomorrow)` : formatClock(minutes)
}

function weekdayOf(isoDate: string): number {
  const [year, month, day] = isoDate.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay()
}
