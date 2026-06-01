import React, { useState } from 'react';
import { AlertTriangleIcon } from '../icons/Lucide';

// Inline HelpCircleIcon to avoid external imports
export function HelpCircleIcon({ size = 18, className = '' }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

const WGI_CEILING_BILLS = 50;
const WGI_CEILING_PROJECTS = 30;
const WGI_CEILING_BUDGET = 500_000_000;

export default function WgiMethodologyModal({ isOpen, onClose, initialPosition = 'LEGISLATIVE' }) {
  const [activeTab, setActiveTab] = useState(
    ['LEGISLATIVE', 'EXECUTIVE', 'VICE_EXECUTIVE', 'COUNCIL'].includes(initialPosition)
      ? initialPosition
      : 'LEGISLATIVE'
  );

  // Simulator States
  const [simBills, setSimBills] = useState(15);
  const [simProjects, setSimProjects] = useState(12);
  const [simBudget, setSimBudget] = useState(150_000_000); // 150M PHP
  const [simCoaCount, setSimCoaCount] = useState(2);
  const [simCoaFlagged, setSimCoaFlagged] = useState(15_000_000); // 15M PHP

  if (!isOpen) return null;

  // Simulator Math
  const normBills = Math.min(100, (simBills / WGI_CEILING_BILLS) * 100);
  const normProjects = Math.min(100, (simProjects / WGI_CEILING_PROJECTS) * 100);
  const normBudget = Math.min(100, (simBudget / WGI_CEILING_BUDGET) * 100);

  const legEfficiency = Math.min(
    100,
    simBills > 0 ? normProjects * 0.5 + normBills * 0.5 : normProjects
  );

  let rawScore = 0;
  let formulaLabel = '';

  switch (activeTab) {
    case 'LEGISLATIVE':
      rawScore = normBills * 0.35 + normBudget * 0.25 + legEfficiency * 0.30;
      formulaLabel = '35% Bills + 25% Budget + 30% Leg. Efficiency';
      break;
    case 'EXECUTIVE':
      rawScore = normProjects * 0.45 + normBudget * 0.30 + legEfficiency * 0.20;
      formulaLabel = '45% Projects + 30% Budget + 20% Leg. Efficiency';
      break;
    case 'VICE_EXECUTIVE':
      rawScore = normBills * 0.30 + normProjects * 0.20 + normBudget * 0.25 + legEfficiency * 0.25;
      formulaLabel = '30% Bills + 20% Projects + 25% Budget + 25% Efficiency';
      break;
    case 'COUNCIL':
      rawScore = normBills * 0.40 + normBudget * 0.35;
      formulaLabel = '40% Ordinances + 35% Budget';
      break;
    default:
      rawScore = normBills * 0.25 + normProjects * 0.25 + normBudget * 0.20 + legEfficiency * 0.20;
      formulaLabel = '25% Bills + 25% Projects + 20% Budget + 20% Efficiency';
      break;
  }

  // COA Penalty Math
  const freqPenalty = simCoaCount * 2.0;
  let magPenalty = 0.0;
  if (simCoaFlagged > 0) {
    if (simBudget > 0) {
      magPenalty = Math.min(30.0, (simCoaFlagged / (simBudget + 1000.0)) * 40.0);
    } else {
      magPenalty = Math.min(30.0, simCoaCount * 3.0);
    }
  }
  const totalCoaPenalty = Math.min(40.0, freqPenalty + magPenalty);
  const finalScore = Math.max(0, Math.min(100, rawScore - totalCoaPenalty));

  // Visual highlights
  const scoreColor =
    finalScore >= 70
      ? 'var(--success, #2e7d32)'
      : finalScore >= 40
        ? 'var(--ph-gold, #b38f00)'
        : 'var(--ph-red, #d32f2f)';

  const scoreLabel =
    finalScore >= 70
      ? 'High Governance'
      : finalScore >= 40
        ? 'Moderate Risk'
        : 'Critical Risk';

  return (
    <div
      className="comparisonModalBackdrop"
      onClick={onClose}
      aria-hidden="true"
    >
      <section
        className="comparisonModal wgiMethodologyModal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="WGI Score Methodology & Simulator"
      >
        {/* Modal Header */}
        <header className="comparisonModalHeader">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <HelpCircleIcon size={20} style={{ color: 'var(--ph-gold)' }} />
            <h2 className="ty-section-title" style={{ margin: 0 }}>
              WGI Governance Index Methodology Guide
            </h2>
          </div>
          <button
            aria-label="Close"
            className="comparisonModalClose"
            onClick={onClose}
            type="button"
          >
            X
          </button>
        </header>

        {/* Scrollable Container */}
        <div className="comparisonModalBody wgiMethodologyBody">
          {/* Left Column: Education / Formula Guide */}
          <div className="wgiEducation" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div>
              <h4 className="ty-label" style={{ color: 'var(--ph-blue)', fontSize: '13px', margin: '0 0 6px' }}>
                WHAT IS THE WGI COMPOSITE SCORE?
              </h4>
              <p className="ty-body" style={{ fontSize: '13.5px', lineHeight: '1.6', margin: 0 }}>
                Inspired by the World Bank's <strong>Worldwide Governance Indicators (WGI)</strong>, our score maps
                official civic activities to two main governance pillars: <strong>Government Effectiveness</strong> (legislative
                and infrastructural output) and <strong>Control of Corruption</strong> (auditing accountability).
              </p>
            </div>

            {/* Position Weight Tabs */}
            <div>
              <h4 className="ty-label" style={{ fontSize: '12px', marginBottom: '8px' }}>
                POSITION-AWARE FORMULA WEIGHTS
              </h4>
              <div
                style={{
                  display: 'flex',
                  gap: '4px',
                  background: 'var(--accent-soft, #f4f6fa)',
                  padding: '4px',
                  borderRadius: 'var(--radius-md, 8px)',
                  marginBottom: '12px',
                  flexWrap: 'wrap',
                }}
              >
                {['LEGISLATIVE', 'EXECUTIVE', 'VICE_EXECUTIVE', 'COUNCIL'].map((group) => (
                  <button
                    key={group}
                    onClick={() => setActiveTab(group)}
                    style={{
                      flex: '1 1 auto',
                      padding: '8px 12px',
                      fontSize: '11px',
                      fontWeight: '700',
                      border: 'none',
                      borderRadius: 'var(--radius-sm, 6px)',
                      background: activeTab === group ? 'var(--bg-surface, #ffffff)' : 'transparent',
                      color: activeTab === group ? 'var(--ph-blue)' : 'var(--text-muted)',
                      boxShadow: activeTab === group ? 'var(--shadow-xs)' : 'none',
                      cursor: 'pointer',
                    }}
                  >
                    {group.replace('_', ' ')}
                  </button>
                ))}
              </div>

              {/* Formula Panel */}
              <div
                style={{
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--line-soft)',
                  borderRadius: 'var(--radius-md)',
                  padding: '16px',
                  fontSize: '13px',
                }}
              >
                <div style={{ marginBottom: '10px' }}>
                  <strong style={{ display: 'block', color: 'var(--text-primary)' }}>Formula Rule:</strong>
                  <span style={{ fontFamily: 'var(--mono, monospace)', fontSize: '12px', color: 'var(--ph-blue)' }}>
                    {formulaLabel}
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', opacity: 0.9 }}>
                  {activeTab === 'LEGISLATIVE' && (
                    <>
                      <div>• <strong>Bills Authored (35%):</strong> Evaluates policy output mapped to standard ceilings.</div>
                      <div>• <strong>Budget Allocated (25%):</strong> Measures volume of resources structured under management.</div>
                      <div>• <strong>Efficiency (30%):</strong> Aligns successful project delivery against sponsored legislation.</div>
                    </>
                  )}
                  {activeTab === 'EXECUTIVE' && (
                    <>
                      <div>• <strong>Projects Completed (45%):</strong> Rewards actual infrastructure/program output.</div>
                      <div>• <strong>Budget Allocated (30%):</strong> Reflects resource management scale.</div>
                      <div>• <strong>Efficiency (20%):</strong> Assesses delivery speed and project density.</div>
                    </>
                  )}
                  {activeTab === 'VICE_EXECUTIVE' && (
                    <>
                      <div>• <strong>Hybrid Weights:</strong> Balanced blend of Bills (30%), Projects (20%), Budget (25%), and Efficiency (25%).</div>
                    </>
                  )}
                  {activeTab === 'COUNCIL' && (
                    <>
                      <div>• <strong>Local Scale:</strong> Specifically models local ordinances filed (40%) and local budget allocations (35%).</div>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Ceiling Explanation */}
            <div>
              <h4 className="ty-label" style={{ fontSize: '12px', marginBottom: '8px' }}>
                INDICATOR REFERENCE CEILINGS
              </h4>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--line-soft)', opacity: 0.7 }}>
                    <th style={{ padding: '6px 4px' }}>Indicator</th>
                    <th style={{ padding: '6px 4px' }}>Max Ceiling</th>
                    <th style={{ padding: '6px 4px' }}>Evaluation Metric</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ borderBottom: '1px solid var(--line-soft)' }}>
                    <td style={{ padding: '8px 4px' }}><strong>Bills Authored</strong></td>
                    <td style={{ padding: '8px 4px' }}>50 Bills</td>
                    <td style={{ padding: '8px 4px' }}>Approved (1.0), In Committee (0.6), Filed (0.3), Rejected (0.0), Withdrawn (0.0)</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid var(--line-soft)' }}>
                    <td style={{ padding: '8px 4px' }}><strong>Completed Projects</strong></td>
                    <td style={{ padding: '8px 4px' }}>30 Projects</td>
                    <td style={{ padding: '8px 4px' }}>Percentage-weighted (e.g. 55% completion = 0.55)</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid var(--line-soft)' }}>
                    <td style={{ padding: '8px 4px' }}><strong>Tracked Budget</strong></td>
                    <td style={{ padding: '8px 4px' }}>PHP 500,000,000</td>
                    <td style={{ padding: '8px 4px' }}>Overall logged allocations mapped in PHP</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* COA Penalty Accordion */}
            <div
              style={{
                background: 'var(--danger-soft, #fdf3f2)',
                border: '1px dashed var(--danger-border, #f9d7d5)',
                borderRadius: 'var(--radius-md)',
                padding: '14px 16px',
                display: 'flex',
                gap: '12px',
                alignItems: 'flex-start',
              }}
            >
              <AlertTriangleIcon size={18} style={{ color: 'var(--ph-red)', flexShrink: 0, marginTop: '2px' }} />
              <div>
                <strong style={{ fontSize: '13px', color: 'var(--ph-red)', display: 'block', marginBottom: '4px' }}>
                  Control of Corruption Penalty (COA Audit Flags)
                </strong>
                <span style={{ fontSize: '12px', lineHeight: '1.5', display: 'block', color: 'var(--text-primary)' }}>
                  Audit penalties are split into <strong>Frequency</strong> (<strong>-2.0</strong> points per flag) and <strong>Financial Magnitude</strong>
                  (proportional audit flags relative to overall tracked budget, capped at <strong>-30.0</strong> points).
                  The total combined penalty is capped at <strong>-40.0</strong> points.
                </span>
              </div>
            </div>
          </div>

          {/* Right Column: Dynamic Simulator Sandbox */}
          <div
            className="wgiSimulator"
            style={{
              background: 'var(--accent-soft, #f4f6fa)',
              borderRadius: 'var(--radius-lg, 12px)',
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '20px',
              border: '1px solid var(--line-soft)',
            }}
          >
            <div style={{ textAlign: 'center', marginBottom: '8px' }}>
              <span className="ty-label" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                INTERACTIVE SIMULATOR SANDBOX
              </span>
              <h4 className="ty-card-title" style={{ margin: '4px 0 0', fontSize: '16px' }}>
                Test Governance Outputs Live
              </h4>
            </div>

            {/* Score Dial */}
            <div
              style={{
                background: 'var(--bg-surface)',
                borderRadius: 'var(--radius-md)',
                padding: '20px',
                boxShadow: 'var(--shadow-sm)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '4px',
                borderTop: `4px solid ${scoreColor}`,
                transition: 'border-color 0.2s ease',
              }}
            >
              <span className="ty-label" style={{ fontSize: '11px' }}>SIMULATED WGI SCORE</span>
              <strong style={{ fontSize: '42px', fontWeight: '850', color: scoreColor, lineHeight: '1' }}>
                {finalScore.toFixed(1)}
                <span style={{ fontSize: '20px', fontWeight: '500', opacity: 0.6 }}>/100</span>
              </strong>
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: '700',
                  color: scoreColor,
                  background: `${scoreColor}14`,
                  padding: '2px 8px',
                  borderRadius: 'var(--radius-full)',
                  marginTop: '4px',
                }}
              >
                {scoreLabel}
              </span>
            </div>

            {/* Sliders Container */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {/* Bills Slider */}
              {activeTab !== 'EXECUTIVE' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                    <span><strong>Effective Bills Authored:</strong></span>
                    <span style={{ fontFamily: 'var(--mono)', color: 'var(--ph-blue)', fontWeight: '700' }}>
                      {simBills}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={simBills}
                    onChange={(e) => setSimBills(Number(e.target.value))}
                    style={{ width: '100%', height: '5px', accentColor: 'var(--ph-blue)' }}
                  />
                  <small style={{ fontSize: '10px', opacity: 0.6, marginTop: '-2px' }}>
                    Weight matches status (e.g. 5 approved bills = 5.0, 5 filed bills = 1.5, rejected/withdrawn = 0.0)
                  </small>
                </div>
              )}

              {/* Projects Slider */}
              {activeTab !== 'COUNCIL' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                    <span><strong>Effective Projects Completed:</strong></span>
                    <span style={{ fontFamily: 'var(--mono)', color: 'var(--ph-blue)', fontWeight: '700' }}>
                      {simProjects}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="60"
                    value={simProjects}
                    onChange={(e) => setSimProjects(Number(e.target.value))}
                    style={{ width: '100%', height: '5px', accentColor: 'var(--ph-blue)' }}
                  />
                  <small style={{ fontSize: '10px', opacity: 0.6, marginTop: '-2px' }}>
                    Weighted by completion ratio (e.g. 1 project completed by 50% = 0.50)
                  </small>
                </div>
              )}

              {/* Budget Slider */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                  <span><strong>Tracked Budget Allocated:</strong></span>
                  <span style={{ fontFamily: 'var(--mono)', color: 'var(--ph-blue)', fontWeight: '700' }}>
                    PHP {(simBudget / 1_000_000).toFixed(0)}M
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1000000000"
                  step="10000000"
                  value={simBudget}
                  onChange={(e) => setSimBudget(Number(e.target.value))}
                  style={{ width: '100%', height: '5px', accentColor: 'var(--ph-blue)' }}
                />
              </div>

              {/* Divider */}
              <div style={{ borderTop: '1px solid var(--line-soft)', margin: '8px 0' }} />

              {/* COA Findings Count Slider */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                  <span><strong>COA Audit Findings:</strong></span>
                  <span style={{ fontFamily: 'var(--mono)', color: 'var(--ph-red)', fontWeight: '700' }}>
                    {simCoaCount} Findings
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="20"
                  value={simCoaCount}
                  onChange={(e) => {
                    const nextVal = Number(e.target.value);
                    setSimCoaCount(nextVal);
                    if (nextVal === 0) setSimCoaFlagged(0);
                  }}
                  style={{ width: '100%', height: '5px', accentColor: 'var(--ph-red)' }}
                />
                <small style={{ fontSize: '10px', opacity: 0.6, marginTop: '-2px' }}>
                  Deducts -2.0 points per finding (Frequency Penalty)
                </small>
              </div>

              {/* COA Flagged Amount Slider */}
              {simCoaCount > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                    <span><strong>COA Flagged Discrepancy Amount:</strong></span>
                    <span style={{ fontFamily: 'var(--mono)', color: 'var(--ph-red)', fontWeight: '700' }}>
                      PHP {(simCoaFlagged / 1_000_000).toFixed(0)}M
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="500000000"
                    step="5000000"
                    value={simCoaFlagged}
                    onChange={(e) => setSimCoaFlagged(Number(e.target.value))}
                    style={{ width: '100%', height: '5px', accentColor: 'var(--ph-red)' }}
                  />
                  <small style={{ fontSize: '10px', opacity: 0.6, marginTop: '-2px' }}>
                    Magnitude Penalty: flag ratio proportional to overall budget (Max -30.0)
                  </small>
                </div>
              )}
            </div>

            {/* Calculations Breakdown */}
            <div
              style={{
                background: 'var(--bg-surface)',
                borderRadius: 'var(--radius-md)',
                padding: '14px',
                fontSize: '11px',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
                border: '1px solid var(--line-soft)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Raw Government Effectiveness Score:</span>
                <span style={{ fontWeight: '700' }}>+{rawScore.toFixed(1)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: totalCoaPenalty > 0 ? 'var(--ph-red)' : 'var(--text-muted)' }}>
                <span>Control of Corruption Penalty:</span>
                <span style={{ fontWeight: '700' }}>-{totalCoaPenalty.toFixed(1)}</span>
              </div>
              <div style={{ borderTop: '1px solid var(--line-soft)', marginTop: '4px', paddingTop: '4px', display: 'flex', justifyContent: 'space-between', fontWeight: '700', fontSize: '12px' }}>
                <span>Simulated Net WGI Score:</span>
                <span style={{ color: scoreColor }}>{finalScore.toFixed(1)}</span>
              </div>
            </div>
          </div>
        </div>

      </section>
    </div>
  );
}
