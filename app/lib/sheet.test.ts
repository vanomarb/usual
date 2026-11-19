import test from 'node:test'
import assert from 'node:assert/strict'
import { noteHint, sheetGroups } from './sheet.ts'

const summary = (drinkId: string) =>
  sheetGroups(drinkId).map((g) => `${g.name}:${g.kind}:${g.options.map((o) => `${o.label}${o.extra ? ` ${o.extra}` : ''}${o.checked ? '*' : ''}`).join('|')}`)

test('the item sheet offers each drink its own choices as rows, with the menu way already picked', () => {
  assert.deepEqual(summary('americano'), [
    'size:radio:12 oz ₱120*|16 oz ₱140',
    'iced:radio:Hot*|Iced',
    'milk:radio:No milk*|Fresh milk|Oat milk +₱35|Soy milk +₱30',
    'sugar:radio:0% Unsweetened|25%|50%*|75%|100% Regular sweetness',
    'extras:checkbox:Extra shot +₱40|Syrup +₱25',
  ])
  assert.deepEqual(summary('ube-latte').slice(0, 3), [
    'size:radio:12 oz ₱170*|16 oz ₱190',
    'iced:radio:Hot|Iced*',
    'milk:radio:Fresh milk*|Oat milk +₱35|Soy milk +₱30',
  ])
})

test('a choice the drink does not have is left out instead of shown disabled', () => {
  const names = (id: string) => sheetGroups(id).map((g) => g.name)
  assert.deepEqual(names('cortado'), ['milk', 'sugar', 'extras'], 'one size, never iced')
  assert.deepEqual(names('cold-brew'), ['size', 'milk', 'sugar', 'extras'], 'always over ice')
  assert.deepEqual(names('calamansi-soda'), ['size', 'sugar', 'extras'], 'no milk in a soda')
  assert.deepEqual(sheetGroups('calamansi-soda').at(-1)!.options.map((o) => o.value), ['syrup'], 'no espresso shot in a soda')
  assert.deepEqual(sheetGroups('espresso-martini'), [])
})

test('required groups are the single choices, extras are optional', () => {
  for (const group of sheetGroups('spanish-latte')) assert.equal(group.required, group.kind === 'radio', group.name)
})

test('the note suggests something that fits the item: ice for an iced drink, heat for a hot one, the oven for a bite', () => {
  assert.equal(noteHint({ kind: 'drink', iced: true }), 'Less ice, no straw')
  assert.equal(noteHint({ kind: 'drink', iced: false }), 'Extra hot, or a lid for the road')
  assert.equal(noteHint({ kind: 'bite' }), 'Warm it up, or cut it in half')
})
