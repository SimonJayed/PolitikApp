import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { API_BASE_URL, readApiResponse } from '../../api/client'
import { newsCacheFor, publicReadCache } from '../../api/readCache'
import { useCachedRead } from '../../api/useCachedRead'
import { useAuth } from '../../auth/AuthContext'
import {
  BookmarkIcon,
  ExternalLinkIcon,
  FileTextIcon,
  MessageCircleIcon,
  SearchIcon,
  ShieldCheckIcon,
  ThumbDownIcon,
  ThumbUpIcon,
} from '../../components/icons/Lucide'
import './Dashboard.css'
import NewsArticleReader from '../../components/NewsArticleReader'
import { PaginationMini } from '../pageHelpers'
import NewsCardContent from '../../components/NewsCardContent'
import { safeNewsUrl } from '../../features/news/newsPresentation'
import { createOptimisticActions, relativeCommentTime } from '../../features/news/optimisticActions'
import { commentsUrl, loadNewsComments, updateNewsComments } from '../../features/news/newsComments'

const categories = ['All', 'Legislation', 'Government Projects', 'Public Spending', 'Audit Reports', 'Government Announcements']
const INSIGHTS_SAMPLE_SIZE = 50
const EMPTY_FEED = { items: [], totalPages: 1, totalElements: 0 }
const EMPTY_INSIGHTS = { items: [], total: 0 }
const EMPTY_SUMMARY = { data: null }
const SUMMARY_URL = `${API_BASE_URL}/api/news/summary`
const loadSummary = () => fetch(SUMMARY_URL).then(readApiResponse).then(data => ({ data }))

// Category colors come from the App.css flag palette (--ph-*), so they follow the theme.
const categoryColors = {
  Legislation: 'var(--ph-blue)',
  'Government Projects': 'var(--ph-gold)',
  'Public Spending': 'var(--ph-red)',
  'Audit Reports': 'var(--ph-gold-light)',
  'Government Announcements': 'var(--ph-blue-light)',
}
const colorFor = (category) => categoryColors[category] || 'var(--ph-blue-light)'

function localDayKey(date) {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

export default function Dashboard({ onOpenProfile, politicians = [], user }) {
  const { token } = useAuth()
  const [activeCategory, setActiveCategory] = useState('All')
  const [readingId, setReadingId] = useState(null)
  const [sort, setSort] = useState('newest')
  const [queryInput, setQueryInput] = useState('')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(0)
  const [commentsByPost, setCommentsByPost] = useState({})
  const [openComments, setOpenComments] = useState({})
  const [drafts, setDrafts] = useState({})
  const [actionMessage, setActionMessage] = useState('')
  const [busy, setBusy] = useState({})
  const [expanded, setExpanded] = useState({})
  const [reloadKey, setReloadKey] = useState(0)
  const feedTopRef = useRef(null)
  const queryRef = useRef('')
  const optimisticAction = useMemo(() => {
    const enqueue = createOptimisticActions()
    return (key, ...args) => enqueue(`${token || 'guest'}:${key}`, ...args)
  }, [token])
  const [commentNow, setCommentNow] = useState(Date.now)
  useEffect(() => {
    const interval = setInterval(() => setCommentNow(Date.now()), 60000)
    return () => clearInterval(interval)
  }, [])

  const newsCache = useMemo(() => newsCacheFor(token), [token])
  const [summary] = useCachedRead(publicReadCache, SUMMARY_URL, loadSummary, EMPTY_SUMMARY, reloadKey)
  const insightsUrl = `${API_BASE_URL}/api/news?${new URLSearchParams({ page: '0', size: String(INSIGHTS_SAMPLE_SIZE), sort: 'newest' })}`
  const loadInsights = useCallback(async () => {
    const data = await fetch(insightsUrl, { headers: token ? { Authorization: `Bearer ${token}` } : {} }).then(readApiResponse)
    const items = Array.isArray(data.content) ? data.content : []
    return { items, total: Number(data.totalElements ?? items.length) }
  }, [insightsUrl, token])
  const [insights, setInsights] = useCachedRead(newsCache, insightsUrl, loadInsights, EMPTY_INSIGHTS, reloadKey)

  const feedParams = new URLSearchParams({ page: String(page), size: '8', sort })
  if (activeCategory !== 'All' && activeCategory !== 'Latest') feedParams.set('category', activeCategory)
  if (query) feedParams.set('q', query)
  const feedUrl = `${API_BASE_URL}/api/news?${feedParams}`
  const loadFeed = useCallback(async () => {
    const data = await fetch(feedUrl, { headers: token ? { Authorization: `Bearer ${token}` } : {} }).then(readApiResponse)
    const items = Array.isArray(data.content) ? data.content : []
    return { items, totalPages: Math.max(1, Number(data.totalPages || 1)), totalElements: Number(data.totalElements ?? items.length) }
  }, [feedUrl, token])
  const [feed, setFeed] = useCachedRead(newsCache, feedUrl, loadFeed, EMPTY_FEED, reloadKey)
  const commentPrefetchIds = feed.items.map(post => post.id).join('|')
  useEffect(() => {
    let cancelled = false
    for (const id of commentPrefetchIds.split('|').filter(Boolean)) {
      loadNewsComments(newsCache, id, token).then(items => {
        if (!cancelled) setCommentsByPost(all => ({ ...all, [id]: { status: 'success', items } }))
      }).catch(() => {}) // Opening the thread provides a retry and visible errors if needed.
    }
    return () => { cancelled = true }
  }, [commentPrefetchIds, newsCache, token])
  useEffect(() => { setCommentsByPost({}); setOpenComments({}) }, [newsCache])

  // Debounced search: avoids a request on every keystroke
  useEffect(() => {
    const timer = setTimeout(() => {
      const next = queryInput.trim()
      if (next !== queryRef.current) {
        queryRef.current = next
        setQuery(next)
        setPage(0)
      }
    }, 350)
    return () => clearTimeout(timer)
  }, [queryInput])

  const changeCategory = (category) => { setActiveCategory(category); setPage(0) }
  const changeSort = (value) => { setSort(value); setPage(0) }
  const resetSearch = () => { queryRef.current = ''; setQueryInput(''); setQuery(''); setPage(0) }
  const clearFilters = () => { resetSearch(); setActiveCategory('All'); setSort('newest') }
  const goToPage = useCallback((next) => {
    setPage(next)
    feedTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [])

  const filtersActive = activeCategory !== 'All' || query !== '' || sort !== 'newest'

  const analytics = useMemo(() => {
    const items = insights.items
    const counts = new Map()
    items.forEach((item) => counts.set(item.category, (counts.get(item.category) || 0) + 1))
    const categoryList = [...counts.entries()].sort((a, b) => b[1] - a[1])

    const engagement = [...items]
      .filter((item) => Number(item.commentCount || 0) > 0)
      .sort((a, b) => Number(b.commentCount || 0) - Number(a.commentCount || 0))
      .slice(0, 4)

    const publications = Array.from({ length: 7 }, (_, index) => {
      const date = new Date()
      date.setHours(0, 0, 0, 0)
      date.setDate(date.getDate() - (6 - index))
      const key = localDayKey(date)
      const label = new Intl.DateTimeFormat('en-PH', { weekday: 'short' }).format(date)
      const value = items.filter((item) => item.publishedAt && localDayKey(new Date(item.publishedAt)) === key).length
      return { label, value }
    })

    return { categoryList, engagement, publications, sampleSize: items.length }
  }, [insights.items])

  async function guarded(key, task) {
    setActionMessage('')
    setBusy((all) => ({ ...all, [key]: true }))
    try {
      await task()
    } catch (error) {
      setActionMessage(error.message || 'Something went wrong. Please try again.')
    } finally {
      setBusy((all) => ({ ...all, [key]: false }))
    }
  }

  async function loadComments(newsId) {
    setOpenComments(all => ({ ...all, [newsId]: !all[newsId] }))
    if (openComments[newsId]) return
    const cached = newsCache.peek(commentsUrl(newsId))
    if (cached) setCommentsByPost(all => ({ ...all, [newsId]: { status: 'success', items: cached } }))
    try {
      const comments = await loadNewsComments(newsCache, newsId, token)
      setCommentsByPost((all) => ({ ...all, [newsId]: { status: 'success', items: comments } }))
    } catch (error) {
      setCommentsByPost((all) => ({ ...all, [newsId]: { status: 'error', message: error.message, items: all[newsId]?.items || [] } }))
    }
  }

  function submitComment(event, newsId) {
    event.preventDefault()
    if (!token) return
    const content = (drafts[newsId] || '').trim()
    if (!content) return
    return guarded(`comment-${newsId}`, async () => {
      const comment = await fetch(`${API_BASE_URL}/api/news/${newsId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ content }),
      }).then(readApiResponse)
      const receivedAt = Date.now()
      setCommentNow(receivedAt)
      setDrafts((all) => ({ ...all, [newsId]: '' }))
      const items = updateNewsComments(newsCache, newsId, current => [{ ...comment, displayCreatedAt: new Date(receivedAt).toISOString() }, ...current.filter(item => item.id !== comment.id)])
      setCommentsByPost((all) => ({
        ...all,
        [newsId]: { status: 'success', items },
      }))
      const bump = (item) => item.id === newsId ? { ...item, commentCount: Number(item.commentCount || 0) + 1 } : item
      newsCache.retain([feedUrl, insightsUrl, ...feed.items.flatMap(post => [commentsUrl(post.id), `${API_BASE_URL}/api/news/${post.id}`])])
      setFeed((current) => ({ ...current, items: current.items.map(bump) }))
      setInsights((current) => ({ ...current, items: current.items.map(bump) }))
    })
  }

  function vote(commentId, newsId, voteType) {
    if (!token) {
      setActionMessage('Sign in to vote on comments.')
      return
    }
    const comment = commentsByPost[newsId]?.items.find(item => item.id === commentId)
    if (!comment || (comment.voted && comment.voteType !== voteType)) return
    setActionMessage('')
    const removing = comment.voteType === voteType
    const desired = { ...comment, voted: !removing, voteType: removing ? null : voteType,
      upvotes: Math.max(0, Number(comment.upvotes || 0) + (voteType === 'UP' ? (removing ? -1 : 1) : 0)),
      downvotes: Math.max(0, Number(comment.downvotes || 0) + (voteType === 'DOWN' ? (removing ? -1 : 1) : 0)) }
    const apply = updated => {
      const items = updateNewsComments(newsCache, newsId, current => current.map(item => item.id === commentId ? { ...item, ...updated } : item))
      setCommentsByPost(all => ({ ...all, [newsId]: {
      ...(all[newsId] || { status: 'success' }),
      items,
    } })) }
    const postVote = type => fetch(`${API_BASE_URL}/api/comments/${commentId}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ voteType: type }),
      }).then(readApiResponse)
    return optimisticAction(`vote-${commentId}`, comment, desired, apply, async (confirmed, target, confirm) => {
      let updated = confirmed
      if (updated.voteType && updated.voteType !== target.voteType) { updated = await postVote(updated.voteType); confirm(updated) }
      if (target.voteType && updated.voteType !== target.voteType) { updated = await postVote(target.voteType); confirm(updated) }
      return updated
    }, error => setActionMessage(error.message || 'Your vote could not be saved. Please try again.'))
  }

  function savePost(newsId) {
    if (!token) {
      setActionMessage('Sign in to save posts.')
      return
    }
    const post = feed.items.find((item) => item.id === newsId)
    if (!post) return
    const isSaved = Boolean(post?.saved)
    setActionMessage('')
    const apply = saved => {
      const toggle = item => item.id === newsId ? { ...item, saved } : item
      newsCache.retain([feedUrl, insightsUrl, ...feed.items.flatMap(post => [commentsUrl(post.id), `${API_BASE_URL}/api/news/${post.id}`])])
      setFeed(current => ({ ...current, items: current.items.map(toggle) }))
      setInsights(current => ({ ...current, items: current.items.map(toggle) }))
    }
    return optimisticAction(`save-${newsId}`, isSaved, !isSaved, apply, async (confirmed, target) => {
      if (confirmed === target) return confirmed
      const response = await fetch(`${API_BASE_URL}/api/news/${newsId}/save`, {
        method: target ? 'POST' : 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!response.ok) await readApiResponse(response)
      return target
    }, error => setActionMessage(error.message || 'Your bookmark could not be saved. Please try again.'))
  }

  const suggestedPoliticians = politicians.slice(0, 4)
  const summaryValue = (value) =>
    summary.status === 'loading' ? '—' : summary.status === 'error' ? 'N/A' : Number(value ?? 0).toLocaleString('en-PH')

  const stats = [
    { label: 'Legislative records', value: summary.data?.legislativeRecordsTracked, Icon: FileTextIcon },
    { label: 'Recent updates', value: summary.data?.recentGovernmentUpdates, Icon: ShieldCheckIcon },
    { label: 'Active discussions', value: summary.data?.activeCitizenDiscussions, Icon: MessageCircleIcon },
  ]

  // Donut chart geometry
  const donutTotal = analytics.categoryList.reduce((sum, [, count]) => sum + count, 0)
  const donutGradient = (() => {
    if (donutTotal === 0) return 'conic-gradient(var(--d-line) 0 100%)'
    let start = 0
    const stops = analytics.categoryList.map(([name, count]) => {
      const end = start + (count / donutTotal) * 100
      const stop = `${colorFor(name)} ${start.toFixed(2)}% ${end.toFixed(2)}%`
      start = end
      return stop
    })
    return `conic-gradient(${stops.join(', ')})`
  })()

  // Weekly activity chart geometry
  const weekMax = Math.max(1, ...analytics.publications.map((day) => day.value))
  const weekPoints = analytics.publications.map((day, index) => ({
    x: 10 + index * (260 / 6),
    y: 70 - (day.value / weekMax) * 56,
    ...day,
  }))
  const weekLine = weekPoints.map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(' ')
  const weekArea = `10,76 ${weekLine} 270,76`
  const weekTotal = analytics.publications.reduce((sum, day) => sum + day.value, 0)

  return (
    <section className="newsFeedShell">
      <header className="dashHero">
        <div className="dashHeroTop">
          <div className="dashHeroText">
            <h1>Government News</h1>
            <p>Verified public feed</p>
          </div>
          <label className="feedSearch">
            <SearchIcon size={16} />
            <input
              type="search"
              aria-label="Search official updates"
              value={queryInput}
              onChange={(event) => setQueryInput(event.target.value)}
              placeholder="Search official updates"
            />
            {queryInput && (
              <button className="searchClear" type="button" aria-label="Clear search" onClick={resetSearch}>×</button>
            )}
          </label>
        </div>

        <div className="dashStats" aria-label="At a glance">
          {stats.map(({ label, value, Icon }) => (
            <article className="dashStat" key={label}>
              <span className="dashStatIcon"><Icon size={16} /></span>
              <div>
                <strong>{summaryValue(value)}</strong>
                <span>{label}</span>
              </div>
            </article>
          ))}
        </div>
        {summary.status === 'error' && (
          <p className="dashHeroError" title={summary.message}>
            Stats are unavailable right now.
            <button type="button" onClick={() => setReloadKey((key) => key + 1)}>Retry</button>
          </p>
        )}
      </header>

      <div className="dashBody">
        <main className="feedMain">
          <div className="feedControls" ref={feedTopRef} aria-label="News filters">
            <div className="categoryScroller" role="tablist" aria-label="Categories">
              {categories.map((category) => (
                <button
                  className={activeCategory === category ? 'active' : ''}
                  key={category}
                  onClick={() => changeCategory(category)}
                  role="tab"
                  aria-selected={activeCategory === category}
                  style={{ '--cat': colorFor(category) }}
                  type="button"
                >
                  {categoryColors[category] && <i className="categoryDot" />}
                  {category}
                </button>
              ))}
            </div>
            <div className="sortToggle" role="group" aria-label="Sort news">
              {[['newest', 'Newest'], ['oldest', 'Oldest']].map(([value, label]) => (
                <button
                  className={sort === value ? 'active' : ''}
                  key={value}
                  type="button"
                  aria-pressed={sort === value}
                  onClick={() => changeSort(value)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {actionMessage && (
            <p className="dashboardActionMessage" role="alert">
              <span>{actionMessage}</span>
              <button type="button" onClick={() => setActionMessage('')} aria-label="Dismiss message">×</button>
            </p>
          )}

          {feed.status === 'success' && feed.items.length > 0 && (
            <p className="feedResultMeta" aria-live="polite">
              <span>
                {feed.totalElements.toLocaleString('en-PH')} update{feed.totalElements === 1 ? '' : 's'}
                {query && <> matching “{query}”</>}
                {activeCategory !== 'All' && activeCategory !== 'Latest' && <> in {activeCategory}</>}
              </span>
              {filtersActive && <button type="button" onClick={clearFilters}>Clear filters</button>}
            </p>
          )}

          {feed.status === 'loading' && <FeedSkeleton />}

          {feed.status === 'error' && (
            <div className="feedNotice error" role="alert">
              <strong>We couldn’t load the feed.</strong>
              <span>{feed.message}</span>
              <button type="button" onClick={() => setReloadKey((key) => key + 1)}>Try again</button>
            </div>
          )}

          {feed.status === 'success' && feed.items.length === 0 && (
            <div className="feedNotice">
              <FileTextIcon size={28} />
              {filtersActive ? (
                <>
                  <strong>No updates match these filters.</strong>
                  <span>Try a different keyword or category.</span>
                  <button type="button" onClick={clearFilters}>Clear filters</button>
                </>
              ) : (
                <>
                  <strong>No published government updates yet.</strong>
                  <span>Admins can fetch official articles, review AI summaries, and publish approved posts.</span>
                </>
              )}
            </div>
          )}

          <div className="postStack">
            {readingId && <NewsArticleReader id={readingId} initialArticle={feed.items.find(post => post.id === readingId)} token={token} onClose={() => setReadingId(null)} onOpenProfile={onOpenProfile} />}
            {feed.status !== 'loading' && feed.items.map((post, index) => {
              const comments = commentsByPost[post.id]
              const open = Boolean(openComments[post.id])
              const isFeatured = index === 0 && page === 0 && sort === 'newest' && !query && activeCategory === 'All'


              const isExpanded = Boolean(expanded[post.id])

              return (
                <article
                  className={`newsPost${isFeatured ? ' featured' : ''}`}
                  key={post.id}
                  style={{ '--cat': colorFor(post.category) }}
                >
                  <header className="postMeta">
                    <span className="sourceBadge">{initials(post.sourceName)}</span>
                    <div>
                      <strong>{post.sourceName}</strong>
                      <time dateTime={post.originalPublishedAt || post.publishedAt || undefined} title={post.originalPublishedAt ? 'Original publication date' : 'Publication date on PolitikApp'}>
                        {post.originalPublishedAt || post.publishedAt ? formatDate(post.originalPublishedAt || post.publishedAt) : 'Publication date unavailable'}
                      </time>
                    </div>
                    {post.adminVerified && <span className="verifiedPill"><ShieldCheckIcon size={14} /> Admin reviewed</span>}
                  </header>

                  <NewsCardContent article={post} expanded={isExpanded} onToggle={() => setExpanded(all => ({ ...all, [post.id]: !all[post.id] }))} />
                  <footer className="postActions">
                    <button type="button" onClick={() => setReadingId(post.id)}>Read article</button>
                    <button type="button" aria-expanded={open} onClick={() => loadComments(post.id)}>
                      <MessageCircleIcon size={17} />
                      <span>{open ? 'Hide comments' : `${post.commentCount ?? 0} comment${post.commentCount === 1 ? '' : 's'}`}</span>
                    </button>
                    <div className="postActionsEnd">
                      {safeNewsUrl(post.sourceUrl) && <a className="sourceLink" href={safeNewsUrl(post.sourceUrl)} target="_blank" rel="noopener noreferrer">
                        <ExternalLinkIcon size={17} />
                        <span>Read original</span>
                      </a>}
                      <button
                        className={`saveIconButton${post.saved ? ' saved' : ''}`}
                        aria-label={post.saved ? 'Unsave update' : 'Save update'}
                        aria-pressed={Boolean(post.saved)}
                        title={token ? (post.saved ? 'Unsave update' : 'Save update') : 'Sign in to save posts'}
                        type="button"
                        onClick={() => savePost(post.id)}
                      >
                        <BookmarkIcon fill={post.saved ? 'currentColor' : 'none'} size={17} />
                      </button>
                    </div>
                  </footer>

                  {open && (
                    <section className="commentPanel" aria-label="Comments">
                      {token ? (
                        <form onSubmit={(event) => submitComment(event, post.id)}>
                          <input
                            aria-label="Write a comment"
                            maxLength={1000}
                            placeholder="Add a comment. Your name stays hidden."
                            value={drafts[post.id] || ''}
                            onChange={(event) => setDrafts((all) => ({ ...all, [post.id]: event.target.value }))}
                          />
                          <button disabled={!(drafts[post.id] || '').trim() || busy[`comment-${post.id}`]} type="submit">
                            {busy[`comment-${post.id}`] ? 'Posting…' : 'Post'}
                          </button>
                        </form>
                      ) : (
                        <p className="ty-meta commentHint">Sign in to join the discussion. Comments are anonymous.</p>
                      )}
                      {comments?.status === 'error' && <p className="ty-meta commentHint">{comments.message}</p>}
                      {comments?.status === 'success' && comments.items?.length === 0 && (
                        <p className="ty-meta commentHint">No comments yet. Start the discussion.</p>
                      )}
                      {comments?.items?.map((comment) => (
                        <div className="commentRow" key={comment.id}>
                          <span className="commentAvatar">{initials(comment.authorLabel)}</span>
                          <div className="commentText">
                            <strong>{comment.authorLabel}</strong>
                            <time dateTime={comment.createdAt}>{relativeCommentTime(comment.displayCreatedAt || comment.createdAt, commentNow)}</time>
                            <p>{comment.content}</p>
                          </div>
                          <div className="voteButtons">
                            <button
                              className={`voteUp${comment.voteType === 'UP' ? ' is-selected' : ''}`}
                              aria-label="Upvote"
                              title={token ? 'Upvote' : 'Sign in to vote'}
                              aria-pressed={comment.voteType === 'UP'}
                              disabled={comment.voted && comment.voteType !== 'UP'}
                              type="button"
                              onClick={() => vote(comment.id, post.id, 'UP')}
                            >
                              <ThumbUpIcon size={15} className={comment.voteType === 'UP' ? 'voteIconSelected' : ''} />
                              <span>{comment.upvotes ?? 0}</span>
                            </button>
                            <button
                              className={`voteDown${comment.voteType === 'DOWN' ? ' is-selected' : ''}`}
                              aria-label="Downvote"
                              title={token ? 'Downvote' : 'Sign in to vote'}
                              aria-pressed={comment.voteType === 'DOWN'}
                              disabled={comment.voted && comment.voteType !== 'DOWN'}
                              type="button"
                              onClick={() => vote(comment.id, post.id, 'DOWN')}
                            >
                              <ThumbDownIcon size={15} className={comment.voteType === 'DOWN' ? 'voteIconSelected' : ''} />
                              <span>{comment.downvotes ?? 0}</span>
                            </button>
                          </div>
                        </div>
                      ))}
                    </section>
                  )}
                </article>
              )
            })}
          </div>

          {feed.totalPages > 1 && (
            <nav className="feedPager" aria-label="News pagination">
              <PaginationMini page={page + 1} totalPages={feed.totalPages} onChange={(nextPage) => goToPage(nextPage - 1)} />
            </nav>
          )}
        </main>

        <aside className="feedRail" aria-label="Insights and context">
          <section className="railCard">
            <div className="railCardHead">
              <h2>Topics</h2>
              <span>Latest {analytics.sampleSize || 0} posts</span>
            </div>
            {insights.status === 'error' && <p className="railEmpty">Charts are unavailable right now.</p>}
            {insights.status !== 'error' && (
              <div className="donutWrap">
                <div className="donut" style={{ background: donutGradient }} role="img" aria-label="Share of posts by category">
                  <div className="donutHole">
                    <strong>{insights.status === 'loading' ? '—' : donutTotal}</strong>
                    <span>posts</span>
                  </div>
                </div>
                <ul className="donutLegend">
                  {analytics.categoryList.length === 0 && insights.status === 'success' && <li className="railEmpty">Nothing published yet.</li>}
                  {analytics.categoryList.map(([name, count]) => (
                    <li key={name} style={{ '--cat': colorFor(name) }}>
                      <i className="categoryDot" />
                      <span title={name}>{name}</span>
                      <strong>{Math.round((count / donutTotal) * 100)}%</strong>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>

          <section className="railCard">
            <div className="railCardHead">
              <h2>This week</h2>
              <span>{weekTotal} published</span>
            </div>
            <svg className="weekChart" viewBox="0 0 280 90" role="img" aria-label="Posts published per day over the last 7 days" preserveAspectRatio="none">
              <defs>
                <linearGradient id="dashWeekFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--d-primary)" stopOpacity="0.28" />
                  <stop offset="100%" stopColor="var(--d-primary)" stopOpacity="0" />
                </linearGradient>
              </defs>
              <polygon points={weekArea} fill="url(#dashWeekFill)" />
              <polyline points={weekLine} fill="none" stroke="var(--d-primary)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
              {weekPoints.map((point) => (
                <circle key={point.label + point.x} cx={point.x} cy={point.y} r="3.5" fill="var(--d-surface)" stroke="var(--d-primary)" strokeWidth="2" vectorEffect="non-scaling-stroke">
                  <title>{`${point.label}: ${point.value}`}</title>
                </circle>
              ))}
            </svg>
            <div className="weekLabels">
              {analytics.publications.map((day, index) => <span key={`${day.label}-${index}`}>{day.label}</span>)}
            </div>
          </section>

          <section className="railCard">
            <div className="railCardHead">
              <h2>Most discussed</h2>
            </div>
            {analytics.engagement.length === 0 ? (
              <p className="railEmpty">No discussions yet.</p>
            ) : (
              <ol className="discussedList">
                {analytics.engagement.map((item) => (
                  <li key={item.id} style={{ '--cat': colorFor(item.category) }}>
                    <span className="discussedCount"><MessageCircleIcon size={13} />{Number(item.commentCount || 0)}</span>
                    <p title={item.headline}>{item.headline || item.originalTitle}</p>
                  </li>
                ))}
              </ol>
            )}
          </section>

          <section className="railCard">
            <div className="railCardHead">
              <h2>Suggested politicians</h2>
            </div>
            {suggestedPoliticians.map((politician) => (
              <button className="politicianSuggestion" key={politician.politicianId} onClick={() => onOpenProfile?.(politician.politicianId)} type="button">
                <span>{initials(politician.fullName)}</span>
                <strong>{politician.fullName}</strong>
              </button>
            ))}
            {suggestedPoliticians.length === 0 && <p className="railEmpty">No profiles loaded.</p>}
          </section>

          {user?.role === 'ADMIN' && (
            <section className="railCard adminCard">
              <div className="railCardHead">
                <h2>Admin</h2>
              </div>
              <p className="railEmpty">News retrieval and review APIs are ready for an admin queue screen.</p>
            </section>
          )}
        </aside>
      </div>
    </section>
  )
}

function FeedSkeleton() {
  return (
    <div className="postStack" aria-hidden="true">
      {Array.from({ length: 3 }).map((_, index) => (
        <div className="newsPost skeleton" key={index}>
          <i style={{ width: '38%' }} />
          <i style={{ width: '90%', height: 22 }} />
          <i style={{ width: '100%' }} />
          <i style={{ width: '70%' }} />
        </div>
      ))}
    </div>
  )
}

function initials(name = '') {
  return String(name).split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'PH'
}

function formatDate(value) {
  if (!value) return 'Date unavailable'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Date unavailable'
  return new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium' }).format(date)
}
