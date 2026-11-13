import { useEffect, useState } from 'react'
import BaseModal from './BaseModal'
import { API_BASE_URL, readApiResponse } from '../api/client'
import { newsCacheFor } from '../api/readCache'
import { summaryLabel } from '../features/news/newsWorkflow'
import { newsPresentation, safeNewsUrl } from '../features/news/newsPresentation'
import { ArticleImage, SummaryText } from './NewsCardContent'
import './NewsArticleReader.css'

export default function NewsArticleReader({ id, token, initialArticle, onClose, onOpenProfile }) {
  const cache = newsCacheFor(token)
  const articleUrl = `${API_BASE_URL}/api/news/${id}`
  const seed = initialArticle?.id === id ? initialArticle : null
  const [loaded, setLoaded] = useState(() => ({ id, token, article: seed || cache.peek(articleUrl) || null }))
  const article = loaded.id === id && loaded.token === token ? loaded.article : seed || cache.peek(articleUrl) || null
  const [error, setError] = useState('')
  useEffect(() => {
    setError('')
    let cancelled = false
    // Feed responses already contain the full public article: show them immediately.
    // Refresh in the background and reuse recent detail responses when reopened.
    cache.load(articleUrl, () => fetch(articleUrl, { headers: token ? { Authorization: `Bearer ${token}` } : {} }).then(readApiResponse))
      .then(data => { if (!cancelled) setLoaded({ id, token, article: data }) })
      .catch(failure => { if (!cancelled) setError(failure.message) })
    return () => { cancelled = true }
  }, [id, token, cache, articleUrl])
  const content = article ? newsPresentation(article, true) : null
  const sourceUrl = article ? safeNewsUrl(article.sourceUrl) : null
  return <BaseModal isOpen title="Government news article" onClose={onClose} modalClassName="newsArticleReader">
    <button type="button" onClick={onClose}>Close article</button>
    {error && <p role="alert">{error}</p>}
    {!article && !error && <div className="articleReaderSkeleton" aria-label="Loading article" aria-busy="true"><span /><span /><span /></div>}
    {article && <article>
      <p className="readerSource">{article.sourceName} · {article.category}{article.adminVerified ? ' · Administrator reviewed' : ''}</p>
      <h1>{article.headline}</h1>
      {article.sourceAuthor && <p className="readerSource">Source author: {article.sourceAuthor}</p>}
      <ArticleImage article={article} />
      <section className="readerSummarySection" aria-labelledby="reader-summary-heading">
        <h2 id="reader-summary-heading">Reviewed summary</h2>
        <p className="readerSource">{summaryLabel(article)}</p>
        {content.summary ? <SummaryText text={content.summary} className="readerSummary" /> : <p>Administrator-reviewed summary unavailable.</p>}
      </section>
      <details className="readerOriginal"><summary>Source text as retrieved</summary><p>{article.originalContent || 'Source text is unavailable. Read the original source below.'}</p></details>
      {sourceUrl ? <a className="readerSourceLink" href={sourceUrl} target="_blank" rel="noopener noreferrer">Read the original government source</a> : <p>Original source link unavailable.</p>}
      {article.relatedPoliticians?.length > 0 && <><h2>Related politicians</h2><ul>{article.relatedPoliticians.map(p => <li key={p.id}>
        {onOpenProfile ? <button onClick={() => { onClose(); onOpenProfile(p.id) }}>{p.fullName}</button> : p.fullName}
      </li>)}</ul></>}
      {article.extraction?.legislativeRecords?.length > 0 && <><h2>Legislative records</h2>{article.extraction.legislativeRecords.map((record, index) => <p key={index}><strong>{record.identifier}: {record.title}</strong> — {record.status}</p>)}</>}
    </article>}
  </BaseModal>
}
