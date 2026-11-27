import { publicCitationHref } from '../../api/congress'
import ProfileCitation from './ProfileCitation'

export default function ProfileBiography({ biography, review }) {
  const sourceLine = String(biography || '').match(/\bOfficial sources?:\s*((?:https?:\/\/[^\s]+\s*)+)$/i)
  const sources = [...new Set(sourceLine?.[1].trim().split(/\s+/).map(publicCitationHref).filter(Boolean))]
  const description = sourceLine && sources.length ? biography.slice(0, sourceLine.index).trim() : biography

  return <>
    <p className={description ? undefined : 'prEmptyState'}>{description || 'No biography available.'}</p>
    <ProfileCitation review={review} />
    {sources.length > 0 && review?.status !== 'INVALID_SOURCE' && <ul aria-label="Sources listed in biography">
      {sources.map((url, index) => <li key={url}>
        <a href={url} target="_blank" rel="noopener noreferrer">{new URL(url).hostname} · source {index + 1}</a>
      </li>)}
    </ul>}
  </>
}
