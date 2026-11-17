import { useCallback, useEffect, useMemo, useState } from 'react'
import { API_BASE_URL, readApiResponse } from '../../api/client'
import { newsCacheFor, publicReadCache } from '../../api/readCache'
import { useCachedRead } from '../../api/useCachedRead'
import { useAuth } from '../../auth/AuthContext'
import { SearchIcon, RefreshCwIcon, MessageCircleIcon } from '../../components/icons/Lucide'
import MobileNewsCard from '../components/cards/MobileNewsCard'
import MobileBottomSheet from '../components/layout/MobileBottomSheet'
import { createOptimisticActions, relativeCommentTime } from '../../features/news/optimisticActions'
import { commentsUrl, loadNewsComments, updateNewsComments } from '../../features/news/newsComments'

const CATEGORIES = [
  'All',
  'Legislation',
  'Government Projects',
  'Public Spending',
  'Audit Reports',
  'Government Announcements',
]

const EMPTY_FEED = { items: [], totalPages: 1, totalElements: 0 }

export function MobileDashboard({ onNavigate, onOpenProfile, politicians = [], user }) {
  const { token } = useAuth()
  const [activeCategory, setActiveCategory] = useState('All')
  const [searchQuery, setSearchQuery] = useState('')
  const [page, setPage] = useState(1)
  const [refreshKey, setRefreshKey] = useState(0)
  const [selectedArticleForComments, setSelectedArticleForComments] = useState(null)
  const [commentsState, setCommentsState] = useState({ items: [], loading: false })
  const [commentInput, setCommentInput] = useState('')

  const cache = useMemo(() => newsCacheFor(publicReadCache, token), [token])

  const newsUrl = useMemo(() => {
    const params = new URLSearchParams()
    params.set('page', String(page - 1))
    params.set('size', '10')
    if (activeCategory !== 'All') params.set('category', activeCategory)
    if (searchQuery.trim()) params.set('q', searchQuery.trim())
    return `${API_BASE_URL}/api/news?${params.toString()}`
  }, [page, activeCategory, searchQuery])

  const feedLoader = useCallback(
    () => fetch(newsUrl).then(readApiResponse).then((data) => data || EMPTY_FEED),
    [newsUrl]
  )

  const feedRead = useCachedRead(cache, newsUrl, feedLoader, EMPTY_FEED)
  const articles = feedRead.data?.items || []

  // Handle comments
  useEffect(() => {
    if (!selectedArticleForComments) return
    let cancelled = false
    setCommentsState({ items: [], loading: true })

    loadNewsComments(selectedArticleForComments.articleId, token)
      .then((items) => {
        if (!cancelled) setCommentsState({ items, loading: false })
      })
      .catch(() => {
        if (!cancelled) setCommentsState({ items: [], loading: false })
      })

    return () => {
      cancelled = true
    }
  }, [selectedArticleForComments, token])

  const handleAddComment = async (e) => {
    e.preventDefault()
    if (!commentInput.trim() || !selectedArticleForComments) return
    const text = commentInput.trim()
    setCommentInput('')

    try {
      const updated = await updateNewsComments(
        selectedArticleForComments.articleId,
        text,
        token
      )
      setCommentsState((prev) => ({ ...prev, items: updated }))
    } catch {
      // Revert if error
    }
  }

  return (
    <div style={{ paddingBottom: '32px' }}>
      {/* Search Input */}
      <div style={{
        position: 'relative',
        marginBottom: '12px',
        background: 'var(--bg-surface, #ffffff)',
        borderRadius: '12px',
        border: '1px solid var(--border-subtle, #e2e8f0)',
      }}>
        <span style={{
          position: 'absolute',
          left: '12px',
          top: '50%',
          transform: 'translateY(-50%)',
          color: '#94A3B8',
          display: 'flex',
        }}>
          <SearchIcon size={18} />
        </span>
        <input
          type="search"
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value)
            setPage(1)
          }}
          placeholder="Search verified government news..."
          aria-label="Search news"
          style={{
            width: '100%',
            height: '48px',
            paddingLeft: '40px',
            paddingRight: '12px',
            background: 'transparent',
            border: 'none',
            outline: 'none',
            color: '#0F172A',
            boxSizing: 'border-box',
          }}
        />
      </div>

      {/* Horizontal Scrolling Category Filter Pills */}
      <div style={{
        display: 'flex',
        overflowX: 'auto',
        gap: '8px',
        marginBottom: '16px',
        paddingBottom: '4px',
        scrollbarWidth: 'none',
      }}>
        {CATEGORIES.map((cat) => {
          const isActive = activeCategory === cat
          return (
            <button
              key={cat}
              type="button"
              onClick={() => {
                setActiveCategory(cat)
                setPage(1)
              }}
              style={{
                minHeight: '44px',
                padding: '0 14px',
                borderRadius: '22px',
                background: isActive ? '#122a58' : 'var(--bg-surface, #ffffff)',
                color: isActive ? '#ffffff' : '#475569',
                border: '1px solid',
                borderColor: isActive ? '#122a58' : '#CBD5E1',
                fontSize: '0.8125rem',
                fontWeight: 600,
                whiteSpace: 'nowrap',
                cursor: 'pointer',
                touchAction: 'manipulation',
                display: 'inline-flex',
                alignItems: 'center',
              }}
            >
              {cat}
            </button>
          )
        })}
      </div>

      {/* Feed List */}
      <div>
        {feedRead.status === 'loading' && articles.length === 0 ? (
          <div className="mobileCard" style={{ textAlign: 'center', padding: '36px 16px' }}>
            <p style={{ margin: 0, color: '#64748B' }}>Fetching verified announcements...</p>
          </div>
        ) : articles.length === 0 ? (
          <div className="mobileCard" style={{ textAlign: 'center', padding: '36px 16px' }}>
            <p style={{ margin: '0 0 10px', color: '#64748B', fontWeight: 600 }}>
              No government announcements in this category yet.
            </p>
            <button
              type="button"
              className="mobileCardAction"
              onClick={() => {
                setActiveCategory('All')
                setSearchQuery('')
              }}
              style={{ background: '#122a58', color: '#ffffff' }}
            >
              View All Topics
            </button>
          </div>
        ) : (
          articles.map((article) => (
            <MobileNewsCard
              key={article.articleId}
              article={article}
              onCommentClick={(art) => setSelectedArticleForComments(art)}
            />
          ))
        )}
      </div>

      {/* Comments Bottom Sheet */}
      <MobileBottomSheet
        isOpen={Boolean(selectedArticleForComments)}
        onClose={() => setSelectedArticleForComments(null)}
        title={selectedArticleForComments ? 'Article Discussion' : ''}
      >
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '12px' }}>
          <div style={{
            fontSize: '0.875rem',
            fontWeight: 700,
            color: '#0F172A',
            borderBottom: '1px solid #E2E8F0',
            paddingBottom: '8px',
          }}>
            {selectedArticleForComments?.title}
          </div>

          <div style={{
            flex: '1 1 auto',
            maxHeight: '320px',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
          }}>
            {commentsState.loading ? (
              <p style={{ color: '#64748B', fontSize: '0.875rem' }}>Loading verified remarks...</p>
            ) : commentsState.items.length === 0 ? (
              <p style={{ color: '#64748B', fontSize: '0.875rem' }}>No public remarks yet. Be the first to verify or comment.</p>
            ) : (
              commentsState.items.map((c, i) => (
                <div key={i} style={{ background: '#F8FAFC', padding: '10px 12px', borderRadius: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#64748B', marginBottom: '4px' }}>
                    <strong style={{ color: '#1E293B' }}>{c.authorName || 'Contributor'}</strong>
                    <span>{relativeCommentTime(c.createdAt)}</span>
                  </div>
                  <p style={{ margin: 0, fontSize: '0.875rem', color: '#334155' }}>
                    {c.commentText || c.text}
                  </p>
                </div>
              ))
            )}
          </div>

          {/* Comment Input */}
          <form onSubmit={handleAddComment} style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
            <input
              type="text"
              value={commentInput}
              onChange={(e) => setCommentInput(e.target.value)}
              placeholder="Add your observation or source..."
              aria-label="Add observation"
              style={{
                flex: '1 1 auto',
                height: '48px',
                borderRadius: '10px',
                border: '1px solid #CBD5E1',
                padding: '0 12px',
                background: '#FFFFFF',
                color: '#0F172A',
              }}
            />
            <button
              type="submit"
              className="mobileTouchTarget"
              disabled={!commentInput.trim()}
              style={{
                background: '#122a58',
                color: '#ffffff',
                borderRadius: '10px',
                padding: '0 16px',
                fontWeight: 600,
                fontSize: '0.875rem',
              }}
            >
              Post
            </button>
          </form>
        </div>
      </MobileBottomSheet>
    </div>
  )
}

export default MobileDashboard

