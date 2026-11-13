const MONTH = '(?:January|February|March|April|May|June|July|August|September|October|November|December)'
const BYLINE = new RegExp(`^(?:Author|Written by|Published by|Posted by)\\s*:\\s*[^|\\n]{1,120}\\s*\\|\\s*(?:\\d{1,2}\\s+${MONTH}\\s+\\d{4}|${MONTH}\\s+\\d{1,2},?\\s+\\d{4})\\s*[|:–—-]?\\s*`, 'i')
const boilerplate = /^(?:Retrieved from an approved government source\.?|Needs administrator verification before publication\.?|Summary requires admin review.*)$/i
export function cleanNewsText(value) {
  const text = String(value ?? '').trim().replace(BYLINE, '').trim()
  return boilerplate.test(text) ? '' : text
}

const normalized = text => text.replace(/\*\*/g, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
export function summarySentences(value) {
  // Keep excerpts verbatim: this splits reviewed text; it does not summarize it.
  return cleanNewsText(value).split(/(?<=[.!?])\s+(?=[A-Z0-9₱])/).map(text => text.trim()).filter(Boolean)
}

export function newsPresentation(article, expanded = false) {
  if (!article?.adminVerified || (article.status && article.status !== 'PUBLISHED')) return { points: [], preview: '', summary: '', origin: 'unavailable' }
  const summary = cleanNewsText(article.summary)
  const structured = (article.keyPoints || []).filter(point => typeof point === 'string')
    .map(cleanNewsText).filter(point => point && !/^(?:Author|Written by|Published by|Posted by)\s*:/i.test(point))
  const source = structured.length ? structured : summarySentences(summary)
  const seen = new Set()
  const points = source.flatMap(point => {
    // Feed excerpts are complete short sentences, never fragments cut mid-claim.
    const short = point.length <= 220 ? point : summarySentences(point).find(sentence => sentence.length <= 220 && /[.!?]$/.test(sentence))
    const candidate = expanded && structured.length ? point : short
    if (!candidate || candidate.length < 12 || (!structured.length && !/[.!?]$/.test(candidate))) return []
    const key = normalized(candidate)
    if (!key || seen.has(key)) return []
    seen.add(key)
    return [candidate]
  })
  const visible = expanded ? points : points.slice(0, 3)
  const preview = summarySentences(summary).filter(sentence => !visible.some(point => normalized(point) === normalized(sentence))).join(' ')
  return { points: visible, preview, summary, origin: structured.length ? 'reviewed-points' : 'reviewed-excerpts' }
}

export function safeNewsUrl(value) {
  try {
    const url = new URL(value)
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? url.href : null
  } catch { return null }
}

export function newsImage(article) {
  const image = article?.image
  const href = safeNewsUrl(image?.url)
  const source = safeNewsUrl(article?.sourceUrl)
  if (!href || !source || !image?.license) return null
  const url = new URL(href), original = new URL(source)
  if (!url.hostname.endsWith('.gov.ph') || url.hostname.replace(/^www\./, '') !== original.hostname.replace(/^www\./, '')
    || (original.protocol === 'https:' && url.protocol !== 'https:')) return null
  return { ...image, url: href, sourceUrl: source }
}

export function emphasisParts(value) {
  // Locate emphasis in plain text first so markdown cannot split dates or numbers.
  // All output remains React text/strong nodes; source HTML is never interpreted.
  const raw = String(value ?? '')
  const candidates = []
  let text = '', cursor = 0
  for (const match of raw.matchAll(/\*\*([^*\n]+)\*\*/g)) {
    text += raw.slice(cursor, match.index).replace(/\*\*/g, '')
    const start = text.length
    text += match[1]
    if (match[1].length <= 90) candidates.push({ start, end: text.length, priority: 4 })
    cursor = match.index + match[0].length
  }
  text += raw.slice(cursor).replace(/\*\*/g, '')
  const addMatches = (pattern, priority) => {
    for (const match of text.matchAll(pattern)) candidates.push({ start: match.index, end: match.index + match[0].trimEnd().length, priority })
  }
  const number = '\\d[\\d,]*(?:\\.\\d+)?'
  addMatches(new RegExp(`(?:₱|PHP\\s*|P(?=\\d))${number}(?:\\s*(?:million|billion|trillion|thousand))?\\b|\\b${number}\\s*(?:percent|per cent|%)(?!\\w)|\\b${number}\\s+(?:(?:million|thousand)\\s+)?(?:farmers|households|families|beneficiaries|workers|students|residents|hectares|jobs|schools|hospitals|projects)\\b`, 'gi'), 3)
  addMatches(/\b(?:Republic Act|RA|Senate Bill|House Bill)\s*(?:No\.?\s*)?\d+\b/gi, 3)
  // Short action phrases also matter when an article has no amounts or bill IDs.
  addMatches(/\b(?:approved|signed|allocated|launched|increased|reduced|suspended|rejected|funded|will\s+(?:provide|fund|publish|build|implement))\s+(?:[\p{L}\p{N}₱][\p{L}\p{N}₱,'’-]*\s+){0,4}[\p{L}\p{N}₱][\p{L}\p{N}₱,'’-]*/giu, 2)
  addMatches(new RegExp(`\\b(?:\\d{1,2}\\s+${MONTH}\\s+\\d{4}|${MONTH}\\s+\\d{1,2}(?:,?\\s+\\d{4})?)(?!\\d)\\b`, 'gi'), 1)

  // Expand partially marked dates/amounts to the complete matching fact.
  const merged = []
  for (const range of candidates.sort((a, b) => a.start - b.start || b.end - a.end)) {
    const previous = merged.at(-1)
    if (previous && range.start < previous.end) {
      previous.end = Math.max(previous.end, range.end)
      previous.priority = Math.max(previous.priority, range.priority)
    } else merged.push({ ...range })
  }
  const selected = merged.filter(range => range.end - range.start < text.trim().length
    && !(/[\p{L}\p{N}]/u.test(text[range.start - 1] || '') && /[\p{L}\p{N}]/u.test(text[range.start] || ''))
    && !(/[\p{L}\p{N}]/u.test(text[range.end - 1] || '') && /[\p{L}\p{N}]/u.test(text[range.end] || '')))
    .sort((a, b) => b.priority - a.priority || a.start - b.start).slice(0, 3).sort((a, b) => a.start - b.start)
  const parts = []; let offset = 0
  for (const range of selected) {
    if (range.start > offset) parts.push({ text: text.slice(offset, range.start), bold: false })
    parts.push({ text: text.slice(range.start, range.end), bold: true })
    offset = range.end
  }
  if (offset < text.length) parts.push({ text: text.slice(offset), bold: false })
  return parts.length ? parts : [{ text, bold: false }]
}
