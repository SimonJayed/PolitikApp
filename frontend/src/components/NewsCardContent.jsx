import { useState } from 'react'
import { emphasisParts, newsImage, newsPresentation, safeNewsUrl } from '../features/news/newsPresentation'
import { summaryLabel } from '../features/news/newsWorkflow'
import './NewsCardContent.css'

const SENTENCES = /[^.!?]+[.!?]+["”')\]]*\s*|[^.!?]+$/g
const MAX_PARAGRAPH = 320

function splitLongParagraph(text) {
  if (text.length <= MAX_PARAGRAPH) return [text]
  const sentences = text.match(SENTENCES) || [text]
  const groups = []
  let current = ''
  for (const sentence of sentences) {
    if (current && (current + sentence).length > MAX_PARAGRAPH) { groups.push(current.trim()); current = '' }
    current += sentence
  }
  if (current.trim()) groups.push(current.trim())
  return groups
}

export function summaryParagraphs(text) {
  if (!text || typeof text !== 'string') return []
  return text
    .split(/\r?\n\s*\r?\n/)
    .flatMap(block => {
      // Preserve reviewed content, including factual sentences beginning with metadata-like labels.
      const lines = block.split(/\r?\n/).filter(line => line.trim())
      return lines.length ? splitLongParagraph(lines.join(' ').replace(/\s+/g, ' ').trim()) : []
    })
}

function RichText({ text }) {
  return emphasisParts(text).map((part, i) => part.bold ? <strong key={i}>{part.text}</strong> : <span key={i}>{part.text}</span>)
}

export function SummaryText({ text, className = '' }) {
  const paragraphs = summaryParagraphs(text)
  if (!paragraphs.length) return null
  return <div className={`summaryText ${className}`.trim()}>{paragraphs.map((paragraph, i) => <p key={i}><RichText text={paragraph} /></p>)}</div>
}

export function ArticleImage({ article }) {
  const image = newsImage(article)
  const [failedUrl, setFailedUrl] = useState(null)
  if (!image) return null
  const license = safeNewsUrl(image.license)
  return <figure className="articleImage">
    {failedUrl === image.url ? <div className="articleImageFallback" role="img" aria-label="Article photograph unavailable"><span>PolitikApp</span><small>Article image unavailable</small></div>
      : <img src={image.url} alt={image.alt || 'Image from the original government article'} width="1600" height="900" loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setFailedUrl(image.url)} />}
    <figcaption>{image.attribution || 'Image from the original government article'} · <a href={image.sourceUrl} target="_blank" rel="noopener noreferrer">Source &amp; image rights</a>{license && <> · <a href={license} target="_blank" rel="noopener noreferrer">Image license</a></>}</figcaption>
  </figure>
}

export default function NewsCardContent({ article, expanded, onToggle }) {
  const content = newsPresentation(article, expanded)
  const isOpen = Boolean(expanded)
  const summaryId = `news-summary-${article.id}`
  // There is no separate takeaway panel in this layout, so preview the full reviewed summary.
  const previewParagraphs = summaryParagraphs(content.summary)
  return <div className="postBody newsCardContent">
    <ArticleImage article={article} />
    <span className="categoryPill"><i className="categoryDot" />{article.category}</span>
    <h2>{article.headline}</h2>

    {previewParagraphs.length > 0 && <div className={`newsCollapse newsPreviewWrap${isOpen ? '' : ' open'}`} aria-hidden={isOpen}>
      <div className="newsCollapseInner"><p className="newsPreview"><RichText text={previewParagraphs.join(' ')} /></p></div>
    </div>}

    {content.summary && <div className={`newsCollapse newsReviewedSummary${isOpen ? ' open' : ''}`} id={summaryId} aria-hidden={!isOpen}>
      <div className="newsCollapseInner">
        <p className="newsSummaryLabel">{summaryLabel(article)}{article.sourceAuthor ? ` · ${article.sourceAuthor}` : ''}</p>
        <SummaryText text={content.summary} />
      </div>
    </div>}

    {!content.summary && isOpen && <p className="newsSummaryLabel">Administrator-reviewed summary unavailable.</p>}

    {content.summary && <button className="readMore" type="button" aria-expanded={isOpen} aria-controls={summaryId} onClick={onToggle}>{isOpen ? 'Show less' : 'Read reviewed summary'}</button>}
  </div>
}
