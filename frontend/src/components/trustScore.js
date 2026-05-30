export const TRUST_MIN = 0;
export const TRUST_BASE = 100;
export const TRUST_APPEAL_UNLOCK = 150;
export const TRUST_MAX = 500;

export const TRUST_SCORE_BANDS = [
  { min: 0, max: 49, label: 'Critical', color: '#b91c1c', soft: '#fee2e2' },
  { min: 50, max: 99, label: 'Below Baseline', color: '#d97706', soft: '#fef3c7' },
  { min: 100, max: 100, label: 'Base Standing', color: '#475569', soft: '#e2e8f0' },
  { min: 101, max: 149, label: 'Building Trust', color: '#2563eb', soft: '#dbeafe' },
  { min: 150, max: 249, label: 'Appeal Eligible', color: '#0891b2', soft: '#cffafe' },
  { min: 250, max: 399, label: 'Strong Standing', color: '#15803d', soft: '#dcfce7' },
  { min: 400, max: 500, label: 'Civic Prime', color: '#7c3aed', soft: '#ede9fe' },
];

export function clampTrustScore(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return TRUST_BASE;
  return Math.min(TRUST_MAX, Math.max(TRUST_MIN, numeric));
}

export function getTrustScoreBand(value) {
  const score = clampTrustScore(value);
  return TRUST_SCORE_BANDS.find((band) => score >= band.min && score <= band.max) || TRUST_SCORE_BANDS[2];
}

export function getTrustVoteWeight(value) {
  const score = clampTrustScore(value);
  if (score >= 400) return 5;
  if (score >= 250) return 3;
  if (score >= 150) return 2;
  return 1;
}
