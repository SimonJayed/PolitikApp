import { useEffect, useState } from 'react'
import { API_BASE_URL, readApiResponse } from '../api/client'
import { fetchReadWithRetry } from '../api/readRequest'
import { newsCacheFor } from '../api/readCache'
import { summaryLabel } from '../features/news/newsWorkflow'
import { colorFor, newsPresentation, safeNewsUrl } from '../features/news/newsPresentation'
import { ArticleCategory, ArticleImage, ArticleMeta, PublisherLink, SummaryText } from './NewsCardContent'
import { ArrowLeftIcon } from './icons/Lucide'
import OriginalArticleBody from './OriginalArticleBody'
import { LoadingSkeleton } from './Skeletons'
import './NewsArticleReader.css'

export default function NewsArticleReader({
  id, original, token, hrefFor, backHref, onClose, onChangeView, onOpenProfile, renderActions, renderDiscussionAction, renderDiscussion,
}) {
  const cache = newsCacheFor(token)
  const url = API_BASE_URL + '/api/news/' + encodeURIComponent(id)
  const [loaded, setLoaded] = useState(null)
  const [error, setError] = useState(null)
  const [retry, setRetry] = useState(0)
  const article = loaded?.cache === cache ? loaded.article : cache.peek(url)
  const [originalLayout, setOriginalLayout] = useState(null)
  const originalText = article?.originalContent?.trim()

  useEffect(() => {
    let current = true
    setError(null)
    cache.load(url, () => fetchReadWithRetry(url, { headers: token ? { Authorization: 'Bearer ' + token } : {} })
      .then(readApiResponse), { force: retry > 0 }).then(data => {
      if (current) setLoaded({ cache, article: data })
    }).catch(failure => {
      if (current) setError(failure)
    })
    return () => { current = false }
  }, [cache, url, token, retry])

  useEffect(() => {
    if (!original || !originalText || originalLayout !== null) return
    const controller = new AbortController()
    fetch(url + '/original', { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(20_000)]) })
      .then(readApiResponse)
      .then(data => { if (!controller.signal.aborted) setOriginalLayout({ html: data.html }) })
      .catch(() => { if (!controller.signal.aborted) setOriginalLayout({ html: null }) })
    return () => controller.abort()
  }, [original, originalLayout, originalText, url])

  function navigate(event, showOriginal) {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    event.preventDefault()
    onChangeView(showOriginal)
  }

  const content = article ? newsPresentation(article, true) : null
  const sourceUrl = safeNewsUrl(article?.sourceUrl)
  const missing = error?.status === 404 || error?.status === 400

  return (
    <div className="newsPageFrame readerPage">
      <a className="readerBack" href={backHref} onClick={event => {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
        event.preventDefault()
        onClose()
      }}><ArrowLeftIcon size={18} /> Back to news</a>
      <article className="newsPost featured newsArticleReader" aria-label="Government news article"
        style={{ '--cat': colorFor(article?.category) }}>
        {error && <div role="alert">
          <h1 className="readerHeadline">{missing ? 'News article not found' : 'Unable to load article'}</h1>
          {!missing && <button type="button" onClick={() => setRetry(value => value + 1)}>Retry article</button>}
        </div>}
        {!article && !error && <LoadingSkeleton label="Loading article" rows={6} />}
        {article && !missing && <>
          <ArticleMeta article={article} />
          <div className="postBody newsCardContent readerBody">
            <ArticleImage article={article} />
            <ArticleCategory category={article.category} />
            <h1 className={original ? 'readerHeadline readerOriginalHeadline' : 'readerHeadline'}>{original ? article.originalTitle || article.headline : article.headline}</h1>
            {article.sourceAuthor && <p className="newsSummaryLabel">By {article.sourceAuthor}</p>}
            <nav className="readerViews" aria-label="Article views">
              <a href={hrefFor(false)} aria-current={!original ? 'page' : undefined} onClick={event => navigate(event, false)}>Summary</a>
              {(originalText || original) && <a href={hrefFor(true)} aria-current={original ? 'page' : undefined}
                onClick={event => navigate(event, true)}>Read Original</a>}
            </nav>
            {original ? <OriginalArticleBody
              html={originalLayout?.html}
              text={originalText}
              title={article.originalTitle}
              sourceAvailable={Boolean(sourceUrl)}
              loading={Boolean(originalText && !originalLayout)}
            /> : <section className="readerSummarySection" aria-label="Reviewed summary">
              <p className="newsSummaryLabel">{summaryLabel(article)}</p>
              {content.summary ? <SummaryText text={content.summary} className="readerSummary" /> : <p>Administrator-reviewed summary unavailable.</p>}
            </section>}
            {!sourceUrl && <p className="newsSummaryLabel">Original source link unavailable.</p>}
          </div>
          {article.relatedPoliticians?.length > 0 && <section className="readerRelated">
            <h2>Related politicians</h2>
            <ul>{article.relatedPoliticians.map(person => <li key={person.id}>
              {onOpenProfile ? <button type="button" onClick={() => onOpenProfile(person.id)}>{person.fullName}</button> : person.fullName}
            </li>)}</ul>
          </section>}
          {article.extraction?.legislativeRecords?.length > 0 && <section className="readerRelated">
            <h2>Legislative records</h2>
            {article.extraction.legislativeRecords.map((record, index) => <p key={index}><strong>{record.identifier} {record.title}</strong> · {record.status}</p>)}
          </section>}
          <footer className="postActions">
            <div className="postActionsStart">{renderDiscussionAction?.(article)}</div>
            <div className="postActionsEnd readerActions">
              <PublisherLink url={article.sourceUrl} />
              {renderActions?.(article)}
            </div>
          </footer>
          {renderDiscussion?.(article)}
        </>}
      </article>
    </div>
  )
}
