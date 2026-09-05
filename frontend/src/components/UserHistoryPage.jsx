import { useEffect, useState } from 'react'
import { ArrowLeftIcon, ArrowRightIcon, HistoryIcon } from './icons/Lucide'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080'

async function readApiResponse(response) {
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(body.message || `Request failed with status ${response.status}`)
  return body
}

function changeTone(value) {
  if (value > 0) return { label: 'Approved', className: 'text-emerald-700 bg-emerald-50 border-emerald-200' }
  if (value < 0) return { label: 'Rejected', className: 'text-rose-700 bg-rose-50 border-rose-200' }
  return { label: 'Updated', className: 'text-slate-700 bg-slate-100 border-slate-200' }
}

export default function UserHistoryPage({ token }) {
  const [state, setState] = useState({ status: 'loading', message: 'Loading history...' })
  const [entries, setEntries] = useState([])
  const [query, setQuery] = useState('')
  const [changeFilter, setChangeFilter] = useState('all')
  const [page, setPage] = useState(1)
  const pageSize = 10

  useEffect(() => {
    let cancelled = false
    fetch(`${API_BASE_URL}/users/me/history`, { headers: { Authorization: `Bearer ${token}` } })
      .then(readApiResponse)
      .then((data) => {
        if (cancelled) return
        setEntries(Array.isArray(data) ? data : [])
        setState({ status: 'success', message: '' })
      })
      .catch((error) => {
        if (cancelled) return
        setState({ status: 'error', message: error.message || 'Failed to load history.' })
      })
    return () => {
      cancelled = true
    }
  }, [token])

  const filtered = entries.filter((entry) => {
    const value = Number(entry.scoreChange || 0)
    const byType = changeFilter === 'all' ? true : changeFilter === 'additions' ? value > 0 : value < 0
    const haystack = [
      entry.reason || '',
      entry.logId || '',
      entry.queueId || '',
      entry.createdAt ? new Date(entry.createdAt).toLocaleString() : '',
    ].join(' ').toLowerCase()
    return byType && (!query.trim() || haystack.includes(query.trim().toLowerCase()))
  })

  useEffect(() => setPage(1), [query, changeFilter, entries.length])

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const safePage = Math.min(page, totalPages)
  const rows = filtered.slice((safePage - 1) * pageSize, safePage * pageSize)
  const approvals = entries.filter((entry) => Number(entry.scoreChange || 0) > 0).length
  const rejections = entries.filter((entry) => Number(entry.scoreChange || 0) < 0).length

  const statCards = [
    { label: 'Total', value: entries.length },
    { label: 'Approved', value: approvals },
    { label: 'Rejected', value: rejections },
  ]

  return (
    <section className="workspace historyWorkspace">
      <section className="historyShell">
        <div className="historyHeader">
          <p className="eyebrow ty-page-kicker">History</p>
          <h2 className="ty-section-title">Account Events</h2>
          <p className="ty-body">Track account-related decisions and their context.</p>
        </div>

        <div className="historyStats">
          {statCards.map(({ label, value }) => (
            <div key={label} className="historyStatCard">
              <p className="ty-meta">{label}</p>
              <p className="ty-metric">{value}</p>
            </div>
          ))}
        </div>

        <div className="historyFilterBar">
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search context, queue id, date..."
            className="historySearch"
          />
          <select
            value={changeFilter}
            onChange={(event) => setChangeFilter(event.target.value)}
            className="historySelect"
          >
            <option value="all">All Events</option>
            <option value="additions">Approvals Only</option>
            <option value="subtractions">Rejections Only</option>
          </select>
        </div>

        {state.status === 'loading' && (
          <div className="historySkeleton">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="historySkeletonRow" />
            ))}
          </div>
        )}

        {state.status === 'error' && <p className="statusLine error">{state.message}</p>}

        {state.status === 'success' && filtered.length === 0 && (
          <div className="historyEmpty">
            <div className="historyEmptyIcon">
              <HistoryIcon size={18} />
            </div>
            <p className="ty-card-title">No matching history records</p>
          </div>
        )}

        {state.status === 'success' && filtered.length > 0 && (
          <div className="historyTableShell">
            <div className="hidden md:block historyDesktopTable">
              <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                <colgroup>
                  <col style={{ width: 'auto' }} />
                  <col style={{ width: '160px' }} />
                </colgroup>
                <thead>
                  <tr style={{ background: 'var(--bg-inset)', textAlign: 'left' }}>
                    {['Event', 'Date'].map((h) => (
                      <th key={h} className="ty-meta historyTh">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((entry) => {
                    const value = Number(entry.scoreChange || 0)
                    const tone = changeTone(value)
                    return (
                      <tr key={entry.logId} style={{ borderTop: '1px solid var(--line-hairline)' }}>
                        <td
                          className="ty-body"
                          style={{
                            padding: '12px 16px',
                            verticalAlign: 'middle',
                            wordBreak: 'break-word',
                            color: 'var(--text-secondary)',
                          }}
                        >
                          <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold historyTone ${tone.className}`}>
                            {tone.label}
                          </span>
                          <span style={{ marginLeft: '10px' }}>{entry.reason || 'No context provided'}</span>
                        </td>
                        <td
                          className="ty-body"
                          style={{
                            padding: '12px 16px',
                            verticalAlign: 'middle',
                            color: 'var(--text-muted)',
                            fontSize: '0.82rem',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {entry.createdAt ? new Date(entry.createdAt).toLocaleString() : 'N/A'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <div className="md:hidden historyMobileCards">
              {rows.map((entry) => {
                const value = Number(entry.scoreChange || 0)
                    const tone = changeTone(value)
                    return (
                      <article key={entry.logId} className="historyMobileCard">
                        <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold historyTone ${tone.className}`}>
                      {tone.label}
                    </span>
                    <p className="ty-body">{entry.reason || 'No context provided'}</p>
                    <p className="ty-meta">{entry.createdAt ? new Date(entry.createdAt).toLocaleString() : 'N/A'}</p>
                  </article>
                )
              })}
            </div>
          </div>
        )}

        {state.status === 'success' && filtered.length > 0 && (
          <div className="historyPagination">
            <button
              type="button"
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              disabled={safePage <= 1}
              className="historyPageButton"
            >
              <ArrowLeftIcon size={14} /> Prev
            </button>
            <span className="ty-meta historyPageMeta">Page {safePage} of {totalPages}</span>
            <button
              type="button"
              onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
              disabled={safePage >= totalPages}
              className="historyPageButton"
            >
              Next <ArrowRightIcon size={14} />
            </button>
          </div>
        )}
      </section>
    </section>
  )
}
