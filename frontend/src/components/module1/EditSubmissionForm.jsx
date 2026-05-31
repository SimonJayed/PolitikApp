import React, { useEffect } from 'react';
import SourceUrlInput from './SourceUrlInput';
import SubmissionStatusAlert from './SubmissionStatusAlert';
import { getActionsForPosition } from './positionConfig';

/**
 * Human-readable labels for each actionIdentifier value.
 * Used in the dropdown so contributors see friendly text instead of snake_case.
 */
export const ACTION_LABELS = {
  COA_FINDING:           'COA Audit Finding',
  BUDGET_ALLOCATION:     'Budget Allocation',
  PROJECT_COMPLETION:    'Project Completion',
  SPONSORED_LEGISLATION: 'Sponsored Legislation',
};

export const categoryOptions = ['Audit', 'Finance', 'Infrastructure', 'Healthcare', 'Education'];

export const actionDetailFields = {
  COA_FINDING: [
    { key: 'flaggedAmount', label: 'Audit Flagged Amount (PHP)', type: 'number' },
  ],
  BUDGET_ALLOCATION: [
    { key: 'allocationAmount', label: 'Budget Allocation Amount (PHP)', type: 'number' },
  ],
  PROJECT_COMPLETION: [
    { key: 'completionPercentage', label: 'Project Completion Percentage (%)', max: 100, type: 'number' },
  ],
  SPONSORED_LEGISLATION: [
    { key: 'legislationTitle', label: 'Legislation Title', type: 'text' },
    { key: 'dateFiled', label: 'Date Filed', type: 'date' },
    {
      key: 'legislativeStatus',
      label: 'Legislative Status',
      options: ['Filed', 'In Committee', 'Approved', 'Rejected', 'Withdrawn'],
      type: 'select',
    },
  ],
};

export default function EditSubmissionForm({
  formData,
  onChange,
  onDetailChange,
  onSubmit,
  selectedPoliticianId,
  state,
  politicians = [],
  onDomainCheck,
}) {
  const selectedPolitician = politicians.find(
    (p) => p.politicianId === (formData.politicianId || selectedPoliticianId)
  );

  // Derive the allowed actions for the currently selected politician's position.
  // Falls back to all actions when no politician is selected yet.
  const allowedActions = getActionsForPosition(selectedPolitician?.position)

  // When the politician changes, auto-reset actionIdentifier if the current
  // value is no longer permitted for the new position. This prevents stale
  // data (e.g. SPONSORED_LEGISLATION) from carrying over to an Executive.
  useEffect(() => {
    if (formData.actionIdentifier && !allowedActions.includes(formData.actionIdentifier)) {
      onChange({
        target: { name: 'actionIdentifier', value: allowedActions[0] },
      })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPolitician?.politicianId])

  return (
    <section className="workspace submission-panel-wrapper">
      <form className="editorPanel" onSubmit={onSubmit}>
        {selectedPolitician && (
          <p className="statusLine success">
            Adding contribution for: <strong style={{ marginLeft: '6px' }}>{selectedPolitician.fullName}</strong>
            <small style={{ marginLeft: '8px', color: 'var(--text-muted)', fontWeight: 400 }}>
              ({selectedPolitician.position || 'UNSPECIFIED'})
            </small>
          </p>
        )}
        <label>
          Select Politician Profile
          <select name="politicianId" value={formData.politicianId} onChange={onChange} required>
            <option value="">— Choose a Politician Profile —</option>
            {politicians.map((p) => (
              <option key={p.politicianId} value={p.politicianId}>
                {p.fullName} ({p.position || 'UNSPECIFIED'})
              </option>
            ))}
          </select>
        </label>

        <SourceUrlInput value={formData.sourceUrl} onChange={onChange} onDomainCheck={onDomainCheck} />

        <div className="fieldRow">
          <label>
            Category
            <select name="categoryTag" value={formData.categoryTag} onChange={onChange}>
              {categoryOptions.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </label>
          <label>
            Action
            <select name="actionIdentifier" value={formData.actionIdentifier} onChange={onChange}>
              {allowedActions.map((o) => (
                <option key={o} value={o}>{ACTION_LABELS[o] ?? o}</option>
              ))}
            </select>
            {selectedPolitician && (
              <small style={{ color: 'var(--text-muted)', fontSize: '11px', marginTop: '4px', display: 'block' }}>
                Available actions are filtered by this politician&apos;s office.
              </small>
            )}
          </label>
        </div>

        <ActionDetailsFields
          actionDetails={formData.actionDetails || {}}
          actionIdentifier={formData.actionIdentifier}
          onChange={onDetailChange}
        />

        <label>
          Impact Summary
          <textarea name="impactSummary" required rows="5" value={formData.impactSummary} onChange={onChange} />
        </label>

        <div className="formFooter">
          <button disabled={state.status === 'loading'} type="submit">Submit Evidence</button>
        </div>

        <SubmissionStatusAlert state={state} />
      </form>
    </section>
  );
}

function ActionDetailsFields({ actionDetails, actionIdentifier, onChange }) {
  const fields = actionDetailFields[actionIdentifier] || [{ key: 'metric', label: 'Metric', type: 'number' }];
  return (
    <div className="fieldRow">
      {fields.map((field) => (
        <label key={field.key}>
          {field.label}
          {field.type === 'select' ? (
            <select
              name={field.key}
              required
              value={actionDetails[field.key] ?? ''}
              onChange={(event) => onChange(field.key, event.target.value)}
            >
              <option value="">Select status</option>
              {field.options.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          ) : (
            <input
              max={field.max}
              min={field.type === 'number' ? '0' : undefined}
              name={field.key}
              required
              step={field.type === 'number' ? 'any' : undefined}
              type={field.type}
              value={actionDetails[field.key] ?? ''}
              onChange={(event) => onChange(field.key, event.target.value)}
            />
          )}
        </label>
      ))}
    </div>
  );
}
