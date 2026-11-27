import { createReadStream, writeFileSync } from 'node:fs'
import { createInterface } from 'node:readline'
import { resolve4 } from 'node:dns/promises'
import { request as http } from 'node:http'
import { request as https } from 'node:https'

const [snapshot, output, mode] = process.argv.slice(2)
if (!snapshot || !output || (mode && mode !== '--probe')) {
  throw new Error('Run with <snapshot.jsonl> <new-report.json> [--probe].')
}

const tracking = /^(utm_.*|fbclid|gclid|dclid|msclkid)$/i
const signature = /^(sig|signature|hmac|token|access_token|x-amz-.*|x-goog-.*)$/i
const approved = /(^|\.)(gov|edu)\.ph$/i
const curated = new Set(['TIMELINE', 'SUBMISSION', 'ACCOMPLISHMENT'])
const records = []
const reviews = new Map()
const counts = {}
const sources = new Map()
let metadata

function parse(raw) {
  try {
    const url = new URL(raw)
    if (!/^https?:\/\//i.test(raw) || /[\s\\]|%(?![a-f\d]{2})/i.test(raw)
        || url.username || url.password) return null
    return url
  } catch {
    return null
  }
}

function citation(raw) {
  const url = parse(raw)
  if (!url) return { url: raw, flag: 'INVALID_URL' }
  const flags = []
  let cleaned = raw
  const keys = [...url.searchParams.keys()]
  if (keys.some(key => tracking.test(key)) && !keys.some(key => signature.test(key))) {
    const parts = url.search.slice(1).split('&').filter(part => !tracking.test(new URLSearchParams(part).keys().next().value))
    const queryStart = raw.indexOf('?')
    cleaned = raw.slice(0, queryStart) + (parts.length ? '?' + parts.join('&') : '') + url.hash
    flags.push('TRACKING')
  }
  if (homepage(url)) flags.push('HOMEPAGE')
  if (/(^|\.)google\.com$/i.test(url.hostname) && /^\/(url|search)$/.test(url.pathname)) {
    flags.push('SEARCH_OR_REDIRECT_WRAPPER')
  }
  return { url: raw, canonical: new URL(cleaned).href, flags, ...(cleaned === raw ? {} : { cleaned }) }
}

function homepage(url) {
  return !url.search && /^\/(?:home\/?|index\.(?:html?|php|aspx))?$/i.test(url.pathname)
}

for await (const line of createInterface({ input: createReadStream(snapshot), crlfDelay: Infinity })) {
  const row = JSON.parse(line)
  if (row.type === 'SNAPSHOT_METADATA') {
    metadata = row
  } else if (row.type === 'REVIEW') {
    reviews.set(`${row.record_type}:${row.record_id}`, row)
  } else {
    const biographyUrls = row.type === 'PROFILE'
      ? row.facts.biography?.match(/https?:\/\/[^\s<>"']+/g) ?? [] : []
    const rawUrls = (row.source_urls ?? [row.source_url, ...biographyUrls]).filter(raw => typeof raw === 'string' && raw.trim())
    const citations = rawUrls.map(raw => citation(raw.trim()))
    records.push({ type: row.type, id: row.id, category: row.category, status: row.status,
      visible: row.visible ?? (row.type === 'TIMELINE' ? !row.is_hidden : undefined),
      linkedPerson: row.congress_person, politicianId: row.politician_id,
      congress: row.congress, chamber: row.subtype, citations })
  }
}
if (!metadata) throw new Error('The snapshot is incomplete.')

for (const record of records) {
  const review = reviews.get(`${record.type}:${record.id}`)
  if (review?.source_url?.trim()) record.reviewCitation = citation(review.source_url.trim())
  const all = [...record.citations, ...(record.reviewCitation ? [record.reviewCitation] : [])]
  for (const { canonical } of all) {
    if (!canonical) continue
    if (!sources.has(canonical)) sources.set(canonical, new Set())
    sources.get(canonical).add(`${record.type}:${record.id}`)
  }
}

// The DNS result is pinned to the socket. Ports, addresses and redirect targets are checked at every hop.
function publicIPv4(address) {
  const [a, b, c] = address.split('.').map(Number)
  return a > 0 && a < 224 && a !== 10 && a !== 127
    && !(a === 100 && b >= 64 && b <= 127) && !(a === 169 && b === 254)
    && !(a === 172 && b >= 16 && b <= 31) && !(a === 192 && [0, 168].includes(b))
    && !(a === 192 && b === 88 && c === 99) && !(a === 198 && [18, 19, 51].includes(b))
    && !(a === 203 && b === 0 && c === 113)
}

// Probe only public document patterns. Reject arbitrary query values, including on redirect hops.
function publicDocument(url) {
  if (!url || url.port || !approved.test(url.hostname)) return false
  if (url.search) {
    const legacyBill = /^(legacy|web)\.senate\.gov\.ph$/.test(url.hostname)
      && /^\/lis\/bill_res\.aspx$/i.test(url.pathname)
      && /^\?congress=\d{1,2}&q=(?:SBN|HBN|SRN|P\.S\.Res\.?)\-?\d{1,6}$/i.test(url.search)
    if (!legacyBill) return false
  }
  return !/(?:token|signature|password|secret|auth)[=:%/]/i.test(url.pathname)
}

function requestStatus(url, address, method) {
  return new Promise((resolve, reject) => {
    const request = (url.protocol === 'https:' ? https : http)(url, {
      agent: false, method, family: 4,
      lookup: (_host, options, callback) => options.all
        ? callback(null, [{ address, family: 4 }]) : callback(null, address, 4),
      headers: { 'User-Agent': 'PolitikApp-CitationAudit/1.0', ...(method === 'GET' ? { Range: 'bytes=0-0' } : {}) },
    }, response => {
      resolve({ status: response.statusCode, location: response.headers.location })
      response.destroy()
    })
    const timeout = setTimeout(() => request.destroy(new Error('Request timeout')), 4500)
    request.once('close', () => clearTimeout(timeout))
    request.once('error', reject)
    request.end()
  })
}

async function probe(raw) {
  let url = parse(raw)
  const redirects = []
  try {
    for (let hop = 0; hop <= 3; hop++) {
      if (!publicDocument(url)) return { outcome: 'OUTSIDE_PROBE_POLICY', redirects }
      const addresses = await resolve4(url.hostname)
      if (!addresses.length || !addresses.every(publicIPv4)) return { outcome: 'ADDRESS_BLOCKED', redirects }
      let { status, location } = await requestStatus(url, addresses[0], 'HEAD')
      if ([403, 404, 405, 501].includes(status)) ({ status, location } = await requestStatus(url, addresses[0], 'GET'))
      if ([301, 302, 303, 307, 308].includes(status) && location) {
        url = parse(new URL(location, url).href)
        redirects.push({ status, destination: url?.href ?? null })
        continue
      }
      const outcome = status >= 200 && status < 300 ? (redirects.length && homepage(url) ? 'REDIRECT_TO_HOMEPAGE' : 'REACHABLE')
        : [404, 410].includes(status) ? 'HTTP_MISSING' : 'HTTP_UNCONFIRMED'
      return { outcome, status, redirects, finalUrl: url.href }
    }
    return { outcome: 'REDIRECT_LIMIT', redirects }
  } catch (error) {
    return { outcome: 'NETWORK_UNCONFIRMED', reason: error.code ?? error.message, redirects }
  }
}

const probes = {}
if (mode === '--probe') {
  const candidates = new Set()
  for (const record of records.filter(row => curated.has(row.type) || row.type === 'PROFILE')) {
    for (const source of [...record.citations, ...(record.reviewCitation ? [record.reviewCitation] : [])]) {
      if (source.canonical && approved.test(new URL(source.canonical).hostname)) candidates.add(source.canonical)
    }
  }
  // One stable, approved URL per imported chamber and Congress, with each host sampled at most once per stratum.
  const sampled = new Set()
  for (const record of records.filter(row => row.type === 'CONGRESS_BILL').sort((a, b) => a.id.localeCompare(b.id))) {
    for (const { canonical } of record.citations) {
      if (!canonical) continue
      const { hostname } = new URL(canonical)
      if (!approved.test(hostname)) continue
      const stratum = `${record.congress}:${record.chamber}:${hostname}`
      if (!sampled.has(stratum)) {
        sampled.add(stratum)
        candidates.add(canonical)
      }
    }
  }
  const pending = [...candidates]
  await Promise.all(Array.from({ length: 4 }, async () => {
    while (pending.length) {
      const url = pending.shift()
      probes[url] = await probe(url)
    }
  }))
}

for (const record of records) {
  const count = counts[record.type] ??= {}
  const citations = [...record.citations, ...(record.reviewCitation ? [record.reviewCitation] : [])]
  const flags = new Set(citations.flatMap(c => c.flags ?? [c.flag]))
  if (!citations.length) flags.add('MISSING')
  if (record.type === 'PROFILE' && !record.reviewCitation) flags.add('NO_STRUCTURED_PROFILE_CITATION')
  if (citations.some(c => sources.get(c.canonical)?.size > 1)) flags.add('SHARED')
  if (new Set(record.citations.map(c => c.canonical ?? c.url)).size < record.citations.length) flags.add('REPEATED_WITHIN_RECORD')
  if (record.type.startsWith('CONGRESS_') && citations.length && !citations.some(c => c.canonical && /(^|\.)gov\.ph$/i.test(new URL(c.canonical).hostname))) {
    flags.add('NO_APPROVED_CONGRESS_HOST')
  }
  for (const c of citations) {
    const result = probes[c.canonical]
    if (result) flags.add(result.outcome)
  }
  record.flags = [...flags]
  for (const key of ['TOTAL', ...flags]) count[key] = (count[key] ?? 0) + 1
}

const probeCounts = {}
for (const { outcome } of Object.values(probes)) probeCounts[outcome] = (probeCounts[outcome] ?? 0) + 1
writeFileSync(output, JSON.stringify({ metadata, counts, probeCounts, probes, records }), { flag: 'wx' })
console.log(JSON.stringify({ metadata, counts, probeCounts }, null, 2))
