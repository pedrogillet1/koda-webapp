/**
 * useSemanticSearch Hook
 * React hook for semantic search with debouncing
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { semanticSearch } from '../services/searchService';

/**
 * Custom hook for semantic search functionality
 * @param {number} debounceMs - Debounce delay in milliseconds (default: 300)
 * @returns {Object} - Search state and search function
 */
export const useSemanticSearch = (debounceMs = 300) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState(null);
  const debounceTimeout = useRef(null);

  /**
   * Perform semantic search
   */
  const performSearch = useCallback(async (searchQuery) => {
    if (!searchQuery || searchQuery.trim().length < 2) {
      setResults([]);
      setError(null);
      return;
    }

    setIsSearching(true);
    setError(null);

    try {
      const response = await semanticSearch(searchQuery.trim());
      setResults(response.results || []);
    } catch (err) {
      console.error('[SEARCH] Error:', err);
      setError(err.response?.data?.error || 'Search failed');
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  /**
   * Debounced search trigger
   */
  useEffect(() => {
    // Clear previous timeout
    if (debounceTimeout.current) {
      clearTimeout(debounceTimeout.current);
    }

    // Set new timeout
    if (query) {
      debounceTimeout.current = setTimeout(() => {
        performSearch(query);
      }, debounceMs);
    } else {
      // Clear results if query is empty
      setResults([]);
      setError(null);
    }

    // Cleanup on unmount
    return () => {
      if (debounceTimeout.current) {
        clearTimeout(debounceTimeout.current);
      }
    };
  }, [query, debounceMs, performSearch]);

  /**
   * Clear search results and reset state
   */
  const clearSearch = useCallback(() => {
    setQuery('');
    setResults([]);
    setError(null);
    setIsSearching(false);
  }, []);

  return {
    query,
    setQuery,
    results,
    isSearching,
    error,
    clearSearch
  };
};

export default useSemanticSearch;
