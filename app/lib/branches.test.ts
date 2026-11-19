import test from 'node:test'
import assert from 'node:assert/strict'
import { BRANCHES, branchNow, isOpen, keepSlot, pickupSlots, typicalBusyness } from './branches.ts'

test('branches use Manila hours', () => {
  const lateManila = new Date(Date.UTC(2026, 10, 18, 14, 30)) // 22:30 in Manila
  assert.equal(isOpen('banilad', lateManila), false); assert.equal(isOpen('it-park', lateManila), true)
})

test('pickup slots start 10 minutes out on the 5, stop 15 minutes before closing', () => {
  const at = new Date(Date.UTC(2026, 10, 18, 23, 2)) // 07:02 Manila
  assert.deepEqual(pickupSlots('banilad', at, 3), [435, 440, 445])
  assert.deepEqual(pickupSlots('banilad', new Date(Date.UTC(2026, 10, 18, 13, 55))), []) // 21:55 Manila
})

test('three branches, IT Park open all night, the others 7:00 to 22:00', () => {
  assert.deepEqual(BRANCHES.map((b) => b.id), ['it-park', 'banilad', 'capitol'])
  assert.equal(BRANCHES[0].hours, 'always')
  assert.deepEqual(BRANCHES[1].hours, { open: 420, close: 1320 })
  assert.deepEqual(BRANCHES[2].hours, { open: 420, close: 1320 })
})

test('opening and closing minutes are exact', () => {
  assert.equal(isOpen('capitol', new Date(Date.UTC(2026, 10, 18, 22, 59))), false) // 06:59 Manila
  assert.equal(isOpen('capitol', new Date(Date.UTC(2026, 10, 18, 23, 0))), true) // 07:00 Manila
  assert.equal(isOpen('capitol', new Date(Date.UTC(2026, 10, 18, 13, 59))), true) // 21:59 Manila
  assert.equal(isOpen('capitol', new Date(Date.UTC(2026, 10, 18, 14, 0))), false) // 22:00 Manila
})

test('a closed branch has no slots, and the last slot is 9:45 PM', () => {
  assert.deepEqual(pickupSlots('capitol', new Date(Date.UTC(2026, 10, 18, 21, 30))), []) // 05:30 Manila
  assert.deepEqual(pickupSlots('capitol', new Date(Date.UTC(2026, 10, 18, 13, 33)), 6), [1305]) // 21:33 Manila
})

test('IT Park slots run past midnight as minutes of the next day', () => {
  assert.deepEqual(pickupSlots('it-park', new Date(Date.UTC(2026, 10, 18, 15, 52)), 4), [1445, 1450, 1455, 1460]) // 23:52 Manila
})

test('slots are the same for a visitor in any time zone', () => {
  const at = new Date('2026-11-18T07:02:00-08:00') // 23:02 Manila, written as a US Pacific time
  assert.deepEqual(pickupSlots('it-park', at, 2), [1395, 1400])
})

test('typical busyness peaks for breaks and is 0 while closed', () => {
  assert.equal(typicalBusyness('it-park', new Date(Date.UTC(2026, 10, 18, 16, 30))), 3) // 00:30 Manila
  assert.equal(typicalBusyness('it-park', new Date(Date.UTC(2026, 10, 18, 19, 30))), 3) // 03:30 Manila
  assert.equal(typicalBusyness('capitol', new Date(Date.UTC(2026, 10, 18, 4, 15))), 3) // 12:15 Manila, office lunch
  assert.equal(typicalBusyness('banilad', new Date(Date.UTC(2026, 10, 18, 7, 30))), 3) // 15:30 Manila, after school
  assert.equal(typicalBusyness('banilad', new Date(Date.UTC(2026, 10, 18, 14, 30))), 0) // 22:30 Manila
  assert.ok(typicalBusyness('banilad', new Date(Date.UTC(2026, 10, 18, 23, 10))) >= 2) // 07:10 Manila, morning rush
})

test('a chosen pickup time stays while it is offered and is cleared once it is not', () => {
  const chosen = { day: '2026-11-19', minutes: 465 } // 7:45 AM
  const at0730 = new Date(Date.UTC(2026, 10, 18, 23, 30)) // 07:30 Manila on 19 Nov
  const at0736 = new Date(Date.UTC(2026, 10, 18, 23, 36)) // 07:36 Manila: 7:45 is now under 10 minutes away
  assert.deepEqual(keepSlot(chosen, pickupSlots('banilad', at0730), '2026-11-19'), { minutes: 465, dropped: false })
  assert.deepEqual(keepSlot(chosen, pickupSlots('banilad', at0736), '2026-11-19'), { minutes: null, dropped: true })
  assert.deepEqual(keepSlot(null, pickupSlots('banilad', at0730), '2026-11-19'), { minutes: null, dropped: false })
})

test('a pickup after midnight chosen before midnight survives the day change', () => {
  const chosen = { day: '2026-11-18', minutes: 1470 } // 12:30 AM, chosen at 23:58 on 18 Nov
  const after = new Date(Date.UTC(2026, 10, 18, 16, 1)) // 00:01 Manila on 19 Nov
  assert.deepEqual(keepSlot(chosen, pickupSlots('it-park', after), '2026-11-19'), { minutes: 30, dropped: false })
  const late = new Date(Date.UTC(2026, 10, 18, 16, 25)) // 00:25 Manila: 12:30 AM has passed the 10-minute mark
  assert.deepEqual(keepSlot(chosen, pickupSlots('it-park', late), '2026-11-19'), { minutes: null, dropped: true })
})

test('the first pickup time is a full 10 minutes away, even late in the minute', () => {
  const at = new Date('2026-11-19T10:00:59+08:00')
  assert.equal(pickupSlots('banilad', at)[0], 10 * 60 + 15, 'at 10:00:59 the 10:10 slot would be 9 minutes away')
  assert.equal(pickupSlots('banilad', new Date('2026-11-19T10:00:00+08:00'))[0], 10 * 60 + 10, 'on the minute, 10:10 is exactly 10 minutes away')
})

test('a branch right now, in words: open or closed, and the earliest pickup', () => {
  assert.deepEqual(branchNow('banilad', new Date(Date.UTC(2026, 10, 18, 14, 30))), { open: false, status: 'Closed, opens 7:00 AM', pickup: null }) // 22:30 Manila
  assert.deepEqual(branchNow('banilad', new Date(Date.UTC(2026, 10, 18, 23, 2))), { open: true, status: 'Open now, until 10:00 PM', pickup: 'Earliest pickup 7:15 AM' }) // 07:02 Manila
  assert.deepEqual(branchNow('it-park', new Date(Date.UTC(2026, 10, 18, 15, 52))), { open: true, status: 'Open now', pickup: 'Earliest pickup 12:05 AM (tomorrow)' }) // 23:52 Manila
})

test('in the last quarter hour a branch is still open, but its pickups have ended', () => {
  assert.deepEqual(branchNow('capitol', new Date(Date.UTC(2026, 10, 18, 13, 55))), { open: true, status: 'Open now, until 10:00 PM', pickup: 'Last pickup was 9:45 PM' }) // 21:55 Manila
})
