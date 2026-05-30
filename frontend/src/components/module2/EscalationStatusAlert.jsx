import React from 'react';

export default function EscalationStatusAlert({ status, message }) {
  if (!message) return null;

  return (
    <div className={`status-toast ${status === 'error' ? 'alert-danger' : 'alert-success'}`} style={{
      background: status === 'error' ? '#fee2e2' : '#ecfdf5',
      borderColor: status === 'error' ? '#fca5a5' : '#a7f3d0',
      color: status === 'error' ? '#991b1b' : '#065f46',
      padding: '12px 16px',
      borderRadius: '8px',
      borderLeft: '4px solid',
      fontSize: '13px',
      marginBottom: '16px'
    }}>
      {message}
    </div>
  );
}
