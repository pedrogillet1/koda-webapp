import React, { createContext, useState, useContext, useRef, useCallback } from 'react';
import documentService from '../services/documentService';
import { getFileTypeCategory, formatFileSize } from '../utils/crypto';

const FileContext = createContext();

export const useFiles = () => useContext(FileContext);

export const FileProvider = ({ children }) => {
    const [files, setFiles] = useState([]);
    const [isUploading, setIsUploading] = useState(false);
    const filesRef = useRef([]);

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
                (progress) => {
                    setFiles(prev => {
                        const updated = [...prev];
                        if (updated[index]) {
                            updated[index] = { ...updated[index], progress };
                        }
                        return updated;
                    });
                }
            );

            setFiles(prev => {
                const updated = [...prev];
                updated[index] = {
                    ...updated[index],
                    status: 'completed',
                    progress: 100,
                    documentId: result.document?.id || result.id
                };
                return updated;
            });
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
