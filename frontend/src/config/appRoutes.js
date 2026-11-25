export const guestRestrictedViews = new Set([
  'adminNews',
  'openCongress',
  'moderation',
  'submit',
  'account',
  'profileMatrix',
])

export const activeHeaders = {
  auth: ['Authentication', 'Civic Account Access'],
  account: ['Account', 'User Account'],
  compare: ['Compare', 'Compare Politicians'],
  adminNews: ['News', 'Admin Verification Queue'],
  dashboard: ['Dashboard', 'Source-First Profile Aggregator'],
  politicians: ['Politicians', 'Politicians'],
  landing: ['Home', 'Verifiable Governance Platform'],
  moderation: ['Moderation', 'Judicial Moderation Engine'],
  profile: ['Profiles', 'Published Profile Dashboard'],
  profileMatrix: ['My Profile', 'Contribution Metrics'],
  submit: ['Submissions', 'Evidence Submission Console'],
}

export const headerTitleHiddenFor = new Set([
  'dashboard',
  'politicians',
  'compare',
  'adminNews',
  'openCongress',
  'submit',
  'moderation',
  'landing',
  'auth',
  'profile',
  'profileMatrix',
])

export const profileSections = ['overview', 'accountability', 'legislative-records', 'accomplishments']

function decodeSegment(value) {
  try {
    const decoded = decodeURIComponent(value)
    return decoded.trim() && !decoded.includes('/') && !decoded.includes(String.fromCharCode(92))
      && [...decoded].every(character => character.charCodeAt(0) >= 32) ? decoded : ''
  } catch {
    return ''
  }
}

export function readAppLocation(location) {
  const params = new URLSearchParams(location.search)
  const path = location.pathname.replace(/\/+$/, '') || '/'
  const parts = path.split('/').slice(1)
  if (path === '/admin/dashboard') return { view: 'adminNews' }
  if (parts[0] === 'politicians') {
    if (parts.length === 1) return { view: 'politicians' }
    const id = decodeSegment(parts[1])
    const section = parts[2] || 'overview'
    return id && parts.length <= 3 && profileSections.includes(section)
      ? { view: 'profile', id, section } : { view: 'notFound' }
  }
  if (parts[0] === 'news') {
    if (parts.length === 1) return {
      view: 'dashboard',
      articleId: params.get('articleId') || params.get('id') || undefined,
      original: params.get('original') === 'true',
    }
    const articleId = decodeSegment(parts[1])
    return articleId && (parts.length === 2 || (parts.length === 3 && parts[2] === 'original'))
      ? { view: 'dashboard', articleId, original: parts[2] === 'original' } : { view: 'notFound' }
  }
  if (path !== '/') return { view: 'notFound' }
  const view = params.get('view')
  const id = params.get('id') || params.get('politicianId') || ''
  if (view === 'profile') return { view, id, section: 'overview' }
  if (view === 'news' || (view === 'dashboard' && params.has('articleId'))) {
    return { view: 'dashboard', articleId: params.get('articleId') || id, original: params.get('original') === 'true' }
  }
  return { view, id }
}

export function profilePath(id, section = 'overview') {
  return '/politicians/' + encodeURIComponent(id) + (section === 'overview' ? '' : '/' + section)
}

export function newsPath(id, original = false) {
  return '/news' + (id ? '/' + encodeURIComponent(id) + (original ? '/original' : '') : '')
}
