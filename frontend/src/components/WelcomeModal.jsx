import React from 'react';
import { useNavigate } from 'react-router-dom';
import kodaLogoWhite from '../assets/logo-white.svg';

/**
 * Welcome Modal - Shows for unauthenticated users
 * Matches the "Need help finding something?" popup design
 */
const WelcomeModal = ({ isOpen, onClose }) => {
  const navigate = useNavigate();

  if (!isOpen) return null;

  const handleSignIn = () => {
    navigate('/login');
  };

  return (
    <>
      {/* Popup Container */}
      <div
        style={{
          position: 'fixed',
          bottom: 40,
          right: 40,
          zIndex: 1000,
          animation: 'welcomeSlideIn 0.3s ease-out'
        }}
      >
        {/* Main Button */}
        <button
          onClick={handleSignIn}
          style={{
            height: 60,
            paddingLeft: 4,
            paddingRight: 18,
            paddingTop: 8,
            paddingBottom: 8,
            background: '#171717',
            borderRadius: 100,
            justifyContent: 'flex-start',
            alignItems: 'center',
            display: 'inline-flex',
            border: 'none',
            cursor: 'pointer',
            transition: 'transform 0.2s ease, box-shadow 0.2s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 8px 24px rgba(0, 0, 0, 0.3)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = 'none';
          }}
        >
          <div style={{ justifyContent: 'flex-start', alignItems: 'center', gap: 0, display: 'flex' }}>
            <img
              src={kodaLogoWhite}
              alt="Koda"
              style={{
                width: 50,
                height: 50,
                flexShrink: 0
              }}
            />
            <div
              style={{
                color: 'white',
                fontSize: 15,
                fontFamily: 'Plus Jakarta Sans',
                fontWeight: '600',
                lineHeight: '20px',
                wordWrap: 'break-word'
              }}
            >
              Welcome to Koda's Universe
            </div>
          </div>
        </button>

        {/* Close Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          style={{
            position: 'absolute',
            right: -5,
            top: -5,
            width: 22,
            height: 22,
            background: '#171717',
            border: '2px solid white',
            borderRadius: 100,
            color: 'white',
            cursor: 'pointer',
            fontSize: 10,
            fontWeight: 'bold',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'background 0.2s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = '#2a2a2a';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = '#171717';
          }}
        >
          ✕
        </button>

        {/* Small decorative circle (matches help popup) */}
        <div style={{ width: 7, height: 7, right: 33, top: 0, position: 'absolute', background: '#171717', borderRadius: 9999 }} />
      </div>

      {/* Animation Keyframes */}
      <style>{`
        @keyframes welcomeSlideIn {
          from {
            opacity: 0;
            transform: translateY(20px) translateX(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0) translateX(0);
          }
        }
      `}</style>
    </>
  );
};

export default WelcomeModal;
