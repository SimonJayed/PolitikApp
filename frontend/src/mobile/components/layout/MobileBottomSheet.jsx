import BaseModal from '../../../components/BaseModal'

export function MobileBottomSheet({ isOpen, onClose, title, children }) {
  return <BaseModal isOpen={isOpen} onClose={onClose} title={title}>{children}</BaseModal>
}

export default MobileBottomSheet
