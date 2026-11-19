import test from 'node:test'
import assert from 'node:assert/strict'
import { formatClock, formatSlot, isNextDay, manilaTime } from './time.ts'

test('manilaTime converts from UTC', () => {
  assert.deepEqual(manilaTime(new Date(Date.UTC(2026, 10, 18, 16, 30))), { isoDate: '2026-11-19', weekday: 4, minutes: 30 })
})

test('formatClock uses 12-hour time', () => {
  assert.equal(formatClock(0), '12:00 AM'); assert.equal(formatClock(465), '7:45 AM'); assert.equal(formatClock(1305), '9:45 PM')
})

test('formatClock wraps slots that pass midnight', () => {
  assert.equal(formatClock(720), '12:00 PM'); assert.equal(formatClock(1445), '12:05 AM'); assert.equal(formatClock(1440 + 465), '7:45 AM')
})

test('pickup times past midnight say tomorrow', () => {
  assert.equal(isNextDay(1439), false); assert.equal(isNextDay(1440), true)
  assert.equal(formatSlot(465), '7:45 AM'); assert.equal(formatSlot(1445), '12:05 AM (tomorrow)')
})
