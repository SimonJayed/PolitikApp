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
}) {
  const isDanger = severity === 'danger'
  return (
    <BaseModal isDismissDisabled={isSubmitting} isOpen={isOpen} onClose={onCancel} title={title}>
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
