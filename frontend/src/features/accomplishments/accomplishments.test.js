import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer } from 'vite'

let server
let PublicAccomplishments
before(async () => {
  server = await createServer({
    root: fileURLToPath(new URL('../../../', import.meta.url)),
    server: { middlewareMode: true, watch: null },
    appType: 'custom',
  })
  ;({ PublicAccomplishments } = await server.ssrLoadModule('/src/components/governance/AccomplishmentsSection.jsx'))
})
after(async () => { await server?.close() })

const visible = {
  accomplishmentId: 'award-1', title: 'Public service award', description: 'Documented public service.',
  accomplishmentYear: 2025, category: 'Public service', sourceUrl: 'https://www.dost.gov.ph/award', visible: true,
}

test('public accomplishments render title, description, year, category, and accessible citation', () => {
  const html = renderToStaticMarkup(createElement(PublicAccomplishments, { records: [visible] }))
  for (const text of [visible.title, visible.description, '2025', visible.category, 'View supporting source']) assert.ok(html.includes(text))
  assert.ok(html.includes(`href="${visible.sourceUrl}"`))
  assert.ok(html.includes('opens in a new tab'))
})

test('hidden accomplishments and their citations are excluded even if supplied to the public list', () => {
  const html = renderToStaticMarkup(createElement(PublicAccomplishments, {
    records: [visible, { ...visible, accomplishmentId: 'hidden', title: 'Private award', sourceUrl: 'https://dost.gov.ph/private', visible: false }],
  }))
  assert.ok(html.includes(visible.title))
  assert.ok(!html.includes('Private award'))
  assert.ok(!html.includes('/private'))
})

test('empty and all-hidden lists display the public empty state', () => {
  for (const records of [[], [{ ...visible, visible: false }]]) {
    const html = renderToStaticMarkup(createElement(PublicAccomplishments, { records }))
    assert.ok(html.includes('No accomplishments are currently available for this politician.'))
  }
})

test('an exact date is displayed without requiring a year field', () => {
  const html = renderToStaticMarkup(createElement(PublicAccomplishments, {
    records: [{ ...visible, accomplishmentYear: null, accomplishmentDate: '2025-06-12' }],
  }))
  assert.match(html, /Jun 12, 2025/)
})

test('unknown dates remain unknown and content is escaped', () => {
  const html = renderToStaticMarkup(createElement(PublicAccomplishments, {
    records: [{ ...visible, accomplishmentYear: null, title: '<script>alert(1)</script>', description: '<img onerror="alert(1)">' }],
  }))
  assert.ok(html.includes('Date not provided'))
  assert.ok(!html.includes('<script>'))
  assert.ok(!html.includes('<img'))
})

test('unsafe citation protocols are never rendered as links', () => {
  const html = renderToStaticMarkup(createElement(PublicAccomplishments, {
    records: [{ ...visible, sourceUrl: 'javascript:alert(1)' }],
  }))
  assert.ok(!html.includes('href='))
})
