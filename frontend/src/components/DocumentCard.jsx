import React from 'react';
import { useNavigate } from 'react-router-dom';
import pdfIcon from '../assets/pdf-icon.png';
import docIcon from '../assets/doc-icon.png';
import xlsIcon from '../assets/xls.png';
import pptIcon from '../assets/pptx.png';
import fileIcon from '../assets/txt-icon.png'; // Use txt-icon as generic file fallback

/**
 * DocumentCard Component
 * Displays a clickable card for a document with icon, name, and type
 * Used in chat responses when AI provides document access
 */
const DocumentCard = ({ document }) => {
  const navigate = useNavigate();

  if (!document) return null;

  // Get the appropriate icon based on document type
  const getDocumentIcon = (type) => {
    switch (type) {
      case 'pdf':
        return pdfIcon;
      case 'docx':
      case 'doc':
        return docIcon;
      case 'xlsx':
      case 'xls':
        return xlsIcon;
      case 'pptx':
      case 'ppt':
        return pptIcon;
      default:
        return fileIcon;
    }
  };

  // Get file type display name
  const getFileTypeDisplay = (type) => {
    switch (type) {
      case 'pdf':
        return 'PDF';
      case 'docx':
      case 'doc':
        return 'WORD';
      case 'xlsx':
      case 'xls':
        return 'EXCEL';
      case 'pptx':
      case 'ppt':
        return 'POWERPOINT';
      case 'image':
        return 'IMAGE';
      case 'text':
        return 'TEXT';
      default:
        return 'FILE';
    }
  };

  // Handle card click - navigate to document preview
  const handleClick = () => {
    if (document.previewUrl) {
      // Navigate to document viewer
      navigate(`/documents/${document.id}`);
    } else if (document.downloadUrl) {
      // Fallback: open download URL
      window.open(document.downloadUrl, '_blank');
    }
  };

  const icon = getDocumentIcon(document.type);
  const typeDisplay = getFileTypeDisplay(document.type);

  return (
    <div
      onClick={handleClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '12px',
        padding: '12px 16px',
        background: 'white',
        border: '1px solid #E6E6EC',
        borderRadius: '12px',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        marginTop: '8px',
        marginBottom: '8px',
        maxWidth: '400px',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = '#F9FAFB';
        e.currentTarget.style.borderColor = '#D1D5DB';
        e.currentTarget.style.transform = 'translateY(-2px)';
        e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.08)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'white';
        e.currentTarget.style.borderColor = '#E6E6EC';
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = 'none';
      }}
    >
      {/* Document Icon */}
      <div style={{
        width: '40px',
        height: '40px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}>
        <img
          src={icon}
          alt={typeDisplay}
          style={{
            width: '40px',
            height: '40px',
            objectFit: 'contain',
          }}
        />
      </div>

      {/* Document Info */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
        minWidth: 0, // Allow text truncation
      }}>
        <div style={{
          fontSize: '14px',
          fontWeight: '600',
          color: '#32302C',
          fontFamily: 'Plus Jakarta Sans',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}>
          {document.name}
        </div>
        <div style={{
          fontSize: '12px',
          fontWeight: '500',
          color: '#6C6B6E',
          fontFamily: 'Plus Jakarta Sans',
        }}>
          {typeDisplay}
        </div>
      </div>

      {/* Processing Badge (for pending/processing documents) */}
      {(document.status === 'pending' || document.status === 'processing') && (
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          padding: '4px 12px',
          background: '#EFF6FF',
          color: '#1D4ED8',
          fontSize: '11px',
          fontWeight: '600',
          fontFamily: 'Plus Jakarta Sans',
          borderRadius: '12px',
          border: '1px solid #DBEAFE',
          flexShrink: 0,
        }}>
          <svg style={{ animation: 'spin 1s linear infinite' }} width="12" height="12" viewBox="0 0 24 24" fill="none">
            <circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path style={{ opacity: 0.75 }} fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          Processing
        </div>
      )}

      {/* Arrow Icon */}
      <div style={{
        width: '20px',
        height: '20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}>
        <svg
          width="20"
          height="20"
          viewBox="0 0 20 20"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M7.5 15L12.5 10L7.5 5"
            stroke="#6C6B6E"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    </div>
  );
};

export default DocumentCard;
