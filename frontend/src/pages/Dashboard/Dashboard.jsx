import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080'
const categories = ['All', 'Legislation', 'Government Projects', 'Public Spending', 'Audit Reports', 'Government Announcements']
const INSIGHTS_SAMPLE_SIZE = 50

// Boilerplate strings that should never be shown to readers.
const HIDDEN_TEXT = [
  'Retrieved from an approved government source.',
  'Retrieved from an approved government source',
  'Needs administrator verification before publication.',
]
const stripHidden = (text = '') =>
  HIDDEN_TEXT.reduce((result, phrase) => result.split(phrase).join(''), String(text)).replace(/\s{2,}/g, ' ').trim()
const isHiddenPoint = (point) => HIDDEN_TEXT.some((phrase) => String(point).trim() === phrase)

// Category colors come from the App.css flag palette (--ph-*), so they follow the theme.
const categoryColors = {
  Legislation: 'var(--ph-blue)',
  'Government Projects': 'var(--ph-gold)',
  'Public Spending': 'var(--ph-red)',
  'Audit Reports': 'var(--ph-gold-light)',
  'Government Announcements': 'var(--ph-blue-light)',
}
const colorFor = (category) => categoryColors[category] || 'var(--ph-blue-light)'

async function readApiResponse(response) {
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(body.message || `Request failed with status ${response.status}`)
  return body
}

function localDayKey(date) {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

export default function Dashboard({ onOpenProfile, politicians = [], user }) {
  const { token } = useAuth()
  const [activeCategory, setActiveCategory] = useState('All')
  const [sort, setSort] = useState('newest')
  const [queryInput, setQueryInput] = useState('')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(0)
  const [feed, setFeed] = useState({ status: 'loading', message: '', items: [], totalPages: 1, totalElements: 0 })
  const [insights, setInsights] = useState({ status: 'loading', items: [], total: 0 })
  const [commentsByPost, setCommentsByPost] = useState({})
  const [drafts, setDrafts] = useState({})
  const [summary, setSummary] = useState({ status: 'loading', data: null, message: '' })
  const [actionMessage, setActionMessage] = useState('')
  const [busy, setBusy] = useState({})
  const [expanded, setExpanded] = useState({})
  const [reloadKey, setReloadKey] = useState(0)
  const feedTopRef = useRef(null)
  const queryRef = useRef('')

  // Platform summary numbers (backend aggregate endpoint)
  useEffect(() => {
    fetch(`${API_BASE_URL}/api/news/summary`)
      .then(readApiResponse)
      .then((data) => setSummary({ status: 'success', data, message: '' }))
      .catch((error) => setSummary({ status: 'error', data: null, message: error.message }))
  }, [reloadKey])

  // Chart data: the most recent published posts, independent of the filters below,
  // so the charts reflect the platform instead of whichever page is on screen.
  useEffect(() => {
    const controller = new AbortController()
    const params = new URLSearchParams({ page: '0', size: String(INSIGHTS_SAMPLE_SIZE), sort: 'newest' })
    fetch(`${API_BASE_URL}/api/news?${params}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      signal: controller.signal,
    })
      .then(readApiResponse)
      .then((data) => {
        const items = Array.isArray(data.content) ? data.content : []
        setInsights({ status: 'success', items, total: Number(data.totalElements ?? items.length) })
      })
      .catch((error) => {
        if (error.name === 'AbortError') return
        setInsights({ status: 'error', items: [], total: 0 })
      })
    return () => controller.abort()
  }, [token, reloadKey])

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

  // Filtered, paginated feed
  useEffect(() => {
    const controller = new AbortController()
    const params = new URLSearchParams({ page: String(page), size: '8', sort })
    if (activeCategory !== 'All' && activeCategory !== 'Latest') params.set('category', activeCategory)
    if (query) params.set('q', query)

    setFeed((current) => ({ ...current, status: 'loading', message: '' }))
    fetch(`${API_BASE_URL}/api/news?${params}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      signal: controller.signal,
    })
      .then(readApiResponse)
      .then((data) => {
        const items = Array.isArray(data.content) ? data.content : []
        setFeed({
          status: 'success',
          message: '',
          items,
          totalPages: Math.max(1, Number(data.totalPages || 1)),
          totalElements: Number(data.totalElements ?? items.length),
        })
      })
      .catch((error) => {
        if (error.name === 'AbortError') return
        setFeed({ status: 'error', message: error.message, items: [], totalPages: 1, totalElements: 0 })
      })
    return () => controller.abort()
  }, [activeCategory, page, query, sort, token, reloadKey])

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
    const current = commentsByPost[newsId]
    if (current?.status === 'success') {
      setCommentsByPost((all) => ({ ...all, [newsId]: { status: 'idle', items: current.items } }))
      return
    }
    setCommentsByPost((all) => ({ ...all, [newsId]: { status: 'loading', items: [] } }))
    try {
      const comments = await fetch(`${API_BASE_URL}/api/news/${newsId}/comments`).then(readApiResponse)
      setCommentsByPost((all) => ({ ...all, [newsId]: { status: 'success', items: comments } }))
    } catch (error) {
      setCommentsByPost((all) => ({ ...all, [newsId]: { status: 'error', message: error.message, items: [] } }))
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
      setDrafts((all) => ({ ...all, [newsId]: '' }))
      setCommentsByPost((all) => ({
        ...all,
        [newsId]: { status: 'success', items: [comment, ...(all[newsId]?.items || [])] },
      }))
      const bump = (item) => item.id === newsId ? { ...item, commentCount: Number(item.commentCount || 0) + 1 } : item
      setFeed((current) => ({ ...current, items: current.items.map(bump) }))
      setInsights((current) => ({ ...current, items: current.items.map(bump) }))
    })
  }

  function vote(commentId, newsId, voteType) {
    if (!token) {
      setActionMessage('Sign in to vote on comments.')
      return
    }
    if (busy[`vote-${commentId}`]) return
    return guarded(`vote-${commentId}`, async () => {
      const updated = await fetch(`${API_BASE_URL}/api/comments/${commentId}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ voteType }),
      }).then(readApiResponse)
      setCommentsByPost((all) => ({
        ...all,
        [newsId]: {
          ...(all[newsId] || { status: 'success' }),
          items: (all[newsId]?.items || []).map((item) => item.id === commentId ? updated : item),
        },
      }))
    })
  }

  function savePost(newsId) {
    if (!token) {
      setActionMessage('Sign in to save posts.')
      return
    }
    if (busy[`save-${newsId}`]) return
    const post = feed.items.find((item) => item.id === newsId)
    const isSaved = Boolean(post?.saved)
    return guarded(`save-${newsId}`, async () => {
      const response = await fetch(`${API_BASE_URL}/api/news/${newsId}/save`, {
        method: isSaved ? 'DELETE' : 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!response.ok) await readApiResponse(response)
      const toggle = (item) => item.id === newsId ? { ...item, saved: !isSaved } : item
      setFeed((current) => ({ ...current, items: current.items.map(toggle) }))
      setInsights((current) => ({ ...current, items: current.items.map(toggle) }))
    })
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
            {feed.status !== 'loading' && feed.items.map((post, index) => {
              const comments = commentsByPost[post.id]
              const open = Boolean(comments?.status && comments.status !== 'idle')
              const isFeatured = index === 0 && page === 0 && sort === 'newest' && !query && activeCategory === 'All'
              const summaryText = stripHidden(post.summary)
              const longSummary = summaryText.length > 240
              const isExpanded = Boolean(expanded[post.id])
              const visiblePoints = (post.keyPoints || []).filter((point) => !isHiddenPoint(point)).slice(0, 3)
              const saveBusy = Boolean(busy[`save-${post.id}`])
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
                      <span title={`Published here ${formatDate(post.publishedAt)}`}>
                        {timeAgo(post.originalPublishedAt || post.publishedAt)}
                      </span>
                    </div>
                    {post.adminVerified && <span className="verifiedPill"><ShieldCheckIcon size={14} /> Verified</span>}
                  </header>

                  <div className="postBody">
                    <span className="categoryPill"><i className="categoryDot" />{post.category}</span>
                    <h2>{post.headline}</h2>
                    {summaryText && <p className={longSummary && !isExpanded ? 'clamped' : ''}>{summaryText}</p>}
                    {longSummary && (
                      <button
                        className="readMore"
                        type="button"
                        aria-expanded={isExpanded}
                        onClick={() => setExpanded((all) => ({ ...all, [post.id]: !isExpanded }))}
                      >
                        {isExpanded ? 'Show less' : 'Show more'}
                      </button>
                    )}
                    {visiblePoints.length > 0 && (
                      <ul className="keyPoints">
                        {visiblePoints.map((point) => <li key={point}>{point}</li>)}
                      </ul>
                    )}
                  </div>

                  <footer className="postActions">
                    <button type="button" aria-expanded={open} onClick={() => loadComments(post.id)}>
                      <MessageCircleIcon size={17} />
                      <span>{open ? 'Hide comments' : `${post.commentCount ?? 0} comment${post.commentCount === 1 ? '' : 's'}`}</span>
                    </button>
                    <div className="postActionsEnd">
                      <a className="sourceLink" href={post.sourceUrl} target="_blank" rel="noreferrer">
                        <ExternalLinkIcon size={17} />
                        <span>Read original</span>
                      </a>
                      <button
                        className={`saveIconButton${post.saved ? ' saved' : ''}`}
                        aria-label={post.saved ? 'Unsave update' : 'Save update'}
                        aria-pressed={Boolean(post.saved)}
                        disabled={saveBusy}
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
                      {comments.status === 'loading' && <p className="ty-meta commentHint">Loading comments…</p>}
                      {comments.status === 'error' && <p className="ty-meta commentHint">{comments.message}</p>}
                      {comments.status === 'success' && comments.items?.length === 0 && (
                        <p className="ty-meta commentHint">No comments yet. Start the discussion.</p>
                      )}
                      {comments.items?.map((comment) => (
                        <div className="commentRow" key={comment.id}>
                          <span className="commentAvatar">{initials(comment.authorLabel)}</span>
                          <div className="commentText">
                            <strong>{comment.authorLabel}</strong>
                            <span>{timeAgo(comment.createdAt)}</span>
                            <p>{comment.content}</p>
                          </div>
                          <div className="voteButtons">
                            <button
                              className="voteUp"
                              aria-label="Upvote"
                              title={token ? 'Upvote' : 'Sign in to vote'}
                              disabled={busy[`vote-${comment.id}`]}
                              type="button"
                              onClick={() => vote(comment.id, post.id, 'UP')}
                            >
                              <ThumbUpIcon size={15} />
                            </button>
                            <strong>{comment.score}</strong>
                            <button
                              className="voteDown"
                              aria-label="Downvote"
                              title={token ? 'Downvote' : 'Sign in to vote'}
                              disabled={busy[`vote-${comment.id}`]}
                              type="button"
                              onClick={() => vote(comment.id, post.id, 'DOWN')}
                            >
                              <ThumbDownIcon size={15} />
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
              <button disabled={page === 0} onClick={() => goToPage(Math.max(0, page - 1))} type="button">Previous</button>
              <span>Page {page + 1} of {feed.totalPages}</span>
              <button disabled={page + 1 >= feed.totalPages} onClick={() => goToPage(page + 1)} type="button">Next</button>
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

function timeAgo(value) {
  if (!value) return 'Date unavailable'
  const time = new Date(value).getTime()
  if (Number.isNaN(time)) return 'Date unavailable'
  const seconds = Math.round((Date.now() - time) / 1000)
  if (seconds < 60) return 'Just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return formatDate(value)
}