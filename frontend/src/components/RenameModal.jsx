import React, { useState, useEffect } from 'react';
import Modal from './ui/Modal';
import Input from './ui/Input';
import { colors, typography, spacing } from '../constants/designTokens';

/**
 * Rename Modal
 * Shows a modal dialog when user wants to rename a file or folder
 * Uses the canonical Modal component for consistent styling
 */
const RenameModal = ({ isOpen, onClose, onConfirm, itemName, itemType = 'file' }) => {
  const [newName, setNewName] = useState(itemName || '');

  // Update newName when itemName changes
  useEffect(() => {
    if (isOpen) {
      setNewName(itemName || '');
    }
  }, [itemName, isOpen]);

  const handleSubmit = () => {
    if (newName.trim() && newName.trim() !== itemName) {
      onConfirm(newName.trim());
      setNewName('');
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    }
  };

  const isValid = newName.trim() && newName.trim() !== itemName;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Rename ${itemType}`}
      maxWidth={400}
      actions={[
        { label: 'Cancel', onClick: onClose, variant: 'secondary' },
        { label: 'Rename', onClick: handleSubmit, variant: 'primary', disabled: !isValid },
      ]}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.sm }}>
        <label
          style={{
            color: colors.gray[900],
            fontSize: typography.sizes.sm,
            fontFamily: typography.fontFamily,
            fontWeight: typography.weights.semibold,
            lineHeight: typography.lineHeights.sm,
          }}
        >
          New name
        </label>
        <Input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={handleKeyDown}
          autoFocus
          placeholder={`Enter new ${itemType} name`}
        />
      </div>
    </Modal>
  );
};

export default RenameModal;
