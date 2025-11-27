import React from 'react';
import Modal from './ui/Modal';
import { colors, typography } from '../constants/designTokens';

/**
 * Delete Confirmation Modal
 * Shows a confirmation dialog when user wants to delete an item
 * Uses the canonical Modal component for consistent styling
 */
const DeleteConfirmationModal = ({ isOpen, onClose, onConfirm, itemName, itemType = 'item' }) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Delete"
      maxWidth={380}
      actions={[
        { label: 'Cancel', onClick: onClose, variant: 'secondary' },
        { label: 'Delete', onClick: onConfirm, variant: 'danger' },
      ]}
    >
      <div
        style={{
          textAlign: 'center',
          color: colors.gray[900],
          fontSize: typography.sizes.md,
          fontFamily: typography.fontFamily,
          lineHeight: typography.lineHeights.md,
        }}
      >
        <span style={{ fontWeight: typography.weights.medium }}>
          Are you sure you want to delete{' '}
        </span>
        <span style={{ fontWeight: typography.weights.bold }}>
          {itemName}
        </span>
        <span style={{ fontWeight: typography.weights.medium }}>
          ?
        </span>
      </div>
    </Modal>
  );
};

export default DeleteConfirmationModal;
