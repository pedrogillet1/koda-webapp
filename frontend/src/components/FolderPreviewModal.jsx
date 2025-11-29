import React from 'react';
import { X, Folder, File, ChevronRight } from 'lucide-react';
import '../styles/FolderPreviewModal.css';

function FolderPreviewModal({
  isOpen,
  onClose,
  folder,
  contents,
  onNavigateToFolder,
  onOpenFile
}) {
  if (!isOpen || !folder) return null;

  const { files = [], subfolders = [] } = contents || {};

  // Format file size
  const formatFileSize = (bytes) => {
    if (!bytes) return '0 KB';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  // Get file icon based on MIME type
  const getFileIcon = (mimeType) => {
    if (!mimeType) return '📄';
    if (mimeType.includes('pdf')) return '📕';
    if (mimeType.includes('word')) return '📘';
    if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) return '📊';
    if (mimeType.includes('powerpoint') || mimeType.includes('presentation')) return '📊';
    if (mimeType.includes('image')) return '🖼️';
    if (mimeType.includes('video')) return '🎥';
    if (mimeType.includes('audio')) return '🎵';
    return '📄';
  };

  return (
    <div className="folder-preview-overlay" onClick={onClose}>
      <div className="folder-preview-content" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="folder-preview-header">
          <div className="folder-title">
            <span className="folder-emoji">{folder.emoji || '📁'}</span>
            <h2>{folder.name}</h2>
          </div>
          <button onClick={onClose} className="close-btn" aria-label="Close">
            <X size={24} />
          </button>
        </div>

        {/* Folder Stats */}
        <div className="folder-stats">
          <span>{files.length} file{files.length !== 1 ? 's' : ''}</span>
          <span className="stat-divider">•</span>
          <span>{subfolders.length} subfolder{subfolders.length !== 1 ? 's' : ''}</span>
        </div>

        {/* Contents */}
        <div className="folder-contents">
          {/* Subfolders */}
          {subfolders.length > 0 && (
            <div className="subfolder-section">
              <h3>Subfolders</h3>
              <div className="subfolder-list">
                {subfolders.map(subfolder => (
                  <div
                    key={subfolder.id}
                    className="subfolder-item"
                    onClick={() => onNavigateToFolder(subfolder.id)}
                  >
                    <Folder size={20} className="subfolder-icon" />
                    <span className="subfolder-emoji">{subfolder.emoji || '📁'}</span>
                    <span className="subfolder-name">{subfolder.name}</span>
                    <span className="subfolder-count">
                      {subfolder.fileCount} file{subfolder.fileCount !== 1 ? 's' : ''}
                    </span>
                    <ChevronRight size={16} className="chevron" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Files */}
          {files.length > 0 && (
            <div className="file-section">
              <h3>Files</h3>
              <div className="file-list">
                {files.map(file => (
                  <div
                    key={file.id}
                    className="file-item"
                    onClick={() => onOpenFile(file.id)}
                  >
                    <span className="file-icon">{getFileIcon(file.mimeType)}</span>
                    <span className="file-name">{file.filename}</span>
                    <span className="file-size">
                      {formatFileSize(file.fileSize)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Empty State */}
          {files.length === 0 && subfolders.length === 0 && (
            <div className="empty-state">
              <Folder size={48} />
              <p>This folder is empty</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="folder-preview-footer">
          <button onClick={() => onNavigateToFolder(folder.id)} className="btn-primary">
            Go to Folder
          </button>
          <button onClick={onClose} className="btn-secondary">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default FolderPreviewModal;
