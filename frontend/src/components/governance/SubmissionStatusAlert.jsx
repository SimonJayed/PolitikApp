import { LoadingSkeleton } from "../Skeletons"
import React from 'react';
import { AlertTriangleIcon, CircleCheckIcon } from '../icons/Lucide';

export default function SubmissionStatusAlert({ state }) {
  if (!state || !state.message) return null;

  if (state.status === 'loading') {
    return (
      <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-slate-600 shadow-xs submission-status-loading">
        <LoadingSkeleton label={state.message} rows={2} />
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
