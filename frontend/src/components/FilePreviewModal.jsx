import React, { useState } from 'react';
import PropTypes from 'prop-types';
import ReactMarkdown from 'react-markdown';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import '../styles/FilePreviewModal.css';

// Set up PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

/**
 * File Preview Modal
 * Displays created files with preview and download/save options
 */
const FilePreviewModal = ({ file, isOpen, onClose, onSave, onDownload }) => {
  const [numPages, setNumPages] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);

  if (!isOpen || !file) return null;

  const onDocumentLoadSuccess = ({ numPages }) => {
    setNumPages(numPages);
  };

  const renderPreview = () => {
    const fileType = file.type?.toLowerCase();

    switch (fileType) {
      case 'md':
      case 'markdown':
        return (
          <div className="markdown-preview prose max-w-none p-6 bg-white dark:bg-gray-800 overflow-auto" style={{ maxHeight: '60vh' }}>
            <ReactMarkdown>{file.content || 'Loading...'}</ReactMarkdown>
          </div>
        );

      case 'pdf':
        return (
          <div className="pdf-preview flex flex-col items-center bg-gray-100 dark:bg-gray-900 p-4" style={{ maxHeight: '60vh', overflow: 'auto' }}>
            <Document
              file={file.previewUrl || file.url}
              onLoadSuccess={onDocumentLoadSuccess}
              loading={<div className="text-center py-8">Loading PDF...</div>}
            >
              <Page pageNumber={pageNumber} />
            </Document>
            {numPages && (
              <div className="mt-4 flex items-center gap-4">
                <button
                  onClick={() => setPageNumber(Math.max(1, pageNumber - 1))}
                  disabled={pageNumber <= 1}
                  className="px-3 py-1 bg-blue-500 text-white rounded disabled:opacity-50"
                >
                  Previous
                </button>
                <span className="text-sm">
                  Page {pageNumber} of {numPages}
                </span>
                <button
                  onClick={() => setPageNumber(Math.min(numPages, pageNumber + 1))}
                  disabled={pageNumber >= numPages}
                  className="px-3 py-1 bg-blue-500 text-white rounded disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        );

      case 'docx':
      case 'pptx':
      case 'xlsx':
        return (
          <div className="office-preview p-6 text-center bg-white dark:bg-gray-800">
            <div className="flex flex-col items-center justify-center" style={{ minHeight: '40vh' }}>
              <div className="text-6xl mb-4">
                {fileType === 'docx' && '📄'}
                {fileType === 'pptx' && '📊'}
                {fileType === 'xlsx' && '📈'}
              </div>
              <h3 className="text-xl font-semibold mb-2 dark:text-white">{file.name}</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                {fileType === 'docx' && 'Microsoft Word Document'}
                {fileType === 'pptx' && 'Microsoft PowerPoint Presentation'}
                {fileType === 'xlsx' && 'Microsoft Excel Spreadsheet'}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-500 mb-6">
                Preview not available for this file type.<br />
                Download to view the complete document.
              </p>
              <button
                onClick={onDownload}
                className="px-6 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
              >
                ⬇️ Download to View
              </button>
            </div>
          </div>
        );

      default:
        return (
          <div className="p-6 text-center bg-white dark:bg-gray-800">
            <p className="text-gray-600 dark:text-gray-400">Preview not available for this file type.</p>
          </div>
        );
    }
  };

  const getFileIcon = (type) => {
    const icons = {
      md: '📝',
      markdown: '📝',
      docx: '📄',
      pdf: '📕',
      pptx: '📊',
      xlsx: '📈'
    };
    return icons[type?.toLowerCase()] || '📁';
  };

  const getFileTypeLabel = (type) => {
    const labels = {
      md: 'MARKDOWN',
      markdown: 'MARKDOWN',
      docx: 'WORD',
      pdf: 'PDF',
      pptx: 'POWERPOINT',
      xlsx: 'EXCEL'
    };
    return labels[type?.toLowerCase()] || type?.toUpperCase();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <span className="text-3xl">{getFileIcon(file.type)}</span>
            <div>
              <h2 className="text-xl font-semibold dark:text-white">{file.name}</h2>
              <span className="inline-block mt-1 px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 text-xs font-medium rounded">
                {getFileTypeLabel(file.type)}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-2xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Preview Body */}
        <div className="flex-1 overflow-auto">
          {renderPreview()}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onDownload}
            className="px-6 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg transition-colors flex items-center gap-2"
          >
            <span>⬇️</span> Download
          </button>
          <button
            onClick={onSave}
            className="px-6 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors flex items-center gap-2"
          >
            <span>💾</span> Save to Files
          </button>
          <button
            onClick={onClose}
            className="px-6 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

FilePreviewModal.propTypes = {
  file: PropTypes.shape({
    id: PropTypes.string,
    name: PropTypes.string.isRequired,
    type: PropTypes.string.isRequired,
    url: PropTypes.string,
    previewUrl: PropTypes.string,
    content: PropTypes.string,
    size: PropTypes.number
  }),
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onSave: PropTypes.func.isRequired,
  onDownload: PropTypes.func.isRequired
};

export default FilePreviewModal;
