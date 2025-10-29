import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useDocuments } from '../context/DocumentsContext';
import { useDocumentSelection } from '../hooks/useDocumentSelection.js';
import LeftNav from './LeftNav';
import NotificationPanel from './NotificationPanel';
import CreateCategoryModal from './CreateCategoryModal';
import EditCategoryModal from './EditCategoryModal';
import UploadModal from './UploadModal';
import UniversalUploadModal from './UniversalUploadModal';
import DeleteConfirmationModal from './DeleteConfirmationModal';
import RenameModal from './RenameModal';
import { ReactComponent as SearchIcon } from '../assets/Search.svg';
import { ReactComponent as LogoutBlackIcon } from '../assets/Logout-black.svg';
import { ReactComponent as TrashCanIcon } from '../assets/Trash can-red.svg';
import { ReactComponent as EditIcon } from '../assets/Edit 5.svg';
import { ReactComponent as DownloadIcon } from '../assets/Download 3- black.svg';
import { ReactComponent as CloseIcon } from '../assets/x-close.svg';
import { ReactComponent as DotsIcon } from '../assets/dots.svg';
import { ReactComponent as UploadIconMenu } from '../assets/Logout-black.svg';
import { ReactComponent as XCloseIcon } from '../assets/x-close.svg';
import { ReactComponent as AddIcon } from '../assets/add.svg';
import logoSvg from '../assets/logo.svg';
import api from '../services/api';
import pdfIcon from '../assets/pdf-icon.svg';
import docIcon from '../assets/doc-icon.svg';
import txtIcon from '../assets/txt-icon.svg';
import xlsIcon from '../assets/xls.svg';
import jpgIcon from '../assets/jpg-icon.svg';
import pngIcon from '../assets/png-icon.svg';
import pptxIcon from '../assets/pptx.svg';
import folderIcon from '../assets/folder_icon.svg';
import CategoryIcon from './CategoryIcon';

const DocumentsPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  // Get global state from context
  const {
    documents: contextDocuments,
    folders: contextFolders,
    deleteDocument,
    renameDocument,
    moveToFolder,
    createFolder,
    deleteFolder,
    getRootFolders,
    getDocumentCountByFolder,
    refreshAll
  } = useDocuments();

  // Selection hook for Recently Added section
  const {
    selectedDocuments,
    isSelectMode,
    toggleSelectMode,
    toggleDocument,
    clearSelection,
    isSelected
  } = useDocumentSelection();

  // Only UI state remains local
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showNotificationsPopup, setShowNotificationsPopup] = useState(false);
  const [showAllCategories, setShowAllCategories] = useState(false);
  const [openDropdownId, setOpenDropdownId] = useState(null);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [selectedDocumentForCategory, setSelectedDocumentForCategory] = useState(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState(null);
  const [categoryMenuOpen, setCategoryMenuOpen] = useState(null);
  const [editingCategory, setEditingCategory] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadCategoryId, setUploadCategoryId] = useState(null);
  const [showAskKoda, setShowAskKoda] = useState(true);
  const [showUniversalUploadModal, setShowUniversalUploadModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [itemToRename, setItemToRename] = useState(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (openDropdownId && !event.target.closest('[data-dropdown]')) {
        setOpenDropdownId(null);
      }
      if (categoryMenuOpen && !event.target.closest('[data-category-menu]')) {
        setCategoryMenuOpen(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [openDropdownId, categoryMenuOpen]);

  // Refresh data when component mounts or becomes visible
  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  // Computed categories (auto-updates when folders or documents change!)
  const categories = useMemo(() => {
    return getRootFolders()
      .filter(folder => folder.name.toLowerCase() !== 'recently added')
      .map(folder => ({
        id: folder.id,
        name: folder.name,
        emoji: folder.emoji || '📁',
        fileCount: getDocumentCountByFolder(folder.id),
        folderCount: folder._count?.subfolders || 0,
        count: getDocumentCountByFolder(folder.id)
      }));
  }, [contextFolders, contextDocuments, getRootFolders, getDocumentCountByFolder]);

  // Computed available categories for modal
  const availableCategories = useMemo(() => {
    return getRootFolders();
  }, [contextFolders, getRootFolders]);

  const handleCreateCategory = async (category) => {
    try {
      console.log('Creating category with:', category);

      // Use context to create folder (instant UI update!)
      const newFolder = await createFolder(category.name, category.emoji);
      console.log('New folder created:', newFolder);

      // If documents were selected, move them to the folder (instant UI updates!)
      if (category.selectedDocuments && category.selectedDocuments.length > 0) {
        console.log('Moving documents to folder:', category.selectedDocuments);
        await Promise.all(
          category.selectedDocuments.map(docId =>
            moveToFolder(docId, newFolder.id)
          )
        );
        console.log('Documents moved successfully');
      }

      // No manual refresh needed - context auto-updates!
    } catch (error) {
      console.error('Error creating folder:', error);
      alert('Failed to create category');
    }
  };

  const handleDeleteCategory = async (categoryId) => {
    try {
      // Use context to delete folder (instant UI update!)
      await deleteFolder(categoryId);
    } catch (error) {
      console.error('Error deleting folder:', error);
      alert('Cannot delete folder with documents or subfolders');
    }
  };

  // Handle document download
  const handleDownload = async (doc) => {
    try {
      const response = await api.get(`/api/documents/${doc.id}/stream?download=true`, {
        responseType: 'blob'
      });

      // Use the blob directly from response (already has correct mime type)
      const url = window.URL.createObjectURL(response.data);
      const link = document.createElement('a');
      link.href = url;
      link.download = doc.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      setOpenDropdownId(null);
    } catch (error) {
      console.error('Error downloading document:', error);
      alert('Failed to download document');
    }
  };

  // Handle document rename
  const handleRename = (doc) => {
    setItemToRename({ type: 'document', id: doc.id, name: doc.filename });
    setShowRenameModal(true);
    setOpenDropdownId(null);
  };

  // Handle rename confirmation from modal
  const handleRenameConfirm = async (newName) => {
    if (!itemToRename) return;

    try {
      if (itemToRename.type === 'document') {
        // Use context to rename (instant UI update!)
        await renameDocument(itemToRename.id, newName);
      }

      setShowRenameModal(false);
      setItemToRename(null);
    } catch (error) {
      console.error('Error renaming:', error);
      alert(`Failed to rename ${itemToRename.type}`);
    }
  };

  // Handle document delete
  const handleDelete = async (docId) => {
    try {
      // Use context to delete (instant UI update!)
      await deleteDocument(docId);

      setOpenDropdownId(null);
    } catch (error) {
      console.error('Error deleting document:', error);
      alert('Failed to delete document');
    }
  };

  // Handle add to category
  const handleAddToCategory = async (doc) => {
    setSelectedDocumentForCategory(doc);
    setShowCategoryModal(true);
    setOpenDropdownId(null);
  };

  const handleCategorySelection = async () => {
    if (!selectedCategoryId || !selectedDocumentForCategory) return;

    try {
      // Use context to move document (instant UI update!)
      await moveToFolder(selectedDocumentForCategory.id, selectedCategoryId);

      setShowCategoryModal(false);
      setSelectedDocumentForCategory(null);
      setSelectedCategoryId(null);
    } catch (error) {
      console.error('Error adding document to category:', error);
      alert('Failed to add document to category');
    }
  };

  // Filter documents based on search query (auto-updates!)
  const filteredDocuments = useMemo(() => {
    return contextDocuments.filter(doc =>
      (doc.filename || doc.name || '').toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [contextDocuments, searchQuery]);

  return (
    <div style={{width: '100%', height: '100vh', background: '#F5F5F5', overflow: 'hidden', display: 'flex'}}>
      <LeftNav onNotificationClick={() => setShowNotificationsPopup(true)} />

      {/* Main Content */}
      <div style={{flex: 1, height: '100%', display: 'flex', flexDirection: 'column'}}>
        {/* Header */}
        <div style={{height: 84, paddingLeft: 20, paddingRight: 20, background: 'white', borderBottom: '1px #E6E6EC solid', display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
          <div style={{color: '#32302C', fontSize: 20, fontFamily: 'Plus Jakarta Sans', fontWeight: '700', textTransform: 'capitalize', lineHeight: '30px'}}>
            Documents
          </div>
          <div style={{display: 'flex', alignItems: 'center', gap: 12}}>
            {isSelectMode ? (
              <>
                {/* Delete Button in Select Mode */}
                <button
                  onClick={async () => {
                    if (selectedDocuments.size === 0) return;
                    if (!window.confirm(`Delete ${selectedDocuments.size} document${selectedDocuments.size > 1 ? 's' : ''}?`)) return;

                    try {
                      await Promise.all(
                        Array.from(selectedDocuments).map(docId =>
                          deleteDocument(docId)
                        )
                      );

                      // Refresh documents
                      await refreshAll();

                      // Clear selection and exit select mode
                      clearSelection();
                      toggleSelectMode();
                    } catch (error) {
                      console.error('Error deleting documents:', error);
                      alert('Failed to delete documents');
                    }
                  }}
                  disabled={selectedDocuments.size === 0}
                  style={{
                    paddingLeft: 18,
                    paddingRight: 18,
                    paddingTop: 10,
                    paddingBottom: 10,
                    background: selectedDocuments.size === 0 ? '#F5F5F5' : '#DC2626',
                    boxShadow: '0px 0px 8px 1px rgba(0, 0, 0, 0.02)',
                    overflow: 'hidden',
                    borderRadius: 100,
                    outline: '1px #E6E6EC solid',
                    outlineOffset: '-1px',
                    justifyContent: 'center',
                    alignItems: 'center',
                    gap: 6,
                    display: 'inline-flex',
                    border: 'none',
                    cursor: selectedDocuments.size === 0 ? 'not-allowed' : 'pointer',
                    opacity: selectedDocuments.size === 0 ? 0.5 : 1,
                    transition: 'all 0.2s'
                  }}
                >
                  <TrashCanIcon style={{ width: 16, height: 16, fill: selectedDocuments.size === 0 ? '#9CA3AF' : 'white' }} />
                  <div style={{
                    color: selectedDocuments.size === 0 ? '#9CA3AF' : 'white',
                    fontSize: 16,
                    fontFamily: 'Plus Jakarta Sans',
                    fontWeight: '600',
                    lineHeight: '24px',
                    wordWrap: 'break-word'
                  }}>
                    Delete
                  </div>
                </button>

                {/* Move Button in Select Mode */}
                <button
                  onClick={() => {
                    if (selectedDocuments.size === 0) return;
                    // Open category selection modal for moving
                    alert('Move functionality - implement folder selection modal');
                  }}
                  disabled={selectedDocuments.size === 0}
                  style={{
                    paddingLeft: 18,
                    paddingRight: 18,
                    paddingTop: 10,
                    paddingBottom: 10,
                    background: '#F5F5F5',
                    boxShadow: '0px 0px 8px 1px rgba(0, 0, 0, 0.02)',
                    overflow: 'hidden',
                    borderRadius: 100,
                    outline: '1px #E6E6EC solid',
                    outlineOffset: '-1px',
                    justifyContent: 'center',
                    alignItems: 'center',
                    gap: 6,
                    display: 'inline-flex',
                    border: 'none',
                    cursor: selectedDocuments.size === 0 ? 'not-allowed' : 'pointer',
                    opacity: selectedDocuments.size === 0 ? 0.5 : 1,
                    transition: 'all 0.2s'
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M14 5.33333V13.3333C14 13.687 13.8595 14.0261 13.6095 14.2761C13.3594 14.5262 13.0203 14.6667 12.6667 14.6667H3.33333C2.97971 14.6667 2.64057 14.5262 2.39052 14.2761C2.14048 14.0261 2 13.687 2 13.3333V5.33333" stroke="#32302C" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M6 7.33333V11.3333" stroke="#32302C" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M10 7.33333V11.3333" stroke="#32302C" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M1.33334 5.33333H14.6667" stroke="#32302C" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M10.6667 2H5.33334L4 5.33333H12L10.6667 2Z" stroke="#32302C" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  <div style={{
                    color: '#32302C',
                    fontSize: 16,
                    fontFamily: 'Plus Jakarta Sans',
                    fontWeight: '600',
                    lineHeight: '24px',
                    wordWrap: 'break-word'
                  }}>
                    Move
                  </div>
                </button>

                {/* Selected Count */}
                <div style={{
                  color: '#32302C',
                  fontSize: 16,
                  fontFamily: 'Plus Jakarta Sans',
                  fontWeight: '500',
                  lineHeight: '24px'
                }}>
                  ({selectedDocuments.size}) Selected
                </div>

                {/* Close Button */}
                <button
                  onClick={() => {
                    clearSelection();
                    toggleSelectMode();
                  }}
                  style={{
                    width: 32,
                    height: 32,
                    background: 'white',
                    border: '1px solid #E6E6EC',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#F5F5F5'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'white'}
                >
                  <CloseIcon style={{ width: 16, height: 16 }} />
                </button>
              </>
            ) : (
              <>
                <div style={{position: 'relative', height: 52, display: 'flex', alignItems: 'center'}}>
                  <SearchIcon style={{position: 'absolute', left: 16, width: 20, height: 20, zIndex: 1}} />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search any documents..."
                    style={{
                      height: '100%',
                      minWidth: 250,
                      paddingLeft: 46,
                      paddingRight: 16,
                      background: '#F5F5F5',
                      borderRadius: 100,
                      border: '1px #E6E6EC solid',
                      outline: 'none',
                      color: '#32302C',
                      fontSize: 16,
                      fontFamily: 'Plus Jakarta Sans',
                      fontWeight: '500',
                      lineHeight: '24px'
                    }}
                  />

                {/* Search Results Dropdown */}
                {searchQuery && (
                  <div style={{
                    position: 'absolute',
                    top: 60,
                    left: 0,
                    right: 0,
                    minWidth: 400,
                    maxHeight: 400,
                    background: 'white',
                    borderRadius: 14,
                    border: '1px #E6E6EC solid',
                    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.12)',
                    overflowY: 'auto',
                    zIndex: 1000
                  }}>
                    {filteredDocuments.length > 0 ? (
                      <div style={{padding: 8}}>
                        {filteredDocuments.map((doc) => (
                          <div
                            key={doc.id}
                            onClick={() => {
                              navigate(`/document/${doc.id}`);
                              setSearchQuery('');
                            }}
                            style={{
                              padding: 12,
                              borderRadius: 10,
                              display: 'flex',
                              alignItems: 'center',
                              gap: 12,
                              cursor: 'pointer',
                              transition: 'background 0.2s ease'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.background = '#F5F5F5'}
                            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                          >
                            <div style={{
                              width: 40,
                              height: 40,
                              background: '#F5F5F5',
                              borderRadius: 8,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: 20
                            }}>
                              📄
                            </div>
                            <div style={{flex: 1, overflow: 'hidden'}}>
                              <div style={{
                                color: '#32302C',
                                fontSize: 14,
                                fontFamily: 'Plus Jakarta Sans',
                                fontWeight: '600',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap'
                              }}>
                                {doc.filename}
                              </div>
                              <div style={{
                                color: '#6C6B6E',
                                fontSize: 12,
                                fontFamily: 'Plus Jakarta Sans',
                                fontWeight: '400'
                              }}>
                                {(doc.fileSize / 1024 / 1024).toFixed(2)} MB
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={{
                        padding: 40,
                        textAlign: 'center',
                        color: '#6C6B6E',
                        fontSize: 14,
                        fontFamily: 'Plus Jakarta Sans'
                      }}>
                        No documents found matching "{searchQuery}"
                      </div>
                    )}
                  </div>
                )}
                </div>

                {/* Select Button */}
                <button
                  onClick={toggleSelectMode}
                  style={{
                    height: 52,
                    paddingLeft: 18,
                    paddingRight: 18,
                    paddingTop: 10,
                    paddingBottom: 10,
                    background: '#F5F5F5',
                    boxShadow: '0px 0px 8px 1px rgba(0, 0, 0, 0.02)',
                    overflow: 'hidden',
                    borderRadius: 100,
                    outline: '1px #E6E6EC solid',
                    outlineOffset: '-1px',
                    justifyContent: 'center',
                    alignItems: 'center',
                    gap: 6,
                    display: 'inline-flex',
                    border: 'none',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  <div style={{
                    color: '#32302C',
                    fontSize: 16,
                    fontFamily: 'Plus Jakarta Sans',
                    fontWeight: '600',
                    lineHeight: '24px',
                    wordWrap: 'break-word'
                  }}>
                    Select
                  </div>
                </button>

                <div onClick={() => setShowUniversalUploadModal(true)} style={{height: 52, paddingLeft: 18, paddingRight: 18, paddingTop: 10, paddingBottom: 10, background: '#F5F5F5', borderRadius: 100, border: '1px #E6E6EC solid', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer'}}>
                  <LogoutBlackIcon style={{width: 24, height: 24}} />
                  <div style={{color: '#32302C', fontSize: 16, fontFamily: 'Plus Jakarta Sans', fontWeight: '500', lineHeight: '24px'}}>Upload a Document</div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Scrollable Content */}
        <div style={{flex: 1, padding: 20, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 20}}>
          {/* Smart Categories */}
          <div style={{display: 'flex', flexDirection: 'column', gap: 12}}>
            <div style={{display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 12}}>
              <div onClick={() => setIsModalOpen(true)} style={{padding: 14, background: 'white', borderRadius: 14, border: '1px #E6E6EC solid', display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer'}}>
                <div style={{width: 40, height: 40, background: '#F6F6F6', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0}}>
                  <AddIcon style={{ width: 20, height: 20 }} />
                </div>
                <span style={{color: '#32302C', fontSize: 14, fontFamily: 'Plus Jakarta Sans', fontWeight: '600', lineHeight: 1}}>Add New Smart Category</span>
              </div>
              {categories.map((category, index) => (
                <div
                  key={index}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.currentTarget.style.background = '#E0E7FF';
                    e.currentTarget.style.border = '2px dashed #4F46E5';
                  }}
                  onDragLeave={(e) => {
                    e.currentTarget.style.background = 'white';
                    e.currentTarget.style.border = '1px #E6E6EC solid';
                  }}
                  onDrop={async (e) => {
                    e.preventDefault();
                    e.currentTarget.style.background = 'white';
                    e.currentTarget.style.border = '1px #E6E6EC solid';

                    try {
                      const data = JSON.parse(e.dataTransfer.getData('application/json'));

                      if (data.type === 'document') {
                        // Move single document
                        await moveToFolder(data.id, category.id);
                        console.log(`Moved document ${data.id} to folder ${category.id}`);
                      } else if (data.type === 'documents') {
                        // Move multiple documents
                        await Promise.all(
                          data.documentIds.map(docId => moveToFolder(docId, category.id))
                        );
                        console.log(`Moved ${data.documentIds.length} documents to folder ${category.id}`);

                        // Clear selection and exit select mode
                        if (isSelectMode) {
                          clearSelection();
                          toggleSelectMode();
                        }
                      }

                      await refreshAll();
                    } catch (error) {
                      console.error('Error moving document:', error);
                    }
                  }}
                  style={{padding: 10, background: 'white', borderRadius: 14, border: '1px #E6E6EC solid', display: 'flex', alignItems: 'center', gap: 8, transition: 'transform 0.2s ease, box-shadow 0.2s ease', position: 'relative'}}
                >
                  <div onClick={() => {
                    console.log('📁 DocumentsPage - Clicking folder:', category.name, 'ID:', category.id);
                    console.log('🔗 DocumentsPage - Navigating to:', `/folder/${category.id}`);
                    navigate(`/folder/${category.id}`);
                  }} style={{display: 'flex', alignItems: 'center', gap: 8, flex: 1, cursor: 'pointer'}} onMouseEnter={(e) => e.currentTarget.parentElement.style.transform = 'translateY(-2px)'} onMouseLeave={(e) => e.currentTarget.parentElement.style.transform = 'translateY(0)'}>
                    <div style={{width: 40, height: 40, background: '#F6F6F6', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0}}>
                      <CategoryIcon emoji={category.emoji} />
                    </div>
                    <div style={{display: 'flex', flexDirection: 'column', gap: 4, flex: 1}}>
                      <div style={{color: '#32302C', fontSize: 14, fontFamily: 'Plus Jakarta Sans', fontWeight: '600', lineHeight: '19.60px'}}>{category.name}</div>
                      <div style={{color: '#6C6B6E', fontSize: 14, fontFamily: 'Plus Jakarta Sans', fontWeight: '500', lineHeight: '15.40px'}}>
                        {category.fileCount || 0} {category.fileCount === 1 ? 'File' : 'Files'}
                      </div>
                    </div>
                  </div>
                  <div style={{position: 'relative'}} data-category-menu>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setCategoryMenuOpen(categoryMenuOpen === category.id ? null : category.id);
                      }}
                      style={{
                        width: 28,
                        height: 28,
                        background: '#F5F5F5',
                        borderRadius: '50%',
                        border: '1px solid #E6E6EC',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        flexShrink: 0
                      }}
                    >
                      <DotsIcon style={{width: 16, height: 16}} />
                    </button>
                    {categoryMenuOpen === category.id && (
                      <div style={{
                        position: 'absolute',
                        right: 0,
                        top: '100%',
                        marginTop: 4,
                        background: 'white',
                        borderRadius: 12,
                        border: '1px solid #E6E6EC',
                        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.12)',
                        zIndex: 1000,
                        minWidth: 160,
                        overflow: 'hidden'
                      }}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingCategory(category);
                            setShowEditModal(true);
                            setCategoryMenuOpen(null);
                          }}
                          style={{
                            width: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            padding: '10px 14px',
                            background: 'transparent',
                            border: 'none',
                            borderBottom: '1px solid #F5F5F5',
                            cursor: 'pointer',
                            fontSize: 14,
                            fontFamily: 'Plus Jakarta Sans',
                            fontWeight: '500',
                            color: '#32302C',
                            transition: 'background 0.2s ease'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.background = '#F9FAFB'}
                          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                        >
                          <EditIcon style={{width: 16, height: 16}} />
                          Edit
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            // Show upload modal for this category
                            setUploadCategoryId(category.id);
                            setShowUniversalUploadModal(true);
                            setCategoryMenuOpen(null);
                          }}
                          style={{
                            width: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            padding: '10px 14px',
                            background: 'transparent',
                            border: 'none',
                            borderBottom: '1px solid #F5F5F5',
                            cursor: 'pointer',
                            fontSize: 14,
                            fontFamily: 'Plus Jakarta Sans',
                            fontWeight: '500',
                            color: '#32302C',
                            transition: 'background 0.2s ease'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.background = '#F9FAFB'}
                          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                        >
                          <UploadIconMenu style={{width: 16, height: 16}} />
                          Upload
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setItemToDelete({ type: 'category', id: category.id, name: category.name });
                            setShowDeleteModal(true);
                            setCategoryMenuOpen(null);
                          }}
                          style={{
                            width: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            padding: '10px 14px',
                            background: 'transparent',
                            border: 'none',
                            cursor: 'pointer',
                            fontSize: 14,
                            fontFamily: 'Plus Jakarta Sans',
                            fontWeight: '500',
                            color: '#D92D20',
                            transition: 'background 0.2s ease'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.background = '#FEF3F2'}
                          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                        >
                          <TrashCanIcon style={{width: 16, height: 16}} />
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Recently Added - Full Width */}
          <div style={{padding: 24, background: 'white', borderRadius: 14, border: '1px #E6E6EC solid', display: 'flex', flexDirection: 'column'}}>
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24}}>
              <div style={{color: '#32302C', fontSize: 18, fontFamily: 'Plus Jakarta Sans', fontWeight: '700'}}>Recently Added</div>
              <div
                onClick={() => navigate('/category/recently-added')}
                style={{color: '#171717', fontSize: 16, fontFamily: 'Plus Jakarta Sans', fontWeight: '700', lineHeight: '22.40px', cursor: 'pointer'}}
              >
                See All
              </div>
            </div>

            {(() => {
              // Only show documents in Recently Added, not category folders
              // If you want to show subfolders (folders inside categories), filter for folders WITH parentFolderId
              const combinedItems = [
                ...contextDocuments.map(d => ({ ...d, isDocument: true }))
              ];

              const recentItems = combinedItems
                .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
                .slice(0, 10);

              return recentItems.length > 0 ? (
              <div style={{display: 'flex', flexDirection: 'column', gap: 16}}>
                {recentItems.map((item) => {
                  // If it's a folder, render folder
                  if (item.isFolder) {
                    return (
                      <div
                        key={item.id}
                        onClick={() => navigate(`/folder/${item.id}`)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 12,
                          padding: 12,
                          borderRadius: 12,
                          background: '#F5F5F5',
                          cursor: 'pointer',
                          transition: 'background 0.2s ease'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = '#E6E6EC'}
                        onMouseLeave={(e) => e.currentTarget.style.background = '#F5F5F5'}
                      >
                        <div style={{width: 40, height: 40, background: '#F6F6F6', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0}}>
                          <img src={folderIcon} alt="Folder" style={{width: 24, height: 24}} />
                        </div>
                        <div style={{flex: 1, overflow: 'hidden'}}>
                          <div style={{color: '#111827', fontSize: 14, fontFamily: 'Plus Jakarta Sans', fontWeight: '600', marginBottom: 4}}>
                            {item.name}
                          </div>
                          <div style={{color: '#6B7280', fontSize: 12, fontFamily: 'Plus Jakarta Sans'}}>
                            {item.fileCount || 0} {item.fileCount === 1 ? 'File' : 'Files'}
                          </div>
                        </div>
                      </div>
                    );
                  }

                  // Otherwise render document
                  const doc = item;
                  const getFileIcon = (filename) => {
                    const ext = filename.toLowerCase();
                    if (ext.match(/\.(pdf)$/)) return pdfIcon;
                    if (ext.match(/\.(jpg|jpeg)$/)) return jpgIcon;
                    if (ext.match(/\.(png)$/)) return pngIcon;
                    if (ext.match(/\.(doc|docx)$/)) return docIcon;
                    if (ext.match(/\.(xls|xlsx)$/)) return xlsIcon;
                    if (ext.match(/\.(txt)$/)) return txtIcon;
                    if (ext.match(/\.(ppt|pptx)$/)) return pptxIcon;
                    return docIcon;
                  };

                  const formatBytes = (bytes) => {
                    if (bytes === 0) return '0 B';
                    const sizes = ['B', 'KB', 'MB', 'GB'];
                    const i = Math.floor(Math.log(bytes) / Math.log(1024));
                    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
                  };

                  return (
                    <div
                      key={doc.id}
                      draggable
                      onDragStart={(e) => {
                        // If in select mode and this doc is selected, drag all selected docs
                        if (isSelectMode && isSelected(doc.id)) {
                          e.dataTransfer.setData('application/json', JSON.stringify({
                            type: 'documents',
                            documentIds: Array.from(selectedDocuments)
                          }));
                        } else {
                          // Otherwise just drag this one document
                          e.dataTransfer.setData('application/json', JSON.stringify({
                            type: 'document',
                            id: doc.id
                          }));
                        }
                        e.dataTransfer.effectAllowed = 'move';
                      }}
                      onDragEnd={(e) => {
                        e.currentTarget.style.opacity = '1';
                      }}
                      onClick={() => {
                        if (isSelectMode) {
                          toggleDocument(doc.id);
                        } else {
                          navigate(`/document/${doc.id}`);
                        }
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        padding: 12,
                        borderRadius: 12,
                        background: isSelectMode && isSelected(doc.id) ? '#111827' : '#F5F5F5',
                        cursor: isSelectMode ? 'pointer' : 'grab',
                        transition: 'background 0.2s ease'
                      }}
                      onMouseEnter={(e) => {
                        if (!isSelectMode) {
                          e.currentTarget.style.background = '#E6E6EC';
                        } else if (!isSelected(doc.id)) {
                          e.currentTarget.style.background = '#E6E6EC';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isSelectMode) {
                          e.currentTarget.style.background = '#F5F5F5';
                        } else if (!isSelected(doc.id)) {
                          e.currentTarget.style.background = '#F5F5F5';
                        }
                      }}
                    >
                      <img
                        src={getFileIcon(doc.filename)}
                        alt="File icon"
                        style={{
                          width: 40,
                          height: 40,
                          imageRendering: '-webkit-optimize-contrast',
                          objectFit: 'contain',
                          shapeRendering: 'geometricPrecision'
                        }}
                      />
                      <div style={{flex: 1, overflow: 'hidden'}}>
                        <div style={{
                          color: isSelectMode && isSelected(doc.id) ? 'white' : '#32302C',
                          fontSize: 14,
                          fontFamily: 'Plus Jakarta Sans',
                          fontWeight: '600',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}>
                          {doc.filename}
                        </div>
                        <div style={{
                          color: isSelectMode && isSelected(doc.id) ? '#D1D5DB' : '#6C6B6E',
                          fontSize: 12,
                          fontFamily: 'Plus Jakarta Sans',
                          fontWeight: '500',
                          marginTop: 4
                        }}>
                          {formatBytes(doc.fileSize)} • {new Date(doc.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                      {!isSelectMode && <div style={{position: 'relative'}} data-dropdown>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenDropdownId(openDropdownId === doc.id ? null : doc.id);
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.background = '#E6E6EC'}
                          onMouseLeave={(e) => e.currentTarget.style.background = 'white'}
                          style={{
                            width: 32,
                            height: 32,
                            background: 'white',
                            borderRadius: '50%',
                            border: '1px solid #E6E6EC',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            fontSize: 18,
                            fontWeight: '700',
                            color: '#32302C',
                            transition: 'background 0.2s ease'
                          }}
                        >
                          ⋯
                        </button>

                        {openDropdownId === doc.id && (
                          <div
                            style={{
                              position: 'absolute',
                              top: '100%',
                              right: 0,
                              marginTop: 4,
                              background: 'white',
                              boxShadow: '0px 4px 6px -2px rgba(16, 24, 40, 0.03)',
                              borderRadius: 12,
                              border: '1px solid #E6E6EC',
                              zIndex: 1000,
                              minWidth: 160
                            }}
                          >
                            <div style={{padding: 4, display: 'flex', flexDirection: 'column', gap: 1}}>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDownload(doc);
                                }}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 6,
                                  padding: '8px 14px',
                                  background: 'transparent',
                                  border: 'none',
                                  borderRadius: 6,
                                  cursor: 'pointer',
                                  fontSize: 14,
                                  fontFamily: 'Plus Jakarta Sans',
                                  fontWeight: '500',
                                  color: '#32302C',
                                  transition: 'background 0.2s ease'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.background = '#F5F5F5'}
                                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                              >
                                <DownloadIcon style={{width: 16, height: 16}} />
                                Download
                              </button>

                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRename(doc);
                                }}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 6,
                                  padding: '8px 14px',
                                  background: 'transparent',
                                  border: 'none',
                                  borderRadius: 6,
                                  cursor: 'pointer',
                                  fontSize: 14,
                                  fontFamily: 'Plus Jakarta Sans',
                                  fontWeight: '500',
                                  color: '#32302C',
                                  transition: 'background 0.2s ease'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.background = '#F5F5F5'}
                                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                              >
                                <EditIcon style={{width: 16, height: 16}} />
                                Rename
                              </button>

                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleAddToCategory(doc);
                                }}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 6,
                                  padding: '8px 14px',
                                  background: 'transparent',
                                  border: 'none',
                                  borderRadius: 6,
                                  cursor: 'pointer',
                                  fontSize: 14,
                                  fontFamily: 'Plus Jakarta Sans',
                                  fontWeight: '500',
                                  color: '#32302C',
                                  transition: 'background 0.2s ease'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.background = '#F5F5F5'}
                                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                              >
                                <svg width="16" height="16" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                                  <path d="M10.6263 4.1665C10.6263 3.82133 10.3465 3.5415 10.0013 3.5415C9.65612 3.5415 9.3763 3.82133 9.3763 4.1665V9.37484H4.16797C3.82279 9.37484 3.54297 9.65466 3.54297 9.99984C3.54297 10.345 3.82279 10.6248 4.16797 10.6248H9.3763V15.8332C9.3763 16.1783 9.65612 16.4582 10.0013 16.4582C10.3465 16.4582 10.6263 16.1783 10.6263 15.8332V10.6248H15.8346C16.1798 10.6248 16.4596 10.345 16.4596 9.99984C16.4596 9.65466 16.1798 9.37484 15.8346 9.37484H10.6263V4.1665Z" fill="#32302C"/>
                                </svg>
                                Category
                              </button>

                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setItemToDelete({ type: 'document', id: doc.id, name: doc.filename });
                                  setShowDeleteModal(true);
                                }}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 6,
                                  padding: '8px 14px',
                                  background: 'transparent',
                                  border: 'none',
                                  borderRadius: 6,
                                  cursor: 'pointer',
                                  fontSize: 14,
                                  fontFamily: 'Plus Jakarta Sans',
                                  fontWeight: '500',
                                  color: '#D92D20',
                                  transition: 'background 0.2s ease'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.background = '#FEF3F2'}
                                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                              >
                                <TrashCanIcon style={{width: 16, height: 16}} />
                                Delete
                              </button>
                            </div>
                          </div>
                        )}
                      </div>}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, minHeight: 200}}>
                <div style={{color: '#6C6B6E', fontSize: 16, fontFamily: 'Plus Jakarta Sans', fontWeight: '500'}}>No documents yet</div>
              </div>
            );
            })()}
          </div>
        </div>
      </div>

      {/* Create Category Modal */}
      <CreateCategoryModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onCreateCategory={handleCreateCategory}
      />

      {/* Notification Panel */}
      <NotificationPanel
        showNotificationsPopup={showNotificationsPopup}
        setShowNotificationsPopup={setShowNotificationsPopup}
      />

      {/* Category Selection Modal */}
      {showCategoryModal && (
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
            maxWidth: 400,
            paddingTop: 18,
            paddingBottom: 18,
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
              width: '100%',
              paddingLeft: 24,
              paddingRight: 24,
              justifyContent: 'space-between',
              alignItems: 'center',
              display: 'flex'
            }}>
              <div style={{
                color: '#32302C',
                fontSize: 18,
                fontFamily: 'Plus Jakarta Sans',
                fontWeight: '600',
                lineHeight: '25.20px'
              }}>
                Category
              </div>
              <button
                onClick={() => {
                  setShowCategoryModal(false);
                  setSelectedDocumentForCategory(null);
                  setSelectedCategoryId(null);
                }}
                style={{
                  width: 32,
                  height: 32,
                  background: '#F5F5F5',
                  border: 'none',
                  borderRadius: 8,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'background 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#E6E6EC'}
                onMouseLeave={(e) => e.currentTarget.style.background = '#F5F5F5'}
              >
                <CloseIcon style={{ width: 16, height: 16 }} />
              </button>
            </div>

            {/* Categories Grid */}
            <div style={{
              width: '100%',
              paddingLeft: 24,
              paddingRight: 24,
              paddingTop: 8,
              paddingBottom: 8,
              flexDirection: 'column',
              justifyContent: 'flex-start',
              alignItems: 'flex-start',
              gap: 12,
              display: 'flex'
            }}>
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 12,
                width: '100%'
              }}>
                {availableCategories.map((category) => (
                  <div
                    key={category.id}
                    onClick={() => setSelectedCategoryId(category.id)}
                    style={{
                      paddingLeft: 16,
                      paddingRight: 16,
                      paddingTop: 12,
                      paddingBottom: 12,
                      background: selectedCategoryId === category.id ? '#F5F5F5' : 'white',
                      borderRadius: 12,
                      border: selectedCategoryId === category.id ? '2px #32302C solid' : '1px #E6E6EC solid',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: 8,
                      display: 'flex',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      position: 'relative'
                    }}
                    onMouseEnter={(e) => {
                      if (selectedCategoryId !== category.id) {
                        e.currentTarget.style.background = '#F9FAFB';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (selectedCategoryId !== category.id) {
                        e.currentTarget.style.background = 'white';
                      }
                    }}
                  >
                    <div style={{
                      flex: 1,
                      color: '#32302C',
                      fontSize: 14,
                      fontFamily: 'Plus Jakarta Sans',
                      fontWeight: '600',
                      lineHeight: '19.60px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}>
                      {category.name}
                    </div>
                    {selectedCategoryId === category.id && (
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <circle cx="8" cy="8" r="8" fill="#32302C"/>
                        <path d="M4.5 8L7 10.5L11.5 6" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Buttons */}
            <div style={{
              width: '100%',
              paddingLeft: 24,
              paddingRight: 24,
              justifyContent: 'flex-start',
              alignItems: 'flex-start',
              gap: 10,
              display: 'flex'
            }}>
              <button
                onClick={() => {
                  setShowCategoryModal(false);
                  setSelectedDocumentForCategory(null);
                  setSelectedCategoryId(null);
                }}
                style={{
                  flex: 1,
                  paddingLeft: 18,
                  paddingRight: 18,
                  paddingTop: 10,
                  paddingBottom: 10,
                  background: 'white',
                  borderRadius: 100,
                  border: '1px #E6E6EC solid',
                  justifyContent: 'center',
                  alignItems: 'center',
                  gap: 6,
                  display: 'flex',
                  cursor: 'pointer',
                  transition: 'background 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#F5F5F5'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'white'}
              >
                <div style={{
                  color: '#32302C',
                  fontSize: 16,
                  fontFamily: 'Plus Jakarta Sans',
                  fontWeight: '500',
                  lineHeight: '24px'
                }}>
                  Cancel
                </div>
              </button>
              <button
                onClick={handleCategorySelection}
                disabled={!selectedCategoryId}
                style={{
                  flex: 1,
                  paddingLeft: 18,
                  paddingRight: 18,
                  paddingTop: 10,
                  paddingBottom: 10,
                  background: selectedCategoryId ? '#32302C' : '#E6E6EC',
                  borderRadius: 100,
                  border: 'none',
                  justifyContent: 'center',
                  alignItems: 'center',
                  gap: 6,
                  display: 'flex',
                  cursor: selectedCategoryId ? 'pointer' : 'not-allowed',
                  transition: 'opacity 0.2s'
                }}
                onMouseEnter={(e) => {
                  if (selectedCategoryId) {
                    e.currentTarget.style.opacity = '0.9';
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.opacity = '1';
                }}
              >
                <div style={{
                  color: selectedCategoryId ? 'white' : '#9CA3AF',
                  fontSize: 16,
                  fontFamily: 'Plus Jakarta Sans',
                  fontWeight: '500',
                  lineHeight: '24px'
                }}>
                  Add
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Category Modal */}
      <EditCategoryModal
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setEditingCategory(null);
        }}
        category={editingCategory}
        onUpdate={async () => {
          // Refresh to show updated emoji immediately
          await refreshAll();
        }}
      />

      <UploadModal
        isOpen={showUploadModal}
        onClose={() => {
          setShowUploadModal(false);
          setUploadCategoryId(null);
        }}
        categoryId={uploadCategoryId}
        onUploadComplete={() => {
          // No manual refresh needed - context auto-updates!
        }}
      />

      {/* Universal Upload Modal */}
      <UniversalUploadModal
        isOpen={showUniversalUploadModal}
        onClose={() => setShowUniversalUploadModal(false)}
        categoryId={null}
        onUploadComplete={() => {
          // No manual refresh needed - context auto-updates!
        }}
      />

      {/* Delete Confirmation Modal */}
      <DeleteConfirmationModal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setItemToDelete(null);
        }}
        onConfirm={() => {
          if (!itemToDelete) return;

          // Close modal IMMEDIATELY for instant feedback
          setShowDeleteModal(false);

          // Delete in background - context will update UI instantly
          (async () => {
            try {
              if (itemToDelete.type === 'category') {
                await handleDeleteCategory(itemToDelete.id);
              } else if (itemToDelete.type === 'document') {
                await handleDelete(itemToDelete.id);
              }
            } catch (error) {
              console.error('Delete error:', error);
            } finally {
              setItemToDelete(null);
            }
          })();
        }}
        itemName={itemToDelete?.name || ''}
      />

      {/* Rename Modal */}
      <RenameModal
        isOpen={showRenameModal}
        onClose={() => {
          setShowRenameModal(false);
          setItemToRename(null);
        }}
        onConfirm={handleRenameConfirm}
        itemName={itemToRename?.name}
        itemType={itemToRename?.type}
      />

    </div>
  );
};

export default DocumentsPage;
