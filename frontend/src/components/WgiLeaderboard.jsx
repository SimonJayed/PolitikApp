import { useEffect, useRef, useState } from 'react'
import { API_BASE_URL, readApiResponse } from '../api/client'
import { fetchReadWithRetry } from '../api/readRequest'
import { publicReadCache } from '../api/readCache'
import { formatJurisdiction, formatPosition } from './governance/positionConfig'
import { combineLeaderboardEntries, formatWgiScore, rankedLeaderboardEntries, validWgiScore } from '../features/congress/wgiLeaderboard'
import BaseModal from './BaseModal'
import './WgiLeaderboard.css'

const COLLAPSED_LIMIT = 6
const SNAPSHOT_KEY = `${API_BASE_URL}/api/politicians/leaderboard:visible`

function updatedLabel(value) {
  if (!value || !Number.isFinite(new Date(value).getTime())) return 'Not Available'
  return `${new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Manila' }).format(new Date(value))} (Manila time)`
}

function Photo({ entry }) {
  return <span className="wgiPhoto">
    <span aria-hidden="true">{String(entry.fullName || '').split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('')}</span>
    {entry.profileImageUrl && <img src={entry.profileImageUrl} alt={entry.fullName} loading="lazy" decoding="async"
      onError={event => { event.currentTarget.hidden = true }} onLoad={event => { event.currentTarget.hidden = false }} />}
  </span>
}

export function WgiLeaderboardEntries({ entries = [], onSelectPolitician, children }) {
  const score = entry => validWgiScore(entry.wgiCompositeScore) === null ? '—' : formatWgiScore(entry.wgiCompositeScore)
  return <>
    <ol className="wgiTopThree" aria-label="Featured leaderboard profiles">
      {entries.slice(0, 3).map((entry, index) => <li key={entry.politicianId}>
        <button className="wgiFeatured" type="button" onClick={() => onSelectPolitician?.(entry.politicianId)} aria-label={`View profile: ${entry.fullName}`}>
          <Photo entry={entry} />
          <span className="wgiRank">{entry.rank ? `Rank ${entry.rank}` : `Position ${index + 1}`}</span>
          <strong className="wgiName">{entry.fullName}</strong>
          <span className="wgiScore" title={entry.rank ? 'Calculated WGI score' : 'WGI score not available'}><small>WGI</small> {score(entry)}</span>
        </button>
      </li>)}
    </ol>
    {(entries.length > 3 || children) && <div className="wgiFullRankings">
      <div className="wgiFullHeading"><h3>Full WGI rankings</h3><span>Scored first · Default order for unscored profiles</span></div>
      <ol className="wgiRankedList" start={4} aria-label="Additional WGI rankings">
      {entries.slice(3).map((entry, index) => <li key={entry.politicianId}>
        <button className="wgiListRow" type="button" onClick={() => onSelectPolitician?.(entry.politicianId)} aria-label={`View profile: ${entry.fullName}`}>
          <span className="wgiRank" title={entry.rank ? 'WGI rank' : 'Default directory position'}>#{entry.rank || index + 4}</span>
          <Photo entry={entry} />
          <span className="wgiIdentity"><strong className="wgiName">{entry.fullName}</strong><span className="wgiOffice">{[formatPosition(entry.position), formatJurisdiction(entry.jurisdiction)].filter(Boolean).join(' · ') || 'Position Not Available'}</span></span>
          <span className="wgiScore" title={entry.rank ? 'Calculated WGI score' : 'WGI score not available'}>{score(entry)}</span>
        </button>
      </li>)}
      </ol>
      {children}
    </div>}
  </>
}

function Methodology({ calculatedAt, latestSourceUpdate, onClose }) {
  return <BaseModal isOpen title="About WGI scoring" onClose={onClose} modalClassName="wgiLeaderboardMethodology">
    <h2>About WGI scoring</h2>
    <p>WGI stands for Worldwide Governance Indicators. PolitikApp uses a project-specific, position-aware composite inspired by those indicators. It is not an official World Bank rating of individual politicians.</p>
    <p>The existing scoring service combines published, curated legislative records, project completion, tracked budget allocations, and COA findings. Its activity terms represent Government Effectiveness and its audit penalties represent Control of Corruption within the project’s model. Open a profile to inspect supporting source citations. Imported source-reported claims, private drafts, hidden records, and standalone accomplishments do not contribute.</p>
    <h3>Existing calculation</h3>
    <p>Bills are weighted by recorded status: Filed 0.3, In Committee 0.6, Approved/Enacted 1, and Rejected/Withdrawn 0. The existing scorer uses 1 for missing or unrecognized statuses. Project contributions use completion percentage divided by 100, or 1 when unavailable.</p>
    <p>Bills, projects, and budget are normalized against reference ceilings of 50 bills, 30 project completions, and PHP 500 million, capped at 100. Efficiency is the average of normalized projects and bills when effective bills are above zero; otherwise it is normalized projects.</p>
    <div className="wgiFormulaTable"><table><caption>Position weights in the current scorer</caption><thead><tr><th>Office group</th><th>Bills</th><th>Projects</th><th>Budget</th><th>Efficiency</th></tr></thead><tbody>
      <tr><th>Legislative</th><td>35%</td><td>—</td><td>25%</td><td>30%</td></tr>
      <tr><th>Executive</th><td>—</td><td>45%</td><td>30%</td><td>20%</td></tr>
      <tr><th>Vice executive</th><td>30%</td><td>20%</td><td>25%</td><td>25%</td></tr>
      <tr><th>Council</th><td>40%</td><td>—</td><td>35%</td><td>—</td></tr>
      <tr><th>Other / unspecified</th><td>25%</td><td>25%</td><td>20%</td><td>20%</td></tr>
    </tbody></table></div>
    <p>The COA penalty is twice the finding count plus a magnitude penalty, capped together at 40. With a tracked budget, magnitude is the lesser of 30 and (flagged amount ÷ (budget + 1,000)) × 40. With flagged funds but no tracked budget, it is the lesser of 30 and three times the finding count. The final score is clamped to 0–100.</p>
    <h3>Ranking and limitations</h3>
    <p>Scores are ordered highest first. Equal unrounded scores use the previous leaderboard’s order: more bills, more projects, higher tracked budget, fewer COA findings, then name. Identical names use profile ID for consistency. Ranks are sequential after these tie-breaks. Displayed scores are rounded to one decimal.</p>
    <p>Profiles without eligible scoring records show WGI — and follow the default directory order after scored profiles. Their displayed positions are not WGI ranks. A calculated zero remains valid. Missing records do not prove an absence of government activity. Scores reflect available curated data, use different office weights, and are not normalized for time served or record completeness.</p>
    <p>These measures describe the project’s recorded indicators; they do not establish that one official is objectively better or worse. An audit finding is not itself proof of personal wrongdoing.</p>
    <p>Calculated for this leaderboard response: <strong>{updatedLabel(calculatedAt)}</strong>.</p>
    <p>Latest contributing record update among loaded entries: <strong>{updatedLabel(latestSourceUpdate)}</strong>. This is a system record timestamp, not the date of an independent real-world verification.</p>
    <button className="wgiControl" type="button" onClick={onClose}>Close scoring methodology</button>
  </BaseModal>
}

export default function WgiLeaderboard({ defaultPoliticians = [], onSelectPolitician }) {
  const [state, setState] = useState(() => publicReadCache.peek(SNAPSHOT_KEY) ?? { status: 'loading', entries: [], totalRanked: 0, unrankedCount: 0, calculatedAt: null, error: '' })
  const [refresh, setRefresh] = useState(0)
  const [visibleCount, setVisibleCount] = useState(COLLAPSED_LIMIT)
  const [moreLoading, setMoreLoading] = useState(false)
  const [showMethodology, setShowMethodology] = useState(false)
  const desiredCount = useRef(COLLAPSED_LIMIT)
  const heading = useRef(null)

  useEffect(() => {
    let disposed = false
    let activeRequest = null
    async function update(background = false) {
      if (disposed || (background && document.visibilityState === 'hidden')) return
      activeRequest?.abort()
      const controller = new AbortController()
      activeRequest = controller
      if (background) setMoreLoading(true)
      try {
        // Replace every loaded score page so profiles can move across boundaries.
        let entries = []
        let result
        do {
          const limit = Math.min(50, desiredCount.current - entries.length)
          const url = `${API_BASE_URL}/api/politicians/leaderboard?offset=${entries.length}&limit=${limit}`
          result = await publicReadCache.load(url, () => fetchReadWithRetry(url).then(readApiResponse), { maxAge: 0 })
          if (!Array.isArray(result.entries)) throw new Error('The leaderboard response was unavailable. Please retry.')
          const page = rankedLeaderboardEntries(result.entries)
          entries = [...entries, ...page]
          if (!page.length) break
        } while (result.hasMore && entries.length < desiredCount.current)
        if (!disposed && !controller.signal.aborted) {
          const next = { ...result, entries, status: 'ready', error: '' }
          publicReadCache.set(SNAPSHOT_KEY, next)
          setState(next)
        }
      } catch (error) {
        if (!disposed && !controller.signal.aborted) setState(current => ({ ...current, status: current.status === 'ready' ? 'ready' : 'error', error: error.message }))
      } finally {
        if (!disposed && activeRequest === controller) { activeRequest = null; setMoreLoading(false) }
      }
    }
    update()
    const automaticUpdate = () => { if (!activeRequest) update(true) }
    const interval = window.setInterval(automaticUpdate, 15000)
    window.addEventListener('focus', automaticUpdate)
    window.addEventListener('online', automaticUpdate)
    document.addEventListener('visibilitychange', automaticUpdate)
    return () => {
      disposed = true
      activeRequest?.abort()
      window.clearInterval(interval)
      window.removeEventListener('focus', automaticUpdate)
      window.removeEventListener('online', automaticUpdate)
      document.removeEventListener('visibilitychange', automaticUpdate)
    }
  }, [refresh])

  const combined = combineLeaderboardEntries(state.entries, defaultPoliticians)
  const visible = combined.slice(0, visibleCount)
  const total = Math.max(combined.length, state.totalRanked + state.unrankedCount)
  const expanded = visibleCount > COLLAPSED_LIMIT
  const latestSourceUpdate = state.entries.map(entry => entry.sourceUpdatedAt).filter(Boolean).sort().at(-1)
  function showMore() {
    const next = visibleCount + 20
    desiredCount.current = next
    setVisibleCount(next)
    if (state.entries.length < Math.min(next, state.totalRanked)) setRefresh(value => value + 1)
  }
  const controls = <div className="wgiControls">
    {!expanded && total > COLLAPSED_LIMIT && <button className="wgiControl" type="button" aria-expanded="false" onClick={showMore}>View Full Leaderboard</button>}
    {expanded && <>
      {total > visibleCount && <button className="wgiControl" type="button" disabled={moreLoading} onClick={showMore}>{moreLoading ? 'Loading rankings…' : 'Show More'}</button>}
      <button className="wgiControl" type="button" aria-expanded="true" onClick={() => { desiredCount.current = COLLAPSED_LIMIT; setVisibleCount(COLLAPSED_LIMIT); heading.current?.scrollIntoView({ block: 'start' }) }}>Collapse leaderboard</button>
    </>}
  </div>
  return <section className="wgiLeaderboard" aria-labelledby="wgi-leaderboard-heading">
    <div className="wgiHeader">
      <div><h2 id="wgi-leaderboard-heading" ref={heading}>WGI Leaderboard</h2><p>Published scores first. Unscored profiles follow the default politician order.</p></div>
      <button className="wgiControl" type="button" onClick={() => setShowMethodology(true)}>Methodology</button>
    </div>
    {state.status === 'loading' && <p role="status">Loading WGI rankings…</p>}
    {state.error && <div className="wgiNotice" role="alert"><p>{state.status === 'ready' ? 'The latest WGI update could not be loaded. Showing the previous scores.' : 'WGI scores could not be loaded. Showing the default politician order.'} {state.error}</p><button className="wgiControl" type="button" onClick={() => setRefresh(value => value + 1)}>Retry leaderboard</button></div>}
    {state.status !== 'loading' && <>
      {visible.length ? <WgiLeaderboardEntries entries={visible} onSelectPolitician={onSelectPolitician}>{controls}</WgiLeaderboardEntries>
        : <p className="wgiNotice">No politician profiles are available yet.</p>}
      <p className="wgiFootnote">{state.totalRanked} scored profile{state.totalRanked === 1 ? '' : 's'}. WGI — means no eligible score yet; default positions are not WGI ranks.</p>
      <p className="wgiFootnote">Updates automatically every 15 seconds while this page is visible. Calculated: {updatedLabel(state.calculatedAt)}.</p>
    </>}
    {showMethodology && <Methodology calculatedAt={state.calculatedAt} latestSourceUpdate={latestSourceUpdate} onClose={() => setShowMethodology(false)} />}
  </section>
}
