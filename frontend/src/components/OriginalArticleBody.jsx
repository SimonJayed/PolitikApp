import { createElement, useMemo } from 'react'
import { safeNewsUrl } from '../features/news/newsPresentation'

const articleTags = new Set([
  'p', 'div', 'section', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote',
  'ul', 'ol', 'li', 'dl', 'dt', 'dd', 'strong', 'b', 'em', 'i', 'u',
  'br', 'hr', 'pre', 'code', 'sup', 'sub', 'a',
])

function renderNode(node, key) {
  if (node.nodeType === 3) return node.textContent
  const tag = node.localName
  if (!articleTags.has(tag)) return null
  const props = { key }
  if (tag === 'a') {
    const href = safeNewsUrl(node.getAttribute('href'))
    if (!href) return createElement('span', props, Array.from(node.childNodes, renderNode))
    Object.assign(props, { href, target: '_blank', rel: 'noopener noreferrer' })
  }
  const attribute = tag === 'ol' ? 'start' : tag === 'li' ? 'value' : null
  if (attribute && node.hasAttribute(attribute)) {
    const value = Number(node.getAttribute(attribute))
    if (Number.isSafeInteger(value)) props[attribute] = value
  }
  if (tag === 'br' || tag === 'hr') return createElement(tag, props)
  return createElement(tag === 'h1' ? 'h2' : tag, props, Array.from(node.childNodes, renderNode))
}

export default function OriginalArticleBody({ html, text, title, sourceAvailable, loading }) {
  const body = useMemo(() => {
    if (!html || typeof DOMParser === 'undefined') return null
    const parsed = new DOMParser().parseFromString(html, 'text/html')
    return parsed.body.textContent.trim() ? Array.from(parsed.body.childNodes, renderNode) : null
  }, [html])
  const repeatedTitle = title && text?.startsWith(title) && /^\s/.test(text.slice(title.length))
  const savedText = repeatedTitle ? text.slice(title.length).trimStart() : text
  const paragraphs = savedText?.split(/\r?\n[ \t]*\r?\n/).filter(paragraph => paragraph.trim()) || []

  return (
    <section className="readerOriginal" aria-label="Original article" lang="en">
      {body || (paragraphs.length ? <>
        {!loading && paragraphs.length === 1 && <p className="readerOriginalNote">
          Publisher formatting is unavailable for this saved copy.{sourceAvailable && ' The publisher website may have the original layout.'}
        </p>}
        {paragraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)}
      </> : <p>{sourceAvailable ? 'Original text is unavailable here. Visit the publisher website to read the article.' : 'Original source unavailable.'}</p>)}
    </section>
  )
}
