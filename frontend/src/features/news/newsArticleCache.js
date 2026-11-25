import { API_BASE_URL } from '../../api/client'

export function updateNewsArticle(cache, id, update) {
  const detailUrl = API_BASE_URL + '/api/news/' + encodeURIComponent(id)
  cache.updateMatching(
    key => key.startsWith(API_BASE_URL + '/api/news?') || key === detailUrl,
    (key, data) => key === detailUrl ? update(data)
      : { ...data, items: data.items.map(item => item.id === id ? update(item) : item) },
  )
}
