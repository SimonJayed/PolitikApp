export function decodedValue(value) {
  for (let attempt = 0; attempt < 3 && typeof value === 'string'; attempt++) {
    const text = value.trim()
    if (!['[', '{', '"'].includes(text[0])) break
    try { value = JSON.parse(text) } catch { break }
  }
  return value
}

const text = value => typeof value === 'string' || typeof value === 'number' ? String(value).trim() : ''

export function historyEntries(value) {
  value = decodedValue(value)
  if (Array.isArray(value)) return value.flatMap(historyEntries)
  if (typeof value === 'string') return value.trim() ? [{ date: '', description: value.trim() }] : []
  if (!value || typeof value !== 'object') return []
  const description = ['action', 'description', 'text', 'event', 'content', 'status', 'legislative_action']
    .map(key => text(value[key])).find(Boolean)
  if (description) return [{ date: text(value.date || value.Date || value.action_date), description }]
  for (const key of ['history', 'entries', 'events', 'items', 'actions', 'action', 'description', 'text', 'status']) {
    if (value[key] && typeof value[key] === 'object') return historyEntries(value[key])
      .map(row => ({ ...row, date: row.date || text(value.date || value.Date || value.action_date) }))
  }
  // Some historical exports group descriptions under their original date keys.
  return Object.entries(value).filter(([key]) => /^\d{4}-\d{2}-\d{2}$/.test(key))
    .flatMap(([date, entry]) => historyEntries(entry).map(row => ({ ...row, date: row.date || date })))
}

export function chronologicalHistory(value) {
  const rows = historyEntries(value)
  return rows.length && rows.every(row => /^\d{4}-\d{2}-\d{2}$/.test(row.date))
    ? rows.sort((a, b) => a.date.localeCompare(b.date)) : rows
}

export function reportedStatuses(value) {
  return historyEntries(value).map(row => ({ date: row.date, status: row.description }))
}

export function authoredBills(records = [], politicianId) {
  return records.filter(record => record.type === 'BILL' && record.relationshipType === 'AUTHORED_BY'
    && record.authorPoliticianId === politicianId)
}

export function billTitle(record) {
  let title = text(record.title) || 'Bill title unavailable'
  if (/[A-Z]/.test(title) && title === title.toUpperCase()) {
    const minor = new Set(['a', 'an', 'and', 'as', 'at', 'by', 'for', 'from', 'in', 'of', 'on', 'or', 'the', 'to', 'with'])
    const acronyms = new Set(['SB', 'HB', 'COA', 'DOH', 'LGU', 'VAT', 'OFW', 'ASEAN', 'AFP', 'RA'])
    title = title.toLowerCase().replace(/\b[a-z]+\b/g, (word, index) =>
      acronyms.has(word.toUpperCase()) ? word.toUpperCase() : index && minor.has(word) ? word : word[0].toUpperCase() + word.slice(1))
  }
  const number = text(record.billNumber)
  if (!number) return title
  const prefix = ({ senate: 'SB', house: 'HB' })[String(record.chamber || '').toLowerCase()]
  const label = /^(SB|HB)\b/i.test(number) || !prefix ? number : `${prefix} ${number}`
  return `${label}: ${title}`
}

export function recordDate(value) {
  if (!value) return 'Date unavailable'
  const raw = String(value)
  const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(raw) ? `${raw}T00:00:00` : raw)
  return Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat('en-PH', { dateStyle: 'long' }).format(date) : raw
}
