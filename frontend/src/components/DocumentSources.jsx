import React, { useState } from 'react';
import InlineDocumentButton from './InlineDocumentButton';
import { getFileIcon } from '../utils/iconMapper';

/**
 * DocumentSources Component
 *
 * A collapsible dropdown that shows all document sources used in an answer.
 * Appears below every answer that used documents.
 */
const DocumentSources = ({ sources, onDocumentClick }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  // Don't render if no sources
  if (!sources || sources.length === 0) {
    return null;
  }

  // Deduplicate sources by documentId or filename
  const uniqueSources = sources.reduce((acc, source) => {
    const key = source.documentId || source.filename || source.documentName;
    if (!acc.find(s => (s.documentId || s.filename || s.documentName) === key)) {
      acc.push(source);
    }
    return acc;
  }, []);

  return (
    <div style={{
      marginTop: '12px',
      borderTop: '1px solid #E5E7EB',
      paddingTop: '12px'
    }}>
      {/* Collapsible Header Button */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '8px 14px',
          backgroundColor: isExpanded ? '#F3F4F6' : '#FAFAFA',
          border: '1px solid #E5E7EB',
          borderRadius: '20px',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          fontFamily: 'inherit',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = '#F3F4F6';
          e.currentTarget.style.borderColor = '#D1D5DB';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = isExpanded ? '#F3F4F6' : '#FAFAFA';
          e.currentTarget.style.borderColor = '#E5E7EB';
        }}
      >
        {/* Folder/Document Icon */}
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#6B7280"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
        </svg>

        {/* Label */}
        <span style={{
          fontSize: '14px',
          fontWeight: '500',
          color: '#374151',
        }}>
          Document Sources
        </span>

        {/* Count Badge */}
        <span style={{
          fontSize: '12px',
          fontWeight: '600',
          color: '#6B7280',
          backgroundColor: '#E5E7EB',
          padding: '2px 8px',
          borderRadius: '10px',
        }}>
          {uniqueSources.length}
        </span>

        {/* Chevron Icon */}
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#6B7280"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{
            transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s ease',
            marginLeft: '4px'
          }}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {/* Expanded Content - Document Buttons */}
      {isExpanded && (
        <div style={{
          marginTop: '10px',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '8px',
          padding: '8px 0',
          animation: 'fadeIn 0.2s ease'
        }}>
          {uniqueSources.map((source, index) => (
            <InlineDocumentButton
              key={`source-${source.documentId || index}`}
              document={{
                documentId: source.documentId || source.id,
                filename: source.filename || source.documentName,
                documentName: source.documentName || source.filename,
                mimeType: source.mimeType || 'application/octet-stream',
                size: source.size || source.fileSize,
                fileSize: source.fileSize || source.size,
                folderPath: source.folderPath
              }}
              onClick={onDocumentClick}
            />
          ))}
        </div>
      )}

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-4px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};

export default DocumentSources;
