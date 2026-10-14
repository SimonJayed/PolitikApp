import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../auth/AuthContext'
import {
  BookmarkIcon,
  ExternalLinkIcon,
  FileTextIcon,
  LandmarkIcon,
  MessageCircleIcon,
  SearchIcon,
  ShieldCheckIcon,
  ThumbDownIcon,
  ThumbUpIcon,
} from '../../components/icons/Lucide'
import './Dashboard.css'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080'
const categories = ['All', 'Latest', 'Legislation', 'Government Projects', 'Public Spending', 'Audit Reports', 'Government Announcements']

async function readApiResponse(response) {
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(body.message || `Request failed with status ${response.status}`)
  return body
}

export default function Dashboard({ onNavigate, onOpenProfile, politicians = [], user }) {
  const { token } = useAuth()
  const [activeCategory, setActiveCategory] = useState('All')
  const [sort, setSort] = useState('newest')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(0)
  const [feed, setFeed] = useState({ status: 'loading', message: '', items: [], totalPages: 1 })
  const [commentsByPost, setCommentsByPost] = useState({})
  const [drafts, setDrafts] = useState({})

  useEffect(() => {
    const controller = new AbortController()
    const params = new URLSearchParams({ page: String(page), size: '8', sort })
    if (activeCategory !== 'All' && activeCategory !== 'Latest') params.set('category', activeCategory)
    if (query.trim()) params.set('q', query.trim())

    setFeed((current) => ({ ...current, status: 'loading', message: '' }))
    fetch(`${API_BASE_URL}/api/news?${params}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      signal: controller.signal,
    })
      .then(readApiResponse)
      .then((data) => {
        setFeed({
          status: 'success',
          message: '',
          items: Array.isArray(data.content) ? data.content : [],
          totalPages: Math.max(1, Number(data.totalPages || 1)),
        })
      })
      .catch((error) => {
        if (error.name === 'AbortError') return
        setFeed({ status: 'error', message: error.message, items: [], totalPages: 1 })
      })
    return () => controller.abort()
  }, [activeCategory, page, query, sort, token])

  useEffect(() => setPage(0), [activeCategory, query, sort])

  const trendingTopics = useMemo(() => {
    const counts = new Map()
    feed.items.forEach((item) => counts.set(item.category, (counts.get(item.category) || 0) + 1))
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)
  }, [feed.items])

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

  async function submitComment(event, newsId) {
    event.preventDefault()
    if (!token) return
    const content = (drafts[newsId] || '').trim()
    if (!content) return
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
  }

  async function vote(commentId, newsId, voteType) {
    if (!token) return
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
  }

  async function savePost(newsId) {
    if (!token) return
    await fetch(`${API_BASE_URL}/api/news/${newsId}/save`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    })
    setFeed((current) => ({
      ...current,
      items: current.items.map((item) => item.id === newsId ? { ...item, saved: true } : item),
    }))
  }

  const suggestedPoliticians = politicians.slice(0, 4)

  return (
    <section className="newsFeedShell">
      <aside className="feedRail left" aria-label="News navigation">
        <nav className="feedNav">
          {[
            ['Home', 'dashboard'],
            ['Latest News', 'dashboard'],
            ['Politicians', 'politicians'],
            ['Categories', 'dashboard'],
            ['Saved Posts', 'dashboard'],
            ['Profile', 'profileMatrix'],
          ].map(([label, view]) => (
            <button key={label} type="button" onClick={() => onNavigate?.(view)}>
              <LandmarkIcon size={17} />
              <span>{label}</span>
            </button>
          ))}
        </nav>
      </aside>

      <main className="feedMain">
        <header className="feedHeader">
          <div>
            <p className="ty-page-kicker">Verified public feed</p>
            <h1 className="ty-page-title">Government News</h1>
          </div>
          <label className="feedSearch">
            <SearchIcon size={17} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search official updates" />
          </label>
        </header>

        <div className="feedControls" aria-label="News filters">
          <div className="categoryScroller">
            {categories.map((category) => (
              <button className={activeCategory === category ? 'active' : ''} key={category} onClick={() => setActiveCategory(category)} type="button">
                {category}
              </button>
            ))}
          </div>
          <select aria-label="Sort news" value={sort} onChange={(event) => setSort(event.target.value)}>
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
          </select>
        </div>

        {feed.status === 'loading' && <FeedSkeleton />}
        {feed.status === 'error' && <p className="feedNotice error">{feed.message}</p>}
        {feed.status === 'success' && feed.items.length === 0 && (
          <div className="feedNotice">
            <FileTextIcon size={28} />
            <strong>No published government updates yet.</strong>
            <span>Admins can fetch official articles, review AI summaries, and publish approved posts.</span>
          </div>
        )}

        <div className="postStack">
          {feed.items.map((post) => {
            const comments = commentsByPost[post.id]
            return (
              <article className="newsPost" key={post.id}>
                <header className="postMeta">
                  <span className="sourceBadge">{initials(post.sourceName)}</span>
                  <div>
                    <strong>{post.sourceName}</strong>
                    <span>{formatDate(post.originalPublishedAt)} - Published {formatDate(post.publishedAt)}</span>
                  </div>
                  {post.adminVerified && <span className="verifiedPill"><ShieldCheckIcon size={15} /> Verified</span>}
                </header>

                <div className="postBody">
                  <span className="categoryPill">{post.category}</span>
                  <h2>{post.headline}</h2>
                  <p>{post.summary}</p>
                  {post.keyPoints?.length > 0 && (
                    <ul className="keyPoints">
                      {post.keyPoints.slice(0, 3).map((point) => <li key={point}>{point}</li>)}
                    </ul>
                  )}
                </div>

                <footer className="postActions">
                  <button type="button" onClick={() => loadComments(post.id)}>
                    <MessageCircleIcon size={17} />
                    <span>{post.commentCount} comments</span>
                  </button>
                  <button disabled={!token || post.saved} type="button" onClick={() => savePost(post.id)}>
                    <BookmarkIcon size={17} />
                    <span>{post.saved ? 'Saved' : 'Save'}</span>
                  </button>
                  <a href={post.sourceUrl} target="_blank" rel="noreferrer">
                    <ExternalLinkIcon size={17} />
                    <span>Original</span>
                  </a>
                </footer>

                {comments?.status && comments.status !== 'idle' && (
                  <section className="commentPanel">
                    {token && (
                      <form onSubmit={(event) => submitComment(event, post.id)}>
                        <input
                          maxLength={1000}
                          placeholder="Comment anonymously"
                          value={drafts[post.id] || ''}
                          onChange={(event) => setDrafts((all) => ({ ...all, [post.id]: event.target.value }))}
                        />
                        <button type="submit">Post</button>
                      </form>
                    )}
                    {!token && <p className="ty-meta">Sign in to comment anonymously.</p>}
                    {comments.status === 'loading' && <p className="ty-meta">Loading comments...</p>}
                    {comments.status === 'error' && <p className="ty-meta">{comments.message}</p>}
                    {comments.items?.map((comment) => (
                      <div className="commentRow" key={comment.id}>
                        <div>
                          <strong>{comment.authorLabel}</strong>
                          <span>{formatDate(comment.createdAt)}</span>
                          <p>{comment.content}</p>
                        </div>
                        <div className="voteButtons">
                          <button disabled={!token} type="button" onClick={() => vote(comment.id, post.id, 'UP')}><ThumbUpIcon size={15} /></button>
                          <strong>{comment.score}</strong>
                          <button disabled={!token} type="button" onClick={() => vote(comment.id, post.id, 'DOWN')}><ThumbDownIcon size={15} /></button>
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
            <button disabled={page === 0} onClick={() => setPage((current) => Math.max(0, current - 1))} type="button">Previous</button>
            <span>Page {page + 1} of {feed.totalPages}</span>
            <button disabled={page + 1 >= feed.totalPages} onClick={() => setPage((current) => current + 1)} type="button">Next</button>
          </nav>
        )}
      </main>

      <aside className="feedRail right" aria-label="Feed context">
        <section>
          <h2>Trending Topics</h2>
          {trendingTopics.length === 0 ? <p>No trends yet.</p> : trendingTopics.map(([topic, count]) => <p key={topic}><strong>{topic}</strong><span>{count} post{count === 1 ? '' : 's'}</span></p>)}
        </section>
        <section>
          <h2>Recent Updates</h2>
          {feed.items.slice(0, 3).map((item) => <p key={item.id}><strong>{item.category}</strong><span>{item.headline}</span></p>)}
          {feed.items.length === 0 && <p>Published updates will appear here.</p>}
        </section>
        <section>
          <h2>Suggested Politicians</h2>
          {suggestedPoliticians.map((politician) => (
            <button className="politicianSuggestion" key={politician.politicianId} onClick={() => onOpenProfile?.(politician.politicianId)} type="button">
              <span>{initials(politician.fullName)}</span>
              <strong>{politician.fullName}</strong>
            </button>
          ))}
          {suggestedPoliticians.length === 0 && <p>No profiles loaded.</p>}
        </section>
        {user?.role === 'ADMIN' && (
          <section>
            <h2>Admin</h2>
            <p>News retrieval and review APIs are ready for an admin queue screen.</p>
          </section>
        )}
      </aside>
    </section>
  )
}

function FeedSkeleton() {
  return (
    <div className="postStack" aria-hidden="true">
      {Array.from({ length: 3 }).map((_, index) => <div className="newsPost skeleton" key={index} />)}
    </div>
  )
}

function initials(name = '') {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'PH'
}

function formatDate(value) {
  if (!value) return 'Date unavailable'
  return new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium' }).format(new Date(value))
}
