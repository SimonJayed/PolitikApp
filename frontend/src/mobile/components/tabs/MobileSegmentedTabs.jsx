export function MobileSegmentedTabs({
  tabs = [],
  activeTab,
  onSelectTab,
}) {
  return (
    <div
      className="mobileSegmentedTabs"
      role="tablist"
      aria-label="Section tabs"
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            id={`tab-${tab.id}`}
            aria-controls={`panel-${tab.id}`}
            className={`mobileTabButton ${isActive ? 'active' : ''}`}
            onClick={() => onSelectTab(tab.id)}
          >
            {tab.label}
            {tab.count !== undefined && (
              <span style={{
                marginLeft: '6px',
                fontSize: '0.6875rem',
                padding: '1px 6px',
                borderRadius: '10px',
                background: isActive ? 'rgba(255, 255, 255, 0.25)' : 'rgba(0, 0, 0, 0.08)',
              }}>
                {tab.count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

export default MobileSegmentedTabs

