export const guestRestrictedViews = new Set([
  'dashboard',
  'politicians',
  'compare',
  'contributions',
  'adminNews',
  'moderation',
  'profile',
  'submit',
  'account',
  'profileMatrix',
])

export const activeHeaders = {
  auth: ['Authentication', 'Civic Account Access'],
  account: ['Account', 'User Account'],
  compare: ['Compare', 'Compare Politicians'],
  contributions: ['Submissions', 'My Contribution Ledger'],
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
  'contributions',
  'adminNews',
  'submit',
  'moderation',
  'landing',
  'auth',
  'profile',
  'profileMatrix',
])
