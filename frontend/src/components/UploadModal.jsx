import React, { useState, useRef } from 'react';
import { ReactComponent as CloseIcon } from '../assets/x-close.svg';
import { useDocuments } from '../context/DocumentsContext';
import UniversalAddToCategoryModal from './UniversalAddToCategoryModal';
import CreateCategoryModal from './CreateCategoryModal';
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

const UploadModal = ({ isOpen, onClose, categoryId, onUploadComplete }) => {
  // Get context functions for optimistic uploads
  const { addDocument, moveToFolder, createFolder } = useDocuments();

  const [uploadState, setUploadState] = useState('initial'); // 'initial', 'uploading', 'complete'
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [uploadProgress, setUploadProgress] = useState({});
  const [uploadedDocuments, setUploadedDocuments] = useState([]); // Store uploaded document IDs
  const [showAddToCategory, setShowAddToCategory] = useState(false);
  const [showCreateCategory, setShowCreateCategory] = useState(false);
  const fileInputRef = useRef(null);
  const folderInputRef = useRef(null);

  const handleFileSelect = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    console.log('Files selected:', files);

    // Extract folder paths for files with webkitRelativePath
    const filesWithPaths = files.map(file => ({
      file,
      relativePath: file.webkitRelativePath || file.name
    }));

    const newFiles = filesWithPaths.filter(item =>
      !selectedFiles.find(f => f.relativePath === item.relativePath)
    );

    setSelectedFiles(prev => [...prev, ...newFiles]);

    // Initialize progress for each file
    setUploadProgress(prev => {
      const newProgress = { ...prev };
      newFiles.forEach(item => {
        newProgress[item.relativePath] = 0;
      });
      return newProgress;
    });

    // Switch to uploading state
    setUploadState('uploading');

    // Reset file input value to allow selecting the same file again
    e.target.value = '';

    // Start uploading the new files immediately
    uploadFiles(newFiles);
  };

  const uploadFiles = async (filesToUpload) => {
    console.log(`🚀 Starting parallel upload for ${filesToUpload.length} files`);

    let allCompleted = true;
    const BATCH_SIZE = 5; // Upload 5 files at a time for optimal performance

    // Helper function to upload a single file using context (optimistic!)
    const uploadSingleFile = async (item) => {
      const { file, relativePath } = item;

      try {
        console.log(`📤 Uploading: ${file.name} (${formatFileSize(file.size)})`);

        // Update progress to show starting
        setUploadProgress(prev => ({
          ...prev,
          [relativePath]: 10
        }));

        // Use context's addDocument for optimistic upload (file appears in UI instantly!)
        const newDocument = await addDocument(file, categoryId);

        console.log(`✅ Completed: ${file.name}`);
        setUploadProgress(prev => ({
          ...prev,
          [relativePath]: 100
        }));

        // Store uploaded document info
        if (newDocument) {
          setUploadedDocuments(prev => [...prev, newDocument]);
        }

        return { success: true, file: file.name };
      } catch (error) {
        console.error(`❌ Failed: ${file.name}`, error);
        allCompleted = false;
        setUploadProgress(prev => ({
          ...prev,
          [relativePath]: -1 // -1 indicates error
        }));
        alert(`Upload failed for ${file.name}\n\nError: ${error.message || 'Unknown error'}`);
        return { success: false, file: file.name, error };
      }
    };

    // Upload files in batches (5 at a time) for optimal performance
    for (let i = 0; i < filesToUpload.length; i += BATCH_SIZE) {
      const batch = filesToUpload.slice(i, i + BATCH_SIZE);
      console.log(`📦 Processing batch ${Math.floor(i / BATCH_SIZE) + 1} of ${Math.ceil(filesToUpload.length / BATCH_SIZE)} (${batch.length} files)`);

      // Upload all files in this batch simultaneously
      await Promise.all(batch.map(item => uploadSingleFile(item)));
    }

    // Check if all files are uploaded
    if (allCompleted) {
      console.log(`✅ All ${filesToUpload.length} files uploaded successfully!`);
      setTimeout(() => {
        setUploadState('complete');
      }, 500);
    } else {
      console.warn('⚠️ Some uploads failed. Please check the errors above.');
    }
  };

  const handleUploadAll = async () => {
    // Upload any remaining files that haven't been uploaded
    const remainingFiles = selectedFiles.filter(item =>
      !uploadProgress[item.relativePath] || uploadProgress[item.relativePath] < 100
    );

    if (remainingFiles.length > 0) {
      await uploadFiles(remainingFiles);
    } else {
      setUploadState('complete');
    }
  };

  const handleAcceptAll = () => {
    if (onUploadComplete) {
      onUploadComplete();
    }
    handleClose();
  };

  const handleClose = () => {
    setUploadState('initial');
    setSelectedFiles([]);
    setUploadProgress({});
    onClose();
  };

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
      zIndex: 1000
    }}>
      <div style={{
        width: '100%',
        maxWidth: 540,
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
          justifyContent: 'space-between',
          alignItems: 'center',
          display: 'flex'
        }}>
          <div style={{
            flexDirection: 'column',
            justifyContent: 'flex-start',
            alignItems: 'center',
            gap: 12,
            display: 'flex'
          }}>
            <div style={{
              width: 304,
              textAlign: 'center',
              color: '#32302C',
              fontSize: uploadState === 'initial' ? 20 : 18,
              fontFamily: 'Plus Jakarta Sans',
              fontWeight: '700',
              textTransform: 'capitalize',
              lineHeight: uploadState === 'initial' ? '30px' : '26px'
            }}>
              {uploadState === 'initial' && 'Upload Documents'}
              {uploadState === 'uploading' && `Uploading ${selectedFiles.length} file${selectedFiles.length > 1 ? 's' : ''}`}
              {uploadState === 'complete' && `${selectedFiles.length} upload${selectedFiles.length > 1 ? 's' : ''} Complete`}
            </div>
          </div>
        </div>

        {/* Close button */}
        <button
          onClick={handleClose}
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
            cursor: 'pointer'
          }}
        >
          <CloseIcon style={{ width: 12, height: 12 }} />
        </button>

        <div style={{ alignSelf: 'stretch', height: 1, background: '#E6E6EC' }} />

        {/* Content Area */}
        <div style={{
          alignSelf: 'stretch',
          paddingLeft: 18,
          paddingRight: 18,
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          display: 'flex'
        }}>
          {/* Initial State - Upload Area */}
          {uploadState === 'initial' && (
            <div
              onClick={() => fileInputRef.current?.click()}
              style={{
                alignSelf: 'stretch',
                height: 420,
                paddingLeft: 40,
                paddingRight: 40,
                paddingTop: 60,
                paddingBottom: 60,
                background: '#F5F5F5',
                overflow: 'hidden',
                borderRadius: 20,
                outline: '2px rgba(108, 107, 110, 0.40) solid',
                outlineOffset: '-2px',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                gap: 32,
                display: 'flex',
                cursor: 'pointer'
              }}
            >
              {/* Document Icon */}
              <div style={{ width: 85.38, height: 80, position: 'relative' }}>
                <div style={{
                  width: 72.95,
                  height: 61.73,
                  paddingTop: 9.62,
                  paddingBottom: 7.22,
                  paddingLeft: 3.78,
                  paddingRight: 3.78,
                  left: 6.22,
                  top: 8.76,
                  position: 'absolute',
                  background: 'white',
                  boxShadow: '0px 1.6px 1.6px 1.2px rgba(68, 68, 68, 0.16)',
                  overflow: 'hidden',
                  borderRadius: 4.13,
                  outline: '0.34px #EDEDED solid',
                  outlineOffset: '-0.34px',
                  flexDirection: 'column',
                  justifyContent: 'flex-start',
                  alignItems: 'flex-start',
                  gap: 1.60,
                  display: 'flex'
                }}>
                  <div style={{ width: 64.40, height: 2.41, background: '#E2E2E0', borderRadius: 6.41 }} />
                  <div style={{ width: 25.89, height: 2.41, background: '#E2E2E0', borderRadius: 6.41 }} />
                </div>
                <div style={{
                  width: 85.38,
                  height: 51.75,
                  left: 0,
                  top: 28.25,
                  position: 'absolute',
                  background: 'linear-gradient(180deg, rgba(67, 67, 67, 0.60) 0%, rgba(0, 0, 0, 0.60) 66%)',
                  boxShadow: '0px 0.38px 1.5px rgba(255, 255, 255, 0.25) inset',
                  backdropFilter: 'blur(9.38px)',
                  borderRadius: 4
                }} />
              </div>

              {/* Text */}
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
                    Upload Documents or Drag-n-drop
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
                  Upload your first document         All file types supported (max 15MB)
                </div>
              </div>

              {/* Select Files/Folder Buttons */}
              <div style={{
                width: 340,
                borderRadius: 12,
                justifyContent: 'center',
                alignItems: 'flex-start',
                gap: 8,
                display: 'flex'
              }}>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    fileInputRef.current?.click();
                  }}
                  style={{
                    flex: 1,
                    height: 52,
                    paddingLeft: 18,
                    paddingRight: 18,
                    paddingTop: 10,
                    paddingBottom: 10,
                    background: 'white',
                    overflow: 'hidden',
                    borderRadius: 14,
                    outline: '1px #E6E6EC solid',
                    outlineOffset: '-1px',
                    justifyContent: 'center',
                    alignItems: 'center',
                    gap: 8,
                    display: 'flex',
                    border: 'none',
                    cursor: 'pointer',
                    color: '#323232',
                    fontSize: 16,
                    fontFamily: 'Plus Jakarta Sans',
                    fontWeight: '600',
                    textTransform: 'capitalize',
                    lineHeight: '24px'
                  }}>
                  Select Files
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    folderInputRef.current?.click();
                  }}
                  style={{
                    flex: 1,
                    height: 52,
                    paddingLeft: 18,
                    paddingRight: 18,
                    paddingTop: 10,
                    paddingBottom: 10,
                    background: 'white',
                    overflow: 'hidden',
                    borderRadius: 14,
                    outline: '1px #E6E6EC solid',
                    outlineOffset: '-1px',
                    justifyContent: 'center',
                    alignItems: 'center',
                    gap: 8,
                    display: 'flex',
                    border: 'none',
                    cursor: 'pointer',
                    color: '#323232',
                    fontSize: 16,
                    fontFamily: 'Plus Jakarta Sans',
                    fontWeight: '600',
                    textTransform: 'capitalize',
                    lineHeight: '24px'
                  }}>
                  Select Folder
                </button>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                multiple
                onChange={handleFileSelect}
                style={{ display: 'none' }}
              />
              <input
                ref={folderInputRef}
                type="file"
                webkitdirectory=""
                directory=""
                multiple
                onChange={handleFileSelect}
                style={{ display: 'none' }}
              />
            </div>
          )}

          {/* Uploading State - Upload Area + File List */}
          {uploadState === 'uploading' && (
            <>
              {/* Upload Area */}
              <div
                style={{
                  alignSelf: 'stretch',
                  height: 420,
                  paddingLeft: 40,
                  paddingRight: 40,
                  paddingTop: 60,
                  paddingBottom: 60,
                  background: '#F5F5F5',
                  overflow: 'hidden',
                  borderRadius: 20,
                  outline: '2px rgba(108, 107, 110, 0.40) solid',
                  outlineOffset: '-2px',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  alignItems: 'center',
                  gap: 32,
                  display: 'flex'
                }}
              >
                {/* Document Icon */}
                <div style={{ width: 85.38, height: 80, position: 'relative' }}>
                  <div style={{
                    width: 72.95,
                    height: 61.73,
                    paddingTop: 9.62,
                    paddingBottom: 7.22,
                    paddingLeft: 3.78,
                    paddingRight: 3.78,
                    left: 6.22,
                    top: 8.76,
                    position: 'absolute',
                    background: 'white',
                    boxShadow: '0px 1.6px 1.6px 1.2px rgba(68, 68, 68, 0.16)',
                    overflow: 'hidden',
                    borderRadius: 4.13,
                    outline: '0.34px #EDEDED solid',
                    outlineOffset: '-0.34px',
                    flexDirection: 'column',
                    justifyContent: 'flex-start',
                    alignItems: 'flex-start',
                    gap: 1.60,
                    display: 'flex'
                  }}>
                    <div style={{ width: 64.40, height: 2.41, background: '#E2E2E0', borderRadius: 6.41 }} />
                    <div style={{ width: 25.89, height: 2.41, background: '#E2E2E0', borderRadius: 6.41 }} />
                  </div>
                  <div style={{
                    width: 85.38,
                    height: 51.75,
                    left: 0,
                    top: 28.25,
                    position: 'absolute',
                    background: 'linear-gradient(180deg, rgba(67, 67, 67, 0.60) 0%, rgba(0, 0, 0, 0.60) 66%)',
                    boxShadow: '0px 0.38px 1.5px rgba(255, 255, 255, 0.25) inset',
                    backdropFilter: 'blur(9.38px)',
                    borderRadius: 4
                  }} />
                </div>

                {/* Text */}
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
                      Upload Documents or Drag-n-drop
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
                    Upload your first document         All file types supported (max 15MB)
                  </div>
                </div>

                {/* Select Files Button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    fileInputRef.current?.click();
                  }}
                  style={{
                    width: 166,
                    height: 52,
                    paddingLeft: 18,
                    paddingRight: 18,
                    paddingTop: 10,
                    paddingBottom: 10,
                    background: 'white',
                    overflow: 'hidden',
                    borderRadius: 14,
                    outline: '1px #E6E6EC solid',
                    outlineOffset: '-1px',
                    justifyContent: 'center',
                    alignItems: 'center',
                    gap: 8,
                    display: 'flex',
                    border: 'none',
                    cursor: 'pointer',
                    color: '#323232',
                    fontSize: 16,
                    fontFamily: 'Plus Jakarta Sans',
                    fontWeight: '600',
                    textTransform: 'capitalize',
                    lineHeight: '24px'
                  }}
                >
                  Select Files
                </button>
              </div>

              {/* File List with Progress */}
              <div style={{
                alignSelf: 'stretch',
                flexDirection: 'column',
                gap: 8,
                display: 'flex'
              }}>
                {selectedFiles.map((item, index) => {
                  const { file, relativePath } = item;
                  const progress = uploadProgress[relativePath] || 0;
                  const icon = getFileIcon(file.name);

                  return (
                    <div
                      key={index}
                      style={{
                        alignSelf: 'stretch',
                        height: 72,
                        padding: 14,
                        position: 'relative',
                        background: 'white',
                        borderRadius: 18,
                        outline: '1px #E6E6EC solid',
                        outlineOffset: '-1px',
                        justifyContent: 'flex-start',
                        alignItems: 'center',
                        gap: 12,
                        display: 'flex',
                        overflow: 'hidden'
                      }}
                    >
                      {/* Progress bar background */}
                      <div style={{
                        width: `${progress}%`,
                        height: 72,
                        left: 0,
                        top: 0,
                        position: 'absolute',
                        background: 'rgba(169, 169, 169, 0.12)',
                        borderTopLeftRadius: 18,
                        borderBottomLeftRadius: 18
                      }} />

                    <div style={{
                      flex: 1,
                      justifyContent: 'flex-start',
                      alignItems: 'center',
                      gap: 12,
                      display: 'flex',
                      position: 'relative',
                      zIndex: 1
                    }}>
                      {/* File Icon */}
                      <div style={{
                        width: 40,
                        height: 40,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        <img
                          src={icon}
                          alt={file.name}
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
                        gap: 8,
                        display: 'flex'
                      }}>
                        <div style={{
                          alignSelf: 'stretch',
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
                            {relativePath}
                          </div>
                          <div style={{
                            alignSelf: 'stretch',
                            color: '#6C6B6E',
                            fontSize: 14,
                            fontFamily: 'Plus Jakarta Sans',
                            fontWeight: '500',
                            lineHeight: '15.40px'
                          }}>
                            {formatFileSize(file.size)} – {progress}% uploaded
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Remove button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedFiles(prev => prev.filter((_, i) => i !== index));
                      }}
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
                        cursor: 'pointer'
                      }}
                    >
                      <CloseIcon style={{ width: 12, height: 12 }} />
                    </button>
                  </div>
                );
              })}
            </div>
            </>
          )}

          {/* Complete State - Uploaded Files */}
          {uploadState === 'complete' && (
            <div style={{
              alignSelf: 'stretch',
              flexDirection: 'column',
              gap: 8,
              display: 'flex',
              maxHeight: 400,
              overflowY: 'auto'
            }}>
              {selectedFiles.map((item, index) => {
                const { file, relativePath } = item;
                const icon = getFileIcon(file.name);

                return (
                  <div
                    key={index}
                    style={{
                      alignSelf: 'stretch',
                      height: 72,
                      padding: 14,
                      position: 'relative',
                      background: 'white',
                      borderRadius: 18,
                      outline: '1px #E6E6EC solid',
                      outlineOffset: '-1px',
                      justifyContent: 'flex-start',
                      alignItems: 'center',
                      gap: 12,
                      display: 'flex'
                    }}
                  >
                    <div style={{
                      flex: 1,
                      justifyContent: 'flex-start',
                      alignItems: 'center',
                      gap: 12,
                      display: 'flex'
                    }}>
                      {/* File Icon */}
                      <div style={{
                        width: 40,
                        height: 40,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        <img
                          src={icon}
                          alt={file.name}
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
                        gap: 8,
                        display: 'flex'
                      }}>
                        <div style={{
                          alignSelf: 'stretch',
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
                            {relativePath}
                          </div>
                          <div style={{
                            alignSelf: 'stretch',
                            color: '#6C6B6E',
                            fontSize: 14,
                            fontFamily: 'Plus Jakarta Sans',
                            fontWeight: '500',
                            lineHeight: '15.40px'
                          }}>
                            {formatFileSize(file.size)} – 100% uploaded
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Remove button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedFiles(prev => prev.filter((_, i) => i !== index));
                      }}
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
                        cursor: 'pointer'
                      }}
                    >
                      <CloseIcon style={{ width: 12, height: 12 }} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div style={{ alignSelf: 'stretch', height: 1, background: '#E6E6EC' }} />

        {/* Footer Buttons */}
        <div style={{
          alignSelf: 'stretch',
          paddingLeft: 18,
          paddingRight: 18,
          justifyContent: 'flex-start',
          alignItems: 'flex-start',
          gap: 8,
          display: 'flex'
        }}>
          {uploadState === 'initial' && (
            <div style={{
              flex: '1 1 0',
              height: 52,
              borderRadius: 14,
              justifyContent: 'flex-start',
              alignItems: 'flex-start',
              display: 'flex'
            }}>
              <button
                onClick={handleClose}
                style={{
                  flex: '1 1 0',
                  height: 52,
                  background: '#181818',
                  overflow: 'hidden',
                  borderRadius: 14,
                  justifyContent: 'center',
                  alignItems: 'center',
                  gap: 8,
                  display: 'flex',
                  border: 'none',
                  cursor: 'pointer'
                }}
              >
                <div style={{
                  color: 'white',
                  fontSize: 16,
                  fontFamily: 'Plus Jakarta Sans',
                  fontWeight: '600',
                  textTransform: 'capitalize',
                  lineHeight: '24px'
                }}>
                  Cancel
                </div>
              </button>
            </div>
          )}

          {uploadState === 'uploading' && (
            <>
              <div style={{
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
                display: 'flex'
              }}>
                <button
                  onClick={handleClose}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    color: '#323232',
                    fontSize: 16,
                    fontFamily: 'Plus Jakarta Sans',
                    fontWeight: '700',
                    textTransform: 'capitalize',
                    lineHeight: '24px'
                  }}
                >
                  Cancel
                </button>
              </div>
              <button
                onClick={handleUploadAll}
                style={{
                  flex: '1 1 0',
                  height: 52,
                  background: '#181818',
                  overflow: 'hidden',
                  borderRadius: 14,
                  justifyContent: 'center',
                  alignItems: 'center',
                  gap: 8,
                  display: 'flex',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'white',
                  fontSize: 16,
                  fontFamily: 'Plus Jakarta Sans',
                  fontWeight: '600',
                  textTransform: 'capitalize',
                  lineHeight: '24px'
                }}
              >
                Upload All
              </button>
            </>
          )}

          {uploadState === 'complete' && (
            <>
              <div style={{
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
                display: 'flex'
              }}>
                <button
                  onClick={() => setShowAddToCategory(true)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    color: '#323232',
                    fontSize: 16,
                    fontFamily: 'Plus Jakarta Sans',
                    fontWeight: '700',
                    textTransform: 'capitalize',
                    lineHeight: '24px'
                  }}
                >
                  Add to Category
                </button>
              </div>
              <div style={{
                flex: '1 1 0',
                height: 52,
                borderRadius: 14,
                justifyContent: 'flex-start',
                alignItems: 'flex-start',
                display: 'flex'
              }}>
                <button
                  onClick={handleAcceptAll}
                  style={{
                    flex: '1 1 0',
                    height: 52,
                    background: '#181818',
                    overflow: 'hidden',
                    borderRadius: 14,
                    justifyContent: 'center',
                    alignItems: 'center',
                    gap: 8,
                    display: 'flex',
                    border: 'none',
                    cursor: 'pointer'
                  }}
                >
                  <div style={{
                    color: 'white',
                    fontSize: 16,
                    fontFamily: 'Plus Jakarta Sans',
                    fontWeight: '600',
                    textTransform: 'capitalize',
                    lineHeight: '24px'
                  }}>
                    Accept All
                  </div>
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Add to Category Modal */}
      <UniversalAddToCategoryModal
        isOpen={showAddToCategory}
        onClose={() => setShowAddToCategory(false)}
        uploadedDocuments={uploadedDocuments}
        onCategorySelected={async (categoryId) => {
          // Move all uploaded documents to the selected category using context (instant!)
          try {
            await Promise.all(
              uploadedDocuments.map(doc =>
                moveToFolder(doc.id, categoryId)
              )
            );
            setShowAddToCategory(false);
            if (onUploadComplete) {
              onUploadComplete();
            }
            handleClose();
          } catch (error) {
            console.error('Failed to move documents:', error);
            alert('Failed to add documents to category');
          }
        }}
        onCreateNew={() => {
          setShowAddToCategory(false);
          setShowCreateCategory(true);
        }}
      />

      {/* Create Category Modal */}
      <CreateCategoryModal
        isOpen={showCreateCategory}
        onClose={() => setShowCreateCategory(false)}
        uploadedDocuments={uploadedDocuments}
        onCreateCategory={async (categoryData) => {
          try {
            // Create the category using context (instant!)
            const newCategory = await createFolder(categoryData.name, categoryData.emoji);

            // Move selected documents to the new category using context (instant!)
            if (categoryData.selectedDocuments && categoryData.selectedDocuments.length > 0) {
              await Promise.all(
                categoryData.selectedDocuments.map(docId =>
                  moveToFolder(docId, newCategory.id)
                )
              );
            }

            setShowCreateCategory(false);
            if (onUploadComplete) {
              onUploadComplete();
            }
            handleClose();
          } catch (error) {
            console.error('Failed to create category:', error);
            alert('Failed to create category: ' + (error.message || 'Unknown error'));
          }
        }}
      />
    </div>
  );
};

export default UploadModal;
