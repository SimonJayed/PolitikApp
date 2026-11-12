export function canProcessAi(article) {
  return Boolean(article && ['PENDING_REVIEW', 'APPROVED', 'REJECTED', 'UNPUBLISHED'].includes(article.status)
    && article.aiProcessingStatus !== 'INCOMPLETE' && article.originalContent?.trim())
}

export function canRejectArticle(article) {
  return Boolean(article && ['PENDING_REVIEW', 'APPROVED'].includes(article.status))
}

export function canRunNewsAction(article, action) {
  if (!article) return false
  switch (action) {
    case 'approve':
      return article.status === 'PENDING_REVIEW' && article.aiProcessingStatus !== 'INCOMPLETE'
        && Boolean(article.summary?.trim())
    case 'publish':
      return ['APPROVED', 'UNPUBLISHED'].includes(article.status) && article.aiProcessingStatus !== 'INCOMPLETE'
    case 'reject': return canRejectArticle(article)
    case 'unpublish': return article.status === 'PUBLISHED'
    default: return false
  }
}

export function planBulkNewsAction(items, selectedIds, action) {
  const selected = items.filter(item => selectedIds.includes(item.id))
  const eligible = selected.filter(item => canRunNewsAction(item, action))
  return { eligible, skipped: selectedIds.length - eligible.length }
}

// Limit parallel writes so a large selection cannot occupy the whole DB pool.
export async function runConcurrentNewsActions(items, run, onSettled) {
  let cursor = 0
  let processed = 0
  async function worker() {
    while (cursor < items.length) {
      const item = items[cursor++]
      let value
      let error
      try { value = await run(item) } catch (failure) { error = failure }
      onSettled({ item, value, error, processed: ++processed })
    }
  }
  await Promise.all(Array.from({ length: Math.min(3, items.length) }, worker))
}

export function summaryLabel(article) {
  if (article?.aiProcessingStatus === 'COMPLETED') return 'AI-assisted summary · administrator reviewed'
  if (article?.aiProcessingStatus === 'MOCKED') return 'Source excerpt · AI mock mode'
  if (article?.aiProcessingStatus === 'FAILED') return 'Manual review summary · AI processing unavailable'
  return 'Source-based summary · administrator reviewed'
}

export function aiActionNotice(article) {
  if (article?.aiProcessingStatus === 'FAILED') {
    const detail = article.reviewNotes?.trim() ? ` ${article.reviewNotes.trim()}` : ''
    return { status: 'error', message: `AI processing failed.${detail}` }
  }
  if (article?.aiProcessingStatus === 'MOCKED') {
    return { status: 'success', message: 'AI mock mode is active: saved a source excerpt instead of calling Gemini.' }
  }
  return { status: 'success', message: 'AI processing completed. Review extracted evidence and uncertainty flags before approval.' }
}
