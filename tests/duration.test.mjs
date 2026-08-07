// Format du chrono de partie.
import { test } from 'node:test'
import assert from 'node:assert/strict'

const D = await import('../src/ui/duration.ts')

test('chrono : mm:ss, et hh:mm:ss au-delà de l’heure', () => {
  assert.equal(D.formatDuration(0), '0:00')
  assert.equal(D.formatDuration(999), '0:01')
  assert.equal(D.formatDuration(59_000), '0:59')
  assert.equal(D.formatDuration(60_000), '1:00')
  assert.equal(D.formatDuration(12 * 60_000 + 34_000), '12:34')
  assert.equal(D.formatDuration(3600_000 + 2 * 60_000 + 33_000), '1:02:33')
  assert.equal(D.formatDuration(-5000), '0:00', 'jamais de durée négative')
})

test('chrono : la forme en toutes lettres', () => {
  assert.equal(D.spellDuration(4200), '4 s')
  assert.equal(D.spellDuration(59_000), '59 s')
  assert.equal(D.spellDuration(60_000), '1 min 00 s')
  assert.equal(D.spellDuration(12 * 60_000 + 34_000), '12 min 34 s')
  assert.equal(D.spellDuration(3600_000 + 5 * 60_000), '1 h 05 min')
})
