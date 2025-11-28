import React from 'react';
import { ReactComponent as BellIcon } from '../assets/Bell-1.svg';
import { ReactComponent as CheckDoubleIcon } from '../assets/check-double_svgrepo.com.svg';

const NotificationPanel = ({ showNotificationsPopup, setShowNotificationsPopup }) => {
  if (!showNotificationsPopup) return null;

  return (
    <>
      {/* Dark Overlay */}
      <div
        onClick={() => setShowNotificationsPopup(false)}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          background: 'linear-gradient(180deg, rgba(17, 19, 21, 0.50) 0%, rgba(17, 19, 21, 0.90) 100%)',
          zIndex: 999
        }}
      />

      {/* Notifications Panel */}
      <div style={{
        width: 440,
        height: 824,
        position: 'fixed',
        left: 84,
        top: 68,
        background: 'white',
        borderRadius: 14,
        zIndex: 1000,
        paddingLeft: 20,
        paddingRight: 20,
        paddingTop: 32,
        paddingBottom: 32,
        overflow: 'auto',
        flexDirection: 'column',
        justifyContent: 'flex-start',
        alignItems: 'center',
        gap: 24,
        display: 'flex',
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.12)'
      }}>
        {/* Header with tabs and close button */}
        <div style={{ alignSelf: 'stretch', justifyContent: 'space-between', alignItems: 'center', gap: 10, display: 'flex' }}>
          <div style={{ flex: '1 1 0', justifyContent: 'flex-start', alignItems: 'center', gap: 8, display: 'flex' }}>
            <div style={{ height: 36, paddingLeft: 18, paddingRight: 18, paddingTop: 10, paddingBottom: 10, background: '#F5F5F5', borderRadius: 100, outline: '1px #E6E6EC solid', outlineOffset: '-1px', justifyContent: 'center', alignItems: 'center', gap: 8, display: 'flex' }}>
              <div style={{ color: '#32302C', fontSize: 14, fontFamily: 'Plus Jakarta Sans', fontWeight: '600', lineHeight: '19.60px' }}>All (0)</div>
            </div>
            <div style={{ paddingLeft: 12, paddingRight: 12, paddingTop: 8, paddingBottom: 8, borderRadius: 6, justifyContent: 'center', alignItems: 'center', gap: 8, display: 'flex', cursor: 'pointer' }}>
              <div style={{ color: '#6C6B6E', fontSize: 14, fontFamily: 'Plus Jakarta Sans', fontWeight: '600', lineHeight: '19.60px' }}>Unread</div>
            </div>
            <div style={{ paddingLeft: 12, paddingRight: 12, paddingTop: 8, paddingBottom: 8, borderRadius: 6, justifyContent: 'center', alignItems: 'center', gap: 8, display: 'flex', cursor: 'pointer' }}>
              <div style={{ color: '#6C6B6E', fontSize: 14, fontFamily: 'Plus Jakarta Sans', fontWeight: '600', lineHeight: '19.60px' }}>Read</div>
            </div>
          </div>
          <div
            onClick={() => setShowNotificationsPopup(false)}
            style={{ width: 52, height: 52, padding: 8, background: '#171717', borderRadius: 100, justifyContent: 'center', alignItems: 'center', display: 'flex', cursor: 'pointer' }}
          >
            <CheckDoubleIcon style={{ width: 20, height: 20 }} />
          </div>
        </div>

        {/* No notifications message */}
        <div style={{ alignSelf: 'stretch', flex: 1, flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: 16, display: 'flex' }}>
          <BellIcon style={{ width: 64, height: 64, opacity: 0.3 }} />
          <div style={{ color: '#6C6B6E', fontSize: 16, fontFamily: 'Plus Jakarta Sans', fontWeight: '600', textAlign: 'center' }}>No notifications yet</div>
          <div style={{ color: '#B9B9B9', fontSize: 14, fontFamily: 'Plus Jakarta Sans', fontWeight: '500', textAlign: 'center', maxWidth: 300 }}>
            You're all caught up! Check back later for updates on your documents and account.
          </div>
        </div>
      </div>
    </>
  );
};

export default NotificationPanel;
