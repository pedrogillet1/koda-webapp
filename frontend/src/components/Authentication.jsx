import React from 'react';
import { useNavigate } from 'react-router-dom';
import backArrow from '../assets/arrow-narrow-left.svg';

const Authentication = () => {
  const navigate = useNavigate();

  return (
    <div style={{width: '100%', minHeight: '100vh', padding: '20px', background: 'white', display: 'flex', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'center'}}>
      <div onClick={() => navigate(-1)} style={{alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', marginBottom: 'auto'}}>
        <img src={backArrow} alt="Back" />
        <div style={{color: '#181818', fontSize: 14, fontFamily: 'Plus Jakarta Sans', fontWeight: '600'}}>Back</div>
      </div>

      <div style={{width: '100%', maxWidth: 450, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 32, flexGrow: 1, justifyContent: 'center'}}>
        <div style={{alignSelf: 'stretch', textAlign: 'center', flexDirection: 'column', gap: 12}}>
          <div style={{color: '#32302C', fontSize: 30, fontFamily: 'Plus Jakarta Sans', fontWeight: '600'}}>Authenticate your account</div>
          <div style={{color: '#6C6B6E', fontSize: 16, fontFamily: 'Plus Jakarta Sans', fontWeight: '500'}}>Choose how you want to verify your account.</div>
        </div>

        <div style={{alignSelf: 'stretch', display: 'flex', flexDirection: 'column', gap: 16}}>
          <button
            onClick={() => navigate('/verify-email')}
            style={{
              height: 52,
              background: '#181818',
              color: 'white',
              borderRadius: 14,
              border: 'none',
              fontSize: 16,
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8
            }}
          >
            Verify via Email
          </button>

          <button
            onClick={() => navigate('/phone-number')}
            style={{
              height: 52,
              background: '#F5F5F5',
              color: '#181818',
              borderRadius: 14,
              border: '1px solid #E6E6EC',
              fontSize: 16,
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8
            }}
          >
            Verify via Phone
          </button>
        </div>
      </div>
      <div style={{height: 52}} />
    </div>
  );
};

export default Authentication;
