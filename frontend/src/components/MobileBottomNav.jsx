import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useIsMobile } from '../hooks/useIsMobile';

// Import icons - outline only
import { ReactComponent as HouseIcon } from '../assets/Untitled design (10) 1.svg';
import { ReactComponent as FolderIcon } from '../assets/Folder.svg';
import { ReactComponent as UploadIcon } from '../assets/Logout-white.svg';
import { ReactComponent as MessageIcon } from '../assets/Message circle.svg';
import { ReactComponent as SettingsIcon } from '../assets/Settings.svg';

/**
 * Mobile Bottom Navigation Bar
 * Only renders on mobile devices (max-width: 768px)
 * Fixed at bottom of screen with safe area insets
 */
const MobileBottomNav = () => {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);

  // ✅ MOBILE KEYBOARD DETECTION: Hide nav when keyboard opens
  useEffect(() => {
    if (!isMobile) return;

    const handleResize = () => {
      // Use visualViewport API for accurate keyboard detection on iOS/Android
      if (window.visualViewport) {
        const viewportHeight = window.visualViewport.height;
        const windowHeight = window.innerHeight;
        // If viewport is significantly smaller than window, keyboard is open
        // Threshold of 150px to avoid false positives from address bar changes
        setIsKeyboardOpen(windowHeight - viewportHeight > 150);
      }
    };

    // Also detect focus/blur on input for more reliable detection
    const handleFocus = () => setIsKeyboardOpen(true);
    const handleBlur = () => {
      // Small delay to allow visualViewport to update
      setTimeout(() => {
        if (window.visualViewport) {
          const viewportHeight = window.visualViewport.height;
          const windowHeight = window.innerHeight;
          setIsKeyboardOpen(windowHeight - viewportHeight > 150);
        } else {
          setIsKeyboardOpen(false);
        }
      }, 100);
    };

    // Listen to visualViewport resize events
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleResize);
    }

    // Listen to input focus/blur
    const inputs = document.querySelectorAll('input, textarea');
    inputs.forEach(input => {
      input.addEventListener('focus', handleFocus);
      input.addEventListener('blur', handleBlur);
    });

    return () => {
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleResize);
      }
      inputs.forEach(input => {
        input.removeEventListener('focus', handleFocus);
        input.removeEventListener('blur', handleBlur);
      });
    };
  }, [isMobile]);

  // Don't render on desktop or when keyboard is open
  if (!isMobile || isKeyboardOpen) return null;

  // Navigation items configuration - 5 items: Home, Documents, Upload, Chat, Settings
  // Using outline icons only (no filled variants)
  const navItems = [
    {
      id: 'home',
      path: '/home',
      label: t('nav.home'),
      icon: HouseIcon,
      matchPaths: ['/home']
    },
    {
      id: 'documents',
      path: '/documents',
      label: t('nav.documents'),
      icon: FolderIcon,
      matchPaths: ['/documents', '/folder', '/filetype', '/category']
    },
    {
      id: 'upload',
      path: '/upload-hub',
      label: t('nav.upload'),
      icon: UploadIcon,
      matchPaths: ['/upload-hub', '/upload']
    },
    {
      id: 'chat',
      path: '/chat',
      label: t('nav.chat'),
      icon: MessageIcon,
      matchPaths: ['/chat', '/']
    },
    {
      id: 'settings',
      path: '/settings',
      label: t('nav.settings'),
      icon: SettingsIcon,
      matchPaths: ['/settings']
    }
  ];

  // Check if current path matches any of the item's paths
  const isActive = (item) => {
    return item.matchPaths.some(path => location.pathname.startsWith(path));
  };

  // Handle navigation
  const handleNavigate = (path) => {
    navigate(path);
  };

  return (
    <nav
      className="mobile-bottom-nav"
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        width: '100%',
        height: 'auto',
        backgroundColor: '#181818',
        borderTop: '1px solid rgba(255, 255, 255, 0.1)',
        display: 'flex',
        justifyContent: 'space-around',
        alignItems: 'center',
        zIndex: 1000,
        paddingBottom: 'max(env(safe-area-inset-bottom), 12px)',
        paddingTop: '8px'
      }}
    >
      {navItems.map((item) => {
        const active = isActive(item);
        const Icon = item.icon;

        return (
          <div
            key={item.id}
            onClick={() => handleNavigate(item.path)}
            className={`mobile-bottom-nav-item ${active ? 'active' : ''}`}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px',
              padding: '8px 12px',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              flex: 1
            }}
          >
            <div
              className="mobile-bottom-nav-item-icon"
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                background: active ? 'rgba(255, 255, 255, 0.15)' : 'transparent',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'background 0.2s ease'
              }}
            >
              <Icon
                style={{
                  width: '20px',
                  height: '20px',
                  color: '#FFFFFF'
                }}
              />
            </div>
            <span
              className="mobile-bottom-nav-item-label"
              style={{
                fontSize: '11px',
                fontWeight: '500',
                fontFamily: 'Plus Jakarta Sans, sans-serif',
                whiteSpace: 'nowrap',
                color: '#FFFFFF'
              }}
            >
              {item.label}
            </span>
          </div>
        );
      })}
    </nav>
  );
};

export default MobileBottomNav;
