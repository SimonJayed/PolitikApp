import BaseModal from './BaseModal'

function ConfirmActionModal({
  cancelLabel = 'Cancel',
  confirmLabel = 'Confirm',
  description,
  isOpen,
  isSubmitting = false,
  onCancel,
  onConfirm,
  severity = 'warning',
  title,
  detailsLabel = '',
  detailsPlaceholder = '',
  detailsValue = '',
  onDetailsChange,
}) {
  const isDanger = severity === 'danger'
  return (
    <BaseModal isDismissDisabled={isSubmitting} isOpen={isOpen} modalClassName="appealModalCompact" onClose={onCancel} title={title}>
      <header className="comparisonModalHeader">
        <h2 className="ty-section-title">{title}</h2>
        <button
          aria-label="Close"
          className="comparisonModalClose"
          disabled={isSubmitting}
          onClick={onCancel}
          type="button"
        >
          Close
        </button>
      </header>
      <div className="comparisonModalBody">
        <div className="confirmModalBody">
          <p className="ty-body">{description}</p>
          {onDetailsChange ? (
            <label className="confirmModalDetailField">
              <span className="ty-label">{detailsLabel || 'Details'}</span>
              <textarea
                disabled={isSubmitting}
                placeholder={detailsPlaceholder || 'Add details'}
                rows={3}
                value={detailsValue}
                onChange={(event) => onDetailsChange(event.target.value)}
              />
            </label>
          ) : null}
          <div className="confirmModalActions">
            <button disabled={isSubmitting} onClick={onCancel} type="button">
              {cancelLabel}
            </button>
            <button
              className={isDanger ? 'dangerButton' : ''}
              disabled={isSubmitting}
              onClick={onConfirm}
              type="submit"
            >
              {isSubmitting ? 'Processing...' : confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </BaseModal>
  )
}

export default ConfirmActionModal
