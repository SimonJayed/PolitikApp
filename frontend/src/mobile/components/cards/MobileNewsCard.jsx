import { useState } from 'react'
import { ArticleImage, SummaryText } from '../../../components/NewsCardContent'
import { safeNewsUrl } from '../../../features/news/newsPresentation'
import { ThumbUpIcon, ThumbDownIcon, ExternalLinkIcon, MessageCircleIcon } from '../../../components/icons/Lucide'

export function MobileNewsCard({
  article,
  onUpvote,
  onDownvote,
  onCommentClick,
  userReaction,
}) {
  const [expanded, setExpanded] = useState(false)
  const sourceUrl = safeNewsUrl(article.sourceUrl || article.canonicalUrl)

  return (
    <article className="mobileCard" style={{ padding: '14px', marginBottom: '14px' }}>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
        <span style={{
          fontSize: '0.6875rem',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          color: '#2563EB',
          background: 'rgba(37, 99, 235, 0.08)',
          padding: '2px 8px',
          borderRadius: '6px',
        }}>
          {article.sourceName || article.sourceHost || 'Official Source'}
        </span>
        {article.publishedAt && (
          <time style={{ fontSize: '0.6875rem', color: '#64748B' }}>
            {new Date(article.publishedAt).toLocaleDateString()}
          </time>
        )}
      </header>

      <h3 style={{
        margin: '0 0 10px',
        fontSize: '1rem',
        fontWeight: 700,
        lineHeight: 1.35,
        color: '#0F172A',
      }}>
        {article.title}
      </h3>

      <div style={{ marginBottom: '12px', borderRadius: '10px', overflow: 'hidden' }}>
        <ArticleImage article={article} />
      </div>

      <div style={{
        fontSize: '0.875rem',
        lineHeight: 1.5,
        color: '#334155',
        marginBottom: '12px',
        maxHeight: expanded ? 'none' : '120px',
        overflow: 'hidden',
        position: 'relative',
      }}>
        <SummaryText text={article.aiSummary || article.body || article.summary || ''} />
        {!expanded && (article.aiSummary?.length > 180 || article.body?.length > 180) && (
          <div style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: '40px',
            background: 'linear-gradient(to top, rgba(255,255,255,1), rgba(255,255,255,0))',
          }} />
        )}
      </div>

      {(article.aiSummary?.length > 180 || article.body?.length > 180) && (
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          style={{
            background: 'none',
            border: 'none',
            color: '#2563EB',
            fontSize: '0.8125rem',
            fontWeight: 600,
            padding: '4px 0 8px',
            cursor: 'pointer',
            minHeight: '36px',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          {expanded ? 'Show less' : 'Read full summary'}
        </button>
      )}

      <footer style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderTop: '1px solid #E2E8F0',
        paddingTop: '8px',
        marginTop: '6px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <button
            type="button"
            className="mobileTouchTarget"
            onClick={() => onUpvote?.(article.articleId)}
            aria-label="Upvote article"
            style={{
              color: userReaction === 'UPVOTE' ? '#16A34A' : '#64748B',
              gap: '4px',
              fontSize: '0.8125rem',
              fontWeight: 600,
            }}
          >
            <ThumbUpIcon size={18} />
            <span>{article.upvotes || 0}</span>
          </button>

          <button
            type="button"
            className="mobileTouchTarget"
            onClick={() => onDownvote?.(article.articleId)}
            aria-label="Downvote article"
            style={{
              color: userReaction === 'DOWNVOTE' ? '#DC2626' : '#64748B',
              gap: '4px',
              fontSize: '0.8125rem',
              fontWeight: 600,
            }}
          >
            <ThumbDownIcon size={18} />
            <span>{article.downvotes || 0}</span>
          </button>

          <button
            type="button"
            className="mobileTouchTarget"
            onClick={() => onCommentClick?.(article)}
            aria-label="Article comments"
            style={{
              color: '#64748B',
              gap: '4px',
              fontSize: '0.8125rem',
              fontWeight: 600,
            }}
          >
            <MessageCircleIcon size={18} />
            <span>{article.commentCount || 0}</span>
          </button>
        </div>

        {sourceUrl && (
          <a
            href={sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mobileTouchTarget"
            aria-label="Visit original official source"
            style={{ color: '#64748B' }}
          >
            <ExternalLinkIcon size={18} />
          </a>
        )}
      </footer>
    </article>
  )
}

export default MobileNewsCard

