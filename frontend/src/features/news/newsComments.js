import { API_BASE_URL, readApiResponse } from '../../api/client'

const versions = new WeakMap()
export const commentsUrl = id => `${API_BASE_URL}/api/news/${id}/comments`
function revision(cache, id) { return versions.get(cache)?.get(id) || 0 }

export function updateNewsComments(cache, id, updater) {
  const items = updater(cache.peek(commentsUrl(id)) || [])
  if (!versions.has(cache)) versions.set(cache, new Map())
  versions.get(cache).set(id, revision(cache, id) + 1)
  cache.set(commentsUrl(id), items)
  return items
}

export function loadNewsComments(cache, id, token) {
  return cache.load(commentsUrl(id), async () => {
    const started = revision(cache, id)
    const items = await fetch(commentsUrl(id), { headers: token ? { Authorization: `Bearer ${token}` } : {} }).then(readApiResponse)
    if (!Array.isArray(items)) throw new Error('Comments could not be loaded. Please try again.')
    if (revision(cache, id) === started) return items
    // A prefetch that finishes after a post/vote must preserve the local confirmed/optimistic changes.
    const current = cache.peek(commentsUrl(id)) || []
    const ids = new Set(current.map(comment => comment.id))
    return [...current, ...items.filter(comment => !ids.has(comment.id))]
  })
}
