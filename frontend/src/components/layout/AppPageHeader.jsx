export default function AppPageHeader({ activeHeader }) {
  return (
    <header className="topBar">
      <div className="flex items-center gap-3">
        <div className="grid h-9 w-9 place-items-center rounded-2xl bg-(--accent-soft) text-(--ph-blue) ring-1 ring-black/5">
          <span className="ty-nav font-extrabold" aria-hidden="true">
            {activeHeader[0]?.slice(0, 1) || 'P'}
          </span>
        </div>

        <div className="min-w-0">
          <p className="ty-label">{activeHeader[0]}</p>
          <p className="ty-nav truncate text-(--text-primary)">{activeHeader[1]}</p>
        </div>
      </div>
    </header>
  )
}
