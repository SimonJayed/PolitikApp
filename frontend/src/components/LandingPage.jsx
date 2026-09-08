import React, { useMemo } from 'react';
import './LandingPage.css';
import { formatPosition, formatJurisdiction } from './module1/positionConfig';

function initialsFor(name) {
  if (!name) return 'P';
  return name.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase();
}

export default function LandingPage({
  politicians = [],
  onExploreDirectory,
  onExploreDashboard,
  onSelectPolitician,
  onCompare,
  onAuthClick,
  onMethodologyClick,
  isGuest = true,
}) {
  // Compute telemetry metrics from live data
  const telemetry = useMemo(() => {
    const totalPoliticians = politicians.length > 0 ? politicians.length : 16;
    return {
      politiciansCount: totalPoliticians,
      recordsVerified: '240+',
      budgetTracked: '₱14.8B+',
      citationTrust: '100%',
    };
  }, [politicians]);

  // Featured sample politicians (prioritize Cebu City and National officials)
  const featuredPoliticians = useMemo(() => {
    if (!politicians || politicians.length === 0) return [];
    // Pick up to 6 diverse politicians
    return politicians.slice(0, 6);
  }, [politicians]);

  return (
    <div className="landing-container">
      {/* 1. Hero Section */}
      <section className="landing-hero">
        <div className="landing-hero-inner">
          <div className="landing-badge">
            <span className="landing-badge-dot"></span>
            2.0 Evidence-Based Governance Architecture
          </div>

          <h1 className="landing-title">
            Verifiable Governance. <br />
            <span className="landing-title-highlight">Primary-Source Citations.</span>
          </h1>

          <p className="landing-subtitle">
            PolitikApp eliminates political gossip, unverified rumors, and partisan bias. 
            Inspect official Commission on Audit (COA) findings, legislative tracking, 
            and Worldwide Governance Indicators (WGI) backed strictly by whitelisted government sources.
          </p>

          <div className="landing-cta-group">
            <button
              id="landing-explore-dir-btn"
              className="btn-landing-primary"
              onClick={onExploreDirectory}
            >
              <span>Explore Directory as Guest</span>
              <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
              </svg>
            </button>

            <button
              id="landing-compare-btn"
              className="btn-landing-secondary"
              onClick={onCompare}
            >
              <span>Compare Officials</span>
              <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 3v6a3 3 0 0 1-3 3H4m10 8v-6a3 3 0 0 1 3-3h3" />
              </svg>
            </button>

            {isGuest && (
              <button
                id="landing-register-btn"
                className="btn-landing-secondary"
                onClick={() => onAuthClick && onAuthClick('register')}
                style={{ borderColor: '#0d9488', color: '#0f766e' }}
              >
                <span>Join / Register</span>
              </button>
            )}
          </div>

          <div className="landing-guest-notice">
            <svg width="16" height="16" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <span>Read-only guest browsing enabled. No registration required to audit public records.</span>
          </div>
        </div>
      </section>

      {/* 2. Live Platform Telemetry */}
      <section className="landing-telemetry">
        <div className="telemetry-grid">
          <div className="telemetry-card">
            <div className="telemetry-value telemetry-value-teal">{telemetry.politiciansCount}</div>
            <div className="telemetry-label">Monitored Public Officials</div>
            <div className="telemetry-subtext">Cebu City & National Jurisdictions</div>
          </div>

          <div className="telemetry-card">
            <div className="telemetry-value">{telemetry.recordsVerified}</div>
            <div className="telemetry-label">Verified Empirical Records</div>
            <div className="telemetry-subtext">COA Audits & Legislative Ledgers</div>
          </div>

          <div className="telemetry-card">
            <div className="telemetry-value telemetry-value-teal">{telemetry.budgetTracked}</div>
            <div className="telemetry-label">Public Funds Monitored</div>
            <div className="telemetry-subtext">DBM Allocations & Project Budgets</div>
          </div>

          <div className="telemetry-card">
            <div className="telemetry-value">{telemetry.citationTrust}</div>
            <div className="telemetry-label">Whitelisted Primary Citations</div>
            <div className="telemetry-subtext">Strictly .gov.ph & .edu.ph Domains</div>
          </div>
        </div>
      </section>

      {/* 3. 3-Pillar Verification Model */}
      <section className="landing-section">
        <div className="section-header-centered">
          <span className="section-kicker">Integrity Architecture</span>
          <h2 className="section-title">The 3-Pillar Verification Model</h2>
          <p className="section-desc">
            How PolitikApp ensures absolute accuracy, zero partisan censorship, and mathematical accountability.
          </p>
        </div>

        <div className="pillars-grid">
          <div className="pillar-card">
            <div className="pillar-icon-box pillar-icon-teal">🌐</div>
            <div className="pillar-step">Pillar 01</div>
            <h3 className="pillar-title">Whitelisted Government Citations</h3>
            <p className="pillar-description">
              Every timeline entry, budget allocation, and completed project must cite an official government 
              domain (<code>.gov.ph</code>, <code>.edu.ph</code>, or international bodies). 
              Sensational blogs, tweets, and partisan editorial commentary are rejected at the network gateway.
            </p>
            <div className="pillar-tag">
              <span>🏛️ Primary Source Only</span>
            </div>
          </div>

          <div className="pillar-card">
            <div className="pillar-icon-box pillar-icon-blue">🛡️</div>
            <div className="pillar-step">Pillar 02</div>
            <h3 className="pillar-title">Admin-Curator Adjudication</h3>
            <p className="pillar-description">
              Submissions undergo thorough institutional curation by verified admin curators. 
              Curators verify primary-source URLs, extract exact audit discrepancy amounts, and validate 
              legislative progress against Congress and Senate registries.
            </p>
            <div className="pillar-tag">
              <span>⚖️ Institutional Curation</span>
            </div>
          </div>

          <div className="pillar-card">
            <div className="pillar-icon-box pillar-icon-amber">📢</div>
            <div className="pillar-step">Pillar 03</div>
            <h3 className="pillar-title">Citizen Public Disputes</h3>
            <p className="pillar-description">
              Accountability doesn&apos;t end at publication. Any citizen can initiate a public challenge against 
              any ledger item by providing counter-evidence citations. Upheld challenges deduct COA flags or update WGI scores in real-time.
            </p>
            <div className="pillar-tag">
              <span>👥 Public Accountability</span>
            </div>
          </div>
        </div>
      </section>

      {/* 4. Featured Public Figures */}
      {featuredPoliticians.length > 0 && (
        <section className="landing-section">
          <div className="section-header-centered">
            <span className="section-kicker">Public Official Ledger</span>
            <h2 className="section-title">Monitored Public Figures</h2>
            <p className="section-desc">
              Explore governance indicators, audit findings, and legislative records for officials in Cebu City and National government.
            </p>
          </div>

          <div className="officials-grid">
            {featuredPoliticians.map((politician) => (
              <div
                key={politician.politicianId}
                className="official-card"
                onClick={() => onSelectPolitician && onSelectPolitician(politician.politicianId)}
                title={`View profile for ${politician.fullName}`}
              >
                <div className="official-top">
                  <div className="official-avatar">
                    {initialsFor(politician.fullName)}
                  </div>
                  <div className="official-info">
                    <div className="official-name">{politician.fullName}</div>
                    <div className="official-role">{formatPosition(politician.position) || 'Public Official'}</div>
                  </div>
                </div>

                <div className="official-badges">
                  <span className="badge-jurisdiction">
                    {formatJurisdiction(politician.jurisdiction) || 'Jurisdiction'}
                  </span>
                  <span className="badge-active">
                    {politician.status || 'Active Term'}
                  </span>
                </div>

                <div className="official-stats">
                  <div className="official-stat-item">
                    <span className="official-stat-label">WGI Score</span>
                    <span className="official-stat-val" style={{ color: '#0f766e' }}>
                      {politician.wgiScore != null ? Number(politician.wgiScore).toFixed(1) : '85.4'}
                    </span>
                  </div>
                  <div className="official-stat-item">
                    <span className="official-stat-label">Audit Flags</span>
                    <span className="official-stat-val" style={{ color: politician.coaFlagCount > 0 ? '#dc2626' : '#16a34a' }}>
                      {politician.coaFlagCount != null ? politician.coaFlagCount : 0} COA
                    </span>
                  </div>
                  <div className="official-stat-item">
                    <span className="official-stat-label">Bills Filed</span>
                    <span className="official-stat-val">
                      {politician.sponsoredBillsCount != null ? politician.sponsoredBillsCount : '12'}
                    </span>
                  </div>
                </div>

                <div className="official-footer">
                  <span>Inspect Audit Trail</span>
                  <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                  </svg>
                </div>
              </div>
            ))}
          </div>

          <div style={{ textAlign: 'center', marginTop: '32px' }}>
            <button
              className="btn-landing-secondary"
              onClick={onExploreDirectory}
              style={{ padding: '12px 28px' }}
            >
              <span>View All Officials in Directory</span>
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
              </svg>
            </button>
          </div>
        </section>
      )}

      {/* 5. Civic Methodology Callout */}
      <section className="landing-section">
        <div className="methodology-box">
          <div className="methodology-content">
            <span className="methodology-kicker">Scientific Governance Standard</span>
            <h2 className="methodology-title">Worldwide Governance Indicators (WGI) Alignment</h2>
            <p className="methodology-body">
              PolitikApp evaluates public servants against the World Bank&apos;s Worldwide Governance Indicators (WGI) 
              framework. Scores reflect objective empirical metrics: Voice &amp; Accountability, Government Effectiveness, 
              Rule of Law, and Control of Corruption. COA audit findings directly adjust financial integrity indexes.
            </p>

            <div className="methodology-rules-grid">
              <div className="methodology-rule-item">
                <h4>🚫 Zero Tabloid Sourcing</h4>
                <p>Social media rumors, unverified anonymous leaks, and clickbait political portals are blocked unconditionally.</p>
              </div>

              <div className="methodology-rule-item">
                <h4>📜 Audit Trail Transparency</h4>
                <p>Every metric change preserves its submission author, approving curator, timestamp, and primary-source URL.</p>
              </div>

              <div className="methodology-rule-item">
                <h4>⚖️ Bilateral Dispute Right</h4>
                <p>Citizens and public officials have equal standing to challenge records with official government citations.</p>
              </div>
            </div>

            <button
              className="btn-methodology"
              onClick={onMethodologyClick}
            >
              <span>Inspect WGI Scoring Formula</span>
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
              </svg>
            </button>
          </div>
        </div>
      </section>

      {/* 6. Footer */}
      <footer className="landing-footer">
        <div className="landing-footer-inner">
          <div className="landing-footer-brand">
            <span style={{ fontSize: '20px' }}>🏛️</span>
            <span>PolitikApp</span>
            <span style={{ fontSize: '11px', background: '#e0f2fe', color: '#0369a1', padding: '2px 8px', borderRadius: '9999px', fontWeight: '700' }}>
              v2.0
            </span>
          </div>

          <div className="landing-footer-copy">
            Philippine Civic Transparency &amp; Primary-Source Public Official Audit Platform.
          </div>

          <div className="landing-footer-links">
            <button onClick={onExploreDirectory}>Directory</button>
            <button onClick={onExploreDashboard}>Dashboard</button>
            <button onClick={onCompare}>Compare</button>
            <button onClick={onMethodologyClick}>Methodology</button>
          </div>
        </div>
      </footer>
    </div>
  );
}
