import { useEffect } from 'react'

export default function SourceUrlInput({ value, onChange, onDomainCheck }) {
  let valid = false
  try { const url = new URL(value); valid = ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password } catch { /* Incomplete URL. */ }
  useEffect(() => { onDomainCheck?.(valid) }, [valid, onDomainCheck])
  return <label className="source-url-input-container">
    Primary source URL
    <input name="sourceUrl" required type="url" value={value} onChange={onChange} placeholder="https://example.com/document" />
    {value && !valid && <span role="alert">Enter a complete HTTP or HTTPS source URL without credentials.</span>}
    <small>Links from any website are accepted. Verify the source before publishing this record.</small>
  </label>
}

