import test from 'node:test'
import assert from 'node:assert/strict'
import { paginationHandlers } from './pagination.js'

test('news review navigation supplies numeric pages for zero-based API requests', () => {
  let apiPage = 0
  const onChange = nextPage => { apiPage = nextPage - 1 }
  paginationHandlers(apiPage + 1, 3, onChange).next()
  assert.equal(apiPage, 1)
  assert.equal(new URLSearchParams({ page: apiPage }).toString(), 'page=1')
  paginationHandlers(apiPage + 1, 3, onChange).next()
  assert.equal(apiPage, 2)
  paginationHandlers(apiPage + 1, 3, onChange).previous()
  assert.equal(apiPage, 1)
  paginationHandlers(apiPage + 1, 3, onChange).previous()
  assert.equal(apiPage, 0)
})

test('navigation clamps to first and last page and supports direct state setters', () => {
  let page = 1
  const setPage = value => { page = value }
  paginationHandlers(page, 3, setPage).previous()
  assert.equal(page, 1)
  paginationHandlers(page, 3, setPage).next()
  assert.equal(page, 2)
  paginationHandlers(3, 3, setPage).next()
  assert.equal(page, 3)
})
