import React, { useState, useEffect } from 'react';

/**
 * CreateFolderModal - Modal for creating new folders
 * Simple modal with folder name input
 */
const CreateFolderModal = ({ isOpen, onClose, onConfirm }) => {
  const [folderName, setFolderName] = useState('');

  useEffect(() => {
    if (isOpen) {
      setFolderName('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    if (e && e.preventDefault) {
      e.preventDefault();
    }
    if (folderName.trim()) {
      onConfirm(folderName.trim());
      setFolderName('');
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: 'white',
          borderRadius: 16,
          padding: 24,
          width: '90%',
          maxWidth: 400,
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          style={{
            fontSize: 20,
            fontFamily: 'Plus Jakarta Sans',
            fontWeight: '700',
            color: '#181818',
            marginBottom: 16,
          }}
        >
          Create New Folder
        </h2>

        <form onSubmit={handleSubmit}>
          <input
            type="text"
            value={folderName}
            onChange={(e) => setFolderName(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Folder name"
            autoFocus
            style={{
              width: '100%',
              padding: 12,
              fontSize: 15,
              fontFamily: 'Plus Jakarta Sans',
              border: '1px solid #E6E6EC',
              borderRadius: 8,
              outline: 'none',
              marginBottom: 20,
            }}
          />

          <div
            style={{
              display: 'flex',
              gap: 12,
              justifyContent: 'flex-end',
            }}
          >
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '10px 20px',
                fontSize: 15,
                fontFamily: 'Plus Jakarta Sans',
                fontWeight: '600',
                color: '#666',
                background: 'white',
                border: '1px solid #E6E6EC',
                borderRadius: 8,
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!folderName.trim()}
              style={{
                padding: '10px 20px',
                fontSize: 15,
                fontFamily: 'Plus Jakarta Sans',
                fontWeight: '600',
                color: 'white',
                background: folderName.trim() ? '#181818' : '#ccc',
                border: 'none',
                borderRadius: 8,
                cursor: folderName.trim() ? 'pointer' : 'not-allowed',
              }}
            >
              Create
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateFolderModal;
