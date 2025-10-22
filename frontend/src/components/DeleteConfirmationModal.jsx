import React from 'react';

/**
 * Delete Confirmation Modal
 * Shows a confirmation dialog when user wants to delete an item
 */
const DeleteConfirmationModal = ({ isOpen, onClose, onConfirm, itemName }) => {
  if (!isOpen) return null;

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
        maxWidth: 340,
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
            width: 304,
            textAlign: 'center',
            color: '#32302C',
            fontSize: 18,
            fontFamily: 'Plus Jakarta Sans',
            fontWeight: '700',
            lineHeight: '26px'
          }}>
            Delete
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

        {/* Message */}
        <div style={{
          alignSelf: 'stretch',
          paddingLeft: 18,
          paddingRight: 18,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center'
        }}>
          <div style={{
            width: 304,
            textAlign: 'center'
          }}>
            <span style={{
              color: '#32302C',
              fontSize: 16,
              fontFamily: 'Plus Jakarta Sans',
              fontWeight: '500',
              lineHeight: '24px'
            }}>
              Are you sure you want to delete{' '}
            </span>
            <span style={{
              color: '#32302C',
              fontSize: 16,
              fontFamily: 'Plus Jakarta Sans',
              fontWeight: '700',
              lineHeight: '24px'
            }}>
              {itemName}
            </span>
            <span style={{
              color: '#32302C',
              fontSize: 16,
              fontFamily: 'Plus Jakarta Sans',
              fontWeight: '500',
              lineHeight: '24px'
            }}>
              ?
            </span>
          </div>
        </div>

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

          {/* Delete Button */}
          <div
            onClick={onConfirm}
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
            onMouseEnter={(e) => e.currentTarget.style.background = '#FEE2E2'}
            onMouseLeave={(e) => e.currentTarget.style.background = '#F5F5F5'}
          >
            <div style={{
              color: '#D92D20',
              fontSize: 16,
              fontFamily: 'Plus Jakarta Sans',
              fontWeight: '700',
              textTransform: 'capitalize',
              lineHeight: '24px'
            }}>
              Delete
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DeleteConfirmationModal;
