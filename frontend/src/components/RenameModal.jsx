import React, { useState, useEffect } from 'react';

/**
 * Rename Modal
 * Shows a modal dialog when user wants to rename a file or folder
 */
const RenameModal = ({ isOpen, onClose, onConfirm, itemName, itemType = 'file' }) => {
  const [newName, setNewName] = useState(itemName || '');

  // Update newName when itemName changes
  useEffect(() => {
    if (isOpen) {
      setNewName(itemName || '');
    }
  }, [itemName, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    if (e && e.preventDefault) {
      e.preventDefault();
    }
    if (newName.trim() && newName.trim() !== itemName) {
      onConfirm(newName.trim());
      setNewName('');
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      background: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 10000
    }}>
      <div style={{
        width: '100%',
        maxWidth: 400,
        background: 'white',
        borderRadius: 14,
        outline: '1px #E6E6EC solid',
        outlineOffset: '-1px',
        display: 'flex',
        flexDirection: 'column',
        gap: 18,
        paddingTop: 18,
        paddingBottom: 18
      }}>
        {/* Header */}
        <div style={{
          alignSelf: 'stretch',
          paddingLeft: 18,
          paddingRight: 18,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          {/* Left spacer (invisible) */}
          <div style={{
            width: 30,
            height: 30,
            opacity: 0
          }} />

          {/* Title */}
          <div style={{
            flex: 1,
            textAlign: 'center',
            color: '#32302C',
            fontSize: 18,
            fontFamily: 'Plus Jakarta Sans',
            fontWeight: '700',
            lineHeight: '26px'
          }}>
            Rename {itemType}
          </div>

          {/* Close button */}
          <div
            onClick={onClose}
            style={{
              width: 30,
              height: 30,
              paddingLeft: 8,
              paddingRight: 8,
              paddingTop: 4,
              paddingBottom: 4,
              background: 'white',
              borderRadius: 100,
              outline: '1px #E6E6EC solid',
              outlineOffset: '-1px',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              cursor: 'pointer'
            }}
          >
            <div style={{
              fontSize: 14,
              color: '#323232'
            }}>
              ✕
            </div>
          </div>
        </div>

        {/* Divider */}
        <div style={{
          alignSelf: 'stretch',
          height: 1,
          background: '#E6E6EC'
        }} />

        {/* Form */}
        <form onSubmit={handleSubmit} style={{
          alignSelf: 'stretch',
          paddingLeft: 18,
          paddingRight: 18,
          display: 'flex',
          flexDirection: 'column',
          gap: 12
        }}>
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 8
          }}>
            <label style={{
              color: '#32302C',
              fontSize: 14,
              fontFamily: 'Plus Jakarta Sans',
              fontWeight: '600',
              lineHeight: '20px'
            }}>
              New name
            </label>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={handleKeyDown}
              autoFocus
              placeholder={`Enter new ${itemType} name`}
              style={{
                width: '100%',
                padding: '12px 14px',
                background: 'white',
                borderRadius: 10,
                border: '1px solid #E6E6EC',
                outline: 'none',
                fontSize: 14,
                fontFamily: 'Plus Jakarta Sans',
                color: '#32302C',
                transition: 'border-color 0.2s ease'
              }}
              onFocus={(e) => e.currentTarget.style.borderColor = '#181818'}
              onBlur={(e) => e.currentTarget.style.borderColor = '#E6E6EC'}
            />
          </div>
        </form>

        {/* Divider */}
        <div style={{
          alignSelf: 'stretch',
          height: 1,
          background: '#E6E6EC'
        }} />

        {/* Action Buttons */}
        <div style={{
          alignSelf: 'stretch',
          paddingLeft: 18,
          paddingRight: 18,
          display: 'flex',
          justifyContent: 'flex-start',
          alignItems: 'flex-start',
          gap: 8
        }}>
          {/* Cancel Button */}
          <div
            onClick={onClose}
            style={{
              flex: '1 1 0',
              height: 52,
              paddingLeft: 18,
              paddingRight: 18,
              paddingTop: 10,
              paddingBottom: 10,
              background: '#F5F5F5',
              borderRadius: 14,
              outline: '1px #E6E6EC solid',
              outlineOffset: '-1px',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              gap: 8,
              cursor: 'pointer',
              transition: 'background 0.2s ease'
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = '#E6E6EC'}
            onMouseLeave={(e) => e.currentTarget.style.background = '#F5F5F5'}
          >
            <div style={{
              color: '#323232',
              fontSize: 16,
              fontFamily: 'Plus Jakarta Sans',
              fontWeight: '700',
              textTransform: 'capitalize',
              lineHeight: '24px'
            }}>
              Cancel
            </div>
          </div>

          {/* Rename Button */}
          <div
            onClick={handleSubmit}
            style={{
              flex: '1 1 0',
              height: 52,
              paddingLeft: 18,
              paddingRight: 18,
              paddingTop: 10,
              paddingBottom: 10,
              background: '#181818',
              borderRadius: 14,
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              gap: 8,
              cursor: newName.trim() && newName.trim() !== itemName ? 'pointer' : 'not-allowed',
              opacity: newName.trim() && newName.trim() !== itemName ? 1 : 0.5,
              transition: 'background 0.2s ease'
            }}
            onMouseEnter={(e) => {
              if (newName.trim() && newName.trim() !== itemName) {
                e.currentTarget.style.background = '#32302C';
              }
            }}
            onMouseLeave={(e) => {
              if (newName.trim() && newName.trim() !== itemName) {
                e.currentTarget.style.background = '#181818';
              }
            }}
          >
            <div style={{
              color: 'white',
              fontSize: 16,
              fontFamily: 'Plus Jakarta Sans',
              fontWeight: '700',
              textTransform: 'capitalize',
              lineHeight: '24px'
            }}>
              Rename
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RenameModal;
