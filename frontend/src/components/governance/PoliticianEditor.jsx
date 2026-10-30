import { useState } from 'react'
import BaseModal from '../BaseModal'
import { API_BASE_URL, readApiResponse } from '../../api/client'

export default function PoliticianEditor({ politician, token, onSaved, onClose }) {
  const [draft, setDraft] = useState({ fullName: '', position: '', jurisdiction: '', partyAffiliation: '', biography: '', profileImageUrl: '', termStart: '', termEnd: '', ...politician })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function save(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      const saved = await fetch(`${API_BASE_URL}/api/politicians${politician ? `/${politician.politicianId}` : ''}`, {
        method: politician ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(draft),
      }).then(readApiResponse)
      onSaved(saved)
      onClose()
    } catch (failure) { setError(failure.message) }
    finally { setBusy(false) }
  }
  return <BaseModal isOpen title={politician ? 'Edit politician' : 'Add politician'} onClose={onClose} isDismissDisabled={busy}>
    <form className="editorPanel" onSubmit={save}>
      <h2>{politician ? 'Edit politician' : 'Add politician'}</h2>
      {[['fullName', 'Full name', 150], ['position', 'Government position', 100], ['jurisdiction', 'Jurisdiction', 100], ['partyAffiliation', 'Party affiliation', 100], ['profileImageUrl', 'Profile image URL', 2048]].map(([field, label, max]) => <label key={field}>{label}
        <input required={['fullName', 'position', 'jurisdiction'].includes(field)} type={field === 'profileImageUrl' ? 'url' : 'text'} maxLength={max} value={draft[field] || ''} onChange={event => setDraft({ ...draft, [field]: event.target.value })} />
      </label>)}
      <label>Biography<textarea maxLength={10000} value={draft.biography || ''} onChange={event => setDraft({ ...draft, biography: event.target.value })} /></label>
      {!politician && <><label>Term start<input required type="date" value={draft.termStart} onChange={event => setDraft({ ...draft, termStart: event.target.value })} /></label>
        <label>Term end<input required type="date" min={draft.termStart} value={draft.termEnd} onChange={event => setDraft({ ...draft, termEnd: event.target.value })} /></label></>}
      {error && <p role="alert">{error}</p>}
      <button disabled={busy} type="submit">{busy ? 'Saving...' : 'Save profile'}</button>
      <button disabled={busy} type="button" onClick={onClose}>Cancel</button>
    </form>
  </BaseModal>
}
