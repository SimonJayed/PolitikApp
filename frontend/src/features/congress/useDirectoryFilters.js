import { useEffect, useState } from 'react'

const defaults = { q: '', jurisdiction: 'ALL', position: 'ALL', congress: 'ALL', active: '' }

function readFilters() {
  const params = new URLSearchParams(window.location.search)
  return Object.fromEntries(Object.entries(defaults).map(([name, value]) => [name, params.get(name) || value]))
}

export function useDirectoryFilters() {
  const [filters, setFilters] = useState(readFilters)
  useEffect(() => {
    function restore() { setFilters(readFilters()) }
    window.addEventListener('popstate', restore)
    return () => window.removeEventListener('popstate', restore)
  }, [])

  function change(values) {
    const url = new URL(window.location.href)
    for (const [name, value] of Object.entries(values)) {
      if (value === defaults[name] || !String(value).trim()) url.searchParams.delete(name)
      else url.searchParams.set(name, value)
    }
    window.history.replaceState(window.history.state, '', url)
    setFilters(current => ({ ...current, ...values }))
  }

  return {
    query: filters.q, setQuery: q => change({ q }),
    jurisdictionFilter: filters.jurisdiction, setJurisdictionFilter: jurisdiction => change({ jurisdiction }),
    positionFilter: filters.position,
    setPositionFilter: (position, jurisdiction = filters.jurisdiction) => change({ position, congress: 'ALL', jurisdiction }),
    congressFilter: filters.congress, setCongressFilter: congress => change({ congress }),
    activeOnly: filters.active === '1', setActiveOnly: active => change({ active: active ? '1' : '' }),
    resetFilters: () => change({ ...defaults, q: filters.q }),
  }
}
