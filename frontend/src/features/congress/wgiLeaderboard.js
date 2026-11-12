export function validWgiScore(value) {
  if (typeof value !== 'number' && (typeof value !== 'string' || !value.trim())) return null
  const score = Number(value)
  return Number.isFinite(score) && score >= 0 && score <= 100 ? score : null
}

export function formatWgiScore(value) {
  const score = validWgiScore(value)
  return score === null ? 'Not Available' : score.toFixed(1)
}

export function rankedLeaderboardEntries(entries = []) {
  return entries.filter(entry => validWgiScore(entry.wgiCompositeScore) !== null
    && Number.isInteger(entry.rank) && entry.rank > 0 && entry.politicianId)
}

// Only the leaderboard endpoint establishes score eligibility. Directory DTOs
// can contain legacy zero defaults even when there is no scoring evidence.
export function combineLeaderboardEntries(ranked = [], defaultPoliticians = []) {
  const entries = new Map(rankedLeaderboardEntries(ranked).map(entry => [entry.politicianId, entry]))
  for (const person of defaultPoliticians) {
    if (!person.politicianId || person.status === 'ARCHIVED' || entries.has(person.politicianId)) continue
    entries.set(person.politicianId, { ...person, rank: null, wgiCompositeScore: null })
  }
  return [...entries.values()]
}
