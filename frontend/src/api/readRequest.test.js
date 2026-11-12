import assert from 'node:assert/strict'
import { test } from 'node:test'
import { fetchReadWithRetry } from './readRequest.js'

test('temporary fetch failures recover automatically with a public GET', async context => {
  let calls = 0
  const response = { ok: true }
  const request = context.mock.method(globalThis, 'fetch', async () => {
    if (++calls < 3) throw new TypeError('Failed to fetch')
    return response
  })
  assert.equal(await fetchReadWithRetry('/api/politicians', { retryDelay: 0 }), response)
  assert.equal(request.mock.callCount(), 3)
  assert.deepEqual(request.mock.calls[0].arguments, ['/api/politicians', { signal: undefined }])
})

test('persistent transport failure stops after three attempts with an actionable message', async context => {
  const request = context.mock.method(globalThis, 'fetch', async () => { throw new TypeError('Failed to fetch') })
  await assert.rejects(fetchReadWithRetry('/api/politicians', { retryDelay: 0 }), /Unable to reach the backend/)
  assert.equal(request.mock.callCount(), 3)
})

test('HTTP errors are returned to the existing response handler without retrying', async context => {
  const response = { ok: false, status: 404 }
  const request = context.mock.method(globalThis, 'fetch', async () => response)
  assert.equal(await fetchReadWithRetry('/api/missing'), response)
  assert.equal(request.mock.callCount(), 1)
})

test('aborting during retry cancels further requests', async context => {
  const controller = new AbortController()
  const request = context.mock.method(globalThis, 'fetch', async () => { throw new TypeError('Failed to fetch') })
  const pending = fetchReadWithRetry('/api/politicians', { signal: controller.signal })
  setTimeout(() => controller.abort(), 0)
  await assert.rejects(pending, { name: 'AbortError' })
  assert.equal(request.mock.callCount(), 1)
})

test('an already aborted request never fetches', async context => {
  const controller = new AbortController()
  controller.abort()
  const request = context.mock.method(globalThis, 'fetch', async () => ({}))
  await assert.rejects(fetchReadWithRetry('/api/politicians', { signal: controller.signal }), { name: 'AbortError' })
  assert.equal(request.mock.callCount(), 0)
})
