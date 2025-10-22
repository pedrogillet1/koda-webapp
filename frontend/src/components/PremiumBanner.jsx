import React from 'react';
import logoCopy from '../assets/Logo copy.svg';

const PremiumBanner = () => {
  return (
    <div style={{
      alignSelf: 'stretch',
      padding: '60px',
      position: 'relative',
      background: '#181818',
      overflow: 'hidden',
      borderRadius: 20,
      display: 'flex',
      justifyContent: 'flex-start',
      alignItems: 'center',
      minHeight: 200
    }}>
      {/* Small scattered stars */}
      <div style={{ position: 'absolute', top: '20%', left: '60%', width: 3, height: 3, background: 'white', borderRadius: '50%', opacity: 0.5 }} />
      <div style={{ position: 'absolute', top: '40%', right: '15%', width: 3, height: 3, background: 'white', borderRadius: '50%', opacity: 0.5 }} />
      <div style={{ position: 'absolute', bottom: '35%', left: '70%', width: 3, height: 3, background: 'white', borderRadius: '50%', opacity: 0.5 }} />
      <div style={{ position: 'absolute', top: '65%', right: '25%', width: 3, height: 3, background: 'white', borderRadius: '50%', opacity: 0.5 }} />
      <div style={{ position: 'absolute', top: '25%', left: '85%', width: 3, height: 3, background: 'white', borderRadius: '50%', opacity: 0.4 }} />
      <div style={{ position: 'absolute', bottom: '45%', right: '35%', width: 3, height: 3, background: 'white', borderRadius: '50%', opacity: 0.4 }} />
      <div style={{ position: 'absolute', top: '55%', left: '65%', width: 3, height: 3, background: 'white', borderRadius: '50%', opacity: 0.4 }} />
      <div style={{ position: 'absolute', bottom: '25%', right: '45%', width: 3, height: 3, background: 'white', borderRadius: '50%', opacity: 0.3 }} />

      {/* Large sparkle top right */}
      <div style={{
        position: 'absolute',
        top: 30,
        right: 60,
        width: 120,
        height: 120,
        opacity: 0.25
      }}>
        <svg viewBox="0 0 100 100" style={{ width: '100%', height: '100%' }}>
          <path
            d="M50 0 L55 45 L100 50 L55 55 L50 100 L45 55 L0 50 L45 45 Z"
            fill="white"
          />
        </svg>
      </div>

      {/* Medium sparkle middle right */}
      <div style={{
        position: 'absolute',
        top: '50%',
        right: '20%',
        width: 60,
        height: 60,
        opacity: 0.2
      }}>
        <svg viewBox="0 0 100 100" style={{ width: '100%', height: '100%' }}>
          <path
            d="M50 0 L55 45 L100 50 L55 55 L50 100 L45 55 L0 50 L45 45 Z"
            fill="white"
          />
        </svg>
      </div>

      {/* KODA Logo on LEFT side - LARGE */}
      <div style={{
        position: 'relative',
        zIndex: 10,
        display: 'flex',
        justifyContent: 'flex-start',
        alignItems: 'center',
        paddingLeft: 0
      }}>
        <img
          src={logoCopy}
          alt="KODA"
          style={{
            height: 140,
            width: 'auto',
            objectFit: 'contain'
          }}
        />
      </div>
    </div>
  );
};

export default PremiumBanner;
