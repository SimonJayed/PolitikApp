import { API_BASE_URL, readApiResponse } from '../../api/client'
import { fetchReadWithRetry } from '../../api/readRequest'
import { publicReadCache } from '../../api/readCache'
import { useCachedRead } from '../../api/useCachedRead'

const key = `${API_BASE_URL}/api/politicians/directory-memberships`
const empty = { people: [], currentCongress: null, asOfDate: '' }
const load = () => fetchReadWithRetry(key).then(readApiResponse)

export function prefetchDirectory() {
  return publicReadCache.load(key, load)
}

export function useDirectory(refreshKey = 0) {
  const [state] = useCachedRead(publicReadCache, key, load, empty, refreshKey)
  return { ...state, status: state.status === 'success' ? 'ready' : state.status, error: state.message }
}
