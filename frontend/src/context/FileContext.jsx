import React, { createContext, useState, useContext, useRef, useCallback, useEffect } from 'react';
import documentService from '../services/documentService';
import { getFileTypeCategory, formatFileSize } from '../utils/crypto';
import { useDocuments } from './DocumentsContext';

const FileContext = createContext();

export const useFiles = () => useContext(FileContext);

export const FileProvider = ({ children }) => {
    const [files, setFiles] = useState([]);
    const [isUploading, setIsUploading] = useState(false);
    const filesRef = useRef([]);
    const { socket } = useDocuments();

    filesRef.current = files;

    const onDrop = useCallback((acceptedFiles, rejectedFiles) => {
        if (rejectedFiles && rejectedFiles.length > 0) {
            console.log('❌ Rejected files:', rejectedFiles);
        }

        if (acceptedFiles && acceptedFiles.length > 0) {
            const newFiles = acceptedFiles.map(originalFile => ({
                file: originalFile,
                progress: 0,
                type: getFileTypeCategory(originalFile.name),
                status: 'uploading',
                error: null,
                documentId: null,
            }));

            const startIndex = filesRef.current.length;
            setFiles(prevFiles => [...prevFiles, ...newFiles]);

            newFiles.forEach((fileObj, i) => {
                const indexInArray = startIndex + i;
                uploadFile(fileObj, indexInArray);
            });
        }
    }, []);

    const uploadFile = async (fileObj, index) => {
        const fileName = fileObj.file.name;
        try {
            setFiles(prev => {
                const updated = [...prev];
                updated[index] = { ...updated[index], status: 'uploading', progress: 0 };
                return updated;
            });

            const result = await documentService.uploadDocument(
                fileObj.file,
                null,
                (uploadProgress) => {
                    // Map upload progress to 0-50% range
                    const uiProgress = uploadProgress * 0.5;
                    setFiles(prev => {
                        const updated = [...prev];
                        if (updated[index]) {
                            updated[index] = { ...updated[index], progress: uiProgress };
                        }
                        return updated;
                    });
                }
            );

            // Upload complete, now at 50% - backend processing will take it to 100%
            const documentId = result.document?.id || result.id;
            setFiles(prev => {
                const updated = [...prev];
                updated[index] = {
                    ...updated[index],
                    status: 'uploading', // Still uploading until backend processing completes
                    progress: 50,
                    documentId: documentId,
                    stage: 'Backend processing...'
                };
                return updated;
            });

            // Emit custom event to notify DocumentsContext
            window.dispatchEvent(new CustomEvent('document-uploaded', {
                detail: { document: result.document || result }
            }));

            return { success: true, result };
        } catch (error) {
            setFiles(prev => {
                const updated = [...prev];
                updated[index] = {
                    ...updated[index],
                    status: 'failed',
                    progress: 0,
                    error: error.message || 'Upload failed'
                };
                return updated;
            });
            return { success: false, error };
        }
    };

    const removeFile = (fileName) => {
        setFiles(files.filter(f => f.file.name !== fileName));
    };

    // Listen for backend processing updates via WebSocket
    useEffect(() => {
        if (!socket) {
            return;
        }

        const handleProcessingUpdate = (data) => {
            setFiles(prev => prev.map(file => {
                if (file.documentId === data.documentId) {
                    // Map backend processing progress (0-100%) to UI progress (50-100%)
                    const uiProgress = 50 + (data.progress * 0.5);

                    // When processing completes, mark as completed
                    if (data.progress === 100 || data.stage === 'completed' || data.stage === 'complete') {
                        return {
                            ...file,
                            status: 'completed',
                            progress: 100,
                            stage: 'Completed'
                        };
                    }

                    return {
                        ...file,
                        progress: uiProgress,
                        stage: data.message || 'Backend processing...'
                    };
                }
                return file;
            }));
        };

        socket.on('document-processing-update', handleProcessingUpdate);

        return () => {
            socket.off('document-processing-update', handleProcessingUpdate);
        };
    }, [socket]);

    const value = {
        files,
        setFiles,
        onDrop,
        removeFile,
        isUploading,
        setIsUploading,
        uploadFile
    };

    return (
        <FileContext.Provider value={value}>
            {children}
        </FileContext.Provider>
    );
};
