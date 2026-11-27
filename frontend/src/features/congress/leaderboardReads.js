import { API_BASE_URL, readApiResponse } from '../../api/client'
import { fetchReadWithRetry } from '../../api/readRequest'
import { publicReadCache } from '../../api/readCache'
import { useCachedRead } from '../../api/useCachedRead'
import { rankedLeaderboardEntries } from './wgiLeaderboard'

export const LEADERBOARD_SNAPSHOT_KEY = `${API_BASE_URL}/api/politicians/leaderboard:visible`
const LEADERBOARD_FIRST_PAGE = `${API_BASE_URL}/api/politicians/leaderboard?offset=0&limit=6`
const emptyLeaderboard = { entries: [] }
const loadFirstPage = () => fetchReadWithRetry(LEADERBOARD_FIRST_PAGE).then(readApiResponse)

export function prefetchLeaderboard() {
  return publicReadCache.load(LEADERBOARD_FIRST_PAGE, loadFirstPage).then(result => {
    if (!Array.isArray(result.entries)) throw new Error('Leaderboard response unavailable.')
    const next = { ...result, entries: rankedLeaderboardEntries(result.entries), status: 'ready', error: '' }
    publicReadCache.set(LEADERBOARD_SNAPSHOT_KEY, next)
    return next
  })
}

export function useLeaderboardFirstPage() {
  const [leaderboard] = useCachedRead(publicReadCache, LEADERBOARD_FIRST_PAGE, loadFirstPage, emptyLeaderboard)
  return leaderboard
}
