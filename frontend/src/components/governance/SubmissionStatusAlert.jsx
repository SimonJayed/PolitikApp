import React from 'react';
import { AlertTriangleIcon, CircleCheckIcon } from '../icons/Lucide';

export default function SubmissionStatusAlert({ state }) {
  if (!state || !state.message) return null;

  if (state.status === 'loading') {
    return (
      <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-slate-600 shadow-xs submission-status-loading">
        <div className="flex items-center gap-3">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-blue-100 border-t-blue-500" aria-hidden="true" />
          <span className="sr-only">{state.message}</span>
          <div className="h-2 w-40 rounded-full bg-slate-100 animate-pulse" aria-hidden="true" />
        </div>
      </div>
    );
  }

  const alertClass = `statusLine ${state.status}`;
  return (
    <div className={`submission-status-alert ${alertClass}`} role="alert">
      {state.status === 'success' && <CircleCheckIcon size={16} className="alert-icon" />}
      {state.status === 'error' && <AlertTriangleIcon size={16} className="alert-icon" />}
      <span className="alert-message">{state.message}</span>
    </div>
  );
}
