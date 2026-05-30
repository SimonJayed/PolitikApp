import React from 'react';

export default function ModerationAlert({ message, status }) {
  if (!message) return null;

  const alertClass = status === 'error' ? 'alert-danger' : status === 'success' ? 'alert-success' : 'alert-info';

  return (
    <div className={`status-toast ${alertClass}`} style={{
      padding: '10px 14px',
      borderRadius: '6px',
      fontSize: '13px',
      margin: '8px 0',
      borderLeft: '4px solid',
      background: status === 'error' ? '#fef2f2' : status === 'success' ? '#ecfdf5' : '#eff6ff',
      borderColor: status === 'error' ? '#ef4444' : status === 'success' ? '#10b981' : '#3b82f6',
      color: status === 'error' ? '#991b1b' : status === 'success' ? '#065f46' : '#1e3a8a',
    }}>
      {message}
    </div>
  );
}
