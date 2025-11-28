import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import kodaLogoWhite from '../assets/logo-white.svg';

/**
 * Welcome Popup - Non-blocking popup for unauthenticated users
 * User can explore pages but popup encourages signup
 * Dismissible with X button, reappears on refresh
 */
const WelcomePopup = ({ isOpen }) => {
  const navigate = useNavigate();
  const [isDismissed, setIsDismissed] = useState(false);

  if (!isOpen || isDismissed) return null;

  const handleJoinClick = () => {
    navigate('/signup');
  };

  const handleClose = (e) => {
    e.stopPropagation();
    setIsDismissed(true);
  };

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 40,
        right: 40,
        width: 360,
        padding: 20,
        background: '#171717',
        borderRadius: 16,
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.12)',
        zIndex: 998,
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        cursor: 'pointer',
        transition: 'all 0.3s ease',
        border: '1px solid #E6E6EC',
        animation: 'welcomeSlideIn 0.3s ease-out'
      }}
      onClick={handleJoinClick}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-4px)';
        e.currentTarget.style.boxShadow = '0 12px 32px rgba(0, 0, 0, 0.16)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = '0 8px 24px rgba(0, 0, 0, 0.12)';
      }}
    >
      {/* Close Button */}
      <button
        onClick={handleClose}
        style={{
          position: 'absolute',
          top: 12,
          right: 12,
          width: 32,
          height: 32,
          background: 'transparent',
          border: 'none',
          color: '#FFFFFF',
          fontSize: 20,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 0.2s ease'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.opacity = '0.7';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.opacity = '1';
        }}
      >
        ✕
      </button>

      {/* Logo */}
      <div
        style={{
          width: 48,
          height: 48,
          padding: 8,
          background: 'white',
          borderRadius: 100,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        <img
          src={kodaLogoWhite}
          alt="Koda"
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            filter: 'invert(1)'
          }}
        />
      </div>

      {/* Content */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div
          style={{
            color: 'white',
            fontSize: 18,
            fontFamily: 'Plus Jakarta Sans',
            fontWeight: '700',
            lineHeight: '26px'
          }}
        >
          Join Koda's Universe
        </div>
        <div
          style={{
            color: '#D0D0D0',
            fontSize: 14,
            fontFamily: 'Plus Jakarta Sans',
            fontWeight: '500',
            lineHeight: '20px'
          }}
        >
          Sign up to unlock the full power of intelligent document management
        </div>
      </div>

      {/* CTA Button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          handleJoinClick();
        }}
        style={{
          width: '100%',
          padding: '12px 16px',
          background: 'white',
          color: '#171717',
          border: 'none',
          borderRadius: 12,
          fontSize: 14,
          fontFamily: 'Plus Jakarta Sans',
          fontWeight: '700',
          cursor: 'pointer',
          transition: 'all 0.2s ease'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = '#F5F5F5';
          e.currentTarget.style.transform = 'scale(1.02)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'white';
          e.currentTarget.style.transform = 'scale(1)';
        }}
      >
        Sign Up Now
      </button>

      {/* Animation Keyframes */}
      <style>{`
        @keyframes welcomeSlideIn {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
};

export default WelcomePopup;
