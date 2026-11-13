import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createOptimisticActions, relativeCommentTime } from './optimisticActions.js'

const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no }); return { promise, resolve, reject } }

test('actions update before the response and revert on failure', async () => {
  const queue = createOptimisticActions(), request = deferred(), states = [], errors = []
  const done = queue('save', false, true, value => states.push(value), () => request.promise, error => errors.push(error.message))
  assert.deepEqual(states, [true])
  request.reject(new Error('offline'))
  await done
  assert.deepEqual(states, [true, false]); assert.deepEqual(errors, ['offline'])
})

test('rapid clicks serialize writes and old responses cannot overwrite the latest click', async () => {
  const queue = createOptimisticActions(), first = deferred(), second = deferred(), calls = [], states = []
  const persist = async (confirmed, desired) => { calls.push([confirmed, desired]); return calls.length === 1 ? first.promise : second.promise }
  const a = queue('save', false, true, value => states.push(value), persist, assert.fail)
  const b = queue('save', true, false, value => states.push(value), persist, assert.fail)
  assert.deepEqual(states, [true, false])
  await Promise.resolve(); assert.equal(calls.length, 1)
  first.resolve(true); await a
  assert.deepEqual(states, [true, false])
  second.resolve(false); await b
  assert.deepEqual(calls, [[false, true], [true, false]])
  assert.equal(states.at(-1), false)
})

test('failed queued writes roll back to confirmed state, including partial vote operations', async () => {
  const queue = createOptimisticActions(), states = []
  await queue('vote', 'UP', 'DOWN', value => states.push(value), async (confirmed, desired, confirm) => {
    assert.equal(confirmed, 'UP'); assert.equal(desired, 'DOWN')
    confirm(null); throw new Error('Unable to add the next vote')
  }, () => {})
  assert.deepEqual(states, ['DOWN', null])
})

test('comment timestamps start at zero, advance with the clock and never become negative', () => {
  const created = '2026-11-13T10:00:00Z', start = Date.parse(created)
  assert.equal(relativeCommentTime(created, start), '0s')
  assert.equal(relativeCommentTime(created, start + 59000), '59s')
  assert.equal(relativeCommentTime(created, start + 60000), '1m ago')
  assert.equal(relativeCommentTime(created, start - 60000), '0s')
  assert.equal(relativeCommentTime('invalid', start), 'Time unavailable')
})
