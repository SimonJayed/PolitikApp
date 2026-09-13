import React from 'react';

export default function AuthPromptModal({
  isOpen,
  onClose,
  onSignIn,
  onRegister,
  actionType = 'propose', // 'propose' | 'challenge' | 'general'
}) {
  if (!isOpen) return null;

  const actionText = {
    propose: 'Proposing new governance metrics and timeline records',
    challenge: 'Challenging an official record with counter-evidence',
    general: 'Contributing to the civic ledger',
    preview: 'Viewing the full public-official database, audit trails, and comparison tools',
  }[actionType] || 'Contributing to the civic ledger';
  const actionIcon = {
    challenge: '⚖️',
    preview: '🔒',
    general: '📝',
    propose: '📝',
  }[actionType] || '📝';

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(8px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        animation: 'fadeIn 0.2s ease-out',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#ffffff',
          borderRadius: '20px',
          width: '100%',
          maxWidth: '480px',
          boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.25)',
          border: '1px solid #e2e8f0',
          padding: '32px 28px',
          position: 'relative',
          textAlign: 'center',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Badge / Icon */}
        <div
          style={{
            width: '64px',
            height: '64px',
            borderRadius: '16px',
            background: 'linear-gradient(135deg, #e0f2fe 0%, #ccfbf1 100%)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '30px',
            marginBottom: '18px',
            border: '1px solid rgba(13, 148, 136, 0.2)',
          }}
        >
          {actionIcon}
        </div>

        <h3
          style={{
            margin: '0 0 10px 0',
            fontFamily: "var(--display, 'Poppins', sans-serif)",
            fontSize: '22px',
            fontWeight: '800',
            color: '#0f172a',
            letterSpacing: '-0.02em',
          }}
        >
          {actionType === 'preview' ? 'Sign in to unlock the full ledger' : 'Citizen Verification Required'}
        </h3>

        <p
          style={{
            margin: '0 0 24px 0',
            fontSize: '14px',
            lineHeight: '1.6',
            color: '#475569',
          }}
        >
          {actionText} requires an authenticated citizen or researcher account to ensure full citation traceability and prevent automated spam.
        </p>

        {/* Benefits bullets */}
        <div
          style={{
            background: '#f8fafc',
            borderRadius: '12px',
            border: '1px solid #e2e8f0',
            padding: '14px 18px',
            textAlign: 'left',
            marginBottom: '28px',
            fontSize: '13px',
            color: '#334155',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ color: '#0d9488', fontWeight: 'bold' }}>✓</span>
            <span>Submit whitelisted <code>.gov.ph</code> / <code>.edu.ph</code> citations</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ color: '#0d9488', fontWeight: 'bold' }}>✓</span>
            <span>Receive real-time updates on Admin Curator rulings</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ color: '#0d9488', fontWeight: 'bold' }}>✓</span>
            <span>Track verified contributions on your personal civic ledger</span>
          </div>
        </div>

        {/* CTAs */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <button
            type="button"
            id="auth-prompt-signin-btn"
            onClick={() => {
              onClose();
              onSignIn();
            }}
            style={{
              padding: '12px 20px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #0f766e 0%, #0d9488 100%)',
              color: '#ffffff',
              fontWeight: '700',
              fontSize: '14px',
              border: 'none',
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(13, 148, 136, 0.3)',
              transition: 'all 0.15s ease',
            }}
          >
            Sign In to Your Account
          </button>

          <button
            type="button"
            id="auth-prompt-register-btn"
            onClick={() => {
              onClose();
              onRegister();
            }}
            style={{
              padding: '12px 20px',
              borderRadius: '10px',
              background: '#ffffff',
              color: '#0f766e',
              fontWeight: '700',
              fontSize: '14px',
              border: '1px solid #0d9488',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            Create New Citizen Account
          </button>

          <button
            type="button"
            onClick={onClose}
            style={{
              marginTop: '4px',
              background: 'none',
              border: 'none',
              color: '#94a3b8',
              fontSize: '13px',
              fontWeight: '500',
              cursor: 'pointer',
              textDecoration: 'underline',
              textUnderlineOffset: '3px',
            }}
          >
            Continue browsing as Guest
          </button>
        </div>
      </div>
    </div>
  );
}
