import React from 'react'

function IconBase({ children, size = 18, className = '' }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      height={size}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
      width={size}
    >
      {children}
    </svg>
  )
}

// These are Lucide-style icons (SVG paths compatible with the Lucide icon set),
// vendored locally to avoid adding a new dependency.
export function LayoutDashboardIcon(props) {
  return (
    <IconBase {...props}>
      <rect x="3" y="3" width="7" height="9" rx="2" />
      <rect x="14" y="3" width="7" height="5" rx="2" />
      <rect x="14" y="10" width="7" height="11" rx="2" />
      <rect x="3" y="14" width="7" height="7" rx="2" />
    </IconBase>
  )
}

export function UsersIcon(props) {
  return (
    <IconBase {...props}>
      <path d="M16 11a4 4 0 1 0-8 0" />
      <path d="M12 15a7 7 0 0 0-7 7" />
      <path d="M12 15a7 7 0 0 1 7 7" />
      <path d="M20 8a3 3 0 1 0-5.5-1.5" />
      <path d="M4 8a3 3 0 1 1 5.5-1.5" />
    </IconBase>
  )
}

export function UserSquareIcon(props) {
  return (
    <IconBase {...props}>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M16 17a4 4 0 0 0-8 0" />
      <circle cx="12" cy="10" r="2.5" />
    </IconBase>
  )
}

export function GitCompareIcon(props) {
  return (
    <IconBase {...props}>
      <path d="M10 3v6a3 3 0 0 1-3 3H4" />
      <path d="M14 21v-6a3 3 0 0 1 3-3h3" />
      <path d="M7 12l-3 3 3 3" />
      <path d="M17 12l3-3-3-3" />
    </IconBase>
  )
}

export function HistoryIcon(props) {
  return (
    <IconBase {...props}>
      <path d="M3 12a9 9 0 1 0 9-9" />
      <path d="M3 4v4h4" />
      <path d="M12 7v5l3 2" />
    </IconBase>
  )
}

export function GavelIcon(props) {
  return (
    <IconBase {...props}>
      <path d="M14 13l-8-8" />
      <path d="M7 6l2-2 6 6-2 2" />
      <path d="M16 15l2-2 3 3-2 2z" />
      <path d="M2 22h10" />
    </IconBase>
  )
}

export function SettingsIcon(props) {
  return (
    <IconBase {...props}>
      <path d="M12 15.5A3.5 3.5 0 1 0 12 8.5a3.5 3.5 0 0 0 0 7z" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-1.42 3.42 2 2 0 0 1-1.42-.58l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.08a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06A2 2 0 0 1 3.8 17.88a2 2 0 0 1 .58-1.42l.06-.06A1.65 1.65 0 0 0 4.77 15a1.65 1.65 0 0 0-1.51-1H3.2a2 2 0 0 1 0-4h.06a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06A2 2 0 0 1 5.8 3.7a2 2 0 0 1 1.42.58l.06.06A1.65 1.65 0 0 0 9.1 4.07a1.65 1.65 0 0 0 1-1.51V2.5a2 2 0 0 1 4 0v.06a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 3.42 1.42 2 2 0 0 1-.58 1.42l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1h.06a2 2 0 0 1 0 4h-.06a1.65 1.65 0 0 0-1.51 1z" />
    </IconBase>
  )
}

export function LogOutIcon(props) {
  return (
    <IconBase {...props}>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="M16 17l5-5-5-5" />
      <path d="M21 12H9" />
    </IconBase>
  )
}

export function BellIcon(props) {
  return (
    <IconBase {...props}>
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 7h18s-3 0-3-7" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </IconBase>
  )
}

export function MenuIcon(props) {
  return (
    <IconBase {...props}>
      <path d="M4 6h16" />
      <path d="M4 12h16" />
      <path d="M4 18h16" />
    </IconBase>
  )
}

export function ChevronDownIcon(props) {
  return (
    <IconBase {...props}>
      <path d="M6 9l6 6 6-6" />
    </IconBase>
  )
}

export function UserCircleIcon(props) {
  return (
    <IconBase {...props}>
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="10" r="3" />
      <path d="M6.5 19a6.5 6.5 0 0 1 11 0" />
    </IconBase>
  )
}

export function SunIcon(props) {
  return (
    <IconBase {...props}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v2" />
      <path d="M12 20v2" />
      <path d="M4 12H2" />
      <path d="M22 12h-2" />
      <path d="M4.9 4.9l1.4 1.4" />
      <path d="M17.7 17.7l1.4 1.4" />
      <path d="M19.1 4.9l-1.4 1.4" />
      <path d="M6.3 17.7l-1.4 1.4" />
    </IconBase>
  )
}

export function AlertTriangleIcon(props) {
  return (
    <IconBase {...props}>
      <path d="M10.3 3.2l-8.4 15a2 2 0 0 0 1.7 3h16.8a2 2 0 0 0 1.7-3l-8.4-15a2 2 0 0 0-3.4 0z" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </IconBase>
  )
}

export function BarChart3Icon(props) {
  return (
    <IconBase {...props}>
      <path d="M3 3v18h18" />
      <path d="M7 16v-6" />
      <path d="M12 16V8" />
      <path d="M17 16v-3" />
    </IconBase>
  )
}

export function KeyIcon(props) {
  return (
    <IconBase {...props}>
      <path d="M21 2l-2 2" />
      <path d="M7.5 14.5a4.5 4.5 0 1 1 6.4-6.4 4.5 4.5 0 0 1-6.4 6.4z" />
      <path d="M15 7l3 3" />
      <path d="M14 8l-7 7H4v3h3v3h3v-3l7-7" />
    </IconBase>
  )
}

export function FolderIcon(props) {
  return (
    <IconBase {...props}>
      <path d="M3 7a2 2 0 0 1 2-2h5l2 2h9a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" />
    </IconBase>
  )
}

export function FileTextIcon(props) {
  return (
    <IconBase {...props}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
      <path d="M16 13H8" />
      <path d="M16 17H8" />
      <path d="M10 9H8" />
    </IconBase>
  )
}

export function ShieldCheckIcon(props) {
  return (
    <IconBase {...props}>
      <path d="M12 2l7 4v6c0 5-3.5 9-7 10-3.5-1-7-5-7-10V6l7-4z" />
      <path d="M9 12l2 2 4-4" />
    </IconBase>
  )
}

export function ScaleIcon(props) {
  return (
    <IconBase {...props}>
      <path d="M12 3v18" />
      <path d="M7 6h10" />
      <path d="M5 6l-3 7h6l-3-7z" />
      <path d="M19 6l-3 7h6l-3-7z" />
      <path d="M7 21h10" />
    </IconBase>
  )
}

export function ChevronLeftIcon(props) {
  return (
    <IconBase {...props}>
      <path d="M15 18l-6-6 6-6" />
    </IconBase>
  )
}

export function ChevronRightIcon(props) {
  return (
    <IconBase {...props}>
      <path d="M9 18l6-6-6-6" />
    </IconBase>
  )
}

export function ArrowLeftIcon(props) {
  return (
    <IconBase {...props}>
      <path d="M19 12H5" />
      <path d="M12 19l-7-7 7-7" />
    </IconBase>
  )
}

export function ArrowRightIcon(props) {
  return (
    <IconBase {...props}>
      <path d="M5 12h14" />
      <path d="M12 5l7 7-7 7" />
    </IconBase>
  )
}

export function ExternalLinkIcon(props) {
  return (
    <IconBase {...props}>
      <path d="M15 3h6v6" />
      <path d="M10 14L21 3" />
      <path d="M21 14v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h7" />
    </IconBase>
  )
}
