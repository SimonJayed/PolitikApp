import { useEffect, useMemo, useState } from 'react'
import { useDeveloperSandbox } from '../developer/DeveloperSandboxContext'
import './Sidebar.css'

function Sidebar({ activeView, onSelectView, title = 'PolitikApp' }) {
  const [isOpen, setIsOpen] = useState(true)

  const sandboxContext = useDeveloperSandbox()
  const isDevModeActive = sandboxContext ? sandboxContext.isDevModeActive : false
  const manipulatedUser = sandboxContext ? sandboxContext.manipulatedUser : null
  const currentRole = isDevModeActive && manipulatedUser ? manipulatedUser.role : 'JUDICIAL_REVIEWER'

  useEffect(() => {
    document.documentElement.style.setProperty('--sidebar-width', isOpen ? '320px' : '92px')
    return () => document.documentElement.style.removeProperty('--sidebar-width')
  }, [isOpen])

  const navSections = useMemo(() => {
    const featureItems = [
      { key: 'directory', label: 'Directory', icon: 'R', accent: '#5c8a9f' },
      { key: 'compare', label: 'Compare', icon: 'C', accent: '#b06b4a' },
    ]

    if (currentRole !== 'CONTRIBUTOR') {
      featureItems.push({ key: 'moderation', label: 'Moderation', icon: 'M', accent: '#0f766e' })
    }

    return [
      {
        title: 'Main',
        items: [{ key: 'dashboard', label: 'Dashboard', icon: 'D', accent: '#ef8354' }],
      },
      {
        title: 'Features',
        items: featureItems,
      },
    ]
  }, [currentRole])

  return (
    <aside className={isOpen ? 'appSidebar active' : 'appSidebar'} aria-label="Primary navigation">
      <div className="sidebarHeader">
        <button
          aria-expanded={isOpen}
          aria-label={isOpen ? 'Collapse sidebar' : 'Expand sidebar'}
          className="sidebarToggle"
          onClick={() => setIsOpen((current) => !current)}
          type="button"
        >
        </button>
        <div className="sidebarBrand">
          <span className="sidebarBrandText">{title}</span>
        </div>
      </div>

      <nav aria-label="Views">
        <ul>
          {navSections.map((section) => (
            <li className="sectionLabel" key={section.title}>
              <span>{section.title}</span>
              <ul>
                {section.items.map((item) => (
                  <li
                    className={activeView === item.key ? 'navItem active' : 'navItem'}
                    key={item.key}
                    style={{ '--bg': item.accent }}
                  >
                    <button onClick={() => onSelectView(item.key)} type="button">
                      <span className="icon" aria-hidden="true">
                        <span>{item.icon}</span>
                      </span>
                      <span className="text">{item.label}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </nav>

      <div className="bottom">
        <button className="navItem" style={{ '--bg': '#2d3142' }} type="button">
          <span className="icon" aria-hidden="true">
            <span>*</span>
          </span>
          <span className="text">Utilities</span>
        </button>
      </div>
    </aside>
  )
}

export default Sidebar

