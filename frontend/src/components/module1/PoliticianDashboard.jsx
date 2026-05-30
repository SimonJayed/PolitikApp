import React, { useState, useEffect, useRef } from 'react';
import PoliticianRankingPanel from '../PoliticianRankingPanel';
import { computeWgiCompositeScore } from './positionConfig';
import {
  FolderIcon,
  BarChart3Icon,
  KeyIcon,
  UsersIcon,
  FileTextIcon,
  ScaleIcon,
  ShieldCheckIcon,
} from '../icons/Lucide';

/**
 * Resolves the WGI composite score for a politician entry.
 * Prefers the server-computed value; falls back to client-side calculation.
 */
function resolveWgiScore(politician) {
  if (Number.isFinite(Number(politician.wgiCompositeScore)) && Number(politician.wgiCompositeScore) > 0) {
    return Number(politician.wgiCompositeScore)
  }
  return computeWgiCompositeScore(
    politician.position,
    Number(politician.billsAuthored || 0),
    Number(politician.projectCompletions || 0),
    Number(politician.trackedBudgetAllocated || 0),
    Number(politician.coaAuditDiscrepancies || 0),
  )
}

function CursorHint({ hoverInfo }) {
  const hintRef = useRef(null);
  const [position, setPosition] = useState({ left: -9999, top: -9999 });

  useEffect(() => {
    if (!hoverInfo?.x || !hoverInfo?.y || !hintRef.current) return;
    const tooltipRect = hintRef.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const offsetX = 6;
    const offsetY = 8;
    const margin = 6;

    let left = hoverInfo.x + offsetX;
    let top = hoverInfo.y + offsetY;

    if (left + tooltipRect.width > viewportWidth - margin) {
      left = hoverInfo.x - tooltipRect.width - offsetX;
    }
    if (top + tooltipRect.height > viewportHeight - margin) {
      top = hoverInfo.y - tooltipRect.height - offsetY;
    }

    left = Math.max(margin, Math.min(left, viewportWidth - tooltipRect.width - margin));
    top = Math.max(margin, Math.min(top, viewportHeight - tooltipRect.height - margin));
    setPosition({ left, top });
  }, [hoverInfo]);

  if (!hoverInfo?.x || !hoverInfo?.y) return null;
  return (
    <div ref={hintRef} aria-hidden="true" className="cursorHint" style={{ left: `${position.left}px`, top: `${position.top}px` }}>
      <strong>{hoverInfo.title}</strong>
      <span>{hoverInfo.description}</span>
      {hoverInfo.hint ? <small>{hoverInfo.hint}</small> : null}
    </div>
  );
}

export default function PoliticianDashboard({
  isLoading = false,
  onOpenProfile,
  politicians = [],
  onNavigate,
  user,
}) {
  const [hoverInfo, setHoverInfo] = useState(null);
  const totalProfiles = politicians.length;
  const totalCoaDiscrepancies = politicians.reduce((acc, curr) => acc + (curr.coaAuditDiscrepancies || 0), 0);
  const averageWgiScore = totalProfiles > 0
    ? politicians.reduce((acc, curr) => acc + resolveWgiScore(curr), 0) / totalProfiles
    : 0;

  const kpis = [
    {
      label: 'Politician Profiles',
      value: totalProfiles,
      sub: 'Active database profiles',
      description: 'Total number of profile records available for review and comparison. Higher counts indicate broader platform coverage across offices and jurisdictions.',
      hint: 'Open Directory to inspect each profile.',
      accent: 'var(--ph-blue)',
      icon: FolderIcon,
    },
    {
      label: 'COA Flags Tracked',
      value: totalCoaDiscrepancies,
      sub: 'Audit discrepancies logged',
      description: 'Combined count of Commission on Audit discrepancy entries linked to tracked officials. This helps surface governance risk signals quickly.',
      hint: 'Use Compare to cross-check flags side by side.',
      accent: 'var(--ph-gold)',
      icon: BarChart3Icon,
    },
    {
      label: 'Avg. WGI Score',
      value: `${averageWgiScore.toFixed(1)} / 100`,
      sub: 'Position-aware governance index',
      description: 'Average WGI Composite Score across all profiles. Computed per the World Bank WGI methodology — weighted by position group (Legislative, Executive, Council) and penalized for COA audit discrepancies.',
      hint: 'Select a profile to see position-specific WGI KPI detail.',
      accent: 'var(--info)',
      icon: BarChart3Icon,
    },
    {
      label: 'My Clearance Role',
      value: user?.role || 'CONTRIBUTOR',
      sub: 'Authorized session role',
      description: 'Your current permission level for this signed-in session. Role determines what you can submit, review, or administratively override.',
      hint: 'Role-based access is enforced across all modules.',
      accent: 'var(--ph-red)',
      icon: KeyIcon,
    },
  ];

  const actions = [
    {
      key: 'directory',
      icon: UsersIcon,
      title: 'Explore Directory',
      sub: 'Browse all politician profiles',
      description: 'Open the searchable profile list to inspect biography, jurisdiction, party details, and audit-linked records before taking action.',
      hint: 'Best starting point for profile discovery.',
      accent: 'var(--ph-blue)',
    },
    {
      key: 'submit',
      icon: FileTextIcon,
      title: 'File Evidence',
      sub: 'Submit an official audit record',
      description: 'Create a structured contribution using approved source domains and categorized action details so it can enter moderation.',
      hint: 'Prepare source URL + impact summary first.',
      accent: 'var(--ph-gold)',
    },
    {
      key: 'compare',
      icon: ScaleIcon,
      title: 'Compare Profiles',
      sub: 'Side-by-side candidate analysis',
      description: 'Review two candidates in parallel with aligned records and metrics to identify policy, budget, and audit differences faster.',
      hint: 'Use filters to narrow by jurisdiction.',
      accent: 'var(--info)',
    },
    {
      key: 'moderation',
      icon: ShieldCheckIcon,
      title: 'Moderation Jury',
      sub: 'Cast a double-blind ballot',
      description: 'Enter the adjudication queue where reviewers vote on evidence quality and outcome before records are finalized or published.',
      hint: 'Your vote impacts consensus and trust outcomes.',
      accent: 'var(--ph-red)',
    },
  ];

  return (
    <section className="workspace dashboardWorkspace" style={{ gap: '20px', display: 'flex', flexDirection: 'column' }}>
      <div className="dashboardHeroBanner" style={{
        background: 'linear-gradient(148deg, var(--ph-blue) 0%, #0c1e4a 55%, #06102a 100%)',
        borderRadius: 'var(--radius-xl)',
        padding: 'clamp(24px, 4vw, 36px)',
        position: 'relative',
        overflow: 'hidden',
        boxShadow: '0 16px 48px rgba(8, 20, 50, 0.28)'
      }}>
        <div style={{ position: 'absolute', top: '-60px', right: '-40px', width: '220px', height: '220px', borderRadius: '50%', background: 'rgba(255,255,255,0.04)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: '-40px', left: '5%', width: '140px', height: '140px', borderRadius: '50%', background: 'rgba(255,255,255,0.03)', pointerEvents: 'none' }} />
        <div style={{ position: 'relative' }}>
          <span className="ty-label" style={{ color: 'rgba(153, 132, 44, 0.95)', marginBottom: '10px', display: 'inline-block' }}>LIVE: CIVIC TRANSPARENCY PLATFORM</span>
          <h2 className="ty-section-title" style={{ color: '#ffffff', margin: '0 0 10px', letterSpacing: '-0.02em', lineHeight: '1.15', fontSize: 'clamp(1.25rem, 2.2vw, 1.6rem)' }}>
            Mabuhay, {user?.fullName || 'Contributor'}.
          </h2>
          <p style={{ color: 'rgba(220, 228, 245, 0.82)', fontSize: '14px', lineHeight: '1.7', margin: 0, maxWidth: '780px' }}>
            Track, analyze, and verify official legislative and audit records across local and national Philippine jurisdictions.
          </p>
        </div>
      </div>

      <div className="dashboardRowGrid">
        {kpis.map(({ label, value, sub, description, hint, accent, icon: Icon }) => (
          <article
            key={label}
            className="hoverLiftCard"
            onMouseEnter={(e) => setHoverInfo({ title: label, description, hint, x: e.clientX, y: e.clientY })}
            onMouseLeave={() => setHoverInfo(null)}
            onMouseMove={(e) => setHoverInfo((current) => current ? { ...current, x: e.clientX, y: e.clientY } : current)}
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--line-soft)',
              borderLeft: `3px solid ${accent}`,
              borderRadius: 'var(--radius-md)',
              padding: '18px 20px',
              boxShadow: 'var(--shadow-xs)',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px'
            }}
          >
            <span aria-hidden="true" className="inline-flex items-center justify-center" style={{ width: '22px', height: '22px', color: accent }}>
              <Icon size={18} />
            </span>
            <span className="ty-label" style={{ marginTop: '4px' }}>{label}</span>
            <strong style={{
              fontFamily: 'var(--display)',
              fontSize: 'clamp(1.3rem, 2vw, 1.8rem)',
              fontWeight: '800',
              color: 'var(--text-primary)',
              lineHeight: '1.1',
              letterSpacing: '-0.03em'
            }}>
              {value}
            </strong>
            <small className="ty-meta">{sub}</small>
          </article>
        ))}
      </div>

      <section className="dashboardSectionBlock">
        <h2 className="ty-section-title" style={{ margin: '0 0 14px' }}>Quick Actions</h2>
        <div className="dashboardRowGrid">
          {actions.map(({ key, icon: Icon, title, sub, description, hint, accent }) => (
            <button
              key={key}
              onClick={() => onNavigate(key)}
              onMouseEnter={(e) => setHoverInfo({ title, description, hint, x: e.clientX, y: e.clientY })}
              onMouseLeave={() => setHoverInfo(null)}
              onMouseMove={(e) => setHoverInfo((current) => current ? { ...current, x: e.clientX, y: e.clientY } : current)}
              type="button"
              className="hoverLiftCard"
              style={{
                minHeight: '170px',
                padding: '18px 20px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                justifyContent: 'flex-start',
                gap: '6px',
                cursor: 'pointer',
                background: 'var(--bg-surface)',
                border: '1px solid var(--line-soft)',
                borderLeft: `3px solid ${accent}`,
                borderRadius: 'var(--radius-md)',
                boxShadow: 'var(--shadow-xs)',
              }}
            >
              <span aria-hidden="true" className="inline-flex items-center justify-center" style={{ width: '22px', height: '22px', color: accent }}>
                <Icon size={18} />
              </span>
              <span className="ty-label" style={{ marginTop: '4px' }}>Quick Action</span>
              <strong style={{
                fontFamily: 'var(--display)',
                fontSize: 'clamp(1.3rem, 2vw, 1.8rem)',
                fontWeight: '800',
                color: 'var(--text-primary)',
                lineHeight: '1.1',
                letterSpacing: '-0.03em'
              }}>
                {title}
              </strong>
              <small className="ty-meta">{sub}</small>
            </button>
          ))}
        </div>
      </section>

      <section className="dashboardSectionBlock">
        <h2 className="ty-section-title" style={{ margin: '0 0 14px' }}>Performance Ranking</h2>
        <PoliticianRankingPanel isLoading={isLoading} onSelectPolitician={onOpenProfile} politicians={politicians} />
      </section>
      <CursorHint hoverInfo={hoverInfo} />
    </section>
  );
}
