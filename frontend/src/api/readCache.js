// Memory only: successful reads survive tab changes, never a browser reload.
// Concurrent consumers share one request; failed reads do not replace good data.
export function createReadCache({ capacity = 40, now = Date.now } = {}) {
  const entries = new Map()
  const pending = new Map()
  const peek = key => entries.get(key)?.data
  const set = (key, data) => {
    entries.delete(key)
    entries.set(key, { data, updatedAt: now() })
    while (entries.size > capacity) entries.delete(entries.keys().next().value)
    return data
  }
  return {
    peek, set,
    retain(keys) { for (const key of entries.keys()) if (!keys.includes(key)) entries.delete(key) },
    load(key, loader, { maxAge = 60000, force = false } = {}) {
      if (pending.has(key)) return pending.get(key)
      const entry = entries.get(key)
      if (!force && entry && now() - entry.updatedAt < maxAge) return Promise.resolve(entry.data)
      const request = Promise.resolve().then(loader).then(data => set(key, data)).finally(() => pending.delete(key))
      pending.set(key, request)
      return request
    },
  }
}

export const publicReadCache = createReadCache()

// News responses can include saved/vote flags. Never share them across sessions.
let newsScope
let newsCache
export function newsCacheFor(scope) {
  if (!newsCache || newsScope !== scope) {
    newsScope = scope
    newsCache = createReadCache()
  }
  return newsCache
}
