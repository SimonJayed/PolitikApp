export const guestRestrictedViews = new Set([
  'dashboard',
  'politicians',
  'compare',
  'contributions',
  'moderation',
  'profile',
  'submit',
  'history',
  'account',
  'profileMatrix',
])

export const activeHeaders = {
  account: ['Account', 'User Account'],
  auth: ['Authentication', 'Civic Account Access'],
  compare: ['Compare', 'Compare Politicians'],
  contributions: ['Submissions', 'My Contribution Ledger'],
  dashboard: ['Dashboard', 'Source-First Profile Aggregator'],
  politicians: ['Politicians', 'Politicians'],
  history: ['History', 'Account Event Ledger'],
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
  'contributions',
  'submit',
  'moderation',
  'landing',
  'auth',
  'profileMatrix',
])
