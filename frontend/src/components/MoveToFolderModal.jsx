import React, { useState, useEffect } from 'react';
import { X, Folder, ChevronRight, Search } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';

/**
 * Modal for selecting a folder to move documents to
 * Features hierarchical folder structure and search
 */
export default function MoveToFolderModal({ isOpen, onClose, onMove, selectedCount }) {
  const { t } = useTranslation();
  const [folders, setFolders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFolder, setSelectedFolder] = useState(null);
  const [expandedFolders, setExpandedFolders] = useState(new Set());

  useEffect(() => {
    if (isOpen) {
      fetchFolders();
    }
  }, [isOpen]);

  const fetchFolders = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/folders');
      setFolders(response.data.folders || []);
    } catch (error) {
    } finally {
      setLoading(false);
    }
  };

  const toggleFolder = (folderId) => {
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(folderId)) {
      newExpanded.delete(folderId);
    } else {
      newExpanded.add(folderId);
    }
    setExpandedFolders(newExpanded);
  };

  const handleMove = () => {
    if (selectedFolder) {
      onMove(selectedFolder.id);
      onClose();
      setSelectedFolder(null);
      setSearchQuery('');
    }
  };

  const filterFolders = (folders, query) => {
    if (!query.trim()) return folders;

    const lowerQuery = query.toLowerCase();
    return folders.filter(folder =>
      folder.name.toLowerCase().includes(lowerQuery)
    );
  };

  const buildFolderTree = (folders) => {
    const folderMap = new Map();
    const roots = [];

    // First pass: create map
    folders.forEach(folder => {
      folderMap.set(folder.id, { ...folder, children: [] });
    });

    // Second pass: build tree
    folders.forEach(folder => {
      const node = folderMap.get(folder.id);
      if (folder.parentId && folderMap.has(folder.parentId)) {
        folderMap.get(folder.parentId).children.push(node);
      } else {
        roots.push(node);
      }
    });

    return roots;
  };

  const renderFolder = (folder, level = 0) => {
    const hasChildren = folder.children && folder.children.length > 0;
    const isExpanded = expandedFolders.has(folder.id);
    const isSelected = selectedFolder?.id === folder.id;

    return (
      <div key={folder.id}>
        <div
          className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
            isSelected
              ? 'bg-blue-100 text-blue-900'
              : 'hover:bg-gray-100'
          }`}
          style={{ paddingLeft: `${level * 24 + 12}px` }}
          onClick={() => setSelectedFolder(folder)}
        >
          {hasChildren && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleFolder(folder.id);
              }}
              className="p-1 hover:bg-gray-200 rounded"
            >
              <ChevronRight
                size={16}
                className={`transition-transform ${isExpanded ? 'rotate-90' : ''}`}
              />
            </button>
          )}
          {!hasChildren && <div className="w-6" />}
          <Folder size={18} className={isSelected ? 'text-blue-600' : 'text-gray-600'} />
          <span className="flex-1 truncate">{folder.name}</span>
        </div>

        {hasChildren && isExpanded && (
          <div>
            {folder.children.map(child => renderFolder(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  if (!isOpen) return null;

  const filteredFolders = filterFolders(folders, searchQuery);
  const folderTree = buildFolderTree(filteredFolders);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900">
              {t('modals.moveToFolder.title', { count: selectedCount })} {selectedCount === 1 ? t('modals.moveToFolder.document') : t('modals.moveToFolder.documents')}
            </h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          {/* Search */}
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search size={18} className="text-gray-400" />
            </div>
            <input
              type="text"
              placeholder={t('modals.moveToFolder.searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Folder List */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : folderTree.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              {searchQuery ? t('modals.moveToFolder.noFoldersFound') : t('modals.moveToFolder.noFoldersAvailable')}
            </div>
          ) : (
            <div className="space-y-1">
              {folderTree.map(folder => renderFolder(folder))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 flex items-center justify-between">
          <div className="text-sm text-gray-600">
            {selectedFolder ? (
              <>{t('modals.moveToFolder.selected')}: <span className="font-medium">{selectedFolder.name}</span></>
            ) : (
              t('modals.moveToFolder.selectFolder')
            )}
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 font-medium transition-colors"
            >
              {t('modals.moveToFolder.cancel')}
            </button>
            <button
              onClick={handleMove}
              disabled={!selectedFolder}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                selectedFolder
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              {t('modals.moveToFolder.move')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
