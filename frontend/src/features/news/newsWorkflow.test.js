import test from 'node:test'
import assert from 'node:assert/strict'
import { setImmediate } from 'node:timers'
import { aiActionNotice, canProcessAi, canRejectArticle, canRunNewsAction, planBulkNewsAction, runConcurrentNewsActions, summaryLabel } from './newsWorkflow.js'

test('bulk writes overlap with at most three active requests and continue after a failure', async () => {
  let active = 0
  let peak = 0
  const settled = []
  const inputs = Array.from({ length: 8 }, (_, id) => ({ id }))
  await runConcurrentNewsActions(inputs, async item => {
    active += 1
    peak = Math.max(peak, active)
    await new Promise(resolve => setImmediate(resolve))
    active -= 1
    if (item.id === 2) throw new Error('Review conflict')
    return { ...item, status: 'APPROVED' }
  }, result => settled.push(result))
  assert.equal(peak, 3)
  assert.equal(settled.length, 8)
  assert.deepEqual(settled.map(result => result.processed), [1, 2, 3, 4, 5, 6, 7, 8])
  assert.equal(settled.filter(result => result.error).length, 1)
  assert.equal(settled.find(result => result.item.id === 2).error.message, 'Review conflict')
  assert.equal(settled.filter(result => result.value?.status === 'APPROVED').length, 7)
})

test('complete deterministic drafts can enter AI review; metadata and published articles cannot', () => {
  const draft = { status: 'PENDING_REVIEW', aiProcessingStatus: 'DETERMINISTIC', originalContent: 'Source article text' }
  assert.equal(canProcessAi(draft), true)
  assert.equal(canProcessAi({ ...draft, status: 'PUBLISHED' }), false)
  assert.equal(canProcessAi({ ...draft, aiProcessingStatus: 'INCOMPLETE' }), false)
  assert.equal(canProcessAi({ ...draft, originalContent: '  ' }), false)
})

test('rejection is limited to reviewable articles', () => {
  for (const status of ['PENDING_REVIEW', 'APPROVED']) assert.equal(canRejectArticle({ status }), true)
  for (const status of ['PUBLISHED', 'UNPUBLISHED', 'REJECTED', 'PROCESSING']) assert.equal(canRejectArticle({ status }), false)
})

test('mock and failed output are never labelled as completed AI output', () => {
  assert.match(summaryLabel({ aiProcessingStatus: 'MOCKED' }), /mock mode/)
  assert.match(summaryLabel({ aiProcessingStatus: 'FAILED' }), /unavailable/)
  assert.match(summaryLabel({ aiProcessingStatus: 'COMPLETED' }), /AI-assisted/)
  assert.doesNotMatch(summaryLabel({ aiProcessingStatus: 'DETERMINISTIC' }), /AI-assisted/)
})

test('select all on a mixed page approves only pending articles with usable summaries', () => {
  const items = [
    { id: 'pending', status: 'PENDING_REVIEW', aiProcessingStatus: 'COMPLETED', summary: 'Reviewed summary' },
    { id: 'incomplete', status: 'PENDING_REVIEW', aiProcessingStatus: 'INCOMPLETE', summary: 'Metadata only' },
    { id: 'empty', status: 'PENDING_REVIEW', summary: '  ' },
    { id: 'approved', status: 'APPROVED', summary: 'Approved summary' },
    { id: 'published', status: 'PUBLISHED', summary: 'Published summary' },
  ]
  const plan = planBulkNewsAction(items, items.map(item => item.id), 'approve')
  assert.deepEqual(plan.eligible.map(item => item.id), ['pending'])
  assert.equal(plan.skipped, 4)
  assert.deepEqual(planBulkNewsAction(items, items.map(item => item.id), 'publish').eligible.map(item => item.id), ['approved'])
  assert.deepEqual(planBulkNewsAction(items, items.map(item => item.id), 'reject').eligible.map(item => item.id), ['pending', 'incomplete', 'empty', 'approved'])
})

test('bulk actions never process selections left over from a different page or filter', () => {
  const page = [{ id: 'current', status: 'APPROVED' }]
  assert.deepEqual(planBulkNewsAction(page, ['previous-page'], 'publish'), { eligible: [], skipped: 1 })
  assert.deepEqual(planBulkNewsAction(page, [], 'publish'), { eligible: [], skipped: 0 })
})

test('publishing and unpublishing respect review status and incomplete-content restrictions', () => {
  assert.equal(canRunNewsAction({ status: 'UNPUBLISHED' }, 'publish'), true)
  assert.equal(canRunNewsAction({ status: 'APPROVED', aiProcessingStatus: 'INCOMPLETE' }, 'publish'), false)
  assert.equal(canRunNewsAction({ status: 'REJECTED' }, 'publish'), false)
  assert.equal(canRunNewsAction({ status: 'PUBLISHED' }, 'unpublish'), true)
  assert.equal(canRunNewsAction({ status: 'UNPUBLISHED' }, 'unpublish'), false)
})

test('AI processing feedback distinguishes failure, mock mode, and completion', () => {
  const failed = aiActionNotice({ aiProcessingStatus: 'FAILED', reviewNotes: 'HTTP 429 quota reached.' })
  assert.equal(failed.status, 'error')
  assert.match(failed.message, /HTTP 429/)

  const mocked = aiActionNotice({ aiProcessingStatus: 'MOCKED' })
  assert.equal(mocked.status, 'success')
  assert.match(mocked.message, /mock mode/)

  const completed = aiActionNotice({ aiProcessingStatus: 'COMPLETED' })
  assert.equal(completed.status, 'success')
  assert.match(completed.message, /completed/)
})
