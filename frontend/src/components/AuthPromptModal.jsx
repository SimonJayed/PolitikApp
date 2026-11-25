import BaseModal from './BaseModal'
import { CircleCheckIcon } from './icons/Lucide'

const messages = {
  bookmark: 'Sign in to save this article to your bookmarks.',
  comment: 'Sign in to join the discussion.',
  vote: 'Sign in to vote on this comment.',
  session: 'Your session has expired. Sign in again to continue.',
  propose: 'Sign in to propose governance metrics and timeline records with source citations.',
  challenge: 'Sign in to challenge an official record with counter-evidence.',
  preview: 'Sign in to access the full public-official database, audit trails, and comparison tools.',
}

export default function AuthPromptModal({ isOpen, onClose, onSignIn, onRegister, actionType }) {
  const news = ['bookmark', 'comment', 'vote', 'session'].includes(actionType)
  const title = news ? 'Sign in to participate' : actionType === 'preview' ? 'Sign in to unlock the full ledger' : 'Citizen verification required'
  return (
    <BaseModal isOpen={isOpen} title={title} onClose={onClose} modalClassName="authPromptDialog">
      <p>{messages[actionType] || 'Sign in to contribute to the civic ledger.'}</p>
      {!news && <ul>
        <li><CircleCheckIcon size={16} /> Submit official government or academic citations</li>
        <li><CircleCheckIcon size={16} /> Receive updates on curator rulings</li>
        <li><CircleCheckIcon size={16} /> Track contributions on your civic ledger</li>
      </ul>}
      <div className="readerActions mt-4">
        <button className="btn-landing-primary" id="auth-prompt-signin-btn" type="button" onClick={() => { onClose(); onSignIn() }}>{news ? 'Sign In' : 'Sign In to Your Account'}</button>
        {!news && <button id="auth-prompt-register-btn" type="button" onClick={() => { onClose(); onRegister() }}>Create New Citizen Account</button>}
        <button type="button" onClick={onClose}>{news ? 'Cancel' : 'Continue browsing as Guest'}</button>
      </div>
    </BaseModal>
  )
}
