import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createReadCache, newsCacheFor } from './readCache.js'

test('concurrent readers and fresh revisits reuse a single successful request', async () => {
  const cache = createReadCache()
  let calls = 0
  const load = async () => { calls++; return { items: ['one'] } }
  const [first, second] = await Promise.all([cache.load('people', load), cache.load('people', load)])
  assert.equal(first, second)
  assert.equal(await cache.load('people', load), first)
  assert.equal(calls, 1)
})

test('stale data stays immediately readable during revalidation and survives failures', async () => {
  let clock = 0
  const cache = createReadCache({ now: () => clock })
  await cache.load('people', async () => ['old'])
  clock = 61000
  let finish
  const request = cache.load('people', () => new Promise(resolve => { finish = resolve }))
  await Promise.resolve()
  assert.deepEqual(cache.peek('people'), ['old'])
  finish(['new'])
  await request
  await assert.rejects(cache.load('people', async () => { throw new Error('offline') }, { force: true }), /offline/)
  assert.deepEqual(cache.peek('people'), ['new'])
  assert.deepEqual(await cache.load('people', async () => ['recovered'], { force: true }), ['recovered'])
})

test('cache is bounded and mutations can discard other filtered pages', () => {
  const cache = createReadCache({ capacity: 2 })
  cache.set('first', 1); cache.set('second', 2); cache.set('third', 3)
  assert.equal(cache.peek('first'), undefined)
  cache.retain(['third'])
  assert.equal(cache.peek('second'), undefined)
  assert.equal(cache.peek('third'), 3)
})

test('news caches are isolated and cleared when the authentication scope changes', () => {
  const signedIn = newsCacheFor('session-one')
  signedIn.set('feed', { saved: true })
  assert.equal(newsCacheFor('session-one'), signedIn)
  assert.equal(newsCacheFor(null).peek('feed'), undefined)
  assert.equal(newsCacheFor('session-two').peek('feed'), undefined)
  assert.equal(newsCacheFor('session-one').peek('feed'), undefined)
})
