import React from 'react';
import SourceUrlInput from './SourceUrlInput';
import SubmissionStatusAlert from './SubmissionStatusAlert';

export const actionOptions = [
  'COA_FINDING',
  'BUDGET_ALLOCATION',
  'PROJECT_COMPLETION',
  'SPONSORED_LEGISLATION',
];

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

  const isSourceAllowed = true; // domain check is now non-blocking via onDomainCheck callback

  return (
    <section className="workspace submission-panel-wrapper">
      <form className="editorPanel" onSubmit={onSubmit}>
        {selectedPolitician && (
          <p className="statusLine success">
            Adding contribution for: <strong style={{ marginLeft: '6px' }}>{selectedPolitician.fullName}</strong>
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
              {actionOptions.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
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
