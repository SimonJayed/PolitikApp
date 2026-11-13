import { useEffect, useId, useRef, useState } from 'react'
import { API_BASE_URL, readApiResponse } from '../api/client'
import { fetchReadWithRetry } from '../api/readRequest'
import { publicReadCache } from '../api/readCache'
import { LEADERBOARD_SNAPSHOT_KEY } from '../features/congress/leaderboardReads'
import { formatJurisdiction, formatPosition } from './governance/positionConfig'
import { combineLeaderboardEntries, formatWgiScore, rankedLeaderboardEntries, validWgiScore } from '../features/congress/wgiLeaderboard'
import BaseModal from './BaseModal'
import './WgiLeaderboard.css'

const COLLAPSED_LIMIT = 6
const PAGE_STEP = 20
const SNAPSHOT_KEY = LEADERBOARD_SNAPSHOT_KEY

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
  return <>
    <ol className="wgiTopThree" aria-label="Featured leaderboard profiles">
      {entries.slice(0, 3).map(entry => <li key={entry.politicianId}>
        <button className="wgiFeatured" type="button" onClick={() => onSelectPolitician?.(entry.politicianId)} aria-label={`View profile: ${entry.fullName}`}>
          <Photo entry={entry} />
          <span className="wgiRank">{entry.rank ? `Rank ${entry.rank}` : 'Not ranked'}</span>
          <strong className="wgiName">{entry.fullName}</strong>
          <ScoreLabel entry={entry} />
        </button>
        <span className="wgiPedestal" aria-hidden="true">{entry.rank || ''}</span>
      </li>)}
    </ol>
    {(entries.length > 3 || children) && <div className="wgiFullRankings">
      <div className="wgiFullHeading"><h3>Full WGI rankings</h3><span>Highest scores first · Unscored profiles follow</span></div>
      <ol className="wgiRankedList" start={4} aria-label="Additional WGI rankings">
      {entries.slice(3).map(entry => {
        const tags = [formatPosition(entry.position), formatJurisdiction(entry.jurisdiction)].filter(Boolean)
        return <li key={entry.politicianId}>
          <button className="wgiListRow" type="button" onClick={() => onSelectPolitician?.(entry.politicianId)} aria-label={`View profile: ${entry.fullName}`}>
            <span className="wgiRank" aria-label={entry.rank ? `Rank ${entry.rank}` : 'Not ranked'} title={entry.rank ? 'Rank by WGI Score' : 'Not yet ranked; shown in default politician order'}>{entry.rank ? `#${entry.rank}` : '—'}</span>
            <Photo entry={entry} />
            <span className="wgiIdentity">
              <strong className="wgiName">{entry.fullName}</strong>
              <span className="wgiOffice">{tags.length
                ? tags.map((tag, index) => <span className="wgiTag" key={`${tag}-${index}`}>{tag}</span>)
                : 'Position Not Available'}</span>
            </span>
            <ScoreLabel entry={entry} />
          </button>
        </li>
      })}
      </ol>
      {children}
    </div>}
  </>
}

function ScoreLabel({ entry }) {
  const scored = validWgiScore(entry.wgiCompositeScore) !== null && Number.isInteger(entry.rank) && entry.rank > 0
  return <span className="wgiScore" data-score-state={scored ? 'scored' : 'unscored'}
    style={scored ? { '--pct': validWgiScore(entry.wgiCompositeScore) } : undefined}
    title={scored ? 'Calculated from eligible published records; 0.0 is a valid score' : 'No eligible published scoring records are available; this is not a score of zero'}>
    <small>WGI Score</small><strong>{scored ? formatWgiScore(entry.wgiCompositeScore) : 'Not yet scored'}</strong>
    {scored && <span className="wgiScoreMax">/ 100</span>}
  </span>
}

function LeaderboardSkeleton() {
  return <div className="wgiSkeleton" aria-hidden="true">
    <div className="wgiSkeletonPodium">
      {[0, 1, 2].map(index => <span className="wgiSkeletonBlock" key={index} />)}
    </div>
    <div className="wgiSkeletonRows">
      {[0, 1, 2].map(index => <span className="wgiSkeletonRow" key={index} />)}
    </div>
  </div>
}

function InfoTip({ label, children }) {
  const id = useId()
  const [open, setOpen] = useState(false)
  return <span className="wgiHelp" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
    <button className="wgiInfoButton" type="button" aria-label={label} aria-describedby={open ? id : undefined}
      onFocus={() => setOpen(true)} onBlur={() => setOpen(false)} onClick={() => setOpen(true)}
      onKeyDown={event => { if (event.key === 'Escape') { event.stopPropagation(); setOpen(false) } }}>i</button>
    {open && <span className="wgiTooltip" id={id} role="tooltip">{children}</span>}
  </span>
}

export function Methodology({ calculatedAt, latestSourceUpdate, onClose }) {
  return <BaseModal isOpen title="How are scores calculated?" onClose={onClose} modalClassName="wgiLeaderboardMethodology">
    <h2>How are scores calculated?</h2>
    <p>WGI means Worldwide Governance Indicators. PolitikApp uses its own record-based score inspired by these indicators. It is not an official World Bank rating of individual politicians.</p>
    <h3>What goes into a score?</h3>
    <ul className="wgiPlainFactors">
      <li><strong>Bills:</strong> eligible legislative records contribute according to their recorded status.</li>
      <li><strong>Projects:</strong> eligible project records contribute according to their recorded completion.</li>
      <li><strong>Budgets:</strong> tracked budget allocations contribute to the score.</li>
      <li><strong>Audit findings:</strong> Commission on Audit (COA) findings reduce the score based on their number and flagged amounts.</li>
    </ul>
    <p>Only eligible, published records count. The factors and weights depend on the politician’s office. The formula also combines bill and project contributions into an efficiency component. Open a profile to see the supporting records and source links.</p>
    <h3>What does a higher score mean?</h3>
    <p>A higher score means a higher result under this formula, based on the records available in PolitikApp. Rankings reflect this methodology, not an objective judgment of a politician’s overall performance. Different office weights, incomplete records and different lengths of service limit comparisons.</p>
    <h3>What is the maximum?</h3>
    <p>Scores stay within <strong>0 to 100</strong>; 100 is the upper limit. Some offices have a lower attainable maximum because of their weights and eligible factors. A score is not a percentage of overall performance or a passing grade.</p>
    <h3>Is zero the same as no score?</h3>
    <p><strong>0.0</strong> is a calculated score based on eligible records. <strong>Not yet scored</strong> means no eligible published scoring records are available; it is not zero. These profiles appear after scored politicians in the default directory order and have no WGI rank.</p>
    <details className="wgiCalculationDetails"><summary>View formula and ranking details</summary>
    <p>Imported source-reported claims, private drafts, hidden records and standalone accomplishments do not contribute. An audit finding is not itself proof of personal wrongdoing.</p>
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
    <p>Scores are ordered highest first. Equal unrounded scores are ordered by more bills, more projects, higher tracked budget, fewer COA findings, then name. Identical names use profile ID for consistency. Ranks are sequential after these tie-breaks. Displayed scores are rounded to one decimal.</p>
    <p>Missing records do not prove an absence of government activity. Scores are not normalized for time served or record completeness.</p>
    <p>These measures describe the project’s recorded indicators; they do not establish that one official is objectively better or worse. An audit finding is not itself proof of personal wrongdoing.</p>
    <p>Calculated for this leaderboard response: <strong>{updatedLabel(calculatedAt)}</strong>.</p>
    <p>Latest contributing record update among loaded entries: <strong>{updatedLabel(latestSourceUpdate)}</strong>. This is a system record timestamp, not the date of an independent real-world verification.</p>
    </details>
    <button className="wgiControl" type="button" onClick={onClose}>Got it</button>
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
          result = await publicReadCache.load(url, () => fetchReadWithRetry(url).then(readApiResponse), { maxAge: background || refresh > 0 ? 0 : 15000 })
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
  const remaining = Math.max(0, total - visibleCount)
  const latestSourceUpdate = state.entries.map(entry => entry.sourceUpdatedAt).filter(Boolean).sort().at(-1)
  const isInitialLoad = state.status === 'loading' && !visible.length
  function showMore() {
    const next = visibleCount + PAGE_STEP
    desiredCount.current = next
    setVisibleCount(next)
    if (state.entries.length < Math.min(next, state.totalRanked)) setRefresh(value => value + 1)
  }
  const controls = <div className="wgiControls">
    {!expanded && total > COLLAPSED_LIMIT && <button className="wgiControl" type="button" aria-expanded="false" onClick={showMore}>View Full Leaderboard ({total})</button>}
    {expanded && <>
      {remaining > 0 && <button className="wgiControl" type="button" disabled={moreLoading} onClick={showMore}>Show {Math.min(PAGE_STEP, remaining)} more</button>}
      <button className="wgiControl" type="button" aria-expanded="true" onClick={() => { desiredCount.current = COLLAPSED_LIMIT; setVisibleCount(COLLAPSED_LIMIT); heading.current?.scrollIntoView({ block: 'start' }) }}>Collapse leaderboard</button>
    </>}
  </div>
  return <section ref={heading} className="wgiLeaderboard" aria-label="WGI scores" aria-busy={isInitialLoad}>
    <div className="wgiHeader">
      <div>
        <p className="wgiMeta" role="status">
          {moreLoading && state.status === 'ready'
            ? 'Updating scores…'
            : state.calculatedAt ? `Scores calculated ${updatedLabel(state.calculatedAt)}` : ''}
        </p>
      </div>
      <button className="wgiControl wgiExplainButton" type="button" onClick={() => setShowMethodology(true)}>How are scores calculated?</button>
    </div>
    {state.error && <div className="wgiNotice wgiError" role="alert"><p>{state.status === 'ready' ? 'The latest WGI update could not be loaded. Showing the previous scores.' : 'WGI scores could not be loaded. Showing the default politician order.'} {state.error}</p><button className="wgiControl" type="button" onClick={() => setRefresh(value => value + 1)}>Retry leaderboard</button></div>}
    <>
      {isInitialLoad && <LeaderboardSkeleton />}
      {visible.length ? <WgiLeaderboardEntries entries={visible} onSelectPolitician={onSelectPolitician}>{controls}</WgiLeaderboardEntries>
        : state.status !== 'loading' && <p className="wgiNotice">No politician profiles are available yet.</p>}
      {state.status !== 'loading' && <p className="wgiFootnote">{state.totalRanked} scored profile{state.totalRanked === 1 ? '' : 's'}{total > 0 ? ` · showing ${Math.min(visibleCount, total)} of ${total}` : ''}.</p>}
    </>
    <div className="wgiReadingGuide" aria-label="Understanding WGI scores">
      <span><strong>0–100 scale</strong> · Higher means a higher result under this formula <InfoTip label="About the score scale">100 is the formula’s upper limit. Some offices have a lower attainable maximum because their weights and eligible factors differ. This is not a percentage grade.</InfoTip></span>
      <span><strong>0.0</strong> = a calculated score · <strong>Not yet scored</strong> = no eligible records <InfoTip label="About zero and missing scores">Zero is a valid calculated result. A profile without eligible published scoring records is not assigned zero or a WGI rank.</InfoTip></span>
    </div>
    <p className="wgiContextNote">Rankings reflect this methodology, not an objective judgment of a politician’s overall performance.</p>
    {showMethodology && <Methodology calculatedAt={state.calculatedAt} latestSourceUpdate={latestSourceUpdate} onClose={() => setShowMethodology(false)} />}
  </section>
}