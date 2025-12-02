import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useIsMobile } from '../hooks/useIsMobile';

// Import icons - matching desktop sidebar
import { ReactComponent as HouseIcon } from '../assets/House.svg';
import { ReactComponent as HouseFilledIcon } from '../assets/House-filled.svg';
import { ReactComponent as Folder1Icon } from '../assets/Folder1.svg';
import { ReactComponent as Folder1FilledIcon } from '../assets/Folder1-filled.svg';
import { ReactComponent as UploadIcon } from '../assets/upload.svg';
import { ReactComponent as MessageIcon } from '../assets/Message circle.svg';
import { ReactComponent as MessageFilledIcon } from '../assets/Message circle - filled.svg';
import { ReactComponent as SettingsIcon } from '../assets/Settings.svg';
import { ReactComponent as SettingsFilledIcon } from '../assets/Settings-filled.svg';

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

  // Don't render on desktop
  if (!isMobile) return null;

  // Navigation items configuration - 5 items: Home, Documents, Upload, Chat, Settings
  const navItems = [
    {
      id: 'home',
      path: '/home',
      label: t('nav.home'),
      icon: HouseIcon,
      iconFilled: HouseFilledIcon,
      matchPaths: ['/home']
    },
    {
      id: 'documents',
      path: '/documents',
      label: t('nav.documents'),
      icon: Folder1Icon,
      iconFilled: Folder1FilledIcon,
      matchPaths: ['/documents', '/folder', '/filetype', '/category']
    },
    {
      id: 'upload',
      path: '/upload-hub',
      label: t('nav.upload'),
      icon: UploadIcon,
      iconFilled: UploadIcon,
      matchPaths: ['/upload-hub', '/upload']
    },
    {
      id: 'chat',
      path: '/chat',
      label: t('nav.chat'),
      icon: MessageIcon,
      iconFilled: MessageFilledIcon,
      matchPaths: ['/chat', '/']
    },
    {
      id: 'settings',
      path: '/settings',
      label: t('nav.settings'),
      icon: SettingsIcon,
      iconFilled: SettingsFilledIcon,
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
        const Icon = active ? item.iconFilled : item.icon;

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
                width: '24px',
                height: '24px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <Icon
                style={{
                  width: '24px',
                  height: '24px',
                  fill: active ? '#FFFFFF' : '#6C6B6E',
                  color: active ? '#FFFFFF' : '#6C6B6E'
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
                color: active ? '#FFFFFF' : '#6C6B6E'
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
