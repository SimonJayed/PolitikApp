import { useEffect, useState } from 'react'

export function useCachedRead(cache, key, loader, empty, refreshKey = 0, maxAge = 60000) {
  const snapshot = () => {
    const cached = cache.peek(key)
    return { ...(cached ?? empty), status: cached === undefined ? 'loading' : 'success', message: '' }
  }
  const [stored, setStored] = useState(() => ({ cache, key, state: snapshot() }))
  // A changed filter or login must never briefly render the previous response.
  const state = stored.cache === cache && stored.key === key ? stored.state : snapshot()
  useEffect(() => {
    let cancelled = false
    const cached = cache.peek(key)
    setStored({ cache, key, state: { ...(cached ?? empty), status: cached === undefined ? 'loading' : 'success', message: '' } })
    cache.load(key, loader, { maxAge, force: refreshKey > 0 }).then(data => {
      if (!cancelled) setStored({ cache, key, state: { ...data, status: 'success', message: '' } })
    }).catch(error => {
      if (cancelled) return
      const previous = cache.peek(key)
      setStored({ cache, key, state: { ...(previous ?? empty), status: previous === undefined ? 'error' : 'success', message: error.message } })
    })
    return () => { cancelled = true }
  }, [cache, key, loader, empty, refreshKey, maxAge])

  function update(updater) {
    const current = { ...(cache.peek(key) ?? empty), status: 'success', message: '' }
    const next = typeof updater === 'function' ? updater(current) : updater
    cache.set(key, next)
    setStored({ cache, key, state: next })
  }
  return [state, update]
}
