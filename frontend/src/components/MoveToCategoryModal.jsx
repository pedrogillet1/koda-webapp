import React, { useState, useEffect } from 'react';
import { X, Tag, Search } from 'lucide-react';
import axios from 'axios';

/**
 * Modal for selecting a category to move documents to
 * Features category list with emoji and search
 */
export default function MoveToCategoryModal({ isOpen, onClose, onMove, selectedCount }) {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(null);

  useEffect(() => {
    if (isOpen) {
      fetchCategories();
    }
  }, [isOpen]);

  const fetchCategories = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/categories');
      setCategories(response.data.categories || []);
    } catch (error) {
      console.error('Error fetching categories:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleMove = () => {
    if (selectedCategory) {
      onMove(selectedCategory.id);
      onClose();
      setSelectedCategory(null);
      setSearchQuery('');
    }
  };

  const filterCategories = (categories, query) => {
    if (!query.trim()) return categories;

    const lowerQuery = query.toLowerCase();
    return categories.filter(category =>
      category.name.toLowerCase().includes(lowerQuery)
    );
  };

  if (!isOpen) return null;

  const filteredCategories = filterCategories(categories, searchQuery);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900">
              Move {selectedCount} {selectedCount === 1 ? 'document' : 'documents'} to category
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
              placeholder="Search categories..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Category List */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : filteredCategories.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              {searchQuery ? 'No categories found' : 'No categories available'}
            </div>
          ) : (
            <div className="space-y-2">
              {filteredCategories.map(category => (
                <div
                  key={category.id}
                  onClick={() => setSelectedCategory(category)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg cursor-pointer transition-all ${
                    selectedCategory?.id === category.id
                      ? 'bg-blue-100 border-2 border-blue-500'
                      : 'bg-gray-50 border-2 border-transparent hover:bg-gray-100'
                  }`}
                >
                  {/* Category Emoji */}
                  {category.emoji ? (
                    <span className="text-2xl">{category.emoji}</span>
                  ) : (
                    <div className="w-8 h-8 bg-gray-200 rounded-lg flex items-center justify-center">
                      <Tag size={18} className="text-gray-500" />
                    </div>
                  )}

                  {/* Category Info */}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-gray-900 truncate">
                      {category.name}
                    </h3>
                    {category.description && (
                      <p className="text-sm text-gray-500 truncate">
                        {category.description}
                      </p>
                    )}
                  </div>

                  {/* Document Count */}
                  {category._count?.documents !== undefined && (
                    <div className="flex-shrink-0">
                      <span className="px-2 py-1 bg-white text-gray-600 text-xs rounded-full border border-gray-200">
                        {category._count.documents} docs
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 flex items-center justify-between">
          <div className="text-sm text-gray-600">
            {selectedCategory ? (
              <>
                Selected:
                <span className="font-medium ml-1">
                  {selectedCategory.emoji && `${selectedCategory.emoji} `}
                  {selectedCategory.name}
                </span>
              </>
            ) : (
              'Select a category'
            )}
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleMove}
              disabled={!selectedCategory}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                selectedCategory
                  ? 'bg-purple-600 text-white hover:bg-purple-700'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              Move
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
