import { useEffect, useState } from 'react'
import BaseModal from './BaseModal'
import { API_BASE_URL, readApiResponse } from '../api/client'

export default function NewsArticleReader({ id, token, onClose, onOpenProfile }) {
  const [article, setArticle] = useState(null)
  const [error, setError] = useState('')
  useEffect(() => {
    const controller = new AbortController()
    setArticle(null)
    setError('')
    fetch(`${API_BASE_URL}/api/news/${id}`, { signal: controller.signal, headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then(readApiResponse).then(setArticle).catch(failure => { if (failure.name !== 'AbortError') setError(failure.message) })
    return () => controller.abort()
  }, [id, token])
  return <BaseModal isOpen title="Government news article" onClose={onClose}>
    <button type="button" onClick={onClose}>Close article</button>
    {error && <p role="alert">{error}</p>}
    {!article && !error && <div className="articleReaderSkeleton" aria-label="Loading article" aria-busy="true"><span /><span /><span /></div>}
    {article && <article>
      <h1>{article.headline}</h1><p>{article.sourceName} · {article.category}</p>
      <h2>Summary</h2><p>{article.summary}</p>
      <ul>{article.keyPoints?.map((point, index) => <li key={index}>{point}</li>)}</ul>
      <h2>Source text</h2><p style={{ whiteSpace: 'pre-wrap' }}>{article.originalContent || 'Source text is unavailable. Read the original source below.'}</p>
      <a href={article.sourceUrl} target="_blank" rel="noreferrer">Read the original government source</a>
      {article.relatedPoliticians?.length > 0 && <><h2>Related politicians</h2><ul>{article.relatedPoliticians.map(p => <li key={p.id}>
        {onOpenProfile ? <button onClick={() => { onClose(); onOpenProfile(p.id) }}>{p.fullName}</button> : p.fullName}
      </li>)}</ul></>}
      {article.extraction?.legislativeRecords?.length > 0 && <><h2>Legislative records</h2>{article.extraction.legislativeRecords.map((record, index) => <p key={index}><strong>{record.identifier}: {record.title}</strong> — {record.status}</p>)}</>}
    </article>}
  </BaseModal>
}
