// Display only: never use this result for identity matching or persistence.
const suffix = /^(?:jr\.?|sr\.?|ii|iii|iv|v|vi)$/i
const surnameParticles = new Set(['de', 'del', 'dela', 'la', 'las', 'los', 'van', 'von', 'da', 'dos', 'di'])

export function formatDisplayName(sourceName = '') {
  const text = String(sourceName)
  const tokens = [...text.matchAll(/\S+/gu)]
  const end = tokens.length - (suffix.test(tokens.at(-1)?.[0] || '') ? 1 : 0)
  const initials = tokens.map((token, index) => /^\p{L}$/u.test(token[0]) ? index : -1).filter(index => index >= 0)
  if (!initials.length) return { name: text, needsReview: false }
  let surnameStart = end - 1
  while (surnameStart > 0 && surnameParticles.has(tokens[surnameStart - 1][0].toLowerCase())) surnameStart--
  const index = initials[0]
  // Only one interior initial directly before a surname; uncertain placement stays unchanged.
  const safe = initials.length === 1 && index > 0 && index === surnameStart - 1
    && tokens.slice(0, index).every(token => /^[\p{L}]+(?:[-’'][\p{L}]+)*$/u.test(token[0]))
    && tokens.slice(surnameStart, end).every(token => /^[\p{L}]+(?:[-’'][\p{L}]+)*[,]?$/u.test(token[0]))
  if (!safe) return { name: text, needsReview: true }
  const insertion = tokens[index].index + tokens[index][0].length
  return { name: `${text.slice(0, insertion)}.${text.slice(insertion)}`, needsReview: false }
}
