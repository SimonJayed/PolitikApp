// Update immediately, serialize writes per item, and reconcile against confirmed server state.
export function createOptimisticActions() {
  const pending = new Map()
  return (key, initial, desired, apply, persist, reportError) => {
    const entry = pending.get(key) || { tail: Promise.resolve(), confirmed: initial, version: 0 }
    pending.set(key, entry)
    const version = ++entry.version
    apply(desired)
    entry.tail = entry.tail.then(async () => {
      try {
        entry.confirmed = await persist(entry.confirmed, desired, confirmed => { entry.confirmed = confirmed })
        if (version === entry.version) apply(entry.confirmed)
      } catch (error) {
        if (version === entry.version) apply(entry.confirmed)
        reportError(error)
      }
    }).finally(() => { if (version === entry.version) pending.delete(key) })
    return entry.tail
  }
}

export function relativeCommentTime(value, now = Date.now()) {
  const timestamp = new Date(value).getTime()
  if (!Number.isFinite(timestamp)) return 'Time unavailable'
  const seconds = Math.max(0, Math.floor((now - timestamp) / 1000))
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}
