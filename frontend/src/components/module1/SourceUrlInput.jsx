import React, { useMemo } from 'react';

export const SOURCE_URL_PATTERN = /^https?:\/\/([a-zA-Z0-9-]+\.)*(gov\.ph|edu\.ph)(\/.*)?$/;

export default function SourceUrlInput({ value, onChange }) {
  const isSourceAllowed = useMemo(() => {
    return SOURCE_URL_PATTERN.test((value || '').trim());
  }, [value]);

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
        className={value ? (isSourceAllowed ? 'input-valid' : 'input-invalid') : ''}
      />
      {value && (
        <span className={`sourceBadge ${isSourceAllowed ? 'approved' : ''}`} style={{ marginTop: '4px', display: 'inline-block' }}>
          {isSourceAllowed ? '✓ Approved source (.gov.ph / .edu.ph)' : '○ Awaiting approved source (.gov.ph or .edu.ph)'}
        </span>
      )}
    </label>
  );
}
