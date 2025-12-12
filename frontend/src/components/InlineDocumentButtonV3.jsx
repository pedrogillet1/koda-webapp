/**
 * InlineDocumentButton.tsx
 *
 * A React component that displays a clickable document filename.
 * - When rendered inside a list (inList=true), the filename is bold only (no underline).
 * - When rendered inline in text (inList=false), the filename is bold and always underlined.
 * Clicking the filename opens a modal preview of the document.
 *
 * This component is fully accessible and handles errors gracefully.
 */

import React, { useState, MouseEvent, KeyboardEvent, useCallback } from 'react';
import ReactDOM from 'react-dom';
import PropTypes from 'prop-types';

// Styles for the component and modal
const styles = {
  button: (inList: boolean): React.CSSProperties => ({
    fontWeight: 'bold',
    textDecoration: inList ? 'none' : 'underline',
    color: '#007bff',
    background: 'none',
    border: 'none',
    padding: 0,
    margin: 0,
    cursor: 'pointer',
    fontSize: 'inherit',
    fontFamily: 'inherit',
    outline: 'none',
  }),
  modalOverlay: {
    position: 'fixed' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    zIndex: 1000,
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    padding: '1rem',
    borderRadius: '4px',
    maxWidth: '90%',
    maxHeight: '90%',
    overflowY: 'auto' as const,
    boxShadow: '0 2px 10px rgba(0,0,0,0.3)',
  },
  modalHeader: {
    marginBottom: '0.5rem',
    fontWeight: 'bold',
    fontSize: '1.25rem',
  },
  modalBody: {
    fontSize: '1rem',
  },
  closeButton: {
    position: 'absolute' as const,
    top: '1rem',
    right: '1rem',
    background: 'none',
    border: 'none',
    fontSize: '1.5rem',
    cursor: 'pointer',
    color: '#333',
  },
};

/**
 * Props for InlineDocumentButton component.
 */
interface InlineDocumentButtonProps {
  /**
   * The filename to display.
   */
  filename: string;

  /**
   * Whether the button is rendered inside a list.
   * If true, the filename is bold only (no underline).
   * If false, the filename is bold and underlined.
   */
  inList: boolean;

  /**
   * The document content or URL to preview.
   * For this example, we assume a string representing document content.
   * In a real app, this could be a URL or a more complex object.
   */
  documentContent: string;
}

/**
 * Modal component to preview document content.
 * Renders into a portal at document.body.
 */
const DocumentPreviewModal: React.FC<{
  filename: string;
  content: string;
  onClose: () => void;
}> = ({ filename, content, onClose }) => {
  // Close modal on Escape key press
  const onKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    },
    [onClose]
  );

  // Prevent scrolling of the background when modal is open
  React.useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);

  return ReactDOM.createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="document-preview-title"
      tabIndex={-1}
      onKeyDown={onKeyDown}
      style={styles.modalOverlay}
      onClick={onClose} // Close modal if clicking outside content
    >
      <div
        style={styles.modalContent}
        onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside modal
      >
        <button
          aria-label="Close document preview"
          onClick={onClose}
          style={styles.closeButton}
        >
          &times;
        </button>
        <h2 id="document-preview-title" style={styles.modalHeader}>
          Preview: {filename}
        </h2>
        <div style={styles.modalBody}>
          {/* For demonstration, render content as preformatted text */}
          <pre
            style={{
              whiteSpace: 'pre-wrap',
              wordWrap: 'break-word',
              fontFamily: 'inherit',
              fontSize: '1rem',
              margin: 0,
            }}
          >
            {content}
          </pre>
        </div>
      </div>
    </div>,
    document.body
  );
};

/**
 * InlineDocumentButton component.
 * Displays a clickable filename with styling based on context.
 * Opens a modal preview on click.
 *
 * @param props InlineDocumentButtonProps
 */
const InlineDocumentButton: React.FC<InlineDocumentButtonProps> = ({
  filename,
  inList,
  documentContent,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Handles opening the preview modal.
   * Catches and sets error if something goes wrong.
   */
  const openPreview = () => {
    try {
      setError(null);
      setIsModalOpen(true);
    } catch (err) {
      // Defensive error handling
      setError('Failed to open document preview.');
      // In production, consider logging error to monitoring service
      // console.error(err);
    }
  };

  /**
   * Handles closing the preview modal.
   */
  const closePreview = () => {
    setIsModalOpen(false);
  };

  /**
   * Handles keyboard interaction for accessibility.
   * Opens preview on Enter or Space keys.
   *
   * @param e KeyboardEvent<HTMLButtonElement>
   */
  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openPreview();
    }
  };

  return (
    <>
      <button
        type="button"
        aria-label={`Open preview for document ${filename}`}
        onClick={openPreview}
        onKeyDown={onKeyDown}
        style={styles.button(inList)}
      >
        {filename}
      </button>
      {error && (
        <div
          role="alert"
          style={{ color: 'red', marginTop: '0.25rem', fontSize: '0.875rem' }}
        >
          {error}
        </div>
      )}
      {isModalOpen && (
        <DocumentPreviewModal
          filename={filename}
          content={documentContent}
          onClose={closePreview}
        />
      )}
    </>
  );
};

InlineDocumentButton.propTypes = {
  filename: PropTypes.string.isRequired,
  inList: PropTypes.bool.isRequired,
  documentContent: PropTypes.string.isRequired,
};

export default InlineDocumentButton;
