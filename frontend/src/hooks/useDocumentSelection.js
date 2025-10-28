import { useState, useCallback } from 'react';

/**
 * Hook for managing document selection state
 * Used in category and folder views for multi-select functionality
 */
export function useDocumentSelection() {
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedDocuments, setSelectedDocuments] = useState(new Set());

  const toggleSelectMode = useCallback(() => {
    setIsSelectMode(prev => {
      const newMode = !prev;
      // Clear selection when exiting select mode
      if (!newMode) {
        setSelectedDocuments(new Set());
      }
      return newMode;
    });
  }, []);

  const toggleDocument = useCallback((documentId) => {
    setSelectedDocuments(prev => {
      const newSet = new Set(prev);
      if (newSet.has(documentId)) {
        newSet.delete(documentId);
      } else {
        newSet.add(documentId);
      }
      return newSet;
    });
  }, []);

  const selectAll = useCallback((documentIds) => {
    setSelectedDocuments(new Set(documentIds));
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedDocuments(new Set());
  }, []);

  const isSelected = useCallback((documentId) => {
    return selectedDocuments.has(documentId);
  }, [selectedDocuments]);

  return {
    isSelectMode,
    selectedDocuments,
    toggleSelectMode,
    toggleDocument,
    selectAll,
    clearSelection,
    isSelected
  };
}
