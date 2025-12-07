import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';

/**
 * Custom hook to manage sidebar expand/collapse state
 *
 * Features:
 * - localStorage persistence per user
 * - First session detection (default expanded)
 * - Multi-tab synchronization
 * - Responsive width calculation
 * - Error handling for localStorage
 *
 * @returns {Object} Sidebar state and controls
 */
export const useSidebarState = () => {
  const { user } = useAuth();

  // Generate user-specific localStorage key
  const getStorageKey = useCallback(() => {
    return user?.id ? `koda_sidebar_state_${user.id}` : 'koda_sidebar_state_guest';
  }, [user?.id]);

  // Calculate responsive widths based on viewport
  const getResponsiveWidths = useCallback(() => {
    const width = window.innerWidth;

    if (width >= 1921) {
      // Large Desktop (4K, ultrawide)
      return { expanded: 200, collapsed: 80 };
    } else if (width >= 1367) {
      // Medium Desktop (1440p, 1080p)
      return { expanded: 180, collapsed: 72 };
    } else {
      // Small Desktop (1024-1366px)
      return { expanded: 160, collapsed: 64 };
    }
  }, []);

  // Initialize state from localStorage or default to expanded
  const [isExpanded, setIsExpanded] = useState(() => {
    try {
      const stored = localStorage.getItem(getStorageKey());
      // If no stored value, default to expanded (first session)
      return stored === null ? true : stored === 'true';
    } catch (error) {
      console.warn('Failed to read sidebar state from localStorage:', error);
      return true; // Default to expanded on error
    }
  });

  const [widths, setWidths] = useState(getResponsiveWidths);

  // Save state to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem(getStorageKey(), String(isExpanded));
    } catch (error) {
      console.warn('Failed to save sidebar state to localStorage:', error);
      // Fallback to sessionStorage if localStorage fails
      try {
        sessionStorage.setItem(getStorageKey(), String(isExpanded));
      } catch (sessionError) {
        console.error('Failed to save sidebar state to sessionStorage:', sessionError);
      }
    }
  }, [isExpanded, getStorageKey]);

  // Sync state across tabs using storage event
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === getStorageKey() && e.newValue !== null) {
        setIsExpanded(e.newValue === 'true');
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [getStorageKey]);

  // Update widths on window resize
  useEffect(() => {
    const handleResize = () => {
      setWidths(getResponsiveWidths());
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [getResponsiveWidths]);

  // Listen for keyboard shortcut event from ChatInterface
  useEffect(() => {
    const handleToggleEvent = () => {
      setIsExpanded(prev => !prev);
    };

    window.addEventListener('toggleSidebar', handleToggleEvent);
    return () => window.removeEventListener('toggleSidebar', handleToggleEvent);
  }, []);

  // Toggle function
  const toggle = useCallback(() => {
    setIsExpanded(prev => !prev);
  }, []);

  // Get current width
  const currentWidth = isExpanded ? widths.expanded : widths.collapsed;

  return {
    isExpanded,
    toggle,
    currentWidth,
    widths,
  };
};

export default useSidebarState;
