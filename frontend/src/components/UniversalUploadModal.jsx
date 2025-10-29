import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { ReactComponent as CloseIcon } from '../assets/x-close.svg';
import { ReactComponent as FolderIcon } from '../assets/folder_icon.svg';
import { useDocuments } from '../context/DocumentsContext';
import api from '../services/api';
import { generateThumbnail, supportsThumbnail } from '../utils/thumbnailGenerator';
import folderUploadService from '../services/folderUploadService';
import pdfIcon from '../assets/pdf-icon.svg';
import docIcon from '../assets/doc-icon.svg';
import txtIcon from '../assets/txt-icon.svg';
import xlsIcon from '../assets/xls.svg';
import pptxIcon from '../assets/pptx.svg';
import jpgIcon from '../assets/jpg-icon.svg';
import pngIcon from '../assets/png-icon.svg';
import movIcon from '../assets/mov.svg';
import mp4Icon from '../assets/mp4.svg';
import mp3Icon from '../assets/mp3.svg';
import folderIcon from '../assets/folder_icon.svg';

const UniversalUploadModal = ({ isOpen, onClose, categoryId = null, onUploadComplete }) => {
  // Get context functions for optimistic uploads
  const { addDocument, createFolder, fetchFolders } = useDocuments();

  const [uploadingFiles, setUploadingFiles] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [folderUploadProgress, setFolderUploadProgress] = useState(null);
  const [showErrorBanner, setShowErrorBanner] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const folderInputRef = React.useRef(null);

  const onDrop = useCallback((acceptedFiles) => {
    const newFiles = acceptedFiles.map(file => ({
      file,
      id: Math.random().toString(36).substr(2, 9),
      status: 'pending',
      progress: 0,
      error: null,
      path: file.path || file.name, // Preserve folder structure
      folderPath: file.path ? file.path.substring(0, file.path.lastIndexOf('/')) : null
    }));
    setUploadingFiles(prev => [...prev, ...newFiles]);
  }, []);

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'application/vnd.ms-excel': ['.xls'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-powerpoint': ['.ppt'],
      'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx'],
      'text/plain': ['.txt'],
      'text/csv': ['.csv'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
      'image/gif': ['.gif'],
      'image/webp': ['.webp'],
      'video/mp4': ['.mp4'],
      'video/mpeg': ['.mpeg', '.mpg'],
      'audio/mpeg': ['.mp3'],
      'audio/wav': ['.wav'],
    },
    maxSize: 500 * 1024 * 1024, // 500MB
    multiple: true,
    noClick: true, // Disable click on root div, we'll use manual button
  });

  const formatFileSize = (bytes) => {
    if (!bytes) return '0 B';
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  const getFileIcon = (filename) => {
    const ext = filename.toLowerCase();
    if (ext.match(/\.(pdf)$/)) return pdfIcon;
    if (ext.match(/\.(doc|docx)$/)) return docIcon;
    if (ext.match(/\.(txt|csv)$/)) return txtIcon;
    if (ext.match(/\.(xls|xlsx)$/)) return xlsIcon;
    if (ext.match(/\.(ppt|pptx)$/)) return pptxIcon;
    if (ext.match(/\.(jpg|jpeg)$/)) return jpgIcon;
    if (ext.match(/\.(png|gif|webp)$/)) return pngIcon;
    if (ext.match(/\.(mov)$/)) return movIcon;
    if (ext.match(/\.(mp4)$/)) return mp4Icon;
    if (ext.match(/\.(mp3)$/)) return mp3Icon;
    return folderIcon; // Default fallback icon
  };

  const removeFile = (fileId) => {
    setUploadingFiles(prev => prev.filter(f => f.id !== fileId));
  };

  const handleUploadAll = async () => {
    const pendingFiles = uploadingFiles.filter(f => f.status === 'pending');
    if (pendingFiles.length === 0) return;

    setIsUploading(true);

    // Check if this is a folder upload (files have webkitRelativePath)
    const isFolderUpload = pendingFiles.some(f => f.file.webkitRelativePath);

    if (isFolderUpload) {
      // Use FolderUploadService for lightning-fast parallel processing
      console.log('🚀 Detected folder upload - using parallel processing');

      try {
        const files = pendingFiles.map(f => f.file);

        // Mark all as uploading
        setUploadingFiles(prev => prev.map(f =>
          f.status === 'pending' ? { ...f, status: 'uploading' } : f
        ));

        const results = await folderUploadService.uploadFolder(files, (progress) => {
          setFolderUploadProgress(progress);

          // Update individual file progress based on overall progress
          if (progress.stage === 'uploading') {
            const uploadedCount = progress.uploaded || 0;
            const totalCount = progress.total || files.length;

            setUploadingFiles(prev => prev.map((f, idx) => {
              if (idx < uploadedCount) {
                return { ...f, status: 'completed', progress: 100 };
              } else if (f.status === 'uploading') {
                return { ...f, progress: 50 };
              }
              return f;
            }));
          }
        }, categoryId);

        console.log('✅ Folder upload complete:', results);

        // Mark all as completed
        setUploadingFiles(prev => prev.map(f => ({
          ...f,
          status: 'completed',
          progress: 100
        })));

        setFolderUploadProgress({ stage: 'complete', message: 'Upload complete!', percentage: 100 });

        // Refresh folders to show updated counts
        await fetchFolders();
      } catch (error) {
        console.error('❌ Error uploading folder:', error);
        const message = error.response?.data?.message || error.message || 'Upload failed. Please check your connection and try again.';
        setErrorMessage(message);
        setShowErrorBanner(true);
        setFolderUploadProgress(null);
        setTimeout(() => {
          setShowErrorBanner(false);
          setErrorMessage('');
        }, 8000);
      }
    } else {
      // Regular file upload (not a folder)
      // Mark all as uploading
      setUploadingFiles(prev => prev.map(f =>
        f.status === 'pending' ? { ...f, status: 'uploading' } : f
      ));

      // Upload each file using context (optimistic - appears in UI instantly!)
      for (let i = 0; i < uploadingFiles.length; i++) {
        const item = uploadingFiles[i];
        if (item.status !== 'pending') continue;

        const file = item.file;

        try {
          // Update progress
          setUploadingFiles(prev => prev.map((f, idx) =>
            idx === i ? { ...f, progress: 10 } : f
          ));

          // Use context's addDocument for optimistic upload (file appears in UI instantly!)
          await addDocument(file, categoryId);

          // Update progress
          setUploadingFiles(prev => prev.map((f, idx) =>
            idx === i ? { ...f, progress: 100 } : f
          ));

          // Mark as completed
          setUploadingFiles(prev => prev.map((f, idx) =>
            idx === i ? { ...f, status: 'completed', progress: 100 } : f
          ));

          await new Promise(resolve => setTimeout(resolve, 300));
        } catch (error) {
          console.error('❌ Error uploading file:', error);
          const message = error.response?.data?.message || error.message || 'Upload failed';
          setUploadingFiles(prev => prev.map((f, idx) =>
            idx === i ? {
              ...f,
              status: 'failed',
              error: message
            } : f
          ));
          setErrorMessage(`Failed to upload ${item.file.name}: ${message}`);
          setShowErrorBanner(true);
          setTimeout(() => {
            setShowErrorBanner(false);
            setErrorMessage('');
          }, 8000);
        }
      }
    }

    setIsUploading(false);

    if (onUploadComplete) {
      onUploadComplete();
    }

    // Check if there were any failures
    const hasFailures = uploadingFiles.some(f => f.status === 'failed');

    // Only auto-close if all uploads succeeded
    if (!hasFailures) {
      // Wait 2 seconds to let user see success, then close
      await new Promise(resolve => setTimeout(resolve, 2000));
      setUploadingFiles([]);
      setFolderUploadProgress(null);
      onClose();
    }
    // If there were failures, keep modal open so user can review errors
  };

  const handleCancel = () => {
    if (!isUploading) {
      setUploadingFiles([]);
      setFolderUploadProgress(null);
      setShowErrorBanner(false);
      setErrorMessage('');
      onClose();
    }
  };

  const handleFolderSelect = (e) => {
    const files = Array.from(e.target.files);
    if (files.length > 0) {
      onDrop(files);
    }
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10000
    }}>
      <div style={{
        width: '100%',
        maxWidth: 520,
        paddingTop: 18,
        paddingBottom: 18,
        position: 'relative',
        background: 'white',
        borderRadius: 14,
        outline: '1px #E6E6EC solid',
        outlineOffset: '-1px',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 18,
        display: 'flex'
      }}>
        {/* Header */}
        <div style={{
          alignSelf: 'stretch',
          height: 30,
          paddingLeft: 18,
          paddingRight: 18,
          justifyContent: 'flex-start',
          alignItems: 'center',
          display: 'flex'
        }}>
          <div style={{
            color: '#32302C',
            fontSize: 20,
            fontFamily: 'Plus Jakarta Sans',
            fontWeight: '700',
            textTransform: 'capitalize',
            lineHeight: '30px'
          }}>
            Upload Documents
          </div>
        </div>

        {/* Close button */}
        <button
          onClick={handleCancel}
          disabled={isUploading}
          style={{
            width: 32,
            height: 32,
            right: -16,
            top: -16,
            position: 'absolute',
            background: 'white',
            borderRadius: 100,
            outline: '1px rgba(55, 53, 47, 0.09) solid',
            outlineOffset: '-1px',
            justifyContent: 'center',
            alignItems: 'center',
            display: 'flex',
            border: 'none',
            cursor: isUploading ? 'not-allowed' : 'pointer',
            opacity: isUploading ? 0.5 : 1
          }}
        >
          <CloseIcon style={{ width: 12, height: 12 }} />
        </button>

        <div style={{ alignSelf: 'stretch', height: 1, background: '#E6E6EC' }} />

        {/* Drop zone */}
        <div style={{
          alignSelf: 'stretch',
          paddingLeft: 18,
          paddingRight: 18,
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          display: 'flex'
        }}>
          <div
            {...getRootProps()}
            style={{
              alignSelf: 'stretch',
              height: 320,
              paddingLeft: 40,
              paddingRight: 40,
              paddingTop: 60,
              paddingBottom: 60,
              background: isDragActive ? '#F0F9FF' : '#F5F5F5',
              overflow: 'hidden',
              borderRadius: 20,
              outline: isDragActive ? '2px #3B82F6 dashed' : '2px rgba(108, 107, 110, 0.40) dashed',
              outlineOffset: '-2px',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              gap: 16,
              display: 'flex',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
          >
            <input {...getInputProps()} />

            {/* Folder Icon */}
            <FolderIcon style={{ width: '120px', height: '120px', minWidth: '120px', minHeight: '120px', display: 'block' }} />

            <div style={{
              flexDirection: 'column',
              justifyContent: 'flex-start',
              alignItems: 'center',
              gap: 4,
              display: 'flex'
            }}>
              <div style={{
                alignSelf: 'stretch',
                justifyContent: 'center',
                alignItems: 'flex-start',
                gap: 6,
                display: 'flex'
              }}>
                <div style={{
                  color: '#32302C',
                  fontSize: 20,
                  fontFamily: 'Plus Jakarta Sans',
                  fontWeight: '600',
                  textTransform: 'capitalize',
                  lineHeight: '30px'
                }}>
                  {isDragActive ? 'Drop files here' : 'Upload Documents or Drag-n-drop'}
                </div>
              </div>
              <div style={{
                width: 366,
                textAlign: 'center',
                color: '#6C6B6E',
                fontSize: 16,
                fontFamily: 'Plus Jakarta Sans',
                fontWeight: '500',
                lineHeight: '24px'
              }}>
                Upload your documents • All file types supported (max 500MB)
              </div>
            </div>

            {/* Buttons Container */}
            <div style={{
              justifyContent: 'center',
              alignItems: 'center',
              gap: 12,
              display: 'flex'
            }}>
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  open();
                }}
                style={{
                  width: 166,
                  height: 52,
                  paddingLeft: 18,
                  paddingRight: 18,
                  paddingTop: 10,
                  paddingBottom: 10,
                  background: 'white',
                  borderRadius: 14,
                  outline: '1px #E6E6EC solid',
                  outlineOffset: '-1px',
                  justifyContent: 'center',
                  alignItems: 'center',
                  gap: 8,
                  display: 'flex',
                  cursor: 'pointer'
                }}
              >
                <div style={{
                  color: '#323232',
                  fontSize: 16,
                  fontFamily: 'Plus Jakarta Sans',
                  fontWeight: '600',
                  textTransform: 'capitalize',
                  lineHeight: '24px'
                }}>
                  Select Files
                </div>
              </div>

              <div
                onClick={(e) => {
                  e.stopPropagation();
                  folderInputRef.current?.click();
                }}
                style={{
                  width: 166,
                  height: 52,
                  paddingLeft: 18,
                  paddingRight: 18,
                  paddingTop: 10,
                  paddingBottom: 10,
                  background: 'white',
                  borderRadius: 14,
                  outline: '1px #E6E6EC solid',
                  outlineOffset: '-1px',
                  justifyContent: 'center',
                  alignItems: 'center',
                  gap: 8,
                  display: 'flex',
                  cursor: 'pointer'
                }}>
                <div style={{
                  color: '#323232',
                  fontSize: 16,
                  fontFamily: 'Plus Jakarta Sans',
                  fontWeight: '600',
                  textTransform: 'capitalize',
                  lineHeight: '24px'
                }}>
                  Select Folder
                </div>
              </div>
            </div>

            {/* Hidden folder input */}
            <input
              ref={folderInputRef}
              type="file"
              {...({ webkitdirectory: '', directory: '', mozdirectory: '' })}
              multiple
              onChange={handleFolderSelect}
              style={{ display: 'none' }}
            />
          </div>
        </div>

        {/* Error Banner */}
        {showErrorBanner && (
          <div style={{
            alignSelf: 'stretch',
            paddingLeft: 18,
            paddingRight: 18
          }}>
            <div style={{
              width: '100%',
              padding: 10,
              background: '#181818',
              borderRadius: 14,
              flexDirection: 'row',
              justifyContent: 'flex-start',
              alignItems: 'center',
              gap: 12,
              display: 'flex'
            }}>
              {/* Error Icon */}
              <div style={{ width: 32, height: 32, position: 'relative', flexShrink: 0 }}>
                <div style={{
                  width: 32,
                  height: 32,
                  left: 0,
                  top: 0,
                  position: 'absolute',
                  background: 'rgba(217, 45, 32, 0.60)',
                  borderRadius: 9999
                }} />
                <div style={{
                  width: 26,
                  height: 26,
                  left: 3,
                  top: 3,
                  position: 'absolute',
                  background: 'rgba(217, 45, 32, 0.60)',
                  borderRadius: 9999
                }} />
                <div style={{
                  width: 20,
                  height: 20,
                  left: 6,
                  top: 6,
                  position: 'absolute',
                  background: 'rgba(217, 45, 32, 0.60)',
                  borderRadius: 9999
                }} />
                <div style={{
                  width: 14,
                  height: 14,
                  left: 9,
                  top: 9,
                  position: 'absolute',
                  background: '#D92D20',
                  borderRadius: 9999
                }} />
              </div>
              {/* Error Message */}
              <div style={{
                flex: 1,
                color: 'white',
                fontSize: 14,
                fontFamily: 'Plus Jakarta Sans',
                fontWeight: '500',
                lineHeight: '20px'
              }}>
                {errorMessage || 'Hmm… the upload didn\'t work. Please retry.'}
              </div>
            </div>
          </div>
        )}

        {/* Folder upload progress banner */}
        {folderUploadProgress && (
          <div style={{
            alignSelf: 'stretch',
            paddingLeft: 18,
            paddingRight: 18,
            paddingTop: 16,
            paddingBottom: 16,
            background: folderUploadProgress.stage === 'error' ? '#FEE2E2' : '#F0F9FF',
            borderRadius: 14,
            flexDirection: 'column',
            gap: 8,
            display: 'flex'
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div style={{
                color: folderUploadProgress.stage === 'error' ? '#DC2626' : '#0369A1',
                fontSize: 16,
                fontFamily: 'Plus Jakarta Sans',
                fontWeight: '600',
                lineHeight: '24px'
              }}>
                {folderUploadProgress.message}
              </div>
              {folderUploadProgress.percentage !== undefined && (
                <div style={{
                  color: folderUploadProgress.stage === 'error' ? '#DC2626' : '#0369A1',
                  fontSize: 16,
                  fontFamily: 'Plus Jakarta Sans',
                  fontWeight: '700',
                  lineHeight: '24px'
                }}>
                  {folderUploadProgress.percentage}%
                </div>
              )}
            </div>
            {folderUploadProgress.stage === 'uploading' && folderUploadProgress.currentBatch && (
              <div style={{
                color: '#6C6B6E',
                fontSize: 14,
                fontFamily: 'Plus Jakarta Sans',
                fontWeight: '500',
                lineHeight: '20px'
              }}>
                Batch {folderUploadProgress.currentBatch} of {folderUploadProgress.totalBatches} • {folderUploadProgress.uploaded} of {folderUploadProgress.total} files uploaded
              </div>
            )}
            {folderUploadProgress.percentage !== undefined && folderUploadProgress.stage !== 'error' && (
              <div style={{
                width: '100%',
                height: 8,
                background: '#E0F2FE',
                borderRadius: 4,
                overflow: 'hidden'
              }}>
                <div style={{
                  width: `${folderUploadProgress.percentage}%`,
                  height: '100%',
                  background: '#0369A1',
                  transition: 'width 0.3s ease'
                }} />
              </div>
            )}
          </div>
        )}

        {/* File list */}
        {uploadingFiles.length > 0 && (
          <div style={{
            alignSelf: 'stretch',
            paddingLeft: 18,
            paddingRight: 18,
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            gap: 12,
            display: 'flex',
            maxHeight: 280,
            overflowY: 'auto'
          }}>
            {uploadingFiles.map((item) => (
              <div
                key={item.id}
                style={{
                  alignSelf: 'stretch',
                  height: 72,
                  padding: 14,
                  position: 'relative',
                  background: 'white',
                  borderRadius: 18,
                  outline: item.status === 'failed' ? '2px #EF4444 solid' : '1px #E6E6EC solid',
                  outlineOffset: '-1px',
                  justifyContent: 'flex-start',
                  alignItems: 'center',
                  gap: 12,
                  display: 'flex'
                }}
              >
                {/* Progress bar */}
                {item.status === 'uploading' && (
                  <div style={{
                    width: `${item.progress}%`,
                    height: 72,
                    left: 0,
                    top: 0,
                    position: 'absolute',
                    background: 'rgba(169, 169, 169, 0.12)',
                    borderTopLeftRadius: 18,
                    borderBottomLeftRadius: 18,
                    transition: 'width 0.3s ease'
                  }} />
                )}

                <div style={{
                  flex: 1,
                  minWidth: 0,
                  justifyContent: 'flex-start',
                  alignItems: 'center',
                  gap: 12,
                  display: 'flex',
                  position: 'relative',
                  zIndex: 1
                }}>
                  {/* File icon */}
                  <div style={{
                    width: 40,
                    height: 40,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <img
                      src={getFileIcon(item.file.name)}
                      alt={item.file.name}
                      style={{
                        width: 40,
                        height: 40,
                        objectFit: 'contain'
                      }}
                    />
                  </div>

                  <div style={{
                    flex: '1 1 0',
                    flexDirection: 'column',
                    justifyContent: 'flex-start',
                    alignItems: 'flex-start',
                    gap: 6,
                    display: 'flex'
                  }}>
                    <div style={{
                      alignSelf: 'stretch',
                      color: '#32302C',
                      fontSize: 16,
                      fontFamily: 'Plus Jakarta Sans',
                      fontWeight: '600',
                      lineHeight: '22.40px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}>
                      {item.file.name}
                    </div>
                    <div style={{
                      alignSelf: 'stretch',
                      color: item.status === 'failed' ? '#EF4444' : '#6C6B6E',
                      fontSize: 14,
                      fontFamily: 'Plus Jakarta Sans',
                      fontWeight: '500',
                      lineHeight: '15.40px'
                    }}>
                      {item.status === 'failed'
                        ? 'Upload failed. Try again.'
                        : item.status === 'completed'
                        ? `${formatFileSize(item.file.size)} • 100% uploaded`
                        : item.status === 'uploading'
                        ? `${formatFileSize(item.file.size)} • ${item.progress}% uploaded`
                        : `${formatFileSize(item.file.size)} • ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })}`
                      }
                    </div>
                  </div>
                </div>

                {/* Remove button */}
                {item.status !== 'uploading' && (
                  <button
                    onClick={() => removeFile(item.id)}
                    style={{
                      width: 24,
                      height: 24,
                      right: -6,
                      top: -6,
                      position: 'absolute',
                      background: 'white',
                      borderRadius: 100,
                      outline: '1px rgba(55, 53, 47, 0.09) solid',
                      outlineOffset: '-1px',
                      justifyContent: 'center',
                      alignItems: 'center',
                      display: 'flex',
                      border: 'none',
                      cursor: 'pointer',
                      zIndex: 2
                    }}
                  >
                    <CloseIcon style={{ width: 12, height: 12 }} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {uploadingFiles.length > 0 && (
          <>
            <div style={{ alignSelf: 'stretch', height: 1, background: '#E6E6EC' }} />

            {/* Action buttons */}
            <div style={{
              alignSelf: 'stretch',
              paddingLeft: 18,
              paddingRight: 18,
              justifyContent: 'flex-start',
              alignItems: 'flex-start',
              gap: 8,
              display: 'flex'
            }}>
              <button
                onClick={handleCancel}
                disabled={isUploading}
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
                  justifyContent: 'center',
                  alignItems: 'center',
                  gap: 8,
                  display: 'flex',
                  border: 'none',
                  cursor: isUploading ? 'not-allowed' : 'pointer',
                  opacity: isUploading ? 0.5 : 1
                }}
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
              </button>

              <button
                onClick={handleUploadAll}
                disabled={isUploading || uploadingFiles.filter(f => f.status === 'pending').length === 0}
                style={{
                  flex: '1 1 0',
                  height: 52,
                  background: (isUploading || uploadingFiles.filter(f => f.status === 'pending').length === 0) ? '#E6E6EC' : '#181818',
                  borderRadius: 14,
                  justifyContent: 'center',
                  alignItems: 'center',
                  gap: 8,
                  display: 'flex',
                  border: 'none',
                  cursor: (isUploading || uploadingFiles.filter(f => f.status === 'pending').length === 0) ? 'not-allowed' : 'pointer'
                }}
              >
                <div style={{
                  color: (isUploading || uploadingFiles.filter(f => f.status === 'pending').length === 0) ? '#9CA3AF' : 'white',
                  fontSize: 16,
                  fontFamily: 'Plus Jakarta Sans',
                  fontWeight: '600',
                  textTransform: 'capitalize',
                  lineHeight: '24px'
                }}>
                  {isUploading ? 'Uploading...' : 'Upload'}
                </div>
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default UniversalUploadModal;
