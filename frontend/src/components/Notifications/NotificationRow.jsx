import React from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * NotificationRow - Single notification in the center popup
 * Icon, title, text, timestamp
 * Unread badge/accent
 * Click to mark as read + navigate
 */
const NotificationRow = ({ notification, onMarkAsRead }) => {
  const navigate = useNavigate();

  // Format timestamp
  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  };

  // Type-based styling
  const getTypeStyles = () => {
    switch (notification.type) {
      case 'error':
        return { iconBg: '#FEE2E2', iconColor: '#DC2626' };
      case 'warning':
        return { iconBg: '#FEF3C7', iconColor: '#D97706' };
      case 'security':
        return { iconBg: '#4F46E5', iconColor: '#4F46E5' };
      default:
        return { iconBg: '#DBEAFE', iconColor: '#2563EB' };
    }
  };

  const typeStyles = getTypeStyles();

  // Type icons
  const getIcon = () => {
    switch (notification.type) {
      case 'error':
        return (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="12" cy="12" r="10" stroke={typeStyles.iconColor} strokeWidth="2"/>
            <path d="M12 8V12M12 16H12.01" stroke={typeStyles.iconColor} strokeWidth="2" strokeLinecap="round"/>
          </svg>
        );
      case 'warning':
        return (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 9V13M12 17H12.01M10.29 3.86L1.82 18C1.64 18.3 1.55 18.64 1.55 19C1.55 19.36 1.64 19.7 1.82 20C2 20.3 2.26 20.56 2.56 20.74C2.86 20.92 3.2 21.01 3.56 21.01H20.44C20.8 21.01 21.14 20.92 21.44 20.74C21.74 20.56 22 20.3 22.18 20C22.36 19.7 22.45 19.36 22.45 19C22.45 18.64 22.36 18.3 22.18 18L13.71 3.86C13.53 3.56 13.27 3.3 12.97 3.12C12.67 2.94 12.33 2.85 11.97 2.85C11.61 2.85 11.27 2.94 10.97 3.12C10.67 3.3 10.41 3.56 10.29 3.86Z" stroke={typeStyles.iconColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        );
      case 'security':
        return (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 22C12 22 20 18 20 12V5L12 2L4 5V12C4 18 12 22 12 22Z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M9 12L11 14L15 10" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        );
      default:
        return (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="12" cy="12" r="10" stroke={typeStyles.iconColor} strokeWidth="2"/>
            <path d="M12 16V12M12 8H12.01" stroke={typeStyles.iconColor} strokeWidth="2" strokeLinecap="round"/>
          </svg>
        );
    }
  };

  // Handle click
  const handleClick = () => {
    onMarkAsRead(notification.id);
    if (notification.action?.type === 'navigate' && notification.action?.target) {
      navigate(notification.action.target);
    }
  };

  return (
    <div
      onClick={handleClick}
      style={{
        padding: '14px 16px',
        display: 'flex',
        alignItems: 'flex-start',
        gap: 12,
        cursor: 'pointer',
        background: notification.isRead ? 'white' : '#FAFAFA',
        borderBottom: '1px solid #E6E6EC',
        transition: 'background 0.15s ease',
        position: 'relative'
      }}
      onMouseEnter={(e) => e.currentTarget.style.background = '#F7F7F9'}
      onMouseLeave={(e) => e.currentTarget.style.background = notification.isRead ? 'white' : '#FAFAFA'}
    >
      {/* Unread indicator */}
      {!notification.isRead && (
        <div style={{
          position: 'absolute',
          left: 6,
          top: '50%',
          transform: 'translateY(-50%)',
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: '#3B82F6'
        }} />
      )}

      {/* Icon */}
      <div style={{
        width: 32,
        height: 32,
        borderRadius: 8,
        background: typeStyles.iconBg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        marginLeft: !notification.isRead ? 8 : 0
      }}>
        {getIcon()}
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          color: '#171717',
          fontSize: 14,
          fontFamily: 'Plus Jakarta Sans',
          fontWeight: notification.isRead ? '500' : '600',
          lineHeight: '20px',
          marginBottom: 2
        }}>
          {notification.title}
        </div>
        <div style={{
          color: '#6C6B6E',
          fontSize: 13,
          fontFamily: 'Plus Jakarta Sans',
          fontWeight: '400',
          lineHeight: '18px',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap'
        }}>
          {notification.text}
        </div>
      </div>

      {/* Timestamp */}
      <div style={{
        color: '#9CA3AF',
        fontSize: 12,
        fontFamily: 'Plus Jakarta Sans',
        fontWeight: '400',
        whiteSpace: 'nowrap',
        flexShrink: 0
      }}>
        {formatTimestamp(notification.timestamp)}
      </div>
    </div>
  );
};

export default NotificationRow;
