import { LoadingSkeleton } from "../../components/Skeletons"
import { useEffect, useState } from 'react'
import { API_BASE_URL, readApiResponse } from '../../api/client'
import { ArticleImage, SummaryText } from '../../components/NewsCardContent'
import { CircleCheckIcon, CircleXIcon, ExternalLinkIcon, RefreshCwIcon } from '../../components/icons/Lucide'

export function MobileAdminNews({ token, user }) {
  const [articles, setArticles] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('PENDING_REVIEW')
  const [actionInProgress, setActionInProgress] = useState(null)
  const [feedback, setFeedback] = useState('')

  const fetchArticles = async () => {
    setLoading(true)
    try {
      const url = filter === 'ALL'
        ? `${API_BASE_URL}/api/admin/news`
        : `${API_BASE_URL}/api/admin/news?status=${filter}`

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      }).then(readApiResponse)

      setArticles(res?.items || res || [])
    } catch (err) {
      setFeedback('Unable to load moderation queue.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchArticles()
  }, [filter, token])

  const handleAction = async (articleId, action) => {
    setActionInProgress(articleId)
    try {
      await fetch(`${API_BASE_URL}/api/admin/news/${articleId}/${action}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }).then(readApiResponse)

      setFeedback(`Article ${action}d successfully.`)
      // Refresh list
      fetchArticles()
    } catch (err) {
      setFeedback(`Failed to ${action} article.`)
    } finally {
      setActionInProgress(null)
    }
  }

  return (
    <div style={{ paddingBottom: '32px' }}>
      <header style={{ marginBottom: '14px' }}>
        <h2 style={{
          margin: '0 0 6px',
          fontSize: '1.25rem',
          fontWeight: 800,
          color: '#0F172A',
          fontFamily: 'var(--display, "Poppins", sans-serif)',
        }}>
          AI News Moderation
        </h2>
        <p style={{ margin: 0, fontSize: '0.8125rem', color: '#64748B' }}>
          Verify civic accuracy of AI-extracted government updates.
        </p>
      </header>

      {/* Filter Tabs */}
      <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', marginBottom: '16px', paddingBottom: '4px' }}>
        {['PENDING_REVIEW', 'APPROVED', 'PUBLISHED', 'REJECTED', 'ALL'].map((st) => (
          <button
            key={st}
            type="button"
            onClick={() => setFilter(st)}
            style={{
              minHeight: '44px',
              padding: '0 14px',
              borderRadius: '22px',
              background: filter === st ? '#122a58' : '#ffffff',
              color: filter === st ? '#ffffff' : '#475569',
              border: `1px solid ${filter === st ? '#122a58' : '#CBD5E1'}`,
              fontSize: '0.75rem',
              fontWeight: 700,
              whiteSpace: 'nowrap',
              cursor: 'pointer',
              touchAction: 'manipulation',
            }}
          >
            {st.replace('_', ' ')}
          </button>
        ))}
      </div>

      {feedback && (
        <div style={{
          background: '#F0FDF4',
          border: '1px solid #BBF7D0',
          color: '#166534',
          padding: '10px 14px',
          borderRadius: '10px',
          fontSize: '0.8125rem',
          marginBottom: '14px',
        }}>
          {feedback}
        </div>
      )}

      {/* Article Review Cards */}
      {loading ? (
        <div className="mobileCard" style={{ textAlign: 'center', padding: '32px 16px' }}>
          <LoadingSkeleton label="Loading review queue" />
        </div>
      ) : articles.length === 0 ? (
        <div className="mobileCard" style={{ textAlign: 'center', padding: '32px 16px' }}>
          <p style={{ margin: 0, color: '#64748B', fontWeight: 600 }}>
            No articles in {filter.replace('_', ' ')} status.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {articles.map((art) => (
            <div key={art.articleId} className="mobileCard" style={{ padding: '16px', margin: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <span style={{
                  fontSize: '0.6875rem',
                  fontWeight: 700,
                  color: '#2563EB',
                  background: '#EFF6FF',
                  padding: '2px 8px',
                  borderRadius: '6px',
                }}>
                  {art.sourceName || 'Government Source'}
                </span>
                <span style={{
                  fontSize: '0.6875rem',
                  fontWeight: 700,
                  color: art.status === 'APPROVED' ? '#16A34A' : art.status === 'REJECTED' ? '#DC2626' : '#D97706',
                }}>
                  {art.status}
                </span>
              </div>

              <h3 style={{ margin: '0 0 10px', fontSize: '0.9375rem', fontWeight: 700, color: '#0F172A' }}>
                {art.title}
              </h3>

              <div style={{ marginBottom: '12px' }}>
                <SummaryText text={art.aiSummary || art.body || ''} />
              </div>

              {/* Action Buttons with >= 48px Touch Targets */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '12px' }}>
                <button
                  type="button"
                  className="mobileTouchTarget"
                  disabled={actionInProgress === art.articleId}
                  onClick={() => handleAction(art.articleId, 'approve')}
                  style={{
                    background: '#16A34A',
                    color: '#ffffff',
                    borderRadius: '10px',
                    fontWeight: 700,
                    fontSize: '0.875rem',
                    gap: '6px',
                  }}
                >
                  <CircleCheckIcon size={18} />
                  <span>Approve</span>
                </button>

                <button
                  type="button"
                  className="mobileTouchTarget"
                  disabled={actionInProgress === art.articleId}
                  onClick={() => handleAction(art.articleId, 'reject')}
                  style={{
                    background: '#EF4444',
                    color: '#ffffff',
                    borderRadius: '10px',
                    fontWeight: 700,
                    fontSize: '0.875rem',
                    gap: '6px',
                  }}
                >
                  <CircleXIcon size={18} />
                  <span>Reject</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default MobileAdminNews

