import { API_BASE_URL, readApiResponse } from '../../api/client'
import { fetchReadWithRetry } from '../../api/readRequest'
import { publicReadCache } from '../../api/readCache'
import { rankedLeaderboardEntries } from './wgiLeaderboard'

export const LEADERBOARD_SNAPSHOT_KEY = `${API_BASE_URL}/api/politicians/leaderboard:visible`
export function prefetchLeaderboard() {
  const url = `${API_BASE_URL}/api/politicians/leaderboard?offset=0&limit=6`
  return publicReadCache.load(url, () => fetchReadWithRetry(url).then(readApiResponse)).then(result => {
    if (!Array.isArray(result.entries)) throw new Error('Leaderboard response unavailable.')
    const next = { ...result, entries: rankedLeaderboardEntries(result.entries), status: 'ready', error: '' }
    publicReadCache.set(LEADERBOARD_SNAPSHOT_KEY, next)
    return next
  })
}
