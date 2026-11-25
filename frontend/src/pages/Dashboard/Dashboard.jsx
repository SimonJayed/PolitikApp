import { LoadingSkeleton } from "../../components/Skeletons"
import { updateNewsArticle } from '../../features/news/newsArticleCache'
import { newsPath } from '../../config/appRoutes'
import { fetchReadWithRetry } from '../../api/readRequest'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { API_BASE_URL, readApiResponse } from '../../api/client'
import { newsCacheFor, publicReadCache } from '../../api/readCache'
import { useCachedRead } from '../../api/useCachedRead'
import { useAuth } from '../../auth/AuthContext'
import {
  BookmarkIcon,
  FileTextIcon,
  MessageCircleIcon,
  SearchIcon,
  ShieldCheckIcon,
  ThumbDownIcon,
  ThumbUpIcon,
} from '../../components/icons/Lucide'
import './Dashboard.css'
import ActionToast from '../../components/ActionToast'
import NewsArticleReader from '../../components/NewsArticleReader'
import { PaginationMini } from '../pageHelpers'
import NewsCardContent, { ArticleMeta, PublisherLink } from '../../components/NewsCardContent'
import { categoryColors, colorFor, initials } from '../../features/news/newsPresentation'
import { relativeCommentTime } from '../../features/news/optimisticActions'
import { commentsUrl, loadNewsComments, updateNewsComments } from '../../features/news/newsComments'

const categories = ['All', 'Legislation', 'Government Projects', 'Public Spending', 'Audit Reports', 'Government Announcements']
const INSIGHTS_SAMPLE_SIZE = 50
const EMPTY_FEED = { items: [], totalPages: 1, totalElements: 0 }
const EMPTY_INSIGHTS = { items: [], total: 0 }
const EMPTY_SUMMARY = { data: null }
const SUMMARY_URL = `${API_BASE_URL}/api/news/summary`
const loadSummary = () => fetchReadWithRetry(SUMMARY_URL).then(readApiResponse).then(data => ({ data }))


const feedDefaults = { category: 'All', sort: 'newest', q: '', page: 0 }

function readFeedFilters() {
  const params = new URLSearchParams(window.location.search)
  const page = Number(params.get('page'))
  return {
    category: categories.includes(params.get('category')) ? params.get('category') : feedDefaults.category,
    sort: params.get('sort') === 'oldest' ? 'oldest' : feedDefaults.sort,
    q: params.get('q') || '',
    page: Number.isSafeInteger(page) && page >= 0 && page < 100000 ? page : 0,
  }
}

function updateFeedLocation(values) {
  const url = new URL(window.location.href)
  for (const [name, value] of Object.entries(values)) {
    if (value === feedDefaults[name]) url.searchParams.delete(name)
    else url.searchParams.set(name, value)
  }
  window.history.replaceState(window.history.state, '', url)
}

function localDayKey(date) {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

export default function Dashboard({ articleId, original, onOpenArticle, onAuthPrompt, onOpenProfile, loadPoliticians, politicians = [], user }) {
  const { token } = useAuth()
  const initialFilters = useMemo(readFeedFilters, [])
  const [activeCategory, setActiveCategory] = useState(initialFilters.category)
  const [sort, setSort] = useState(initialFilters.sort)
  const [queryInput, setQueryInput] = useState(initialFilters.q)
  const [query, setQuery] = useState(initialFilters.q)
  const [page, setPage] = useState(initialFilters.page)
  const [commentsByPost, setCommentsByPost] = useState({})
  const [openComments, setOpenComments] = useState({})
  const [drafts, setDrafts] = useState({})
  const [toast, setToast] = useState(null)
  const dismissToast = useCallback(() => setToast(null), [])
  const [savedById, setSavedById] = useState({})
  const writes = useRef(new Set())
  const activeToken = useRef(token)
  useEffect(() => { activeToken.current = token; setSavedById({}) }, [token])

  const [busy, setBusy] = useState({})
  const [expanded, setExpanded] = useState({})
  const [reloadKey, setReloadKey] = useState(0)
  const feedTopRef = useRef(null)
  const queryRef = useRef(initialFilters.q)
  const [commentNow, setCommentNow] = useState(Date.now)
  useEffect(() => {
    const interval = setInterval(() => setCommentNow(Date.now()), 60000)
    return () => clearInterval(interval)
  }, [])

  const newsCache = useMemo(() => newsCacheFor(token), [token])
  const insightsUrl = `${API_BASE_URL}/api/news?${new URLSearchParams({ page: '0', size: String(INSIGHTS_SAMPLE_SIZE), sort: 'newest', view: 'feed' })}`
  const loadInsights = useCallback(async () => {
    const data = await fetchReadWithRetry(insightsUrl, { headers: token ? { Authorization: `Bearer ${token}` } : {} }).then(readApiResponse)
    if (!Array.isArray(data.content)) throw new Error('The news feed returned an unexpected response.')
    const items = data.content
    return { items, total: Number(data.totalElements ?? items.length) }
  }, [insightsUrl, token])

  const feedParams = new URLSearchParams({ page: String(page), size: '8', sort, view: 'feed' })
  if (activeCategory !== 'All' && activeCategory !== 'Latest') feedParams.set('category', activeCategory)
  if (query) feedParams.set('q', query)
  const feedUrl = `${API_BASE_URL}/api/news?${feedParams}`
  const loadFeed = useCallback(async () => {
    const data = await fetchReadWithRetry(feedUrl, { headers: token ? { Authorization: `Bearer ${token}` } : {} }).then(readApiResponse)
    if (!Array.isArray(data.content)) throw new Error('The news feed returned an unexpected response.')
    const items = data.content
    return { items, totalPages: Math.max(1, Number(data.totalPages || 1)), totalElements: Number(data.totalElements ?? items.length) }
  }, [feedUrl, token])
  const [feed, setFeed] = useCachedRead(newsCache, articleId ? null : feedUrl, loadFeed, EMPTY_FEED, reloadKey)
  useEffect(() => {
    if (feed.status !== 'success' || page < feed.totalPages) return
    const next = feed.totalPages - 1
    setPage(next)
    updateFeedLocation({ page: next })
  }, [feed.status, feed.totalPages, page])
  const showInsights = !articleId && feed.status === 'success' && feed.items.length > 0
  useEffect(() => {
    if (showInsights && !politicians.length) loadPoliticians?.()
  }, [showInsights, politicians.length, loadPoliticians])
  const [summary] = useCachedRead(publicReadCache, showInsights ? SUMMARY_URL : null, loadSummary, EMPTY_SUMMARY, reloadKey)
  const [insights] = useCachedRead(newsCache, showInsights ? insightsUrl : null, loadInsights, EMPTY_INSIGHTS, reloadKey)

  useEffect(() => {
    setCommentsByPost({})
    setOpenComments({})
    setBusy({})
    setToast(null)
  }, [newsCache])

  useEffect(() => {
    function restore() {
      const filters = readFeedFilters()
      queryRef.current = filters.q
      setQuery(filters.q)
      setQueryInput(filters.q)
      setActiveCategory(filters.category)
      setSort(filters.sort)
      setPage(filters.page)
    }
    window.addEventListener('popstate', restore)
    return () => window.removeEventListener('popstate', restore)
  }, [])


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

  const changeCategory = (category) => { setActiveCategory(category); setPage(0); updateFeedLocation({ category, page: 0 }) }
  const changeSort = (value) => { setSort(value); setPage(0); updateFeedLocation({ sort: value, page: 0 }) }
  const resetSearch = () => { queryRef.current = ''; setQueryInput(''); setQuery(''); setPage(0); updateFeedLocation({ q: '', page: 0 }) }
  const clearFilters = () => { resetSearch(); setActiveCategory('All'); setSort('newest'); updateFeedLocation({ category: 'All', sort: 'newest' }) }
  const goToPage = useCallback((next) => {
    setPage(next)
    updateFeedLocation({ page: next })
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
    const requestKey = (token || 'guest') + ':' + key
    if (writes.current.has(requestKey)) return
    writes.current.add(requestKey)
    setBusy(all => ({ ...all, [key]: true }))
    try {
      await task()
    } catch (error) {
      if (activeToken.current === token) {
        if (error.status === 401) onAuthPrompt?.('session')
        else setToast({ text: error.message || 'Something went wrong. Please try again.', error: true })
      }
    } finally {
      writes.current.delete(requestKey)
      if (activeToken.current === token) setBusy(all => ({ ...all, [key]: false }))
    }
  }

  async function loadComments(newsId) {
    const cached = newsCache.peek(commentsUrl(newsId))
    setCommentsByPost(all => ({ ...all, [newsId]: { status: cached ? 'success' : 'loading', items: cached || [] } }))
    try {
      const items = await loadNewsComments(newsCache, newsId, token)
      if (activeToken.current === token) setCommentsByPost(all => ({ ...all, [newsId]: { status: 'success', items } }))
    } catch (error) {
      if (activeToken.current === token) setCommentsByPost(all => ({
        ...all, [newsId]: { status: 'error', message: error.message, items: all[newsId]?.items || [] },
      }))
    }
  }

  function toggleComments(newsId) {
    setOpenComments(all => ({ ...all, [newsId]: !all[newsId] }))
    if (!openComments[newsId]) loadComments(newsId)
  }

  function submitComment(event, newsId) {
    event.preventDefault()
    if (!token) { onAuthPrompt?.('comment'); return }
    const content = (drafts[newsId] || '').trim()
    if (!content || content.length > 1000) return
    return guarded('comment-' + newsId, async () => {
      const comment = await fetch(commentsUrl(newsId), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ content }),
      }).then(readApiResponse)
      if (activeToken.current !== token) return
      setCommentNow(Date.now())
      setDrafts(all => ({ ...all, [newsId]: '' }))
      const items = updateNewsComments(newsCache, newsId, current => [comment, ...current.filter(item => item.id !== comment.id)])
      setCommentsByPost(all => ({ ...all, [newsId]: { status: 'success', items } }))
      updateArticles(newsId, item => ({ ...item, commentCount: Number(item.commentCount || 0) + 1 }))
      setToast({ text: 'Comment posted' })
    })
  }

  function vote(comment, newsId, voteType) {
    if (!token) { onAuthPrompt?.('vote'); return }
    return guarded('vote-' + comment.id, async () => {
      const updated = await fetch(API_BASE_URL + '/api/comments/' + encodeURIComponent(comment.id) + '/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ voteType, active: comment.voteType !== voteType }),
      }).then(readApiResponse)
      if (activeToken.current !== token) return
      const items = updateNewsComments(newsCache, newsId, current => current.map(item => item.id === comment.id ? updated : item))
      setCommentsByPost(all => ({ ...all, [newsId]: { ...all[newsId], items } }))
      setToast({ text: updated.voteType ? 'Vote saved' : 'Vote removed' })
    })
  }

  function updateArticles(id, update) {
    updateNewsArticle(newsCache, id, update)
    if (!articleId) setFeed(data => ({ ...data, items: [...data.items] }))
  }

  function savePost(post) {
    if (!token) { onAuthPrompt?.('bookmark'); return }
    const target = !(savedById[post.id] ?? post.saved)
    return guarded('save-' + post.id, async () => {
      await fetch(API_BASE_URL + '/api/news/' + encodeURIComponent(post.id) + '/save', {
        method: target ? 'POST' : 'DELETE',
        headers: { Authorization: 'Bearer ' + token },
      }).then(readApiResponse)
      if (activeToken.current !== token) return
      setSavedById(all => ({ ...all, [post.id]: target }))
      updateArticles(post.id, item => ({ ...item, saved: target }))
      setToast({ text: target ? 'Saved to bookmarks' : 'Bookmark removed' })
    })
  }

  function bookmarkButton(post) {
    const saved = Boolean(savedById[post.id] ?? post.saved)
    const pending = Boolean(busy['save-' + post.id])
    return <button className="saveIconButton" aria-pressed={saved} aria-busy={pending}
      aria-label="Bookmark article" title={saved ? 'Remove bookmark' : 'Bookmark article'}
      type="button" disabled={pending} onClick={() => savePost(post)}>
      <BookmarkIcon fill={saved ? 'currentColor' : 'none'} size={17} aria-hidden="true" />
      <span aria-hidden="true">{pending ? <LoadingSkeleton inline label="Saving" /> : saved ? 'Saved' : 'Bookmark'}</span>
    </button>
  }

  function discussion(post) {
    const id = post.id
    const comments = commentsByPost[id]
    const draft = drafts[id] || ''
    const submitting = busy['comment-' + id]
    return <section className="commentPanel" aria-label="Discussion">
      <h2>Discussion{comments?.status === 'success' ? ' (' + comments.items.length + ')' : ''}</h2>
      {token ? <form onSubmit={event => submitComment(event, id)}>
        <label htmlFor={'comment-' + id}>Write a comment</label>
        <textarea id={'comment-' + id} rows={3} maxLength={1000} required
          placeholder="Share your thoughts…" value={draft} readOnly={submitting}
          onChange={event => setDrafts(all => ({ ...all, [id]: event.target.value }))} />
        <p className="commentHint">Comments appear anonymously. {draft.length}/1000</p>
        <button disabled={!draft.trim() || submitting} type="submit">{submitting ? <LoadingSkeleton inline label="Posting" /> : 'Post Comment'}</button>
      </form> : <p className="commentHint"><button type="button" onClick={() => onAuthPrompt?.('comment')}>Sign in</button> to join the discussion.</p>}
      {comments?.status === 'loading' && <LoadingSkeleton label="Loading comments" />}
      {comments?.status === 'error' && <div role="alert"><p>{comments.message}</p>
        <button type="button" onClick={() => loadComments(id)}>Retry comments</button></div>}
      {comments?.status === 'success' && !comments.items.length && <p className="commentHint">No comments yet.</p>}
      {comments?.items.map(comment => <article className="commentRow" key={comment.id}>
        <span className="commentAvatar" aria-hidden="true">{initials(comment.authorLabel)}</span>
        <div className="commentText">
          <strong>{comment.authorLabel}</strong>
          <time dateTime={comment.createdAt}>{relativeCommentTime(comment.createdAt, commentNow)}</time>
          <p>{comment.content}</p>
        </div>
        <div className="voteButtons" role="group" aria-label="Comment votes">
          {[['UP', 'Upvote', comment.upvotes, ThumbUpIcon], ['DOWN', 'Downvote', comment.downvotes, ThumbDownIcon]]
            .map(([type, label, count, Icon]) => {
              const selected = comment.voteType === type
              return <button key={type} className={(type === 'UP' ? 'voteUp' : 'voteDown') + (selected ? ' is-selected' : '')}
                aria-label={label + ', ' + count} aria-pressed={selected}
                title={selected ? 'Remove ' + label.toLowerCase() : label} disabled={busy['vote-' + comment.id]}
                type="button" onClick={() => vote(comment, id, type)}>
                <Icon size={16} className={selected ? 'voteIconSelected' : ''} /><span>{count}</span>
              </button>
            })}
        </div>
      </article>)}
    </section>
  }

  const notification = <ActionToast message={toast} onDismiss={dismissToast} />
  if (articleId) {
    const feedParams = new URLSearchParams(window.location.search)
    for (const key of ['view', 'id', 'articleId', 'original']) feedParams.delete(key)
    const filterQuery = feedParams.size ? '?' + feedParams : ''
    return <><NewsArticleReader key={articleId} id={articleId} original={original} token={token}
      hrefFor={showOriginal => newsPath(articleId, showOriginal) + filterQuery}
      backHref={newsPath() + filterQuery}
      onChangeView={showOriginal => onOpenArticle(articleId, showOriginal)}
      onClose={() => onOpenArticle(null)}
      onOpenProfile={onOpenProfile}
      renderActions={bookmarkButton}
      renderDiscussionAction={post => {
        const open = Boolean(openComments[post.id])
        const count = commentsByPost[post.id]?.items.length ?? post.commentCount ?? 0
        return <button type="button" aria-expanded={open} onClick={() => toggleComments(post.id)}>
          <MessageCircleIcon size={17} />
          <span>{open ? 'Hide comments' : count + (count === 1 ? ' comment' : ' comments')}</span>
        </button>
      }}
      renderDiscussion={post => openComments[post.id] && discussion(post)} />{notification}</>
  }

  const suggestedPoliticians = politicians.slice(0, 4)
  const summaryValue = (value) =>
    summary.status === 'loading' ? <LoadingSkeleton inline label="Loading news totals" /> : summary.status === 'error' ? 'N/A' : Number(value ?? 0).toLocaleString('en-PH')

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
    <><section className="newsFeedShell newsPageFrame">
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
        <div className="feedMain">
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

          {feed.status === 'loading' && <div role="status" aria-label="Loading news articles"><FeedSkeleton /></div>}

          {feed.status === 'success' && feed.message && <div className="feedNotice" role="status">
            <span>Showing previously loaded articles. Updates are temporarily unavailable.</span>
            <button type="button" onClick={() => setReloadKey(key => key + 1)}>Retry</button>
          </div>}
          {feed.status === 'error' && (
            <div className="feedNotice error" role="alert">
              <strong>We couldn’t load the feed.</strong>
              <span>Unable to load news articles. Please try again.</span>
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
                </>
              )}
            </div>
          )}

          <div className="postStack">
            {feed.status !== 'loading' && feed.items.map((post, index) => {
              const open = Boolean(openComments[post.id])
              const isFeatured = index === 0 && page === 0 && sort === 'newest' && !query && activeCategory === 'All'


              const isExpanded = Boolean(expanded[post.id])

              return (
                <article
                  className={`newsPost${isFeatured ? ' featured' : ''}`}
                  key={post.id}
                  style={{ '--cat': colorFor(post.category) }}
                >
                  <ArticleMeta article={post} />

                  <NewsCardContent article={post} expanded={isExpanded} onToggle={() => setExpanded(all => ({ ...all, [post.id]: !all[post.id] }))} />
                  <footer className="postActions">
                    <div className="postActionsStart">
                      <a className="postReadLink" href={newsPath(post.id) + window.location.search} onClick={event => {
                        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
                        event.preventDefault()
                        onOpenArticle(post.id)
                      }}>Read article</a>
                      <button type="button" aria-expanded={open} onClick={() => toggleComments(post.id)}>
                        <MessageCircleIcon size={17} />
                        <span>{open ? 'Hide comments' : `${post.commentCount ?? 0} comment${post.commentCount === 1 ? '' : 's'}`}</span>
                      </button>
                    </div>
                    <div className="postActionsEnd">
                      <PublisherLink url={post.sourceUrl} />
                      {bookmarkButton(post)}
                    </div>
                  </footer>

                  {open && discussion(post)}
                </article>
              )
            })}
          </div>

          {feed.totalPages > 1 && (
            <nav className="feedPager" aria-label="News pagination">
              <PaginationMini page={page + 1} totalPages={feed.totalPages} onChange={(nextPage) => goToPage(nextPage - 1)} />
            </nav>
          )}
        </div>

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
                    <strong>{insights.status === 'loading' ? <LoadingSkeleton inline label="Loading topic totals" /> : donutTotal}</strong>
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
    </section>{notification}</>
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
