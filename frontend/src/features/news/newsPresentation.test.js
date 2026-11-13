import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'
import { cleanNewsText, emphasisParts, newsImage, newsPresentation } from './newsPresentation.js'
import { createReadCache } from '../../api/readCache.js'

let server, Content, Image, Summary, paragraphs, commentsStore
before(async () => {
  server = await createServer({ root: fileURLToPath(new URL('../../../', import.meta.url)), server: { middlewareMode: true, watch: null }, appType: 'custom' })
  ;({ default: Content, ArticleImage: Image, SummaryText: Summary, summaryParagraphs: paragraphs } = await server.ssrLoadModule('/src/components/NewsCardContent.jsx'))
  commentsStore = await server.ssrLoadModule('/src/features/news/newsComments.js')
})
after(async () => { await server?.close() })

test('comment prefetches share one request, preserve new comments and reopen from cache', async () => {
  const originalFetch = globalThis.fetch
  const cache = createReadCache()
  let calls = 0, finish
  globalThis.fetch = () => { calls++; return new Promise(resolve => { finish = resolve }) }
  try {
    const first = commentsStore.loadNewsComments(cache, 'article', 'session')
    const second = commentsStore.loadNewsComments(cache, 'article', 'session')
    await Promise.resolve()
    commentsStore.updateNewsComments(cache, 'article', () => [{ id: 'new', content: 'A newly posted comment' }])
    finish(new Response(JSON.stringify([{ id: 'existing', content: 'Previously posted comment' }]), { headers: { 'content-type': 'application/json' } }))
    assert.deepEqual((await first).map(item => item.id), ['new', 'existing'])
    assert.deepEqual(await second, await first)
    assert.deepEqual(await commentsStore.loadNewsComments(cache, 'article', 'session'), await first)
    assert.equal(calls, 1)
  } finally { globalThis.fetch = originalFetch }
})
const article = { id: 'one', adminVerified: true, status: 'PUBLISHED', headline: 'Government support for farmers', category: 'Public Spending', sourceUrl: 'https://www.da.gov.ph/aid',
  summary: 'The allocation is PHP 50 million. Applications open on November 1. The agency will publish application requirements.',
  keyPoints: ['The allocation is PHP 50 million.', 'Applications open on November 1.'] }

test('image-first cards preview the reviewed summary without a separate takeaway panel', () => {
  const content = newsPresentation(article)
  assert.deepEqual(content.points, article.keyPoints)
  assert.equal(content.preview, 'The agency will publish application requirements.')
  const html = renderToStaticMarkup(createElement(Content, { article }))
  assert.ok(!html.includes('Key takeaways'))
  assert.ok(html.includes('<strong>PHP 50 million</strong>'))
  assert.ok(html.includes('newsPreview'))
  assert.ok(html.includes('aria-hidden="true"'))
  const withImage = renderToStaticMarkup(createElement(Content, { article: { ...article, image: { url: 'https://www.da.gov.ph/photo.jpg', license: 'Source public-domain notice' } } }))
  assert.ok(withImage.indexOf('<figure') < withImage.indexOf('<h2>'))
})
test('fallbacks only quote complete reviewed sentences and never invent filler points', () => {
  const fallback = newsPresentation({ ...article, keyPoints: [] })
  assert.equal(fallback.origin, 'reviewed-excerpts')
  assert.equal(fallback.points.length, 3)
  assert.ok(fallback.points.every(point => article.summary.includes(point)))
  assert.deepEqual(newsPresentation({ ...article, summary: 'A fragment with no completed sentence', keyPoints: [] }).points, [])
  assert.deepEqual(newsPresentation({ ...article, adminVerified: false }).points, [])
  assert.deepEqual(newsPresentation({ ...article, status: 'PENDING_REVIEW' }).points, [])
})
test('metadata presentation is separated without modifying the reviewed object', () => {
  const original = 'Author: DA Press Office | 25 October 2026 Agriculture Secretary announced support for farmers.'
  assert.equal(cleanNewsText(original), 'Agriculture Secretary announced support for farmers.')
  assert.equal(cleanNewsText('Agriculture Secretary announced support for farmers.'), 'Agriculture Secretary announced support for farmers.')
  assert.equal(original.startsWith('Author:'), true)
  assert.deepEqual(newsPresentation({ ...article, keyPoints: ['Author: DA Press Office', 'Retrieved from an approved government source.'] }).points.length, 3)
})
test('expanded views retain the full reviewed summary and all available structured points', () => {
  const post = { ...article, keyPoints: [...article.keyPoints, 'The program supports farmers.', 'The agency will publish requirements.'] }
  assert.equal(newsPresentation(post).points.length, 3)
  assert.equal(newsPresentation(post, true).points.length, 4)
  const html = renderToStaticMarkup(createElement(Content, { article: post, expanded: true }))
  assert.ok(html.includes('summaryText') && html.includes('Show less') && html.replace(/<[^>]*>/g, '').includes('The agency will publish application requirements.'))
  assert.ok(html.includes('newsReviewedSummary open'))
})
test('bold emphasis is escaped text, never source-provided HTML', () => {
  const html = renderToStaticMarkup(createElement(Summary, { text: 'Funding is **PHP 50 million**. <img src=x onerror="alert(1)">' }))
  assert.ok(html.includes('<strong>PHP 50 million</strong>'))
  assert.ok(!html.includes('<img') && html.includes('&lt;img'))
  assert.ok(!emphasisParts('**Entire sentence**').some(part => part.bold))
  assert.deepEqual(paragraphs('Source: Officials confirmed the funding.\n\nResidents can apply.'), ['Source: Officials confirmed the funding.', 'Residents can apply.'])
})

test('emphasis keeps complete dates and numbers intact, including partial source markdown', () => {
  for (const date of ['10 NOVEMBER 2026', 'November 10, 2026', '10 **NOVEMBER 20**26']) {
    const text = `Applications close on ${date}. Residents can apply online.`
    const parts = emphasisParts(text)
    assert.equal(parts.map(part => part.text).join(''), text.replace(/\*\*/g, ''))
    assert.deepEqual(parts.filter(part => part.bold).map(part => part.text), [date.replace(/\*\*/g, '')])
  }
  const parts = emphasisParts('The budget is PHP **50** million for 10,000 families.')
  assert.deepEqual(parts.filter(part => part.bold).map(part => part.text), ['PHP 50 million', '10,000 families'])
  assert.ok(!emphasisParts('A code abc**123**def remains text.').some(part => part.bold))
})

test('important amounts, beneficiaries and decisions take priority over dates', () => {
  const parts = emphasisParts('On November 10, 2026, officials approved the relief program. Funding is PHP 50 million for 10,000 families.')
  const bold = parts.filter(part => part.bold).map(part => part.text)
  assert.deepEqual(bold, ['approved the relief program', 'PHP 50 million', '10,000 families'])
  assert.ok(emphasisParts('The agency will publish application requirements.').some(part => part.bold && part.text === 'will publish application requirements'))
})
test('only original-government-source images with rights metadata are displayed', () => {
  const post = { ...article, image: { url: 'https://www.da.gov.ph/photo.jpg', alt: 'Program launch', attribution: 'Original article caption', license: 'Source public-domain notice' } }
  assert.ok(newsImage(post))
  const html = renderToStaticMarkup(createElement(Image, { article: post }))
  for (const value of ['loading="lazy"', 'width="1600"', 'height="900"', 'Program launch', 'Original article caption', 'Source &amp; image rights']) assert.ok(html.includes(value), value)
  for (const url of ['javascript:alert(1)', 'https://unrelated.example/photo.jpg', 'http://www.da.gov.ph/photo.jpg']) assert.equal(newsImage({ ...post, image: { ...post.image, url } }), null)
  assert.equal(renderToStaticMarkup(createElement(Image, { article })), '')
  assert.equal(newsImage({ ...post, image: { ...post.image, license: '' } }), null)
})
