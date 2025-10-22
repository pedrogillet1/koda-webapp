import React, { useState, useEffect } from 'react';
import { useFiles } from '../context/FileContext';
import { useNavigate } from 'react-router-dom';
import { useDropzone } from 'react-dropzone';
import LeftNav from './LeftNav';
import { formatFileSize } from '../utils/crypto';
import api from '../services/api';

const Upload = () => {
    const navigate = useNavigate();
    const { files, onDrop, removeFile, isUploading } = useFiles();
    const [showNotification, setShowNotification] = useState(false);
    const [notificationType, setNotificationType] = useState('success');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [allDocuments, setAllDocuments] = useState([]);

    // Load existing documents
    useEffect(() => {
        const loadDocuments = async () => {
            try {
                const response = await api.get('/api/documents');
                const docs = response.data.documents || [];
                setAllDocuments(docs.map(doc => ({
                    id: doc.id,
                    name: doc.filename,
                    size: formatFileSize(doc.size),
                    type: doc.mimeType
                })));
            } catch (error) {
                console.error('Error loading documents:', error);
            }
        };
        loadDocuments();
    }, []);

    const { getRootProps, getInputProps, open } = useDropzone({
        onDrop: (acceptedFiles) => {
            onDrop(acceptedFiles);
            setIsModalOpen(true);
        },
        accept: {
            'application/pdf': ['.pdf'],
            'application/msword': ['.doc'],
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
            'application/vnd.ms-excel': ['.xls'],
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
            'image/jpeg': ['.jpg', '.jpeg'],
            'image/png': ['.png'],
            'image/gif': ['.gif'],
            'image/webp': ['.webp'],
            'text/plain': ['.txt'],
        },
        maxSize: 50 * 1024 * 1024,
        multiple: true,
        noClick: false,
        noKeyboard: false,
    });

    // Check upload status and show notifications
    useEffect(() => {
        const completedCount = files.filter(f => f.status === 'completed').length;
        const failedCount = files.filter(f => f.status === 'failed').length;
        const uploadingCount = files.filter(f => f.status === 'uploading').length;

        if (files.length > 0 && completedCount === files.length && uploadingCount === 0) {
            setNotificationType('success');
            setShowNotification(true);

            // Reload documents after successful upload
            const loadDocuments = async () => {
                try {
                    const response = await api.get('/api/documents');
                    const docs = response.data.documents || [];
                    setAllDocuments(docs.map(doc => ({
                        id: doc.id,
                        name: doc.filename,
                        size: formatFileSize(doc.size),
                        type: doc.mimeType
                    })));
                } catch (error) {
                    console.error('Error loading documents:', error);
                }
            };
            loadDocuments();

            setTimeout(() => {
                setShowNotification(false);
                setIsModalOpen(false);
            }, 3000);
        }

        if (failedCount > 0 && uploadingCount === 0) {
            setNotificationType('error');
            setShowNotification(true);
            setTimeout(() => setShowNotification(false), 5000);
        }
    }, [files]);

    const getFileIcon = (mimeType) => {
        const gradients = {
            'application/pdf': 'linear-gradient(180deg, #F14B54 0%, #88252B 100%)',
            'application/msword': 'linear-gradient(180deg, #835AB5 0%, #5C299A 100%)',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'linear-gradient(180deg, #835AB5 0%, #5C299A 100%)',
            'application/vnd.ms-excel': 'linear-gradient(180deg, #00C23E 0%, #007B27 100%)',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'linear-gradient(180deg, #00C23E 0%, #007B27 100%)',
            'image/jpeg': 'linear-gradient(180deg, #65A531 0%, #3A6E10 100%)',
            'image/png': 'linear-gradient(180deg, #65A531 0%, #3A6E10 100%)',
            'image/gif': 'linear-gradient(180deg, #65A531 0%, #3A6E10 100%)',
            'image/webp': 'linear-gradient(180deg, #65A531 0%, #3A6E10 100%)',
            'text/plain': 'linear-gradient(180deg, #9BAFB1 0%, #5B6869 100%)',
            'audio/mpeg': 'linear-gradient(180deg, #835AB5 0%, #5C299A 100%)',
            'video/quicktime': 'linear-gradient(180deg, #F59E0B 0%, #D97706 100%)',
            'video/mp4': 'linear-gradient(180deg, #8B5CF6 0%, #6D28D9 100%)',
        };

        return gradients[mimeType] || 'linear-gradient(180deg, #9BAFB1 0%, #5B6869 100%)';
    };

    const getFileExtension = (fileName) => {
        const parts = fileName.split('.');
        return parts[parts.length - 1].toUpperCase();
    };

    const handleCloseModal = () => {
        const uploadingCount = files.filter(f => f.status === 'uploading').length;
        if (uploadingCount > 0) {
            if (window.confirm('Files are still uploading. Are you sure you want to close?')) {
                setIsModalOpen(false);
            }
        } else {
            setIsModalOpen(false);
        }
    };

    return (
        <div style={{width: '100%', height: '100vh', background: '#F5F5F5', overflow: 'hidden', justifyContent: 'flex-start', alignItems: 'center', display: 'flex'}}>
            <LeftNav />

            {/* Main Content */}
            <div style={{flex: '1 1 0', height: '100vh', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start', display: 'flex'}}>
                <div style={{alignSelf: 'stretch', height: 84, paddingLeft: 20, paddingRight: 20, background: 'white', borderBottom: '1px solid #E6E6EC', justifyContent: 'flex-start', alignItems: 'center', gap: 12, display: 'flex'}}>
                    <div style={{textAlign: 'center', color: '#32302C', fontSize: 20, fontFamily: 'Plus Jakarta Sans', fontWeight: '700', textTransform: 'capitalize', lineHeight: '30px'}}>Upload Documents</div>
                </div>

                <div style={{alignSelf: 'stretch', flex: '1 1 0', padding: 20, overflow: 'auto', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: 20, display: 'flex'}}>
                    <div {...getRootProps()} style={{alignSelf: 'stretch', flex: '1 1 0', paddingLeft: 40, paddingRight: 40, paddingTop: 60, paddingBottom: 60, background: '#F5F5F5', overflow: 'hidden', borderRadius: 20, border: '2px dashed rgba(108, 107, 110, 0.40)', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: 32, display: 'flex', cursor: 'pointer'}}>
                        <input {...getInputProps()} />
                        <div style={{width: 85.38, height: 80, position: 'relative'}}>
                            <div style={{width: 72.95, height: 61.73, paddingTop: 9.62, paddingBottom: 7.22, paddingLeft: 3.78, paddingRight: 3.78, left: 6.21, top: 8.76, position: 'absolute', background: 'white', boxShadow: '0px 1.60px 1.60px 1.20px rgba(68, 68, 68, 0.16)', overflow: 'hidden', borderRadius: 4.13, border: '0.34px solid #EDEDED', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start', gap: 1.60, display: 'flex'}}>
                                <div style={{width: 64.40, height: 2.41, background: '#E2E2E0', borderRadius: 6.41}} />
                                <div style={{width: 25.89, height: 2.41, background: '#E2E2E0', borderRadius: 6.41}} />
                            </div>
                            <div style={{width: 85.38, height: 51.75, left: 0, top: 28.25, position: 'absolute', background: 'linear-gradient(180deg, rgba(67, 67, 67, 0.60) 0%, rgba(0, 0, 0, 0.60) 66%)', boxShadow: '0px 0.38px 1.50px rgba(255, 255, 255, 0.25) inset', backdropFilter: 'blur(9.38px)', borderRadius: 4}} />
                        </div>
                        <div style={{flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'center', gap: 4, display: 'flex'}}>
                            <div style={{alignSelf: 'stretch', justifyContent: 'center', alignItems: 'flex-start', gap: 6, display: 'flex'}}>
                                <div style={{color: '#32302C', fontSize: 20, fontFamily: 'Plus Jakarta Sans', fontWeight: '600', textTransform: 'capitalize', lineHeight: '30px'}}>Upload Documents or Drag-n-drop</div>
                            </div>
                            <div style={{width: 366, textAlign: 'center', color: '#6C6B6E', fontSize: 16, fontFamily: 'Plus Jakarta Sans', fontWeight: '500', lineHeight: '24px'}}>Upload your first document           All file types supported (max 15MB)</div>
                        </div>
                        <div style={{width: 340, borderRadius: 12, justifyContent: 'center', alignItems: 'flex-start', gap: 8, display: 'flex'}}>
                            <div onClick={(e) => { e.stopPropagation(); open(); }} style={{width: 166, height: 52, borderRadius: 14, justifyContent: 'flex-start', alignItems: 'flex-start', display: 'flex', cursor: 'pointer'}}>
                                <div style={{flex: '1 1 0', alignSelf: 'stretch', paddingLeft: 18, paddingRight: 18, paddingTop: 10, paddingBottom: 10, background: 'white', overflow: 'hidden', borderRadius: 14, border: '1px solid #E6E6EC', justifyContent: 'center', alignItems: 'center', gap: 8, display: 'flex'}}>
                                    <div style={{color: '#323232', fontSize: 16, fontFamily: 'Plus Jakarta Sans', fontWeight: '600', textTransform: 'capitalize', lineHeight: '24px'}}>Select Files</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Upload Modal Overlay */}
            {isModalOpen && files.length > 0 && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'rgba(0, 0, 0, 0.6)',
                    zIndex: 9999,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backdropFilter: 'blur(4px)',
                    animation: 'fadeIn 0.2s ease-out'
                }}>
                    {/* Modal Container */}
                    <div style={{
                        background: 'white',
                        width: '90%',
                        maxWidth: 1200,
                        height: '85vh',
                        borderRadius: 12,
                        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
                        display: 'flex',
                        overflow: 'hidden',
                        animation: 'slideUp 0.3s ease-out'
                    }}>
                        {/* Left Sidebar */}
                        <div style={{
                            width: 280,
                            background: '#F9FAFB',
                            borderRight: '1px solid #E5E7EB',
                            display: 'flex',
                            flexDirection: 'column',
                            overflowY: 'auto'
                        }}>
                            <div style={{padding: 20, borderBottom: '1px solid #E5E7EB'}}>
                                <h3 style={{fontSize: 18, fontWeight: '600', color: '#111827', margin: 0, fontFamily: 'Plus Jakarta Sans'}}>Library</h3>
                            </div>

                            <div style={{padding: 16}}>
                                <input
                                    type="text"
                                    placeholder="Search for document......"
                                    style={{
                                        width: '100%',
                                        padding: '8px 12px',
                                        border: '1px solid #E5E7EB',
                                        borderRadius: 8,
                                        fontSize: 14,
                                        fontFamily: 'Plus Jakarta Sans',
                                        outline: 'none'
                                    }}
                                />
                            </div>

                            <div style={{flex: 1, overflowY: 'auto', padding: 8}}>
                                {allDocuments.map((doc, idx) => (
                                    <div key={idx} style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 12,
                                        padding: 12,
                                        borderRadius: 8,
                                        marginBottom: 4,
                                        cursor: 'pointer',
                                        transition: 'background 0.15s'
                                    }}>
                                        <div style={{width: 40, height: 40, position: 'relative', flexShrink: 0}}>
                                            <div style={{width: 31.67, height: 31.67, left: 4.17, top: 4.17, position: 'absolute', background: getFileIcon(doc.type), boxShadow: '0px 5px 16.67px rgba(0, 0, 0, 0.12)', borderRadius: 5}} />
                                            <div style={{width: 38.33, height: 21.67, left: 0.83, top: 9.17, position: 'absolute', background: 'rgba(0, 0, 0, 0.35)', boxShadow: '0px 3.33px 5px rgba(0, 0, 0, 0.15)', borderRadius: 5, border: '0.83px solid white', backdropFilter: 'blur(4.17px)'}} />
                                            <div style={{width: 18.31, height: 7.31, left: 11.08, top: 16.86, position: 'absolute', background: 'rgba(255, 255, 255, 0.95)', boxShadow: '0px 1.67px 3.33px rgba(0, 0, 0, 0.15)'}} />
                                        </div>
                                        <div style={{flex: 1, minWidth: 0}}>
                                            <p style={{
                                                fontSize: 14,
                                                fontWeight: '500',
                                                color: '#111827',
                                                margin: '0 0 4px 0',
                                                fontFamily: 'Plus Jakarta Sans',
                                                whiteSpace: 'nowrap',
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis'
                                            }}>{doc.name}</p>
                                            <p style={{
                                                fontSize: 12,
                                                color: '#6B7280',
                                                margin: 0,
                                                fontFamily: 'Plus Jakarta Sans'
                                            }}>{doc.size}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Main Upload Area */}
                        <div style={{
                            flex: 1,
                            display: 'flex',
                            flexDirection: 'column',
                            background: 'white'
                        }}>
                            {/* Header */}
                            <div style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                padding: '20px 24px',
                                borderBottom: '1px solid #E5E7EB'
                            }}>
                                <h2 style={{fontSize: 20, fontWeight: '600', color: '#111827', margin: 0, fontFamily: 'Plus Jakarta Sans'}}>Upload Documents</h2>
                                <button
                                    onClick={handleCloseModal}
                                    style={{
                                        width: 32,
                                        height: 32,
                                        border: 'none',
                                        background: 'transparent',
                                        borderRadius: 6,
                                        cursor: 'pointer',
                                        fontSize: 20,
                                        color: '#6B7280',
                                        transition: 'background 0.15s',
                                        fontFamily: 'Plus Jakarta Sans'
                                    }}
                                >
                                    ✕
                                </button>
                            </div>

                            {/* Content */}
                            <div style={{
                                flex: 1,
                                overflowY: 'auto',
                                padding: 24
                            }}>
                                {/* Drag-drop zone */}
                                <div {...getRootProps()} style={{
                                    border: '2px dashed #D1D5DB',
                                    borderRadius: 12,
                                    padding: '48px 24px',
                                    textAlign: 'center',
                                    marginBottom: 24,
                                    cursor: 'pointer'
                                }}>
                                    <input {...getInputProps()} />
                                    <div style={{fontSize: 64, marginBottom: 16}}>📁</div>
                                    <h3 style={{fontSize: 18, fontWeight: '600', color: '#111827', margin: '0 0 8px 0', fontFamily: 'Plus Jakarta Sans'}}>Upload Documents Or Drag-N-Drop</h3>
                                    <p style={{fontSize: 14, color: '#6B7280', margin: '0 0 24px 0', lineHeight: 1.5, fontFamily: 'Plus Jakarta Sans'}}>Upload your first document<br/>All file types supported (max 15MB)</p>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); open(); }}
                                        style={{
                                            padding: '10px 24px',
                                            background: 'white',
                                            border: '1px solid #D1D5DB',
                                            borderRadius: 8,
                                            fontSize: 14,
                                            fontWeight: '500',
                                            color: '#374151',
                                            cursor: 'pointer',
                                            transition: 'all 0.15s',
                                            fontFamily: 'Plus Jakarta Sans'
                                        }}
                                    >
                                        Select Files
                                    </button>
                                </div>

                                {/* Upload progress list */}
                                <div style={{display: 'flex', flexDirection: 'column', gap: 12}}>
                                    {files.map((f, index) => {
                                        const isError = f.status === 'failed';
                                        const progressWidth = f.status === 'completed' ? 100 : (f.progress || 0);

                                        return (
                                            <div key={index} style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 16,
                                                padding: 16,
                                                background: 'white',
                                                border: `1px solid ${isError ? '#EF4444' : '#E5E7EB'}`,
                                                borderRadius: 8,
                                                transition: 'box-shadow 0.15s',
                                                position: 'relative'
                                            }}>
                                                {/* File Icon Badge */}
                                                <div style={{
                                                    width: 48,
                                                    height: 48,
                                                    borderRadius: 8,
                                                    background: getFileIcon(f.file.type),
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    fontSize: 12,
                                                    fontWeight: '700',
                                                    color: 'white',
                                                    textTransform: 'uppercase',
                                                    flexShrink: 0,
                                                    fontFamily: 'Plus Jakarta Sans'
                                                }}>
                                                    {f.status === 'uploading' ? (
                                                        <div style={{
                                                            width: 24,
                                                            height: 24,
                                                            border: '3px solid rgba(255, 255, 255, 0.3)',
                                                            borderTop: '3px solid white',
                                                            borderRadius: '50%',
                                                            animation: 'spin 0.8s linear infinite'
                                                        }} />
                                                    ) : f.status === 'completed' ? (
                                                        <div style={{
                                                            width: 16,
                                                            height: 12,
                                                            borderLeft: '3px solid white',
                                                            borderBottom: '3px solid white',
                                                            transform: 'rotate(-45deg)',
                                                            marginTop: -4
                                                        }} />
                                                    ) : (
                                                        getFileExtension(f.file.name)
                                                    )}
                                                </div>

                                                {/* File Details */}
                                                <div style={{flex: 1, minWidth: 0}}>
                                                    <div style={{
                                                        display: 'flex',
                                                        justifyContent: 'space-between',
                                                        alignItems: 'center',
                                                        marginBottom: 4
                                                    }}>
                                                        <p style={{
                                                            fontSize: 14,
                                                            fontWeight: '500',
                                                            color: '#111827',
                                                            margin: 0,
                                                            fontFamily: 'Plus Jakarta Sans',
                                                            whiteSpace: 'nowrap',
                                                            overflow: 'hidden',
                                                            textOverflow: 'ellipsis',
                                                            flex: 1
                                                        }}>{f.file.name}</p>
                                                        {f.status !== 'uploading' && (
                                                            <button
                                                                onClick={() => removeFile(f.file.name)}
                                                                style={{
                                                                    width: 24,
                                                                    height: 24,
                                                                    border: 'none',
                                                                    background: 'transparent',
                                                                    borderRadius: 4,
                                                                    cursor: 'pointer',
                                                                    fontSize: 16,
                                                                    color: '#9CA3AF',
                                                                    flexShrink: 0,
                                                                    transition: 'all 0.15s',
                                                                    fontFamily: 'Plus Jakarta Sans',
                                                                    marginLeft: 8
                                                                }}
                                                            >
                                                                ✕
                                                            </button>
                                                        )}
                                                    </div>

                                                    {!isError && (
                                                        <p style={{
                                                            fontSize: 13,
                                                            color: '#6B7280',
                                                            margin: '0 0 8px 0',
                                                            fontFamily: 'Plus Jakarta Sans'
                                                        }}>
                                                            {`${formatFileSize(f.file.size)} - ${progressWidth}% uploaded`}
                                                        </p>
                                                    )}

                                                    {/* Progress Bar - Only show if NOT error */}
                                                    {!isError && (
                                                        <div style={{
                                                            width: '100%',
                                                            height: 6,
                                                            background: '#E5E7EB',
                                                            borderRadius: 3,
                                                            overflow: 'hidden'
                                                        }}>
                                                            <div style={{
                                                                height: '100%',
                                                                width: `${progressWidth}%`,
                                                                background: f.status === 'completed' ? '#10B981' : 'linear-gradient(90deg, #3B82F6 0%, #2563EB 100%)',
                                                                borderRadius: 3,
                                                                transition: 'width 0.3s ease-out'
                                                            }} />
                                                        </div>
                                                    )}

                                                    {/* Error State - Show retry button */}
                                                    {isError && (
                                                        <div style={{
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: 12
                                                        }}>
                                                            <p style={{
                                                                fontSize: 13,
                                                                color: '#EF4444',
                                                                margin: 0,
                                                                fontFamily: 'Plus Jakarta Sans',
                                                                flex: 1
                                                            }}>
                                                                Failed to upload
                                                            </p>
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    // Retry upload logic here
                                                                    window.location.reload();
                                                                }}
                                                                style={{
                                                                    padding: '6px 16px',
                                                                    background: 'transparent',
                                                                    border: '1px solid #EF4444',
                                                                    borderRadius: 6,
                                                                    color: '#EF4444',
                                                                    fontSize: 13,
                                                                    fontWeight: '500',
                                                                    fontFamily: 'Plus Jakarta Sans',
                                                                    cursor: 'pointer',
                                                                    transition: 'all 0.15s'
                                                                }}
                                                                onMouseEnter={(e) => {
                                                                    e.currentTarget.style.background = '#FEE2E2';
                                                                }}
                                                                onMouseLeave={(e) => {
                                                                    e.currentTarget.style.background = 'transparent';
                                                                }}
                                                            >
                                                                Retry
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Footer with Upload Button */}
                            <div style={{
                                padding: '16px 24px',
                                borderTop: '1px solid #E5E7EB',
                                background: 'white'
                            }}>
                                <button
                                    disabled={files.filter(f => f.status === 'uploading').length === 0 && files.filter(f => f.status === 'completed').length === files.length}
                                    style={{
                                        width: '100%',
                                        padding: '14px 24px',
                                        background: '#111827',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: 8,
                                        fontSize: 16,
                                        fontWeight: '600',
                                        cursor: 'pointer',
                                        transition: 'background 0.15s',
                                        fontFamily: 'Plus Jakarta Sans',
                                        opacity: files.filter(f => f.status === 'completed').length === files.length ? 0.5 : 1
                                    }}
                                >
                                    Upload {files.length} Document{files.length > 1 ? 's' : ''}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Success/Error Notification */}
            {showNotification && (
                <div style={{position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)', zIndex: 10000, animation: 'slideUp 0.3s ease-out'}}>
                    <div style={{padding: 10, background: '#181818', borderRadius: 14, justifyContent: 'center', alignItems: 'center', gap: 12, display: 'flex', minWidth: 400}}>
                        {notificationType === 'success' ? (
                            <>
                                <div style={{width: 36, height: 36, position: 'relative'}}>
                                    <div style={{width: 30.86, height: 30.86, left: 2.57, top: 2.57, position: 'absolute', background: 'rgba(52, 168, 83, 0.60)', borderRadius: 9999}} />
                                    <div style={{width: 36, height: 36, left: 0, top: 0, position: 'absolute', background: 'rgba(52, 168, 83, 0.60)', borderRadius: 9999}} />
                                    <div style={{width: 25.71, height: 25.71, left: 5.14, top: 5.14, position: 'absolute', background: '#34A853', overflow: 'hidden', borderRadius: 12.86, border: '1.61px solid #34A853'}}>
                                        <div style={{width: 14.40, height: 14.40, left: 5.66, top: 5.66, position: 'absolute', overflow: 'hidden'}}>
                                            <div style={{width: 9.60, height: 6.60, left: 2.40, top: 3.60, position: 'absolute', border: '1.80px solid white', borderTop: 'none', borderRight: 'none', transform: 'rotate(-45deg)', transformOrigin: 'bottom left'}} />
                                        </div>
                                    </div>
                                </div>
                                <div style={{flex: '1 1 0', color: 'white', fontSize: 14, fontFamily: 'Plus Jakarta Sans', fontWeight: '400', lineHeight: '20px'}}>
                                    {files.length} document{files.length > 1 ? 's have' : ' has'} been successfully uploaded.
                                </div>
                            </>
                        ) : (
                            <>
                                <div style={{width: 36, height: 36, position: 'relative'}}>
                                    <div style={{width: 30.86, height: 30.86, left: 2.57, top: 2.57, position: 'absolute', background: 'rgba(217, 45, 32, 0.60)', borderRadius: 9999}} />
                                    <div style={{width: 36, height: 36, left: 0, top: 0, position: 'absolute', background: 'rgba(217, 45, 32, 0.60)', borderRadius: 9999}} />
                                    <div style={{width: 25.71, height: 25.71, left: 5.14, top: 5.14, position: 'absolute', background: '#D92D20', overflow: 'hidden', borderRadius: 12.86, border: '1.61px solid #D92D20'}}>
                                        <div style={{width: 14, height: 14, left: 5.86, top: 5.86, position: 'absolute'}}>
                                            <div style={{width: 11.67, height: 10.79, left: 1.17, top: 1.75, position: 'absolute', borderRadius: 5.83, border: '1.20px solid white'}} />
                                        </div>
                                    </div>
                                </div>
                                <div style={{flex: '1 1 0', color: 'white', fontSize: 14, fontFamily: 'Plus Jakarta Sans', fontWeight: '400', lineHeight: '20px'}}>
                                    Hmm… the upload didn't work. Please retry.
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* Animation Keyframes */}
            <style dangerouslySetInnerHTML={{ __html: `
                @keyframes slideUp {
                    from {
                        transform: translateX(-50%) translateY(20px);
                        opacity: 0;
                    }
                    to {
                        transform: translateX(-50%) translateY(0);
                        opacity: 1;
                    }
                }

                @keyframes fadeIn {
                    from {
                        opacity: 0;
                    }
                    to {
                        opacity: 1;
                    }
                }

                @keyframes spin {
                    from {
                        transform: rotate(0deg);
                    }
                    to {
                        transform: rotate(360deg);
                    }
                }

                @keyframes scaleIn {
                    from {
                        transform: scale(0);
                        opacity: 0;
                    }
                    to {
                        transform: scale(1);
                        opacity: 1;
                    }
                }

                @keyframes checkmark {
                    from {
                        width: 0;
                        height: 0;
                    }
                    to {
                        width: 12px;
                        height: 8px;
                    }
                }

                /* Mobile Responsiveness */
                @media (max-width: 768px) {
                    .upload-modal {
                        width: 100% !important;
                        height: 100vh !important;
                        border-radius: 0 !important;
                        flex-direction: column !important;
                    }
                }
            `}} />
        </div>
    );
};

export default Upload;
