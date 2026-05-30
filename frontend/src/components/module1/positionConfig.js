/**
 * positionConfig.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Mock database rules engine for the Position-Aware KPI System.
 *
 * Defines:
 *  - POSITION_OPTIONS        — controlled dropdown enum for Add/Edit politician modals
 *  - POSITION_KPI_CONFIG     — WGI-pillar-mapped KPI definitions per position group
 *  - MOCK_APPROVED_DOMAINS   — regex-driven domain whitelist (simulates DB table)
 *  - getKpisForPosition()    — pure function: maps position + profile → KPI array
 *
 * Geographic Jurisdiction Scope:
 *  - NATIONAL  → Senator, House Representative
 *  - CEBU_CITY → Mayor, Vice Mayor, City Councilor
 *
 * WGI Pillars (World Bank Worldwide Governance Indicators):
 *  1. Government Effectiveness
 *  2. Regulatory Quality
 *  3. Voice and Accountability
 *  4. Control of Corruption
 *  5. Rule of Law
 *  6. Political Stability and Absence of Violence
 */

// ─── Position Dropdown Options ────────────────────────────────────────────────

export const POSITION_OPTIONS = [
  {
    value: 'SENATOR',
    label: 'Senator',
    jurisdiction: 'NATIONAL',
    jurisdictionLabel: 'National',
  },
  {
    value: 'HOUSE_REPRESENTATIVE',
    label: 'House Representative',
    jurisdiction: 'NATIONAL',
    jurisdictionLabel: 'National',
  },
  {
    value: 'MAYOR',
    label: 'Mayor',
    jurisdiction: 'CEBU_CITY',
    jurisdictionLabel: 'Cebu City',
  },
  {
    value: 'VICE_MAYOR',
    label: 'Vice Mayor',
    jurisdiction: 'CEBU_CITY',
    jurisdictionLabel: 'Cebu City',
  },
  {
    value: 'CITY_COUNCILOR',
    label: 'City Councilor',
    jurisdiction: 'CEBU_CITY',
    jurisdictionLabel: 'Cebu City',
  },
];

// ─── Approved Domain Mock Configuration ───────────────────────────────────────
// Simulates a database rules table mapping domain patterns to source types.
// Each regex string is compiled at runtime (new RegExp(entry.regex)) by SourceUrlInput.

export const MOCK_APPROVED_DOMAINS = [
  {
    domainName: 'Philippine Government (.gov.ph)',
    regex: '\\.gov\\.ph(/|$)',
    sourceType: 'Official Government',
    wgiPillar: 'Control of Corruption',
  },
  {
    domainName: 'Philippine Academic / Research (.edu.ph)',
    regex: '\\.edu\\.ph(/|$)',
    sourceType: 'Academic / Research Institution',
    wgiPillar: 'Regulatory Quality',
  },
];

// ─── KPI Definitions Per Position Group ───────────────────────────────────────

/**
 * Position group resolver.
 * Maps individual position values to a logical group for KPI selection.
 */
function resolvePositionGroup(position) {
  switch (position) {
    case 'SENATOR':
    case 'HOUSE_REPRESENTATIVE':
      return 'LEGISLATIVE';
    case 'MAYOR':
    case 'VICE_MAYOR':
      return 'EXECUTIVE';
    case 'CITY_COUNCILOR':
      return 'COUNCIL';
    default:
      return 'DEFAULT';
  }
}

/**
 * Currency formatter (PHP).
 */
function formatCurrency(value) {
  return new Intl.NumberFormat('en-PH', {
    currency: 'PHP',
    maximumFractionDigits: 0,
    style: 'currency',
  }).format(Number(value || 0));
}

/**
 * KPI configuration map keyed by position group.
 * Each entry describes which metrics to display and their WGI pillar linkage.
 */
const POSITION_KPI_CONFIG = {
  LEGISLATIVE: {
    groupLabel: 'Legislative',
    kpis: [
      {
        key: 'billsAuthored',
        label: 'Bills Authored',
        wgiPillar: 'Voice and Accountability',
        format: (v) => v ?? 0,
      },
      {
        key: 'coaAuditDiscrepancies',
        label: 'COA Findings',
        wgiPillar: 'Control of Corruption',
        format: (v) => v ?? 0,
        isAlert: (v) => (v ?? 0) > 0,
      },
      {
        key: 'trackedBudgetAllocated',
        label: 'Budget Tracked',
        wgiPillar: 'Government Effectiveness',
        format: (v) => formatCurrency(v),
      },
      {
        key: 'legislativeEfficiencyRatio',
        label: 'Legislative Efficiency',
        wgiPillar: 'Rule of Law',
        format: (v) => `${Number(v || 0).toFixed(1)}%`,
      },
    ],
  },

  EXECUTIVE: {
    groupLabel: 'Executive',
    kpis: [
      {
        key: 'projectCompletions',
        label: 'Projects Completed',
        wgiPillar: 'Government Effectiveness',
        format: (v) => v ?? 0,
      },
      {
        key: 'coaAuditDiscrepancies',
        label: 'COA Findings',
        wgiPillar: 'Control of Corruption',
        format: (v) => v ?? 0,
        isAlert: (v) => (v ?? 0) > 0,
      },
      {
        key: 'trackedBudgetAllocated',
        label: 'Budget Tracked',
        wgiPillar: 'Government Effectiveness',
        format: (v) => formatCurrency(v),
      },
      {
        key: 'legislativeEfficiencyRatio',
        label: 'Project Efficiency',
        wgiPillar: 'Political Stability and Absence of Violence',
        format: (v) => `${Number(v || 0).toFixed(1)}%`,
      },
    ],
  },

  COUNCIL: {
    groupLabel: 'Council',
    kpis: [
      {
        key: 'billsAuthored',
        label: 'Ordinances Filed',
        wgiPillar: 'Voice and Accountability',
        format: (v) => v ?? 0,
      },
      {
        key: 'coaAuditDiscrepancies',
        label: 'COA Findings',
        wgiPillar: 'Control of Corruption',
        format: (v) => v ?? 0,
        isAlert: (v) => (v ?? 0) > 0,
      },
      {
        key: 'trackedBudgetAllocated',
        label: 'Budget Tracked',
        wgiPillar: 'Regulatory Quality',
        format: (v) => formatCurrency(v),
      },
    ],
  },

  DEFAULT: {
    groupLabel: 'Politician',
    kpis: [
      {
        key: 'billsAuthored',
        label: 'Bills Authored',
        wgiPillar: 'Voice and Accountability',
        format: (v) => v ?? 0,
      },
      {
        key: 'projectCompletions',
        label: 'Projects Completed',
        wgiPillar: 'Government Effectiveness',
        format: (v) => v ?? 0,
      },
      {
        key: 'coaAuditDiscrepancies',
        label: 'COA Findings',
        wgiPillar: 'Control of Corruption',
        format: (v) => v ?? 0,
        isAlert: (v) => (v ?? 0) > 0,
      },
      {
        key: 'trackedBudgetAllocated',
        label: 'Budget Tracked',
        wgiPillar: 'Government Effectiveness',
        format: (v) => formatCurrency(v),
      },
      {
        key: 'legislativeEfficiencyRatio',
        label: 'Efficiency',
        wgiPillar: 'Rule of Law',
        format: (v) => `${Number(v || 0).toFixed(1)}%`,
      },
    ],
  },
};

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Returns an ordered array of KPI metric objects for the given politician position.
 * Each object: { label, value, isAlert, wgiPillar }
 *
 * @param {string} position - Politician's position value (e.g. 'SENATOR', 'MAYOR')
 * @param {object} profile  - Profile data object (e.g. from PoliticianResponse / DashboardCompositeResponse)
 * @returns {{ label: string, value: any, isAlert: boolean, wgiPillar: string }[]}
 */
export function getKpisForPosition(position, profile) {
  const group = resolvePositionGroup(position);
  const config = POSITION_KPI_CONFIG[group] ?? POSITION_KPI_CONFIG.DEFAULT;

  return config.kpis.map((kpi) => {
    const rawValue = profile?.[kpi.key];
    return {
      label: kpi.label,
      value: kpi.format(rawValue),
      isAlert: kpi.isAlert ? kpi.isAlert(rawValue) : false,
      wgiPillar: kpi.wgiPillar,
    };
  });
}

/**
 * Returns the display group label for a given position (e.g. 'Legislative').
 * @param {string} position
 * @returns {string}
 */
export function getPositionGroupLabel(position) {
  const group = resolvePositionGroup(position);
  return POSITION_KPI_CONFIG[group]?.groupLabel ?? 'Politician';
}
