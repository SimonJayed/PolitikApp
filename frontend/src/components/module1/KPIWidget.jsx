import React from 'react';
import { getKpisForPosition, getPositionGroupLabel } from './positionConfig';

export default function KPIWidget({ profile, compact = false }) {
  if (!profile) return null;

  const metrics = getKpisForPosition(profile.position, profile);
  const groupLabel = getPositionGroupLabel(profile.position);

  return (
    <section className={compact ? 'kpiGrid compact' : 'kpiGrid'} aria-label="Performance indicators">
      <div className="kpi-position-group-label" aria-label={`Position group: ${groupLabel}`}>
        <span>{groupLabel}</span>
        <span className="kpi-position-group-sublabel">WGI-Mapped Performance Indicators</span>
      </div>
      {metrics.map(({ label, value, isAlert, wgiPillar }) => (
        <article
          className={`kpiCard ${isAlert ? 'kpi-card-alert' : ''}`}
          key={label}
          title={`WGI Pillar: ${wgiPillar}`}
          style={isAlert ? { borderLeft: '3px solid var(--ph-gold)', background: '#fef9e8' } : {}}
        >
          <span className="ty-label">{label}</span>
          <strong style={isAlert ? { color: '#92660a' } : {}}>{value ?? 'N/A'}</strong>
          <span className="kpi-wgi-pillar" aria-label={`WGI Pillar: ${wgiPillar}`}>{wgiPillar}</span>
        </article>
      ))}
    </section>
  );
}

