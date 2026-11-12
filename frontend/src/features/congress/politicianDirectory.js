import { formatDisplayName } from './displayName.js'

export function normalizePosition(value) {
  const position = String(value || '').trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_')
  return ({ SENATE: 'SENATOR', HOUSE: 'HOUSE_REPRESENTATIVE', REPRESENTATIVE: 'HOUSE_REPRESENTATIVE',
    HOUSE_OF_REPRESENTATIVES: 'HOUSE_REPRESENTATIVE', CONGRESSMAN: 'HOUSE_REPRESENTATIVE', CONGRESSWOMAN: 'HOUSE_REPRESENTATIVE',
    VICE_PRES: 'VICE_PRESIDENT' })[position] || position
}

export function chamberForPosition(position) {
  return ({ SENATOR: 'senate', HOUSE_REPRESENTATIVE: 'house' })[normalizePosition(position)] || null
}

function memberships(person, metadata) {
  return metadata?.get(person.politicianId)?.memberships || []
}

export function matchesPosition(person, position, metadata) {
  if (position === 'ALL') return true
  const chamber = chamberForPosition(position)
  return normalizePosition(person.position) === normalizePosition(position)
    || Boolean(chamber && memberships(person, metadata).some(member => member.chamber === chamber))
}

export function directoryJurisdiction(person, metadata) {
  if (person.jurisdiction) return person.jurisdiction
  return memberships(person, metadata).length ? 'NATIONAL' : null
}

export function matchesCongress(person, position, congress, metadata) {
  const chamber = chamberForPosition(position)
  return !chamber || congress === 'ALL' || memberships(person, metadata)
    .some(member => member.chamber === chamber && Number(member.congress) === Number(congress))
}

export function congressOptions(people, position, metadata) {
  const chamber = chamberForPosition(position)
  if (!chamber) return []
  return [...new Set(people.filter(person => person.status !== 'ARCHIVED')
    .flatMap(person => memberships(person, metadata).filter(member => member.chamber === chamber)
      .map(member => Number(member.congress))))]
    .filter(number => Number.isInteger(number) && number > 0).sort((a, b) => b - a)
}

function currentTerm(person, today) {
  if (person.status === 'INACTIVE' || person.status === 'ARCHIVED') return false
  return Boolean(person.termStart && person.termEnd && person.termStart <= today && person.termEnd >= today)
}

export function directoryRank(person, metadata, currentCongress, today) {
  const position = normalizePosition(person.position)
  const active = currentTerm(person, today)
  if (active && position === 'PRESIDENT') return 0
  if (active && position === 'VICE_PRESIDENT') return 1
  const other = { GOVERNOR: 4, VICE_GOVERNOR: 5, MAYOR: 6, VICE_MAYOR: 7, CITY_COUNCILOR: 8 }
  if (active && Object.hasOwn(other, position)) return other[position]
  const records = memberships(person, metadata)
  const current = chamber => records.some(member => member.chamber === chamber
    && currentCongress != null && Number(member.congress) === Number(currentCongress))
  // A current office outranks former chamber memberships held by the same person.
  if (active && position === 'SENATOR') return 2
  if (active && position === 'HOUSE_REPRESENTATIVE') return 3
  const inactive = person.status === 'INACTIVE' || (chamberForPosition(position) && person.termEnd && person.termEnd < today)
  const currentSenate = !inactive && current('senate')
  const currentHouse = !inactive && current('house')
  if (currentSenate) return 2
  if (currentHouse) return 3
  if (records.some(member => member.chamber === 'senate') || position === 'SENATOR') return 10
  if (records.some(member => member.chamber === 'house') || position === 'HOUSE_REPRESENTATIVE') return 11
  // Offices without verified current terms remain discoverable above former legislators.
  return 9
}

export function sortDirectory(people, metadata, currentCongress, today) {
  const collator = new Intl.Collator('en-PH', { sensitivity: 'base', numeric: true })
  const sortName = person => {
    const source = metadata?.get(person.politicianId)
    return source?.lastName ? `${source.lastName}, ${source.firstName || person.fullName}` : formatDisplayName(person.fullName).name
  }
  return [...people].sort((left, right) => directoryRank(left, metadata, currentCongress, today) - directoryRank(right, metadata, currentCongress, today)
    || collator.compare(sortName(left), sortName(right)) || collator.compare(left.fullName, right.fullName)
    || String(left.politicianId).localeCompare(String(right.politicianId)))
}
