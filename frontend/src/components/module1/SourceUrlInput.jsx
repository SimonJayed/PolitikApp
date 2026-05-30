import React, { useMemo, useEffect } from 'react';
import { MOCK_APPROVED_DOMAINS } from './positionConfig';

/**
 * Dynamically compiles approved domain patterns from MOCK_APPROVED_DOMAINS config.
 * Returns true if the URL matches at least one whitelisted pattern.
 */
function evaluateDomainApproval(url) {
  if (!url || !url.trim()) return false;
  const trimmed = url.trim();
  return MOCK_APPROVED_DOMAINS.some((entry) => {
    try {
      return new RegExp(entry.regex, 'i').test(trimmed);
    } catch {
      return false;
    }
  });
}

/**
 * SourceUrlInput
 * Renders the source URL field with dynamic, config-driven domain validation.
 * Submissions are NEVER blocked by domain status — contributors may submit any URL.
 * Unverified domains trigger a warning banner and set onDomainCheck(false).
 *
 * Props:
 *  - value: string         — current URL value
 *  - onChange: function    — input change handler
 *  - onDomainCheck: function — called with (isApprovedDomain: boolean) on each change
 */
export default function SourceUrlInput({ value, onChange, onDomainCheck }) {
  const isApprovedDomain = useMemo(() => evaluateDomainApproval(value), [value]);

  // Notify parent of current domain approval state on every value change
  useEffect(() => {
    onDomainCheck?.(isApprovedDomain);
  }, [isApprovedDomain, onDomainCheck]);

  const hasValue = Boolean(value && value.trim());

  return (
    <label className="source-url-input-container">
      Source URL
      <input
        name="sourceUrl"
        required
        type="url"
        value={value}
        onChange={onChange}
        placeholder="https://example.gov.ph/document"
        className={hasValue ? (isApprovedDomain ? 'input-valid' : 'input-warning') : ''}
      />
      {hasValue && isApprovedDomain && (
        <span className="sourceBadge approved" style={{ marginTop: '4px', display: 'inline-block' }}>
          ✓ Approved source — verified .gov.ph / .edu.ph domain
        </span>
      )}
      {hasValue && !isApprovedDomain && (
        <div className="source-warning-banner" role="alert">
          <span className="source-warning-icon">⚠</span>
          <div>
            <strong>Unverified source domain</strong>
            <p>This submission will be accepted but will require heightened manual auditing by peer reviewers. The source link will be flagged in the moderation queue.</p>
          </div>
        </div>
      )}
    </label>
  );
}

