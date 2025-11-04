import React, { useState, useCallback, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { ReactComponent as CloseIcon } from '../assets/x-close.svg';
import { ReactComponent as FolderIcon } from '../assets/folder_icon.svg';
import { ReactComponent as CheckIcon } from '../assets/check.svg';
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

const UniversalUploadModal = ({ isOpen, onClose, categoryId = null, onUploadComplete, initialFiles = null }) => {
  console.log('🟢 UniversalUploadModal RENDER - Props:', {
    isOpen,
    initialFiles,
    fileCount: initialFiles?.length,
    categoryId
  });

  // Get context functions for optimistic uploads
  const { addDocument, createFolder, refreshAll } = useDocuments();

  const [uploadingFiles, setUploadingFiles] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [folderUploadProgress, setFolderUploadProgress] = useState(null);
  const [showErrorBanner, setShowErrorBanner] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [showNotification, setShowNotification] = useState(false);
  const [notificationType, setNotificationType] = useState('success');
  const [uploadedCount, setUploadedCount] = useState(0);
  const folderInputRef = React.useRef(null);

  const onDrop = useCallback((acceptedFiles) => {
    console.log('🔵 onDrop called with files:', acceptedFiles);
    console.log('🔵 Files count:', acceptedFiles.length);

    // Separate folder files from regular files
    const folderFiles = acceptedFiles.filter(file => file.webkitRelativePath);
    const regularFiles = acceptedFiles.filter(file => !file.webkitRelativePath);

    console.log('🔵 Folder files:', folderFiles.length, 'Regular files:', regularFiles.length);

    const newEntries = [];

    // Process folder files - group by root folder name
    if (folderFiles.length > 0) {
      const folderGroups = {};

      folderFiles.forEach(file => {
        const folderName = file.webkitRelativePath.split('/')[0];
        if (!folderGroups[folderName]) {
          folderGroups[folderName] = [];
        }
        folderGroups[folderName].push(file);
      });

      // Create a folder entry for each folder
      Object.entries(folderGroups).forEach(([folderName, files]) => {
        const totalSize = files.reduce((sum, file) => sum + file.size, 0);

        newEntries.push({
          file: files[0], // Store first file as reference
          allFiles: files, // Store all files for upload
          id: Math.random().toString(36).substr(2, 9),
          status: 'pending',
          progress: 0,
          error: null,
          isFolder: true,
          folderName: folderName,
          fileCount: files.length,
          totalSize: totalSize,
          processingStage: null
        });
      });
    }

    // Process regular files - create individual entries
    if (regularFiles.length > 0) {
      regularFiles.forEach(file => {
        newEntries.push({
          file,
          id: Math.random().toString(36).substr(2, 9),
          status: 'pending',
          progress: 0,
          error: null,
          path: file.path || file.name,
          folderPath: file.path ? file.path.substring(0, file.path.lastIndexOf('/')) : null,
          isFolder: false,
          processingStage: null
        });
      });
    }

    console.log('🔵 New entries to add:', newEntries.length);
    console.log('🔵 Entries:', newEntries);
    setUploadingFiles(prev => {
      const updated = [...prev, ...newEntries];
      console.log('🔵 Updated uploadingFiles:', updated);
      return updated;
    });
  }, []);

  // Process initial files when modal opens with dropped files
  useEffect(() => {
    console.log('useEffect triggered - isOpen:', isOpen, 'initialFiles:', initialFiles);
    if (isOpen && initialFiles && initialFiles.length > 0) {
      console.log('✅ Processing dropped files:', initialFiles);
      console.log('Files count:', initialFiles.length);
      onDrop(initialFiles);
      console.log('✅ onDrop called');
    } else {
      console.log('❌ Condition not met - isOpen:', isOpen, 'initialFiles length:', initialFiles?.length);
    }
  }, [isOpen, initialFiles, onDrop]);

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
    if (!filename) return folderIcon;
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

    // Separate folder entries from regular file entries
    const folderEntries = pendingFiles.filter(f => f.isFolder);
    const fileEntries = pendingFiles.filter(f => !f.isFolder);

    let totalSuccessCount = 0;
    let totalFailureCount = 0;

    try {
      // Process folders using folderUploadService
      if (folderEntries.length > 0) {
        console.log('🚀 Uploading folders using parallel processing');

        for (const folderEntry of folderEntries) {
          try {
            // Mark folder as uploading
            setUploadingFiles(prev => prev.map(f =>
              f.id === folderEntry.id ? { ...f, status: 'uploading' } : f
            ));

            // Track stage timing to ensure minimum display time
            let lastStageTime = Date.now();
            const minStageDisplayTime = 600;

            const results = await folderUploadService.uploadFolder(
              folderEntry.allFiles,
              async (progress) => {
                // Ensure minimum display time for previous stage
                const elapsed = Date.now() - lastStageTime;
                if (elapsed < minStageDisplayTime) {
                  await new Promise(resolve => setTimeout(resolve, minStageDisplayTime - elapsed));
                }
                lastStageTime = Date.now();

                // Update folder entry progress
                if (progress.stage === 'analyzing') {
                  setUploadingFiles(prev => prev.map(f =>
                    f.id === folderEntry.id ? { ...f, progress: 10, processingStage: 'Preparing...' } : f
                  ));
                } else if (progress.stage === 'uploading') {
                  setUploadingFiles(prev => prev.map(f =>
                    f.id === folderEntry.id ? { ...f, progress: progress.percentage || 50, processingStage: 'Uploading to cloud...' } : f
                  ));
                } else if (progress.stage === 'complete') {
                  setUploadingFiles(prev => prev.map(f =>
                    f.id === folderEntry.id ? { ...f, progress: 95, processingStage: 'Finalizing...' } : f
                  ));
                }
              },
              categoryId
            );

            // Show finalizing stage for at least 400ms
            await new Promise(resolve => setTimeout(resolve, 400));

            // Mark folder as completed
            setUploadingFiles(prev => prev.map(f =>
              f.id === folderEntry.id ? { ...f, status: 'completed', progress: 100, processingStage: null } : f
            ));

            totalSuccessCount += results.successCount;
            totalFailureCount += results.failureCount;
          } catch (error) {
            console.error('❌ Error uploading folder:', error);
            setUploadingFiles(prev => prev.map(f =>
              f.id === folderEntry.id ? { ...f, status: 'failed', error: error.message } : f
            ));
            totalFailureCount += folderEntry.fileCount;
          }
        }
      }

      // Process regular files using addDocument
      if (fileEntries.length > 0) {
        console.log('📄 Uploading regular files');

        for (const fileEntry of fileEntries) {
          try {
            // Mark file as uploading
            setUploadingFiles(prev => prev.map(f =>
              f.id === fileEntry.id ? { ...f, status: 'uploading', progress: 10, processingStage: 'Preparing...' } : f
            ));

            await new Promise(resolve => setTimeout(resolve, 500));

            // Update to uploading stage
            setUploadingFiles(prev => prev.map(f =>
              f.id === fileEntry.id ? { ...f, progress: 30, processingStage: 'Uploading to cloud...' } : f
            ));

            // Use context's addDocument for optimistic upload
            console.log('📤 Starting upload for:', fileEntry.file.name);
            const uploadedDoc = await addDocument(fileEntry.file, categoryId);
            console.log('✅ Upload complete, document:', uploadedDoc);
            await new Promise(resolve => setTimeout(resolve, 800));

            // Update to finalizing stage
            setUploadingFiles(prev => prev.map(f =>
              f.id === fileEntry.id ? { ...f, progress: 95, processingStage: 'Finalizing...' } : f
            ));

            await new Promise(resolve => setTimeout(resolve, 400));

            // Mark as completed
            setUploadingFiles(prev => prev.map(f =>
              f.id === fileEntry.id ? { ...f, status: 'completed', progress: 100, processingStage: null } : f
            ));

            totalSuccessCount++;
            console.log('✅ Success count:', totalSuccessCount);
          } catch (error) {
            console.error('❌ Error uploading file:', error);
            console.error('❌ Error details:', {
              message: error.message,
              response: error.response?.data,
              status: error.response?.status
            });
            const message = error.response?.data?.message || error.message || 'Upload failed';
            setUploadingFiles(prev => prev.map(f =>
              f.id === fileEntry.id ? { ...f, status: 'failed', error: message } : f
            ));
            setErrorMessage(`Failed to upload ${fileEntry.file.name}: ${message}`);
            setShowErrorBanner(true);
            setTimeout(() => {
              setShowErrorBanner(false);
              setErrorMessage('');
            }, 8000);
            totalFailureCount++;
            console.log('❌ Failure count:', totalFailureCount);
          }
        }
      }

      // Show success notification
      if (totalSuccessCount > 0) {
        setUploadedCount(totalSuccessCount);
        setNotificationType('success');
        setShowNotification(true);
        setTimeout(() => setShowNotification(false), 5000);
      }

      // Show error notification
      if (totalFailureCount > 0) {
        setNotificationType('error');
        setShowNotification(true);
        setTimeout(() => setShowNotification(false), 5000);
      }

      // Refresh folders and documents to show updated data
      console.log('🔄 Refreshing documents after upload...');
      await refreshAll();
      console.log('✅ Documents refreshed!');
    } catch (error) {
      console.error('❌ Unexpected error during upload:', error);
      setErrorMessage(error.message || 'Upload failed');
      setShowErrorBanner(true);
      setTimeout(() => {
        setShowErrorBanner(false);
        setErrorMessage('');
      }, 8000);
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
      // Add webkitRelativePath to ensure proper folder detection
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

        {/* Folder upload progress banner - HIDDEN (progress shown on individual files) */}

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
                {/* Progress bar - Only show during upload */}
                {item.status === 'uploading' && (
                  <>
                    <div style={{
                      width: '100%',
                      height: '100%',
                      left: 0,
                      top: 0,
                      position: 'absolute',
                      pointerEvents: 'none'
                    }}>
                      <div style={{
                        width: `${item.progress}%`,
                        height: '100%',
                        left: 0,
                        top: 0,
                        position: 'absolute',
                        background: 'rgba(169, 169, 169, 0.12)',
                        borderTopLeftRadius: 18,
                        borderBottomLeftRadius: 18,
                        transition: 'width 0.3s ease-in-out',
                        opacity: item.progress >= 100 ? 0 : 1,
                        transitionProperty: item.progress >= 100 ? 'width 0.3s ease-in-out, opacity 400ms ease-out' : 'width 0.3s ease-in-out'
                      }} />
                    </div>

                    {/* Upload percentage counter */}
                    <div style={{
                      position: 'absolute',
                      bottom: 12,
                      right: 16,
                      fontSize: 13,
                      fontWeight: '500',
                      color: '#6C6C6C',
                      zIndex: 2,
                      opacity: item.progress < 100 ? 1 : 0,
                      transition: 'opacity 0.3s ease-out'
                    }}>
                      {Math.round(item.progress)}%
                    </div>
                  </>
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
                  {/* File/Folder icon */}
                  <div style={{
                    width: 40,
                    height: 40,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <img
                      src={item.isFolder ? folderIcon : getFileIcon(item.file.name)}
                      alt={item.isFolder ? item.folderName : item.file.name}
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
                      {item.isFolder ? item.folderName : item.file.name}
                    </div>
                    <div style={{
                      alignSelf: 'stretch',
                      color: item.status === 'failed' ? '#EF4444' : (item.status === 'uploading' ? '#A0A0A0' : '#6C6B6E'),
                      fontSize: 13,
                      fontFamily: 'Plus Jakarta Sans',
                      fontWeight: '500',
                      lineHeight: '15.40px'
                    }}>
                      {item.isFolder ? (
                        // Folder status display
                        item.status === 'failed'
                          ? 'Upload failed. Try again.'
                          : item.status === 'completed'
                          ? `${formatFileSize(item.totalSize)} • ${item.fileCount} file${item.fileCount > 1 ? 's' : ''} • 100% uploaded`
                          : item.status === 'uploading'
                          ? 'Uploading to cloud...'
                          : `${formatFileSize(item.totalSize)} • ${item.fileCount} file${item.fileCount > 1 ? 's' : ''} • ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })}`
                      ) : (
                        // File status display
                        item.status === 'failed'
                          ? 'Upload failed. Try again.'
                          : item.status === 'completed'
                          ? `${formatFileSize(item.file.size)} • 100% uploaded`
                          : item.status === 'uploading'
                          ? 'Uploading to cloud...'
                          : `${formatFileSize(item.file.size)} • ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })}`
                      )}
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

      {/* Success/Error Notification */}
      {showNotification && (uploadedCount > 0 || notificationType === 'error') && (
        <div style={{
          position: 'fixed',
          top: 20,
          left: '50%',
          transform: 'translateX(-50%)',
          width: 'calc(100% - 700px)',
          maxWidth: '960px',
          minWidth: '400px',
          zIndex: 99999,
          animation: 'slideDown 0.3s ease-out'
        }}>
          <div style={{
            width: '100%',
            padding: '6px 16px',
            background: '#181818',
            borderRadius: 14,
            justifyContent: 'center',
            alignItems: 'center',
            gap: 10,
            display: 'inline-flex'
          }}>
            {notificationType === 'success' ? (
              <>
                <div style={{
                  width: 24,
                  height: 24,
                  borderRadius: '50%',
                  background: '#34A853',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  <CheckIcon style={{width: 12, height: 12}} />
                </div>
                <div style={{
                  flex: '1 1 0',
                  color: 'white',
                  fontSize: 13,
                  fontFamily: 'Plus Jakarta Sans',
                  fontWeight: '400',
                  lineHeight: '18px',
                  wordWrap: 'break-word'
                }}>
                  {uploadedCount} document{uploadedCount > 1 ? 's have' : ' has'} been successfully uploaded.
                </div>
              </>
            ) : (
              <>
                <div style={{width: 24, height: 24, position: 'relative', flexShrink: 0}}>
                  <div style={{width: 20.57, height: 20.57, left: 1.71, top: 1.71, position: 'absolute', background: 'rgba(217, 45, 32, 0.60)', borderRadius: 9999}} />
                  <div style={{width: 24, height: 24, left: 0, top: 0, position: 'absolute', background: 'rgba(217, 45, 32, 0.60)', borderRadius: 9999}} />
                  <div style={{width: 17.14, height: 17.14, left: 3.43, top: 3.43, position: 'absolute', background: '#D92D20', overflow: 'hidden', borderRadius: 8.57, outline: '1.07px #D92D20 solid', outlineOffset: '-1.07px'}}>
                    <div style={{width: 9.33, height: 9.33, left: 3.91, top: 3.91, position: 'absolute'}}>
                      <svg width="9" height="9" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M5.83333 2.5H4.16667V5.83333H5.83333V2.5ZM5.83333 7.5H4.16667V9.16667H5.83333V7.5Z" fill="white"/>
                      </svg>
                    </div>
                  </div>
                </div>
                <div style={{
                  flex: '1 1 0',
                  color: 'white',
                  fontSize: 13,
                  fontFamily: 'Plus Jakarta Sans',
                  fontWeight: '400',
                  lineHeight: '18px',
                  wordWrap: 'break-word'
                }}>
                  {errorMessage || 'Upload failed. Please try again.'}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default UniversalUploadModal;
